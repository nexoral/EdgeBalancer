import { Gateway } from '../../../models/Gateway';
import { generateGatewayWorkerCode } from '../../../services/workerGenerator';
import {
  getActiveWorkerDeployment,
  uploadWorkerVersion,
  createWorkerDeployment,
  pruneWorkerHistory,
} from '../../../services/workerDeployment';
import { attachDomainToWorker, detachDomainFromWorker } from '../../../services/workerDomain';
import { getCloudflareCredentialsForUser } from '../services/credentials.service';
import { isNameUpdateAttempt } from '../services/validation.service';
import { toHostname, assertHostnameAvailable } from '../../loadbalancer/services/hostname.service';
import { provisionIpDnsChanges, deleteIpDnsRecord } from '../../../services/workerDns';
import { formatGateway } from '../services/formatter.service';
import { buildGatewayWorkerConfig, encryptJwtSecret, resolveJwtSecret } from '../services/config-builder.service';
import { createSession, deactivateSessionsForLoadBalancer } from '../../../services/sessionService';
import type { RequestCancellation } from '../../../utils/requestCancellation';
import type { CreateGatewayInput } from '../types/gateway.types';

export async function updateGatewayOrchestrator(params: {
  userId: string;
  userEmail: string | null;
  gatewayId: string;
  input: CreateGatewayInput;
  cancellation: RequestCancellation;
}) {
  const { userId, userEmail, gatewayId, input, cancellation } = params;

  const gateway = await Gateway.findById(gatewayId);
  if (!gateway) {
    const e = new Error('Gateway not found');
    (e as any).statusCode = 404;
    throw e;
  }
  if (gateway.userId.toString() !== userId) {
    const e = new Error('You do not have permission to update this gateway');
    (e as any).statusCode = 403;
    throw e;
  }
  if (isNameUpdateAttempt(input.name, gateway.name)) {
    const e = new Error('Gateway name cannot be changed after creation');
    (e as any).statusCode = 400;
    throw e;
  }

  const previousHostname = toHostname(gateway.domain, gateway.subdomain);
  const previousWorkerCode = await gatewayWorkerCodeFor(gateway);

  const { accountId, apiToken, isOAuth } = await getCloudflareCredentialsForUser(userId);
  const nextHostname = toHostname(input.domain, input.subdomain);
  await assertHostnameAvailable({ userId, accountId, apiToken, hostname: nextHostname, zoneId: input.zoneId, excludeLoadBalancerId: gatewayId });
  await cancellation.throwIfCancelled();

  const hostnameValueChanged = nextHostname !== previousHostname;
  const hostnameChanged = hostnameValueChanged || input.zoneId !== gateway.zoneId;

  const {
    resolvedOrigins: resolvedUpstreams,
    ipOriginRecords: nextIpOriginRecords,
    createdRecordIds: newDnsRecordIds,
    obsoleteRecords: obsoleteDnsRecords,
  } = await provisionIpDnsChanges({
    newOrigins: input.upstreams as any,
    existingRecords: (gateway as any).ipOriginRecords ?? [],
    scriptName: gateway.scriptName,
    domain: input.domain,
    zoneId: input.zoneId,
    apiToken,
    isOAuth,
  } as any);
  await cancellation.throwIfCancelled();

  const jwtSecret = input.jwtAuth?.secret ?? resolveJwtSecret(gateway.jwtAuth);
  let jwtDoc: any;
  if (input.jwtAuth?.enabled === true && jwtSecret) {
    const enc = encryptJwtSecret(jwtSecret);
    jwtDoc = {
      enabled: true,
      headerName: input.jwtAuth.headerName ?? 'Authorization',
      algorithms: input.jwtAuth.algorithms ?? ['HS256'],
      issuer: input.jwtAuth.issuer ?? null,
      secretEncrypted: enc.secretEncrypted, secretIv: enc.secretIv, secretTag: enc.secretTag,
      rbacRules: input.jwtAuth.rbacRules ?? gateway.jwtAuth?.rbacRules ?? [],
      injectHeaders: input.jwtAuth.injectHeaders ?? gateway.jwtAuth?.injectHeaders ?? false,
    };
  } else if (input.jwtAuth?.enabled === false) {
    jwtDoc = { enabled: false, headerName: 'Authorization', algorithms: ['HS256'], issuer: null, secretEncrypted: null, secretIv: null, secretTag: null, rbacRules: [], injectHeaders: false };
  } else {
    jwtDoc = {
      ...gateway.jwtAuth,
      rbacRules: input.jwtAuth?.rbacRules ?? gateway.jwtAuth?.rbacRules ?? [],
      injectHeaders: input.jwtAuth?.injectHeaders ?? gateway.jwtAuth?.injectHeaders ?? false,
    };
  }

  const rateLimit = input.rateLimitEnabled && input.rateLimitRequestsPerMinute
    ? { enabled: true as const, requestsPerMinute: input.rateLimitRequestsPerMinute }
    : undefined;

  const workerConfig = buildGatewayWorkerConfig({
    upstreams: resolvedUpstreams as any,
    pathRoutes: input.pathRoutes,
    bffRoutes: input.bffRoutes ?? gateway.bffRoutes,
    corsEnabled: input.corsEnabled,
    corsOrigins: input.corsOrigins,
    jwtAuth: jwtDoc,
    headerTransforms: input.headerTransforms as any,
    cacheConfig: input.cacheConfig as any,
    canary: input.canary as any,
    shadowConfig: input.shadowConfig ?? gateway.shadowConfig,
    bodyTransforms: input.bodyTransforms ?? gateway.bodyTransforms,
    schemaRules: input.schemaRules ?? gateway.schemaRules,
    ipRules: input.ipRules as any,
    mockRoutes: input.mockRoutes as any,
    rateLimitEnabled: input.rateLimitEnabled,
    rateLimitRequestsPerMinute: input.rateLimitRequestsPerMinute,
    rateLimitKeyType: input.rateLimitKeyType ?? gateway.rateLimitKeyType,
    rateLimitHeaderName: input.rateLimitHeaderName ?? gateway.rateLimitHeaderName,
    pathRateLimits: input.pathRateLimits,
  });

  const workerCode = await generateGatewayWorkerCode({
    upstreams: workerConfig.upstreams,
    pathRoutes: workerConfig.pathRoutes as any,
    bffRoutes: workerConfig.bffRoutes as any,
    corsEnabled: workerConfig.corsEnabled,
    corsOrigins: workerConfig.corsOrigins,
    jwtAuth: workerConfig.jwtAuth,
    headerTransforms: workerConfig.headerTransforms,
    cacheConfig: workerConfig.cacheConfig,
    canary: workerConfig.canary,
    shadowConfig: workerConfig.shadowConfig,
    bodyTransforms: workerConfig.bodyTransforms,
    schemaRules: workerConfig.schemaRules,
    ipRules: workerConfig.ipRules,
    mockRoutes: workerConfig.mockRoutes,
    rateLimit,
    rateLimitKeyType: workerConfig.rateLimitKeyType,
    rateLimitHeaderName: workerConfig.rateLimitHeaderName,
    pathRateLimits: workerConfig.pathRateLimits,
  });

  const codeChanged = workerCode !== previousWorkerCode || hostnameValueChanged;

  if (!hostnameChanged && !codeChanged) {
    if (newDnsRecordIds.length > 0) {
      await Promise.allSettled(newDnsRecordIds.map((id) => deleteIpDnsRecord({ apiToken, zoneId: input.zoneId, recordId: id })));
    }
    return { success: true, message: 'Gateway updated successfully', data: { gateway: formatGateway(gateway) } };
  }

  const activeDeployment = await getActiveWorkerDeployment({ accountId, apiToken, scriptName: gateway.scriptName });
  if (!activeDeployment?.versions?.length) {
    const e = new Error('Unable to determine the currently active Worker version for rollback');
    (e as any).statusCode = 500;
    throw e;
  }

  let newVersionDeployed = false;
  let newHostnameAttached = false;
  let oldHostnameDetached = false;
  let databaseSaved = false;

  try {
    const versionId = await uploadWorkerVersion({
      accountId, apiToken, scriptName: gateway.scriptName, workerCode,
      placement: {
        smartPlacement: input.placement?.smartPlacement !== false,
        region: input.placement?.region || undefined,
      },
      rateLimit,
    });
    await cancellation.throwIfCancelled();

    await createWorkerDeployment({
      accountId, apiToken, scriptName: gateway.scriptName,
      versions: [{ version_id: versionId, percentage: 100 }],
      message: 'EdgeBalancer gateway update deployment',
    });
    newVersionDeployed = true;
    await cancellation.throwIfCancelled();

    if (hostnameChanged) {
      await attachDomainToWorker({ accountId, apiToken, hostname: nextHostname, zoneId: input.zoneId, scriptName: gateway.scriptName });
      newHostnameAttached = true;
      await cancellation.throwIfCancelled();
    }

    const upstreamsForDb = input.upstreams.map(({ rawIp: _, ...rest }: any) => rest);
    const updated = await Gateway.findOneAndUpdate(
      { _id: gatewayId, userId },
      {
        $set: {
          domain: input.domain, subdomain: input.subdomain || undefined, zoneId: input.zoneId,
          upstreams: upstreamsForDb, pathRoutes: input.pathRoutes ?? [],
          bffRoutes: input.bffRoutes !== undefined ? input.bffRoutes : gateway.bffRoutes ?? [],
          corsEnabled: input.corsEnabled ?? false, corsOrigins: input.corsOrigins ?? [],
          jwtAuth: jwtDoc,
          headerTransforms: {
            request: { set: input.headerTransforms?.request?.set ?? [], remove: input.headerTransforms?.request?.remove ?? [] },
            response: { set: input.headerTransforms?.response?.set ?? [], remove: input.headerTransforms?.response?.remove ?? [] },
          },
          cacheConfig: {
            enabled: input.cacheConfig?.enabled ?? false,
            ttlSeconds: input.cacheConfig?.ttlSeconds ?? 60,
            paths: input.cacheConfig?.paths ?? [],
            normalizeQuery: input.cacheConfig?.normalizeQuery ?? false,
          },
          canary: { enabled: input.canary?.enabled ?? false, percentage: input.canary?.percentage ?? 10, upstreamIndex: input.canary?.upstreamIndex ?? 0 },
          shadowConfig: input.shadowConfig !== undefined ? input.shadowConfig : gateway.shadowConfig ?? { enabled: false, percentage: 10, upstreamIndex: 0 },
          bodyTransforms: input.bodyTransforms !== undefined ? input.bodyTransforms : gateway.bodyTransforms ?? [],
          schemaRules: input.schemaRules !== undefined ? input.schemaRules : gateway.schemaRules ?? [],
          ipRules: input.ipRules ?? [],
          mockRoutes: (input.mockRoutes ?? []).map((m: any) => ({ path: m.path, method: m.method ?? 'ANY', status: m.status, body: m.body ?? '', contentType: m.contentType ?? 'application/json' })),
          rateLimitEnabled: input.rateLimitEnabled ?? false,
          rateLimitRequestsPerMinute: input.rateLimitRequestsPerMinute ?? null,
          rateLimitKeyType: input.rateLimitKeyType ?? gateway.rateLimitKeyType ?? 'ip',
          rateLimitHeaderName: input.rateLimitHeaderName ?? gateway.rateLimitHeaderName ?? 'X-API-Key',
          pathRateLimits: input.pathRateLimits ?? [],
          ipOriginRecords: nextIpOriginRecords,
          placement: {
            smartPlacement: input.placement?.smartPlacement !== false,
            region: input.placement?.region ?? null,
          },
          workerUrl: `https://${nextHostname}`,
        },
      },
      { new: true, runValidators: true },
    );

    if (!updated) {
      const e = new Error('Gateway was changed while this update was in progress. Please refresh and try again.');
      (e as any).statusCode = 409;
      throw e;
    }

    databaseSaved = true;
    await cancellation.throwIfCancelled();

    if (hostnameValueChanged) {
      await detachDomainFromWorker({ accountId, apiToken, hostname: previousHostname });
      oldHostnameDetached = true;
      await cancellation.throwIfCancelled();
    }

    await pruneWorkerHistory({ accountId, apiToken, scriptName: updated.scriptName, keepInactiveCount: 2 });

    if (obsoleteDnsRecords.length > 0) {
      await Promise.allSettled(
        obsoleteDnsRecords.map(r => deleteIpDnsRecord({ apiToken, zoneId: input.zoneId, recordId: r.dnsRecordId }))
      );
    }

    try {
      await deactivateSessionsForLoadBalancer(gatewayId);
      await createSession({
        userId, email: userEmail, content: workerCode,
        loadBalancerName: updated.name, domain: input.domain, subdomain: input.subdomain ?? null,
        strategy: 'api-gateway',
        placement: {
          smartPlacement: input.placement?.smartPlacement !== false,
          region: input.placement?.region || undefined,
        },
        exposeRealOrigin: null,
        actionType: 'edit', loadBalancerId: gatewayId,
      });
    } catch (e: any) {
      console.error(`Gateway session log failed: ${e.message}`);
    }

    return { success: true, message: 'Gateway updated successfully', data: { gateway: formatGateway(updated) } };
  } catch (error) {
    try {
      await Promise.allSettled(
        newDnsRecordIds.map(id => deleteIpDnsRecord({ apiToken, zoneId: input.zoneId, recordId: id }))
      );
      if (oldHostnameDetached) {
        await attachDomainToWorker({ accountId, apiToken, hostname: previousHostname, zoneId: gateway.zoneId, scriptName: gateway.scriptName });
      }
      if (hostnameValueChanged && newHostnameAttached) {
        await detachDomainFromWorker({ accountId, apiToken, hostname: nextHostname });
      }
      if (newVersionDeployed && activeDeployment?.versions?.length) {
        await createWorkerDeployment({
          accountId, apiToken, scriptName: gateway.scriptName,
          versions: activeDeployment.versions, force: true, message: 'EdgeBalancer gateway rollback deployment',
        });
      }
      if (databaseSaved) {
        // Revert DB to previous state
        await Gateway.findByIdAndUpdate(gatewayId, {
          $set: {
            domain: gateway.domain, subdomain: gateway.subdomain, zoneId: gateway.zoneId,
            upstreams: gateway.upstreams, pathRoutes: gateway.pathRoutes,
            corsEnabled: gateway.corsEnabled, corsOrigins: gateway.corsOrigins,
            jwtAuth: gateway.jwtAuth, headerTransforms: gateway.headerTransforms,
            cacheConfig: gateway.cacheConfig, canary: gateway.canary,
            ipRules: gateway.ipRules, mockRoutes: gateway.mockRoutes,
            rateLimitEnabled: gateway.rateLimitEnabled, rateLimitRequestsPerMinute: gateway.rateLimitRequestsPerMinute,
            pathRateLimits: gateway.pathRateLimits, workerUrl: gateway.workerUrl,
          },
        });
      }
    } catch (e: any) {
      console.error(`Gateway update rollback failed: ${e.message}`);
    }
    throw error;
  }
}

async function gatewayWorkerCodeFor(gateway: any): Promise<string> {
  return JSON.stringify({
    upstreams: gateway.upstreams, pathRoutes: gateway.pathRoutes,
    corsEnabled: gateway.corsEnabled, corsOrigins: gateway.corsOrigins,
    jwtAuth: gateway.jwtAuth, headerTransforms: gateway.headerTransforms,
    cacheConfig: gateway.cacheConfig, canary: gateway.canary,
    ipRules: gateway.ipRules, mockRoutes: gateway.mockRoutes,
    rateLimitEnabled: gateway.rateLimitEnabled, rateLimitRequestsPerMinute: gateway.rateLimitRequestsPerMinute,
    pathRateLimits: gateway.pathRateLimits,
  });
}

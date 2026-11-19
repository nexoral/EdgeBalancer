import { Gateway } from '../../../models/Gateway';
import { generateGatewayWorkerCode, generateScriptName } from '../../../services/workerGenerator';
import { deployWorker } from '../../../services/workerDeployment';
import { attachDomainToWorker } from '../../../services/workerDomain';
import { deleteWorker } from '../../../services/workerDeletion';
import { getCloudflareCredentialsForUser } from '../services/credentials.service';
import { ensureWorkerNameAvailability } from '../services/validation.service';
import { toHostname, assertHostnameAvailable } from '../../loadbalancer/services/hostname.service';
import { formatGateway } from '../services/formatter.service';
import { buildGatewayWorkerConfig, encryptJwtSecret } from '../services/config-builder.service';
import { resolveIpOrigins, deleteIpDnsRecord } from '../../../services/workerDns';
import type { IpOriginRecord } from '../../../services/workerDns';
import { createSession } from '../../../services/sessionService';
import { acquireLock, releaseLock, type LockHandle } from '../../../utils/resourceLock';
import type { RequestCancellation } from '../../../utils/requestCancellation';
import type { CreateGatewayInput } from '../types/gateway.types';

export async function createGatewayOrchestrator(params: {
  userId: string;
  userEmail: string | null;
  operationId: string | undefined;
  input: CreateGatewayInput;
  cancellation: RequestCancellation;
}) {
  const { userId, userEmail, input, cancellation } = params;

  let createdGateway: any = null;
  let scriptName = '';
  let hostname = '';
  let accountId = '';
  let apiToken = '';
  let isOAuth: boolean | undefined = false;
  let workerCode = '';
  let ipOriginRecords: IpOriginRecord[] = [];
  let nameLock: LockHandle | null = null;

  const {
    name,
    domain,
    subdomain,
    zoneId,
    upstreams,
    pathRoutes,
    corsEnabled,
    corsOrigins,
    jwtAuth,
    headerTransforms,
    cacheConfig,
    canary,
    ipRules,
    mockRoutes,
    rateLimitEnabled,
    rateLimitRequestsPerMinute,
    pathRateLimits,
    placement,
  } = input;

  try {
    ({ accountId, apiToken, isOAuth } = await getCloudflareCredentialsForUser(userId));

    scriptName = generateScriptName(name);
    nameLock = await acquireLock(`gw:create:${accountId}:${scriptName}`);
    if (!nameLock) {
      const error = new Error('Another deployment is already using this name. Wait for it to finish or choose a different name.');
      (error as any).statusCode = 409;
      throw error;
    }

    await ensureWorkerNameAvailability({ userId, accountId, apiToken, scriptName });
    await cancellation.throwIfCancelled();

    const resolved = await resolveIpOrigins({ origins: upstreams as any, scriptName, domain, zoneId, apiToken, isOAuth });
    ipOriginRecords = resolved.ipOriginRecords;
    await cancellation.throwIfCancelled();

    const rateLimit = rateLimitEnabled && rateLimitRequestsPerMinute
      ? { enabled: true as const, requestsPerMinute: rateLimitRequestsPerMinute }
      : undefined;

    const workerConfig = buildGatewayWorkerConfig({
      upstreams: resolved.resolvedOrigins as any, pathRoutes, corsEnabled, corsOrigins, jwtAuth: jwtAuth as any,
      headerTransforms: headerTransforms as any, cacheConfig: cacheConfig as any,
      canary: canary as any, ipRules: ipRules as any, mockRoutes: mockRoutes as any,
      rateLimitEnabled, rateLimitRequestsPerMinute, pathRateLimits,
    });

    workerCode = await generateGatewayWorkerCode({
      upstreams: workerConfig.upstreams,
      pathRoutes: workerConfig.pathRoutes as any,
      corsEnabled: workerConfig.corsEnabled,
      corsOrigins: workerConfig.corsOrigins,
      jwtAuth: workerConfig.jwtAuth,
      headerTransforms: workerConfig.headerTransforms,
      cacheConfig: workerConfig.cacheConfig,
      canary: workerConfig.canary,
      ipRules: workerConfig.ipRules,
      mockRoutes: workerConfig.mockRoutes,
      rateLimit,
      pathRateLimits: workerConfig.pathRateLimits,
    });

    await deployWorker({
      accountId, apiToken, scriptName, workerCode,
      placement: {
        smartPlacement: placement?.smartPlacement !== false,
        region: placement?.region || undefined,
      },
      rateLimit,
    });
    await cancellation.throwIfCancelled();

    hostname = toHostname(domain, subdomain);
    await assertHostnameAvailable({ userId, accountId, apiToken, hostname, zoneId });
    await cancellation.throwIfCancelled();

    const workerUrl = await attachDomainToWorker({ accountId, apiToken, hostname, zoneId, scriptName });
    await cancellation.throwIfCancelled();

    let jwtDoc: any = { enabled: false, headerName: 'Authorization', algorithms: ['HS256'], issuer: null, secretEncrypted: null, secretIv: null, secretTag: null };
    if (jwtAuth?.enabled && jwtAuth.secret) {
      const enc = encryptJwtSecret(jwtAuth.secret);
      jwtDoc = {
        enabled: true,
        headerName: jwtAuth.headerName ?? 'Authorization',
        algorithms: jwtAuth.algorithms ?? ['HS256'],
        issuer: jwtAuth.issuer ?? null,
        secretEncrypted: enc.secretEncrypted,
        secretIv: enc.secretIv,
        secretTag: enc.secretTag,
      };
    }

    const upstreamsForDb = upstreams.map(({ rawIp: _, ...rest }: any) => rest);
    createdGateway = await Gateway.create({
      userId, name, scriptName, domain, subdomain: subdomain || undefined, zoneId,
      upstreams: upstreamsForDb, pathRoutes: pathRoutes ?? [],
      corsEnabled: corsEnabled ?? false, corsOrigins: corsOrigins ?? [],
      jwtAuth: jwtDoc,
      headerTransforms: {
        request: { set: headerTransforms?.request?.set ?? [], remove: headerTransforms?.request?.remove ?? [] },
        response: { set: headerTransforms?.response?.set ?? [], remove: headerTransforms?.response?.remove ?? [] },
      },
      cacheConfig: {
        enabled: cacheConfig?.enabled ?? false,
        ttlSeconds: cacheConfig?.ttlSeconds ?? 60,
        paths: cacheConfig?.paths ?? [],
      },
      canary: {
        enabled: canary?.enabled ?? false,
        percentage: canary?.percentage ?? 10,
        upstreamIndex: canary?.upstreamIndex ?? 0,
      },
      ipRules: ipRules ?? [],
      mockRoutes: (mockRoutes ?? []).map((m: any) => ({
        path: m.path, method: m.method ?? 'ANY', status: m.status, body: m.body ?? '', contentType: m.contentType ?? 'application/json',
      })),
      rateLimitEnabled: rateLimitEnabled ?? false,
      rateLimitRequestsPerMinute: rateLimitRequestsPerMinute ?? null,
      pathRateLimits: pathRateLimits ?? [],
      ipOriginRecords,
      placement: {
        smartPlacement: placement?.smartPlacement !== false,
        region: placement?.region ?? null,
      },
      status: 'active',
      workerUrl,
    });
    await cancellation.throwIfCancelled();

    try {
      await createSession({
        userId, email: userEmail, content: workerCode,
        loadBalancerName: name, domain, subdomain: subdomain ?? null,
        strategy: 'api-gateway',
        placement: {
          smartPlacement: placement?.smartPlacement !== false,
          region: placement?.region || undefined,
        },
        exposeRealOrigin: null,
        actionType: 'create', loadBalancerId: createdGateway._id.toString(),
      });
    } catch (e: any) {
      console.error(`Gateway session log failed: ${e.message}`);
    }

    return {
      success: true,
      message: 'API gateway created successfully',
      data: { gateway: { ...formatGateway(createdGateway) } },
    };
  } catch (error) {
    if (nameLock && accountId && apiToken && scriptName) {
      try {
        await Promise.allSettled(
          ipOriginRecords.map(r => deleteIpDnsRecord({ apiToken, zoneId, recordId: r.dnsRecordId }))
        );
        if (createdGateway?._id) await Gateway.findByIdAndDelete(createdGateway._id);
        await deleteWorker({ accountId, apiToken, scriptName, hostname: hostname || undefined });
      } catch (e: any) {
        console.error(`Gateway create rollback failed: ${e.message}`);
      }
    }
    throw error;
  } finally {
    await releaseLock(nameLock);
  }
}

/**
 * Create Load Balancer Orchestrator
 *
 * Handles the complex workflow for creating a new load balancer
 * with rollback support on failure.
 */

import { LoadBalancer } from '../../../models/LoadBalancer';
import { generateWorkerCode, generateScriptName } from '../../../services/workerGenerator';
import { deployWorker } from '../../../services/workerDeployment';
import { attachDomainToWorker } from '../../../services/workerDomain';
import { deleteWorker } from '../../../services/workerDeletion';
import { getCloudflareCredentialsForUser } from '../services/credentials.service';
import { ensureWorkerNameAvailability } from '../services/validation.service';
import { normalizeStrategy, isWeightedStrategy } from '../services/strategy.service';
import { toHostname, assertHostnameAvailable } from '../services/hostname.service';
import { formatLoadBalancer } from '../services/formatter.service';
import { createSession } from '../../../services/sessionService';
import { resolveIpOrigins, deleteIpDnsRecord } from '../../../services/workerDns';
import type { IpOriginRecord } from '../../../services/workerDns';
import type { RequestCancellation } from '../../../utils/requestCancellation';

export interface CreateLoadBalancerInput {
  name: string;
  domain: string;
  subdomain?: string;
  zoneId: string;
  origins: Array<{
    url: string;
    weight: number;
    rawIp?: string;
    geoCities?: string[];
    geoSubdivisions?: string[];
    geoCountries?: string[];
    geoContinents?: string[];
    isFallback?: boolean;
  }>;
  strategy?: string;
  weightedEnabled?: boolean;
  exposeRealOrigin?: boolean;
  corsEnabled?: boolean;
  corsOrigins?: string[];
  placement?: {
    smartPlacement?: boolean;
    region?: string;
  };
}

export interface CreateLoadBalancerResult {
  success: boolean;
  message: string;
  data: {
    loadBalancer: any;
  };
}

export async function createLoadBalancerOrchestrator(params: {
  userId: string;
  userEmail: string | null;
  operationId: string | undefined;
  input: CreateLoadBalancerInput;
  cancellation: RequestCancellation;
}): Promise<CreateLoadBalancerResult> {
  const { userId, userEmail, input, cancellation } = params;

  let createdLoadBalancer: any = null;
  let scriptName = '';
  let hostname = '';
  let accountId = '';
  let apiToken = '';
  let workerCode = '';
  let ipOriginRecords: IpOriginRecord[] = [];

  const {
    name,
    domain,
    subdomain,
    zoneId,
    origins,
    strategy,
    weightedEnabled,
    exposeRealOrigin,
    corsEnabled,
    corsOrigins,
    placement,
  } = input;

  const nextStrategy = normalizeStrategy(strategy, weightedEnabled || false);
  const nextWeightedEnabled = isWeightedStrategy(nextStrategy);

  try {
    // Step 1: Get Cloudflare credentials
    ({ accountId, apiToken } = await getCloudflareCredentialsForUser(userId));

    // Step 2: Generate script name and validate availability
    scriptName = generateScriptName(name);
    await ensureWorkerNameAvailability({
      userId,
      accountId,
      apiToken,
      scriptName,
    });
    await cancellation.throwIfCancelled();

    // Step 3: Resolve raw IP origins to internal grey-cloud DNS hostnames
    const resolved = await resolveIpOrigins({ origins, scriptName, domain, zoneId, apiToken });
    ipOriginRecords = resolved.ipOriginRecords;
    await cancellation.throwIfCancelled();

    // Step 4: Generate Worker code using resolved origins (hostnames, not raw IPs)
    workerCode = generateWorkerCode({
      origins: resolved.resolvedOrigins,
      strategy: nextStrategy,
      exposeRealOrigin: exposeRealOrigin ?? false,
      corsEnabled: corsEnabled ?? false,
      corsOrigins: corsOrigins ?? [],
    });

    // Step 5: Deploy Worker to Cloudflare
    await deployWorker({
      accountId,
      apiToken,
      scriptName,
      workerCode,
      placement: placement || { smartPlacement: false },
    });
    await cancellation.throwIfCancelled();

    // Step 6: Construct and validate hostname
    hostname = toHostname(domain, subdomain);
    await assertHostnameAvailable({
      userId,
      accountId,
      apiToken,
      hostname,
    });
    await cancellation.throwIfCancelled();

    // Step 7: Attach domain to Worker
    const workerUrl = await attachDomainToWorker({
      accountId,
      apiToken,
      hostname,
      zoneId,
      scriptName,
    });
    await cancellation.throwIfCancelled();

    // Step 8: Save load balancer to database
    // Strip transient rawIp field from origins before persisting (it's only used for DNS record creation)
    const originsForDb = origins.map(({ rawIp: _, ...rest }: any) => rest);
    createdLoadBalancer = await LoadBalancer.create({
      userId,
      name,
      scriptName,
      domain,
      subdomain: subdomain || undefined,
      origins: originsForDb,
      strategy: nextStrategy,
      weightedEnabled: nextWeightedEnabled,
      exposeRealOrigin: exposeRealOrigin ?? false,
      corsEnabled: corsEnabled ?? false,
      corsOrigins: corsOrigins ?? [],
      ipOriginRecords,
      placement,
      zoneId,
      status: 'active',
      workerUrl,
    });
    await cancellation.throwIfCancelled();

    // Step 9: Save session log (non-blocking — failure must not roll back the LB)
    try {
      await createSession({
        userId,
        email: userEmail,
        content: workerCode,
        loadBalancerName: name,
        domain,
        subdomain: subdomain ?? null,
        strategy: nextStrategy,
        placement: placement ?? null,
        exposeRealOrigin: exposeRealOrigin ?? null,
        actionType: 'create',
        loadBalancerId: createdLoadBalancer._id.toString(),
      });
    } catch (sessionError: any) {
      console.error(`Session log failed (create): ${sessionError.message}`);
    }

    return {
      success: true,
      message: 'Load balancer created successfully',
      data: {
        loadBalancer: {
          ...formatLoadBalancer(createdLoadBalancer),
          originCount: createdLoadBalancer.origins.length,
        },
      },
    };
  } catch (error) {
    // Rollback: clean up all resources created so far
    if (accountId && apiToken && scriptName) {
      try {
        // Delete auto-created DNS records for raw IP origins
        await Promise.allSettled(
          ipOriginRecords.map(r => deleteIpDnsRecord({ apiToken, zoneId, recordId: r.dnsRecordId }))
        );

        if (createdLoadBalancer?._id) {
          await LoadBalancer.findByIdAndDelete(createdLoadBalancer._id);
        }

        await deleteWorker({
          accountId,
          apiToken,
          scriptName,
          hostname: hostname || undefined,
        });
      } catch (rollbackError: any) {
        console.error(`Create rollback failed: ${rollbackError.message}`);
      }
    }

    throw error;
  }
}

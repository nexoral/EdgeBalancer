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
import type { RequestCancellation } from '../../../utils/requestCancellation';

export interface CreateLoadBalancerInput {
  name: string;
  domain: string;
  subdomain?: string;
  zoneId: string;
  origins: Array<{
    url: string;
    weight: number;
    geoCities?: string[];
    geoSubdivisions?: string[];
    geoCountries?: string[];
    geoContinents?: string[];
    isFallback?: boolean;
  }>;
  strategy?: string;
  weightedEnabled?: boolean;
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
  operationId: string | undefined;
  input: CreateLoadBalancerInput;
  cancellation: RequestCancellation;
}): Promise<CreateLoadBalancerResult> {
  const { userId, input, cancellation } = params;

  let createdLoadBalancer: any = null;
  let scriptName = '';
  let hostname = '';
  let accountId = '';
  let apiToken = '';

  const {
    name,
    domain,
    subdomain,
    zoneId,
    origins,
    strategy,
    weightedEnabled,
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
    cancellation.throwIfCancelled();

    // Step 3: Generate Worker code
    const workerCode = generateWorkerCode({
      origins,
      strategy: nextStrategy,
    });

    // Step 4: Deploy Worker to Cloudflare
    await deployWorker({
      accountId,
      apiToken,
      scriptName,
      workerCode,
      placement: placement || { smartPlacement: false },
    });
    cancellation.throwIfCancelled();

    // Step 5: Construct and validate hostname
    hostname = toHostname(domain, subdomain);
    await assertHostnameAvailable({
      userId,
      accountId,
      apiToken,
      hostname,
    });
    cancellation.throwIfCancelled();

    // Step 6: Attach domain to Worker
    const workerUrl = await attachDomainToWorker({
      accountId,
      apiToken,
      hostname,
      zoneId,
      scriptName,
    });
    cancellation.throwIfCancelled();

    // Step 7: Save load balancer to database
    createdLoadBalancer = await LoadBalancer.create({
      userId,
      name,
      scriptName,
      domain,
      subdomain: subdomain || undefined,
      origins,
      strategy: nextStrategy,
      weightedEnabled: nextWeightedEnabled,
      placement,
      zoneId,
      status: 'active',
      workerUrl,
    });
    cancellation.throwIfCancelled();

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
    // Rollback: Clean up any created resources
    if (accountId && apiToken && scriptName) {
      try {
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

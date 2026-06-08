/**
 * Update Load Balancer Orchestrator
 *
 * Handles the complex workflow for updating a load balancer
 * with comprehensive rollback support.
 */

import { LoadBalancer } from '../../../models/LoadBalancer';
import { generateWorkerCode } from '../../../services/workerGenerator';
import {
  getActiveWorkerDeployment,
  uploadWorkerVersion,
  createWorkerDeployment,
  pruneWorkerHistory,
} from '../../../services/workerDeployment';
import { attachDomainToWorker, detachDomainFromWorker } from '../../../services/workerDomain';
import { getCloudflareCredentialsForUser } from '../services/credentials.service';
import { normalizeStrategy, isWeightedStrategy } from '../services/strategy.service';
import { toHostname, assertHostnameAvailable } from '../services/hostname.service';
import { snapshotLoadBalancer, configSignature } from '../services/snapshot.service';
import { isNameUpdateAttempt } from '../services/validation.service';
import { formatLoadBalancer } from '../services/formatter.service';
import { createSession, deactivateSessionsForLoadBalancer } from '../../../services/sessionService';
import type { RequestCancellation } from '../../../utils/requestCancellation';

export interface UpdateLoadBalancerInput {
  name?: string;
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

export interface UpdateLoadBalancerResult {
  success: boolean;
  message: string;
  data: {
    loadBalancer: any;
  };
}

export async function updateLoadBalancerOrchestrator(params: {
  userId: string;
  userEmail: string | null;
  loadBalancerId: string;
  input: UpdateLoadBalancerInput;
  cancellation: RequestCancellation;
}): Promise<UpdateLoadBalancerResult> {
  const { userId, userEmail, loadBalancerId, input, cancellation } = params;

  // Load existing load balancer
  const loadBalancer = await LoadBalancer.findById(loadBalancerId);
  if (!loadBalancer) {
    const error = new Error('Load balancer not found');
    (error as any).statusCode = 404;
    throw error;
  }

  if (loadBalancer.userId.toString() !== userId) {
    const error = new Error('You do not have permission to update this load balancer');
    (error as any).statusCode = 403;
    throw error;
  }

  // Check for name change attempt
  if (isNameUpdateAttempt(input.name, loadBalancer.name)) {
    const error = new Error('Load balancer name cannot be changed after creation');
    (error as any).statusCode = 400;
    throw error;
  }

  const previousSnapshot = snapshotLoadBalancer(loadBalancer);
  let persistedLoadBalancer = loadBalancer;
  const previousHostname = toHostname(loadBalancer.domain, loadBalancer.subdomain);

  const {
    domain,
    subdomain,
    zoneId,
    origins,
    strategy,
    weightedEnabled,
    placement,
  } = input;

  // Get credentials
  const { accountId, apiToken } = await getCloudflareCredentialsForUser(userId);

  // Validate new hostname
  const nextHostname = toHostname(domain, subdomain);
  await assertHostnameAvailable({
    userId,
    accountId,
    apiToken,
    hostname: nextHostname,
    excludeLoadBalancerId: loadBalancerId,
  });
  cancellation.throwIfCancelled();

  const nextStrategy = normalizeStrategy(strategy, weightedEnabled || false);
  const nextWeightedEnabled = isWeightedStrategy(nextStrategy);

  // Detect changes
  const hostnameValueChanged = nextHostname !== previousHostname;
  const hostnameChanged = hostnameValueChanged || zoneId !== loadBalancer.zoneId;
  const configChanged = configSignature({
    origins,
    strategy: nextStrategy,
    weightedEnabled: nextWeightedEnabled,
    placement,
  }) !== configSignature({
    origins: previousSnapshot.origins,
    strategy: previousSnapshot.strategy,
    weightedEnabled: previousSnapshot.weightedEnabled,
    placement: previousSnapshot.placement,
  });

  // Always generate worker code — needed for session log regardless of what changed
  const workerCode = generateWorkerCode({ origins, strategy: nextStrategy });

  // No changes detected
  if (!hostnameChanged && !configChanged) {
    return {
      success: true,
      message: 'Load balancer updated successfully',
      data: {
        loadBalancer: {
          ...formatLoadBalancer(loadBalancer),
          originCount: loadBalancer.origins.length,
        },
      },
    };
  }

  // Get active deployment for rollback (only if config changed)
  const activeDeployment = configChanged
    ? await getActiveWorkerDeployment({
        accountId,
        apiToken,
        scriptName: loadBalancer.scriptName,
      })
    : null;

  if (configChanged && !activeDeployment?.versions?.length) {
    const error = new Error('Unable to determine the currently active Worker version for rollback');
    (error as any).statusCode = 500;
    throw error;
  }

  // Track rollback state
  let newVersionDeployed = false;
  let newHostnameAttached = false;
  let oldHostnameDetached = false;
  let databaseSaved = false;

  try {
    // Step 1: Deploy new Worker version (if config changed)
    if (configChanged) {
      const versionId = await uploadWorkerVersion({
        accountId,
        apiToken,
        scriptName: loadBalancer.scriptName,
        workerCode,
        placement: placement || { smartPlacement: false },
      });

      cancellation.throwIfCancelled();

      await createWorkerDeployment({
        accountId,
        apiToken,
        scriptName: loadBalancer.scriptName,
        versions: [
          {
            version_id: versionId,
            percentage: 100,
          },
        ],
        message: 'EdgeBalancer update deployment',
      });

      newVersionDeployed = true;
      cancellation.throwIfCancelled();
    }

    // Step 2: Attach new hostname (if hostname changed)
    if (hostnameChanged) {
      await attachDomainToWorker({
        accountId,
        apiToken,
        hostname: nextHostname,
        zoneId,
        scriptName: loadBalancer.scriptName,
      });
      newHostnameAttached = true;
      cancellation.throwIfCancelled();
    }

    // Step 3: Update database
    const updatedLoadBalancer = await LoadBalancer.findOneAndUpdate(
      {
        _id: loadBalancerId,
        userId,
      },
      {
        $set: {
          name: previousSnapshot.name,
          scriptName: previousSnapshot.scriptName,
          domain,
          subdomain: subdomain || undefined,
          zoneId,
          origins,
          strategy: nextStrategy,
          weightedEnabled: nextWeightedEnabled,
          placement,
          workerUrl: `https://${nextHostname}`,
          status: 'active',
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedLoadBalancer) {
      const error = new Error('Load balancer was changed while this update was in progress. Please refresh and try again.');
      (error as any).statusCode = 409;
      throw error;
    }

    persistedLoadBalancer = updatedLoadBalancer;
    databaseSaved = true;
    cancellation.throwIfCancelled();

    // Step 4: Detach old hostname (if hostname value changed)
    if (hostnameValueChanged) {
      await detachDomainFromWorker({
        accountId,
        apiToken,
        hostname: previousHostname,
      });
      oldHostnameDetached = true;
      cancellation.throwIfCancelled();
    }

    // Step 5: Prune Worker history (if config changed)
    if (configChanged) {
      await pruneWorkerHistory({
        accountId,
        apiToken,
        scriptName: persistedLoadBalancer.scriptName,
        keepInactiveCount: 2,
      });
    }

    // Step 6: Deactivate old session(s) and save new session log
    try {
      await deactivateSessionsForLoadBalancer(loadBalancerId);
      await createSession({
        userId,
        email: userEmail,
        content: workerCode,
        loadBalancerName: persistedLoadBalancer.name,
        domain,
        subdomain: subdomain ?? null,
        strategy: nextStrategy,
        placement: placement ?? null,
        actionType: 'edit',
        loadBalancerId,
      });
    } catch (sessionError: any) {
      console.error(`Session log failed (update): ${sessionError.message}`);
    }

    return {
      success: true,
      message: 'Load balancer updated successfully',
      data: {
        loadBalancer: {
          ...formatLoadBalancer(persistedLoadBalancer),
          originCount: persistedLoadBalancer.origins.length,
        },
      },
    };
  } catch (error) {
    // Comprehensive rollback logic
    try {
      // Rollback Step 1: Reattach old hostname if detached
      if (oldHostnameDetached) {
        await attachDomainToWorker({
          accountId,
          apiToken,
          hostname: previousHostname,
          zoneId: previousSnapshot.zoneId,
          scriptName: previousSnapshot.scriptName,
        });
      }

      // Rollback Step 2: Detach new hostname if attached
      if (hostnameValueChanged && newHostnameAttached) {
        await detachDomainFromWorker({
          accountId,
          apiToken,
          hostname: nextHostname,
        });
      }

      // Rollback Step 3: Restore previous deployment
      if (configChanged && newVersionDeployed && activeDeployment?.versions?.length) {
        await createWorkerDeployment({
          accountId,
          apiToken,
          scriptName: previousSnapshot.scriptName,
          versions: activeDeployment.versions,
          force: true,
          message: 'EdgeBalancer rollback deployment',
        });
      }

      // Rollback Step 4: Restore database state
      if (databaseSaved) {
        await LoadBalancer.findOneAndUpdate(
          {
            _id: loadBalancerId,
            userId,
          },
          {
            $set: {
              name: previousSnapshot.name,
              scriptName: previousSnapshot.scriptName,
              domain: previousSnapshot.domain,
              subdomain: previousSnapshot.subdomain,
              zoneId: previousSnapshot.zoneId,
              origins: previousSnapshot.origins,
              strategy: previousSnapshot.strategy,
              weightedEnabled: previousSnapshot.weightedEnabled,
              placement: previousSnapshot.placement,
              workerUrl: previousSnapshot.workerUrl,
              status: previousSnapshot.status,
            },
          },
          {
            runValidators: true,
          }
        );
      }
    } catch (rollbackError: any) {
      console.error(`Update rollback failed: ${rollbackError.message}`);
    }

    throw error;
  }
}

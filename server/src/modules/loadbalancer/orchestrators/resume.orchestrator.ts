import { LoadBalancer } from '../../../models/LoadBalancer';
import { attachDomainToWorker } from '../../../services/workerDomain';
import { deployWorker, pruneWorkerHistory } from '../../../services/workerDeployment';
import { generateWorkerCode, WorkerStrategy } from '../../../services/workerGenerator';
import { getCloudflareCredentialsForUser } from '../services/credentials.service';
import { toHostname } from '../services/hostname.service';

export interface ResumeResult {
  success: boolean;
  message: string;
  data: {
    loadBalancer: any;
  };
}

export async function resumeLoadBalancerOrchestrator(params: {
  userId: string;
  loadBalancerId: string;
}): Promise<ResumeResult> {
  const { userId, loadBalancerId } = params;

  // Find the load balancer
  const loadBalancer = await LoadBalancer.findById(loadBalancerId);
  if (!loadBalancer) {
    const error = new Error('Load balancer not found');
    (error as any).statusCode = 404;
    throw error;
  }

  // Ensure the load balancer belongs to the user
  if (loadBalancer.userId.toString() !== userId) {
    const error = new Error('You do not have permission to modify this load balancer');
    (error as any).statusCode = 403;
    throw error;
  }

  // Ensure it's paused
  if (loadBalancer.status !== 'paused') {
    const error = new Error('Load balancer is not paused, cannot resume.');
    (error as any).statusCode = 400;
    throw error;
  }

  const { accountId, apiToken } = await getCloudflareCredentialsForUser(userId);
  const hostname = toHostname(loadBalancer.domain, loadBalancer.subdomain);

  // Resume Action 1: If domain was released, re-attach it
  if (loadBalancer.pauseMode === 'release-domain') {
    await attachDomainToWorker({
      accountId,
      apiToken,
      hostname,
      zoneId: loadBalancer.zoneId,
      scriptName: loadBalancer.scriptName,
    });
  }

  // Resume Action 2: Redeploy the actual strategy Worker code
  // This is ALWAYS needed for keep-domain, and good practice for release-domain
  const workerCode = generateWorkerCode({
    origins: loadBalancer.origins.map((origin) => ({
      url: origin.url,
      weight: origin.weight,
      geoCountries: origin.geoCountries,
      geoContinents: origin.geoContinents,
    })),
    strategy: loadBalancer.strategy as WorkerStrategy,
  });

  await deployWorker({
    accountId,
    apiToken,
    scriptName: loadBalancer.scriptName,
    workerCode,
    placement: loadBalancer.placement,
  });

  await pruneWorkerHistory({
    accountId,
    apiToken,
    scriptName: loadBalancer.scriptName,
  });

  // Update from database
  loadBalancer.status = 'active';
  loadBalancer.pauseMode = undefined;
  await loadBalancer.save();

  return {
    success: true,
    message: 'Load balancer resumed successfully. Traffic is now flowing according to configured strategy.',
    data: {
      loadBalancer,
    },
  };
}

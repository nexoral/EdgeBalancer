import { Gateway } from '../../../models/Gateway';
import { detachDomainFromWorker } from '../../../services/workerDomain';
import { deployWorker, pruneWorkerHistory } from '../../../services/workerDeployment';
import { generateGatewayWorkerCode } from '../../../services/workerGenerator';
import { getCloudflareCredentialsForUser } from '../services/credentials.service';
import { toHostname } from '../../loadbalancer/services/hostname.service';

export async function pauseGatewayOrchestrator(params: {
  userId: string;
  gatewayId: string;
  mode: 'release-domain' | 'keep-domain';
}) {
  const { userId, gatewayId, mode } = params;

  const gateway = await Gateway.findById(gatewayId);
  if (!gateway) {
    const e = new Error('Gateway not found');
    (e as any).statusCode = 404;
    throw e;
  }
  if (gateway.userId.toString() !== userId) {
    const e = new Error('You do not have permission to modify this gateway');
    (e as any).statusCode = 403;
    throw e;
  }
  if (gateway.status !== 'active') {
    const e = new Error(`Gateway is currently ${gateway.status}, cannot pause.`);
    (e as any).statusCode = 400;
    throw e;
  }

  const { accountId, apiToken } = await getCloudflareCredentialsForUser(userId);
  const hostname = toHostname(gateway.domain, gateway.subdomain);

  if (mode === 'release-domain') {
    await detachDomainFromWorker({ accountId, apiToken, hostname });
  } else {
    const pausedCode = await generateGatewayWorkerCode({
      upstreams: [],
      corsEnabled: false,
      rateLimit: undefined,
    });
    const placement = gateway.placement ? {
      smartPlacement: gateway.placement.smartPlacement !== false,
      region: gateway.placement.region || undefined,
    } : { smartPlacement: true };
    await deployWorker({ accountId, apiToken, scriptName: gateway.scriptName, workerCode: pausedCode, placement, rateLimit: undefined });
    await pruneWorkerHistory({ accountId, apiToken, scriptName: gateway.scriptName });
  }

  gateway.status = 'paused';
  (gateway as any).pauseMode = mode;
  await gateway.save();

  return {
    success: true,
    message: mode === 'release-domain' ? 'Custom domain released. Traffic is now stopped.' : 'Maintenance mode activated. Gateway is now returning a paused message.',
    data: { gateway },
  };
}

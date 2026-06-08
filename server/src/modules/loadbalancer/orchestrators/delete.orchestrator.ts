/**
 * Delete Load Balancer Orchestrator
 *
 * Handles the workflow for deleting a load balancer from both
 * the database and Cloudflare.
 */

import { LoadBalancer } from '../../../models/LoadBalancer';
import { deleteWorker } from '../../../services/workerDeletion';
import { getCloudflareCredentialsForUser } from '../services/credentials.service';
import { deactivateSessionsForLoadBalancer } from '../../../services/sessionService';

export interface DeleteLoadBalancerResult {
  success: boolean;
  message: string;
  data: null;
}

export async function deleteLoadBalancerOrchestrator(params: {
  userId: string;
  loadBalancerId: string;
}): Promise<DeleteLoadBalancerResult> {
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
    const error = new Error('You do not have permission to delete this load balancer');
    (error as any).statusCode = 403;
    throw error;
  }

  const { accountId, apiToken } = await getCloudflareCredentialsForUser(userId);

  // Build the full hostname
  const hostname = loadBalancer.subdomain
    ? `${loadBalancer.subdomain}.${loadBalancer.domain}`
    : loadBalancer.domain;

  // Delete Worker from Cloudflare
  try {
    await deleteWorker({
      accountId,
      apiToken,
      scriptName: loadBalancer.scriptName,
      hostname,
    });
  } catch (error: any) {
    // Log the error but continue with database deletion
    console.error(`Warning: Failed to delete Worker from Cloudflare: ${error.message}`);
  }

  // Delete from database
  await LoadBalancer.findByIdAndDelete(loadBalancerId);

  // Deactivate related sessions
  try {
    await deactivateSessionsForLoadBalancer(loadBalancerId);
  } catch (sessionError: any) {
    console.error(`Session deactivation failed (delete): ${sessionError.message}`);
  }

  return {
    success: true,
    message: 'Load balancer deleted successfully',
    data: null,
  };
}

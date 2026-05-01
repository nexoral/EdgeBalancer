import { User } from '../../../models/User';
import { LoadBalancer } from '../../../models/LoadBalancer';
import { decrypt } from '../../../utils/encryption';
import { CloudflareClient } from '../../../services/cloudflareClient';
import { toHostname } from './validationService';

interface CloudflareCredentials {
  accountId: string;
  apiToken: string;
}

export const getCloudflareCredentialsForUser = async (userId: string): Promise<CloudflareCredentials> => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    (error as any).statusCode = 404;
    throw error;
  }

  if (
    !user.cloudflareAccountId ||
    !user.cloudflareApiToken ||
    !user.cloudflareAccountIdIv ||
    !user.cloudflareTokenIv ||
    !user.cloudflareAccountIdTag ||
    !user.cloudflareTokenTag
  ) {
    const error = new Error('Cloudflare credentials not configured. Please complete onboarding first.');
    (error as any).statusCode = 400;
    throw error;
  }

  return {
    accountId: decrypt(user.cloudflareAccountId, user.cloudflareAccountIdIv, user.cloudflareAccountIdTag),
    apiToken: decrypt(user.cloudflareApiToken, user.cloudflareTokenIv, user.cloudflareTokenTag),
  };
};

export const ensureWorkerNameAvailability = async ({
  userId,
  accountId,
  apiToken,
  scriptName,
  excludeLoadBalancerId,
}: {
  userId: string;
  accountId: string;
  apiToken: string;
  scriptName: string;
  excludeLoadBalancerId?: string;
}): Promise<void> => {
  const existingLoadBalancer = await LoadBalancer.findOne({
    userId,
    scriptName,
    ...(excludeLoadBalancerId ? { _id: { $ne: excludeLoadBalancerId } } : {}),
  });

  if (existingLoadBalancer) {
    const error = new Error('A load balancer with this Worker name already exists. Choose a different name.');
    (error as any).statusCode = 409;
    throw error;
  }

  const cloudflareClient = new CloudflareClient(apiToken);
  const workerNameExists = await cloudflareClient.workerNameExists(accountId, scriptName);
  if (workerNameExists) {
    const error = new Error('A Worker with this name already exists in your Cloudflare account. Choose a different name.');
    (error as any).statusCode = 409;
    throw error;
  }
};

export const assertHostnameAvailable = async ({
  userId,
  accountId,
  apiToken,
  hostname,
  excludeLoadBalancerId,
}: {
  userId: string;
  accountId: string;
  apiToken: string;
  hostname: string;
  excludeLoadBalancerId?: string;
}): Promise<void> => {
  let excludedHostname: string | null = null;

  if (excludeLoadBalancerId) {
    const existingLoadBalancer = await LoadBalancer.findById(excludeLoadBalancerId);
    if (!existingLoadBalancer) {
      const error = new Error('Load balancer not found');
      (error as any).statusCode = 404;
      throw error;
    }

    if (existingLoadBalancer.userId.toString() !== userId) {
      const error = new Error('You do not have permission to access this load balancer');
      (error as any).statusCode = 403;
      throw error;
    }

    excludedHostname = toHostname(existingLoadBalancer.domain, existingLoadBalancer.subdomain);
  }

  const cloudflareClient = new CloudflareClient(apiToken);
  const domains = await cloudflareClient.getWorkerDomains(accountId);
  const hostnameInUse = domains.some((domain: any) => (
    domain?.hostname === hostname && domain?.hostname !== excludedHostname
  ));

  if (hostnameInUse) {
    const error = new Error(`Hostname '${hostname}' is already assigned to another Worker. Choose a different domain or subdomain.`);
    (error as any).statusCode = 409;
    throw error;
  }
};

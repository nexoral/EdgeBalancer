/**
 * Credentials Service
 *
 * Handles retrieval of Cloudflare credentials for authenticated users.
 */

import { User } from '../../../models/User';
import { decrypt } from '../../../utils/encryption';

export interface CloudflareCredentials {
  accountId: string;
  apiToken: string;
}

/**
 * Get decrypted Cloudflare credentials for a user
 *
 * @throws Error if user not found or credentials not configured
 */
export async function getCloudflareCredentialsForUser(userId: string): Promise<CloudflareCredentials> {
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
}

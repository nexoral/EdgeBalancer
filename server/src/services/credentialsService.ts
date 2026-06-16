import { User } from '../models/User';
import { encrypt, decrypt, maskToken, maskAccountId } from '../utils';
import { CloudflareClient } from './cloudflareClient';

export interface CredentialsValidationResult {
  valid: boolean;
  errors: string[];
}

export const validateCloudflareCredentials = async (
  accountId: string,
  apiToken: string
): Promise<CredentialsValidationResult> => {
  const client = new CloudflareClient(apiToken);
  const errors: string[] = [];

  try {
    // Test Worker Scripts permission
    const hasWorkerScripts = await client.testWorkerScriptsPermission(accountId);
    if (!hasWorkerScripts) {
      errors.push('Missing permission: Account > Worker Scripts > Edit');
    }

    // Test Workers KV Storage permission
    const hasWorkersKV = await client.testWorkersKVPermission(accountId);
    if (!hasWorkersKV) {
      errors.push('Missing permission: Account > Workers KV Storage > Edit');
    }

    // Test Zone Read permission
    const hasZoneRead = await client.testZoneReadPermission(accountId);
    if (!hasZoneRead) {
      errors.push('Missing permission: Zone > Zone > Read');
    }

    // Test Zone DNS Edit permission (required for raw IP origin auto-DNS)
    const hasDnsEdit = await client.testDnsEditPermission(accountId);
    if (!hasDnsEdit) {
      errors.push('Missing permission: Zone > DNS > Edit');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (error: any) {
    if (error.response?.status === 403 || error.response?.status === 401) {
      errors.push('Invalid API token or account ID');
    } else {
      errors.push('Failed to validate credentials with Cloudflare API');
    }
    return {
      valid: false,
      errors,
    };
  }
};

export const saveCloudflareCredentials = async (
  userId: string,
  accountId: string,
  apiToken: string
): Promise<void> => {
  // Encrypt credentials
  const encryptedAccountId = encrypt(accountId);
  const encryptedApiToken = encrypt(apiToken);

  // Update user
  await User.findByIdAndUpdate(userId, {
    cloudflareAccountId: encryptedAccountId.encrypted,
    cloudflareAccountIdIv: encryptedAccountId.iv,
    cloudflareAccountIdTag: encryptedAccountId.tag,
    cloudflareApiToken: encryptedApiToken.encrypted,
    cloudflareTokenIv: encryptedApiToken.iv,
    cloudflareTokenTag: encryptedApiToken.tag,
  });
};

export const getCloudflareCredentials = async (userId: string): Promise<{
  accountId: string;
  apiToken: string;
} | null> => {
  const user = await User.findById(userId);
  if (!user || !user.cloudflareAccountId || !user.cloudflareApiToken) {
    return null;
  }

  // Decrypt credentials
  const accountId = decrypt(user.cloudflareAccountId, user.cloudflareAccountIdIv!, user.cloudflareAccountIdTag!);
  const apiToken = decrypt(user.cloudflareApiToken, user.cloudflareTokenIv!, user.cloudflareTokenTag!);

  return { accountId, apiToken };
};

export const getMaskedCredentials = async (userId: string): Promise<{
  accountId: string | null;
  apiToken: string | null;
} | null> => {
  const user = await User.findById(userId);
  if (!user) {
    return null;
  }

  if (!user.cloudflareAccountId || !user.cloudflareApiToken) {
    return {
      accountId: null,
      apiToken: null,
    };
  }

  // Decrypt and mask
  const accountId = decrypt(user.cloudflareAccountId, user.cloudflareAccountIdIv!, user.cloudflareAccountIdTag!);
  const apiToken = decrypt(user.cloudflareApiToken, user.cloudflareTokenIv!, user.cloudflareTokenTag!);

  return {
    accountId: maskAccountId(accountId),
    apiToken: maskToken(apiToken),
  };
};

import { createHash } from 'crypto';
import axios from 'axios';
import { retryWithBackoff } from '../utils/retry';

export interface PlacementConfig {
  smartPlacement?: boolean;
  region?: string;
}

export interface RateLimitConfig {
  enabled: boolean;
  requestsPerMinute: number;
}

export interface DeployWorkerParams {
  accountId: string;
  apiToken: string;
  scriptName: string;
  workerCode: string;
  placement: PlacementConfig;
  rateLimit?: RateLimitConfig;
}

interface DeploymentVersion {
  version_id: string;
  percentage: number;
}

interface WorkerDeploymentSummary {
  id: string;
  created_on?: string;
  versions: DeploymentVersion[];
}

interface WorkerVersionSummary {
  id: string;
}

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

const rateLimitNamespaceId = (scriptName: string): string => {
  // namespace_id must be a positive integer string unique within the account. scriptName is already
  // unique per account via the {userId, scriptName} compound index, so hashing it gives a stable,
  // collision-free id without a shared counter.
  const digest = createHash('sha1').update(scriptName).digest('hex').slice(0, 7);
  return String(parseInt(digest, 16));
};

const buildVersionPayload = (scriptName: string, workerCode: string, placement: PlacementConfig, rateLimit?: RateLimitConfig) => {
  const payload: any = {
    compatibility_date: '2025-10-01',
    main_module: 'worker.js',
    modules: [
      {
        name: 'worker.js',
        content_type: 'application/javascript+module',
        content_base64: Buffer.from(workerCode, 'utf8').toString('base64'),
      },
    ],
  };

  const bindings: any[] = [];

  // Add placement configuration
  if (placement.region) {
    // Explicit region takes precedence
    payload.placement = {
      mode: 'smart',
    };
    bindings.push({
      type: 'plain_text',
      name: 'PLACEMENT_HINT',
      text: placement.region,
    });
  } else if (placement.smartPlacement !== false) {
    // Smart placement is default
    payload.placement = {
      mode: 'smart',
    };
  }

  if (rateLimit?.enabled) {
    // The new beta Workers API (POST /workers/workers/{id}/versions) accepts rate limiting as a
    // `ratelimit` binding inside bindings[] — the only documented shape for it. The multipart
    // metadata APIs do not recognise a "ratelimit" binding type, and a top-level `ratelimits`
    // field is silently dropped, which is why the binding never appeared on the Worker.
    bindings.push({
      type: 'ratelimit',
      name: 'EDGEBALANCER_RATE_LIMITER',
      namespace_id: rateLimitNamespaceId(scriptName),
      simple: {
        limit: rateLimit.requestsPerMinute,
        period: 60,
      },
    });
  }

  if (bindings.length > 0) {
    payload.bindings = bindings;
  }

  return payload;
};

const getOrCreateWorker = async (accountId: string, apiToken: string, scriptName: string): Promise<void> => {
  try {
    const existing = await retryWithBackoff(
      () => axios.get(
        `${CLOUDFLARE_API_BASE}/accounts/${accountId}/workers/workers/${encodeURIComponent(scriptName)}`,
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
          },
          timeout: 30000,
        }
      ),
      { maxRetries: 3, retryableStatusCodes: [429, 500, 502, 503, 504] }
    );

    if (existing.data?.success) {
      return;
    }
  } catch (error: any) {
    if (error.response?.status !== 404) {
      throw new Error(`Failed to check Worker: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }

  const created = await retryWithBackoff(
    () => axios.post(
      `${CLOUDFLARE_API_BASE}/accounts/${accountId}/workers/workers`,
      {
        name: scriptName,
        subdomain: { enabled: false },
      },
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    ),
    { maxRetries: 3, retryableStatusCodes: [429, 500, 502, 503, 504] }
  );

  if (!created.data?.success) {
    throw new Error('Failed to create Worker');
  }
};

export const deployWorker = async (params: DeployWorkerParams): Promise<void> => {
  const { accountId, apiToken, scriptName, workerCode, placement, rateLimit } = params;

  try {
    await getOrCreateWorker(accountId, apiToken, scriptName);

    const payload = buildVersionPayload(scriptName, workerCode, placement, rateLimit);

    const response = await retryWithBackoff(
      () => axios.post(
        `${CLOUDFLARE_API_BASE}/accounts/${accountId}/workers/workers/${encodeURIComponent(scriptName)}/versions`,
        payload,
        {
          params: { deploy: true },
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000, // 60 second timeout for worker deployment
        }
      ),
      {
        maxRetries: 3,
        initialDelay: 2000,
        retryableStatusCodes: [429, 500, 502, 503, 504], // Retry on rate limit and server errors
      }
    );

    if (!response.data.success) {
      throw new Error('Failed to deploy Worker to Cloudflare');
    }
  } catch (error: any) {
    console.error('Worker deployment error:', error.response?.data || error.message);
    throw new Error(`Failed to deploy Worker: ${error.response?.data?.errors?.[0]?.message || error.message}`);
  }
};

export const uploadWorkerVersion = async (params: DeployWorkerParams): Promise<string> => {
  const { accountId, apiToken, scriptName, workerCode, placement, rateLimit } = params;

  try {
    await getOrCreateWorker(accountId, apiToken, scriptName);

    const payload = buildVersionPayload(scriptName, workerCode, placement, rateLimit);

    const response = await retryWithBackoff(
      () => axios.post(
        `${CLOUDFLARE_API_BASE}/accounts/${accountId}/workers/workers/${encodeURIComponent(scriptName)}/versions`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        }
      ),
      {
        maxRetries: 3,
        initialDelay: 2000,
        retryableStatusCodes: [429, 500, 502, 503, 504],
      }
    );

    const versionId = response.data?.result?.id;
    if (!response.data?.success || !versionId) {
      throw new Error('Failed to upload Worker version');
    }

    return versionId;
  } catch (error: any) {
    console.error('Worker version upload error:', error.response?.data || error.message);
    throw new Error(`Failed to upload Worker version: ${error.response?.data?.errors?.[0]?.message || error.message}`);
  }
};

export const getActiveWorkerDeployment = async ({
  accountId,
  apiToken,
  scriptName,
}: {
  accountId: string;
  apiToken: string;
  scriptName: string;
}): Promise<{ versions: DeploymentVersion[] } | null> => {
  const response = await retryWithBackoff(
    () => axios.get(
      `${CLOUDFLARE_API_BASE}/accounts/${accountId}/workers/scripts/${scriptName}/deployments`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    ),
    { maxRetries: 3, retryableStatusCodes: [429, 500, 502, 503, 504] }
  );

  const deployments = response.data?.result?.deployments ?? response.data?.result ?? [];
  const activeDeployment = Array.isArray(deployments) ? deployments[0] : null;

  if (!activeDeployment?.versions?.length) {
    return null;
  }

  return {
    versions: activeDeployment.versions.map((version: any) => ({
      version_id: version.version_id,
      percentage: version.percentage,
    })),
  };
};

export const listWorkerDeployments = async ({
  accountId,
  apiToken,
  scriptName,
}: {
  accountId: string;
  apiToken: string;
  scriptName: string;
}): Promise<WorkerDeploymentSummary[]> => {
  const response = await retryWithBackoff(
    () => axios.get(
      `${CLOUDFLARE_API_BASE}/accounts/${accountId}/workers/scripts/${scriptName}/deployments`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    ),
    { maxRetries: 3, retryableStatusCodes: [429, 500, 502, 503, 504] }
  );

  const deployments = response.data?.result?.deployments ?? response.data?.result ?? [];

  return Array.isArray(deployments)
    ? deployments.map((deployment: any) => ({
        id: deployment.id,
        created_on: deployment.created_on,
        versions: Array.isArray(deployment.versions)
          ? deployment.versions.map((version: any) => ({
              version_id: version.version_id,
              percentage: version.percentage,
            }))
          : [],
      }))
    : [];
};

export const deleteWorkerDeployment = async ({
  accountId,
  apiToken,
  scriptName,
  deploymentId,
}: {
  accountId: string;
  apiToken: string;
  scriptName: string;
  deploymentId: string;
}): Promise<void> => {
  try {
    const response = await retryWithBackoff(
      () => axios.delete(
        `${CLOUDFLARE_API_BASE}/accounts/${accountId}/workers/scripts/${scriptName}/deployments/${deploymentId}`,
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      ),
      { maxRetries: 3, retryableStatusCodes: [429, 500, 502, 503, 504] }
    );

    if (!response.data?.success) {
      throw new Error('Failed to delete Worker deployment');
    }
  } catch (error: any) {
    throw new Error(`Failed to delete Worker deployment: ${error.response?.data?.errors?.[0]?.message || error.message}`);
  }
};

export const listWorkerVersions = async ({
  accountId,
  apiToken,
  scriptName,
}: {
  accountId: string;
  apiToken: string;
  scriptName: string;
}): Promise<WorkerVersionSummary[]> => {
  const versions: WorkerVersionSummary[] = [];
  let page = 1;

  while (true) {
    const response = await retryWithBackoff(
      () => axios.get(
        `${CLOUDFLARE_API_BASE}/accounts/${accountId}/workers/scripts/${scriptName}/versions`,
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          params: {
            page,
            per_page: 100,
          },
          timeout: 30000,
        }
      ),
      { maxRetries: 3, retryableStatusCodes: [429, 500, 502, 503, 504] }
    );

    const pageItems = Array.isArray(response.data?.result) ? response.data.result : [];
    versions.push(
      ...pageItems
        .filter((version: any) => version?.id)
        .map((version: any) => ({
          id: version.id,
        }))
    );

    const totalPages = response.data?.result_info?.total_pages;
    if (
      pageItems.length === 0 ||
      (typeof totalPages === 'number' && page >= totalPages) ||
      pageItems.length < 100
    ) {
      break;
    }

    page += 1;
  }

  return versions;
};

export const deleteWorkerVersion = async ({
  accountId,
  apiToken,
  scriptName,
  versionId,
}: {
  accountId: string;
  apiToken: string;
  scriptName: string;
  versionId: string;
}): Promise<void> => {
  try {
    const response = await retryWithBackoff(
      () => axios.delete(
        `${CLOUDFLARE_API_BASE}/accounts/${accountId}/workers/workers/${encodeURIComponent(scriptName)}/versions/${versionId}`,
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      ),
      { maxRetries: 3, retryableStatusCodes: [429, 500, 502, 503, 504] }
    );

    if (!response.data?.success) {
      throw new Error('Failed to delete Worker version');
    }
  } catch (error: any) {
    throw new Error(`Failed to delete Worker version: ${error.response?.data?.errors?.[0]?.message || error.message}`);
  }
};

export const pruneWorkerVersions = async ({
  accountId,
  apiToken,
  scriptName,
  keepCount = 3,
}: {
  accountId: string;
  apiToken: string;
  scriptName: string;
  keepCount?: number;
}): Promise<void> => {
  const versions = await listWorkerVersions({
    accountId,
    apiToken,
    scriptName,
  });
  const versionsToDelete = versions.slice(keepCount);

  for (const version of versionsToDelete) {
    await deleteWorkerVersion({
      accountId,
      apiToken,
      scriptName,
      versionId: version.id,
    });
  }
};

export const pruneWorkerDeployments = async ({
  accountId,
  apiToken,
  scriptName,
  keepInactiveCount = 2,
}: {
  accountId: string;
  apiToken: string;
  scriptName: string;
  keepInactiveCount?: number;
}): Promise<void> => {
  const deployments = await listWorkerDeployments({
    accountId,
    apiToken,
    scriptName,
  });

  const deploymentsToDelete = deployments.slice(1 + keepInactiveCount);

  for (const deployment of deploymentsToDelete) {
    await deleteWorkerDeployment({
      accountId,
      apiToken,
      scriptName,
      deploymentId: deployment.id,
    });
  }
};

export const pruneWorkerHistory = async ({
  accountId,
  apiToken,
  scriptName,
  keepInactiveCount = 2,
}: {
  accountId: string;
  apiToken: string;
  scriptName: string;
  keepInactiveCount?: number;
}): Promise<void> => {
  await pruneWorkerDeployments({
    accountId,
    apiToken,
    scriptName,
    keepInactiveCount,
  });

  await pruneWorkerVersions({
    accountId,
    apiToken,
    scriptName,
    keepCount: 1 + keepInactiveCount,
  });

  let latestVersionCount = Number.POSITIVE_INFINITY;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const versions = await listWorkerVersions({
      accountId,
      apiToken,
      scriptName,
    });
    latestVersionCount = versions.length;

    if (latestVersionCount <= 1 + keepInactiveCount) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  if (latestVersionCount > 1 + keepInactiveCount) {
    throw new Error(`Worker version history still has ${latestVersionCount} versions after prune`);
  }
};

export const createWorkerDeployment = async ({
  accountId,
  apiToken,
  scriptName,
  versions,
  force = false,
  message,
}: {
  accountId: string;
  apiToken: string;
  scriptName: string;
  versions: DeploymentVersion[];
  force?: boolean;
  message?: string;
}): Promise<void> => {
  try {
    const response = await retryWithBackoff(
      () => axios.post(
        `${CLOUDFLARE_API_BASE}/accounts/${accountId}/workers/scripts/${scriptName}/deployments`,
        {
          strategy: 'percentage',
          versions,
          ...(message ? {
            annotations: {
              'workers/message': message.slice(0, 100),
            },
          } : {}),
        },
        {
          params: force ? { force: true } : undefined,
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      ),
      { maxRetries: 3, retryableStatusCodes: [429, 500, 502, 503, 504] }
    );

    if (!response.data?.success) {
      throw new Error('Failed to create Worker deployment');
    }
  } catch (error: any) {
    console.error('Worker deployment switch error:', error.response?.data || error.message);
    throw new Error(`Failed to create Worker deployment: ${error.response?.data?.errors?.[0]?.message || error.message}`);
  }
};
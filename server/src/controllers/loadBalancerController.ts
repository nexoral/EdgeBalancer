import mongoose from 'mongoose';
import { LoadBalancer } from '../models/LoadBalancer';
import { User } from '../models/User';
import { decrypt } from '../utils/encryption';
import { generateWorkerCode, generateScriptName } from '../services/workerGenerator';
import { createWorkerDeployment, deployWorker, getActiveWorkerDeployment, pruneWorkerHistory, uploadWorkerVersion } from '../services/workerDeployment';
import { attachDomainToWorker, detachDomainFromWorker } from '../services/workerDomain';
import { deleteWorker, deleteWorkerScript } from '../services/workerDeletion';
import { CloudflareClient } from '../services/cloudflareClient';
import { createRequestCancellation, RequestCancelledError } from '../utils/requestCancellation';
import { beginLoadBalancerOperation, cancelLoadBalancerOperation, completeLoadBalancerOperation, isLoadBalancerOperationCancelled } from '../utils/loadBalancerOperationStore';
import type { AppRequest as Request, AppResponse as Response, NextFunction } from '../types/http';

type LoadBalancerStrategy =
  | 'round-robin'
  | 'weighted-round-robin'
  | 'ip-hash'
  | 'cookie-sticky'
  | 'weighted-cookie-sticky'
  | 'failover'
  | 'geo-steering';

const getStrategyLabel = (strategy: string) => {
  switch (strategy) {
    case 'weighted-round-robin':
      return 'Weighted Round Robin';
    case 'ip-hash':
      return 'IP Hash';
    case 'cookie-sticky':
    case 'sticky-session':
      return 'Sticky Session';
    case 'weighted-cookie-sticky':
      return 'Weighted Sticky Session';
    case 'failover':
      return 'Failover';
    case 'geo-steering':
      return 'Geo Steering';
    default:
      return 'Round Robin';
  }
};

const normalizeStoredStrategy = (
  incomingStrategy: string | undefined,
  weightedEnabled: boolean
): LoadBalancerStrategy => {
  if (incomingStrategy === 'sticky-session') {
    return 'cookie-sticky';
  }

  if (incomingStrategy === 'cookie-sticky') {
    return 'cookie-sticky';
  }

  if (incomingStrategy === 'weighted-cookie-sticky') {
    return 'weighted-cookie-sticky';
  }

  if (incomingStrategy === 'ip-hash') {
    return 'ip-hash';
  }

  if (incomingStrategy === 'failover') {
    return 'failover';
  }

  if (incomingStrategy === 'geo-steering') {
    return 'geo-steering';
  }

  if (incomingStrategy === 'weighted-round-robin' || weightedEnabled) {
    return 'weighted-round-robin';
  }

  return 'round-robin';
};

const isWeightedStrategy = (strategy: string) => (
  strategy === 'weighted-round-robin' || strategy === 'weighted-cookie-sticky'
);

const normalizeStrategy = (
  incomingStrategy: string | undefined,
  weightedEnabled: boolean
): LoadBalancerStrategy => {
  return normalizeStoredStrategy(incomingStrategy, weightedEnabled);
};

const formatLoadBalancer = (lb: any) => ({
  id: lb._id,
  name: lb.name,
  scriptName: lb.scriptName,
  domain: lb.domain,
  subdomain: lb.subdomain || null,
  fullDomain: lb.subdomain ? `${lb.subdomain}.${lb.domain}` : lb.domain,
  zoneId: lb.zoneId,
  origins: lb.origins,
  strategy: getStrategyLabel(lb.strategy),
  strategyValue: normalizeStoredStrategy(lb.strategy, lb.weightedEnabled),
  weightedEnabled: isWeightedStrategy(lb.strategy),
  placement: lb.placement,
  status: lb.status,
  workerUrl: lb.workerUrl,
  createdAt: lb.createdAt,
  updatedAt: lb.updatedAt,
});

const getValidatedLoadBalancerId = (idParam: string | string[] | undefined): string => {
  const id = Array.isArray(idParam) ? idParam[0] : idParam;

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('Invalid load balancer id');
  }

  return id;
};

const getCloudflareCredentialsForUser = async (userId: string) => {
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

const ensureWorkerNameAvailability = async ({
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
}) => {
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

const toHostname = (domain: string, subdomain?: string | null) => (
  subdomain ? `${subdomain}.${domain}` : domain
);

const snapshotLoadBalancer = (loadBalancer: any) => ({
  name: loadBalancer.name,
  scriptName: loadBalancer.scriptName,
  domain: loadBalancer.domain,
  subdomain: loadBalancer.subdomain || undefined,
  zoneId: loadBalancer.zoneId,
  origins: loadBalancer.origins.map((origin: any) => ({
    url: origin.url,
    weight: origin.weight,
    geoCountries: Array.isArray(origin.geoCountries) ? origin.geoCountries : [],
    geoColos: Array.isArray(origin.geoColos) ? origin.geoColos : [],
    geoContinents: Array.isArray(origin.geoContinents) ? origin.geoContinents : [],
  })),
  strategy: normalizeStoredStrategy(loadBalancer.strategy, loadBalancer.weightedEnabled),
  weightedEnabled: isWeightedStrategy(loadBalancer.strategy),
  placement: {
    smartPlacement: loadBalancer.placement?.smartPlacement !== false,
    region: loadBalancer.placement?.region || undefined,
  },
  workerUrl: loadBalancer.workerUrl,
  status: loadBalancer.status,
});

const normalizePlacement = (placement: any) => ({
  smartPlacement: placement?.smartPlacement !== false,
  region: placement?.region || undefined,
});

const configSignature = ({
  origins,
  strategy,
  weightedEnabled,
  placement,
}: {
  origins: Array<{ url: string; weight: number }>;
  strategy: string;
  weightedEnabled: boolean;
  placement: any;
}) => JSON.stringify({
  origins: origins.map((origin) => ({
    url: origin.url.trim(),
    weight: origin.weight,
    geoCountries: Array.isArray((origin as any).geoCountries)
      ? (origin as any).geoCountries.map((code: string) => code.trim().toUpperCase()).filter(Boolean)
      : [],
    geoColos: Array.isArray((origin as any).geoColos)
      ? (origin as any).geoColos.map((code: string) => code.trim().toUpperCase()).filter(Boolean)
      : [],
    geoContinents: Array.isArray((origin as any).geoContinents)
      ? (origin as any).geoContinents.map((code: string) => code.trim().toUpperCase()).filter(Boolean)
      : [],
  })),
  strategy,
  weightedEnabled,
  placement: normalizePlacement(placement),
});

const isCancellationError = (error: unknown) => (
  error instanceof RequestCancelledError
);

const isNameUpdateAttempt = (incomingName: string | undefined, currentName: string) => (
  typeof incomingName === 'string' && incomingName !== currentName
);

const assertHostnameAvailable = async ({
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
}) => {
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

export const validateLoadBalancerHostname = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401);
      throw new Error('Not authenticated');
    }

    const {
      domain,
      subdomain,
      excludeLoadBalancerId,
    } = req.body;

    if (!domain || typeof domain !== 'string') {
      res.status(400);
      throw new Error('Domain is required');
    }

    const hostname = toHostname(domain, typeof subdomain === 'string' ? subdomain : undefined);
    const { accountId, apiToken } = await getCloudflareCredentialsForUser(userId);

    await assertHostnameAvailable({
      userId,
      accountId,
      apiToken,
      hostname,
      excludeLoadBalancerId,
    });

    res.json({
      success: true,
      message: 'Hostname is available',
      data: {
        hostname,
        available: true,
      },
    });
  } catch (error) {
    if ((error as any).statusCode) {
      res.status((error as any).statusCode);
    }
    next(error as Error);
  }
};

export const cancelLoadBalancerDeployment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401);
      throw new Error('Not authenticated');
    }

    const rawOperationId = req.params.operationId;
    const operationId = Array.isArray(rawOperationId) ? rawOperationId[0] : rawOperationId;
    if (!operationId) {
      res.status(400);
      throw new Error('Operation id is required');
    }

    const accepted = cancelLoadBalancerOperation(operationId);

    res.json({
      success: true,
      message: accepted ? 'Cancellation requested' : 'Operation already completed',
      data: {
        accepted,
      },
    });
  } catch (error) {
    next(error as Error);
  }
};

export const getLoadBalancers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401);
      throw new Error('Not authenticated');
    }

    const loadBalancers = await LoadBalancer.find({ userId }).sort({ createdAt: -1 });

    const formattedLBs = loadBalancers.map((lb) => ({
      ...formatLoadBalancer(lb),
      originCount: lb.origins.length,
    }));

    res.json({
      success: true,
      message: 'Load balancers retrieved successfully',
      data: {
        loadBalancers: formattedLBs,
      },
    });
  } catch (error) {
    if ((error as any).statusCode) {
      res.status((error as any).statusCode);
    }
    next(error as Error);
  }
};

export const getLoadBalancer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401);
      throw new Error('Not authenticated');
    }

    let id: string;
    try {
      id = getValidatedLoadBalancerId(req.params.id);
    } catch (error: any) {
      res.status(400);
      throw error;
    }

    const loadBalancer = await LoadBalancer.findById(id);
    if (!loadBalancer) {
      res.status(404);
      throw new Error('Load balancer not found');
    }

    if (loadBalancer.userId.toString() !== userId) {
      res.status(403);
      throw new Error('You do not have permission to access this load balancer');
    }

    res.json({
      success: true,
      message: 'Load balancer retrieved successfully',
      data: {
        loadBalancer: formatLoadBalancer(loadBalancer),
      },
    });
  } catch (error) {
    if ((error as any).statusCode) {
      res.status((error as any).statusCode);
    }
    next(error as Error);
  }
};

export const createLoadBalancer = async (req: Request, res: Response, next: NextFunction) => {
  const operationId = req.header('x-operation-id');
  beginLoadBalancerOperation(operationId);
  const cancellation = createRequestCancellation(req, res, operationId);
  let createdLoadBalancer: any = null;
  let scriptName = '';
  let hostname = '';
  let accountId = '';
  let apiToken = '';

  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401);
      throw new Error('Not authenticated');
    }

    const {
      name,
      domain,
      subdomain,
      zoneId,
      origins,
      strategy,
      weightedEnabled,
      placement,
    } = req.body;

    const nextStrategy = normalizeStrategy(strategy, weightedEnabled);
    const nextWeightedEnabled = isWeightedStrategy(nextStrategy);

    ({ accountId, apiToken } = await getCloudflareCredentialsForUser(userId));

    // Use the exact validated load balancer name as the Worker script name
    scriptName = generateScriptName(name);

    await ensureWorkerNameAvailability({
      userId,
      accountId,
      apiToken,
      scriptName,
    });
    cancellation.throwIfCancelled();

    // Generate Worker code
    const workerCode = generateWorkerCode({
      origins,
      strategy: nextStrategy,
    });

    // Deploy Worker to Cloudflare
    await deployWorker({
      accountId,
      apiToken,
      scriptName,
      workerCode,
      placement,
    });
    cancellation.throwIfCancelled();

    // Construct full hostname
    hostname = toHostname(domain, subdomain);

    await assertHostnameAvailable({
      userId,
      accountId,
      apiToken,
      hostname,
    });
    cancellation.throwIfCancelled();

    // Attach domain to Worker
    const workerUrl = await attachDomainToWorker({
      accountId,
      apiToken,
      hostname,
      zoneId,
      scriptName,
    });
    cancellation.throwIfCancelled();

    // Save load balancer to database
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

    res.status(201).json({
      success: true,
      message: 'Load balancer created successfully',
      data: {
        loadBalancer: {
          ...formatLoadBalancer(createdLoadBalancer),
          originCount: createdLoadBalancer.origins.length,
        },
      },
    });
  } catch (error) {
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

    if (isCancellationError(error) || cancellation.isCancelled()) {
      if (!res.headersSent) {
        res.status(409).json({
          success: false,
          message: isLoadBalancerOperationCancelled(operationId)
            ? 'Operation cancelled and rolled back'
            : 'Request cancelled by client',
          data: null,
        });
      }
      return;
    }

    if ((error as any).statusCode) {
      res.status((error as any).statusCode);
    }
    next(error as Error);
  } finally {
    completeLoadBalancerOperation(operationId);
  }
};

export const updateLoadBalancer = async (req: Request, res: Response, next: NextFunction) => {
  const operationId = req.header('x-operation-id');
  beginLoadBalancerOperation(operationId);
  const cancellation = createRequestCancellation(req, res, operationId);
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401);
      throw new Error('Not authenticated');
    }

    let id: string;
    try {
      id = getValidatedLoadBalancerId(req.params.id);
    } catch (error: any) {
      res.status(400);
      throw error;
    }

    const loadBalancer = await LoadBalancer.findById(id);
    if (!loadBalancer) {
      res.status(404);
      throw new Error('Load balancer not found');
    }

    if (loadBalancer.userId.toString() !== userId) {
      res.status(403);
      throw new Error('You do not have permission to update this load balancer');
    }

    const previousSnapshot = snapshotLoadBalancer(loadBalancer);
    let persistedLoadBalancer = loadBalancer;
    const previousHostname = toHostname(loadBalancer.domain, loadBalancer.subdomain);

    const {
      name,
      domain,
      subdomain,
      zoneId,
      origins,
      strategy,
      weightedEnabled,
      placement,
    } = req.body;

    if (isNameUpdateAttempt(name, loadBalancer.name)) {
      res.status(400);
      throw new Error('Load balancer name cannot be changed after creation');
    }

    const { accountId, apiToken } = await getCloudflareCredentialsForUser(userId);

    const nextHostname = toHostname(domain, subdomain);
    await assertHostnameAvailable({
      userId,
      accountId,
      apiToken,
      hostname: nextHostname,
      excludeLoadBalancerId: id,
    });
    cancellation.throwIfCancelled();

    const nextStrategy = normalizeStrategy(strategy, weightedEnabled);
    const nextWeightedEnabled = isWeightedStrategy(nextStrategy);
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

    if (!hostnameChanged && !configChanged) {
      res.json({
        success: true,
        message: 'Load balancer updated successfully',
        data: {
          loadBalancer: {
            ...formatLoadBalancer(loadBalancer),
            originCount: loadBalancer.origins.length,
          },
        },
      });
      return;
    }

    const activeDeployment = configChanged
      ? await getActiveWorkerDeployment({
          accountId,
          apiToken,
          scriptName: loadBalancer.scriptName,
        })
      : null;

    if (configChanged && !activeDeployment?.versions?.length) {
      res.status(500);
      throw new Error('Unable to determine the currently active Worker version for rollback');
    }

    let newVersionDeployed = false;
    let newHostnameAttached = false;
    let oldHostnameDetached = false;
    let databaseSaved = false;

    try {
      if (configChanged) {
        const workerCode = generateWorkerCode({
          origins,
          strategy: nextStrategy,
        });

        const versionId = await uploadWorkerVersion({
          accountId,
          apiToken,
          scriptName: loadBalancer.scriptName,
          workerCode,
          placement,
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

      const updatedLoadBalancer = await LoadBalancer.findOneAndUpdate(
        {
          _id: id,
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
        res.status(409);
        throw new Error('Load balancer was changed while this update was in progress. Please refresh and try again.');
      }

      persistedLoadBalancer = updatedLoadBalancer;
      databaseSaved = true;
      cancellation.throwIfCancelled();

      if (hostnameValueChanged) {
        await detachDomainFromWorker({
          accountId,
          apiToken,
          hostname: previousHostname,
        });
        oldHostnameDetached = true;
        cancellation.throwIfCancelled();
      }

      if (configChanged) {
        await pruneWorkerHistory({
          accountId,
          apiToken,
          scriptName: persistedLoadBalancer.scriptName,
          keepInactiveCount: 2,
        });
      }

      res.json({
        success: true,
        message: 'Load balancer updated successfully',
        data: {
          loadBalancer: {
            ...formatLoadBalancer(persistedLoadBalancer),
            originCount: persistedLoadBalancer.origins.length,
          },
        },
      });

      return;
    } catch (error) {
      try {
        if (oldHostnameDetached) {
          await attachDomainToWorker({
            accountId,
            apiToken,
            hostname: previousHostname,
            zoneId: previousSnapshot.zoneId,
            scriptName: previousSnapshot.scriptName,
          });
        }

        if (hostnameValueChanged && newHostnameAttached) {
          await detachDomainFromWorker({
            accountId,
            apiToken,
            hostname: nextHostname,
          });
        }

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

        if (databaseSaved) {
          await LoadBalancer.findOneAndUpdate(
            {
              _id: id,
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
  } catch (error: any) {
    if (isCancellationError(error) || cancellation.isCancelled()) {
      if (!res.headersSent) {
        res.status(409).json({
          success: false,
          message: isLoadBalancerOperationCancelled(operationId)
            ? 'Operation cancelled and rolled back'
            : 'Request cancelled by client',
          data: null,
        });
      }
      return;
    }

    if (error.statusCode) {
      res.status(error.statusCode);
    }
    next(error as Error);
  } finally {
    completeLoadBalancerOperation(operationId);
  }
};

export const deleteLoadBalancer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401);
      throw new Error('Not authenticated');
    }

    let id: string;
    try {
      id = getValidatedLoadBalancerId(req.params.id);
    } catch (error: any) {
      res.status(400);
      throw error;
    }

    // Find the load balancer
    const loadBalancer = await LoadBalancer.findById(id);
    if (!loadBalancer) {
      res.status(404);
      throw new Error('Load balancer not found');
    }

    // Ensure the load balancer belongs to the user
    if (loadBalancer.userId.toString() !== userId) {
      res.status(403);
      throw new Error('You do not have permission to delete this load balancer');
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
    await LoadBalancer.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Load balancer deleted successfully',
      data: null,
    });
  } catch (error) {
    if ((error as any).statusCode) {
      res.status((error as any).statusCode);
    }
    next(error as Error);
  }
};

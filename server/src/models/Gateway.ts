import mongoose, { Schema, Document } from 'mongoose';
import { WORKER_SCRIPT_NAME_REGEX } from '../utils/workerName';

export interface IGatewayUpstream {
  url: string;
  weight: number;
}

export interface IGatewayHeaderRule {
  name: string;
  value: string;
}

export interface IGatewayHeaderTransforms {
  request: { set: IGatewayHeaderRule[]; remove: string[] };
  response: { set: IGatewayHeaderRule[]; remove: string[] };
}

export interface IGatewayCacheConfig {
  enabled: boolean;
  ttlSeconds: number;
  paths: string[];
  normalizeQuery?: boolean;
}

export interface IGatewayBffRoute {
  path: string;
  upstreamIndices: number[];
  priority: number;
}

export interface IGatewayShadowConfig {
  enabled: boolean;
  percentage: number;
  upstreamIndex: number;
}

export interface IGatewayRbacRule {
  path: string;
  requiredRoles: string[];
}

export interface IGatewayBodyTransform {
  path: string;
  phase: 'request' | 'response';
  stripFields?: string[];
  renameFields?: Array<{ from: string; to: string }>;
}

export interface IGatewaySchemaRule {
  path: string;
  method?: string;
  requiredFields?: string[];
  fieldTypes?: Array<{ field: string; type: 'string' | 'number' | 'boolean' | 'array' }>;
}

export interface IGatewayCanary {
  enabled: boolean;
  percentage: number;
  upstreamIndex: number;
}

export interface IGatewayIpRule {
  value: string;
  action: 'allow' | 'deny';
}

export interface IGatewayMockRoute {
  path: string;
  method: string;
  status: number;
  body: string;
  contentType: string;
}

export interface IGatewayJwtAuth {
  enabled: boolean;
  headerName: string;
  algorithms: string[];
  issuer?: string | null;
  secretEncrypted?: string | null;
  secretIv?: string | null;
  secretTag?: string | null;
  rbacRules?: IGatewayRbacRule[];
  injectHeaders?: boolean;
}

export interface IGatewayIpRecord {
  originalUrl: string;
  hostname: string;
  dnsRecordId: string;
}

export interface IGateway extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  scriptName: string;
  domain: string;
  subdomain?: string;
  zoneId: string;
  upstreams: IGatewayUpstream[];
  pathRoutes: Array<{ path: string; upstreamIndex: number; priority: number }>;
  corsEnabled: boolean;
  corsOrigins: string[];
  jwtAuth: IGatewayJwtAuth;
  headerTransforms: IGatewayHeaderTransforms;
  cacheConfig: IGatewayCacheConfig;
  canary: IGatewayCanary;
  ipRules: IGatewayIpRule[];
  mockRoutes: IGatewayMockRoute[];
  rateLimitEnabled: boolean;
  rateLimitRequestsPerMinute: number | null;
  rateLimitKeyType?: 'ip' | 'header' | 'jwt';
  rateLimitHeaderName?: string;
  pathRateLimits: Array<{ path: string; requestsPerMinute: number; priority: number }>;
  bffRoutes?: IGatewayBffRoute[];
  shadowConfig?: IGatewayShadowConfig;
  bodyTransforms?: IGatewayBodyTransform[];
  schemaRules?: IGatewaySchemaRule[];
  ipOriginRecords: IGatewayIpRecord[];
  placement?: {
    smartPlacement?: boolean;
    region?: string | null;
  };
  status: 'active' | 'paused' | 'inactive';
  pauseMode?: 'release-domain' | 'keep-domain';
  workerUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

const headerRule = {
  name: { type: String, required: true },
  value: { type: String, required: true },
};

const GatewaySchema = new Schema<IGateway>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    name: {
      type: String,
      required: [true, 'Gateway name is required'],
      trim: true,
      minlength: [3, 'Name must be at least 3 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
      match: [WORKER_SCRIPT_NAME_REGEX, 'Name must use only lowercase letters, numbers, and hyphens'],
    },
    scriptName: {
      type: String,
      required: [true, 'Script name is required'],
    },
    domain: {
      type: String,
      required: [true, 'Domain is required'],
    },
    subdomain: {
      type: String,
      default: null,
    },
    zoneId: {
      type: String,
      required: [true, 'Zone ID is required'],
    },
    upstreams: {
      type: [
        {
          url: { type: String, required: true },
          weight: { type: Number, required: true, default: 1, min: 1 },
        },
      ],
      required: [true, 'At least one upstream is required'],
      validate: {
        validator: (v: IGatewayUpstream[]) => v.length > 0,
        message: 'At least one upstream is required',
      },
    },
    pathRoutes: {
      type: [
        {
          path: { type: String, required: true },
          upstreamIndex: { type: Number, required: true, min: 0 },
          priority: { type: Number, required: true, min: 1 },
        },
      ],
      default: [],
    },
    corsEnabled: {
      type: Boolean,
      default: false,
    },
    corsOrigins: {
      type: [String],
      default: [],
    },
    jwtAuth: {
      type: {
        enabled: { type: Boolean, default: false },
        headerName: { type: String, default: 'Authorization' },
        algorithms: { type: [String], default: ['HS256'] },
        issuer: { type: String, default: null },
        secretEncrypted: { type: String, default: null },
        secretIv: { type: String, default: null },
        secretTag: { type: String, default: null },
        rbacRules: {
          type: [
            {
              path: { type: String, required: true },
              requiredRoles: { type: [String], default: [] },
            },
          ],
          default: [],
        },
        injectHeaders: { type: Boolean, default: false },
      },
      default: () => ({}),
    },
    headerTransforms: {
      type: {
        request: {
          set: { type: [headerRule], default: [] },
          remove: { type: [String], default: [] },
        },
        response: {
          set: { type: [headerRule], default: [] },
          remove: { type: [String], default: [] },
        },
      },
      default: () => ({}),
    },
    cacheConfig: {
      type: {
        enabled: { type: Boolean, default: false },
        ttlSeconds: { type: Number, default: 60, min: 1, max: 86400 },
        paths: { type: [String], default: [] },
        normalizeQuery: { type: Boolean, default: false },
      },
      default: () => ({}),
    },
    shadowConfig: {
      type: {
        enabled: { type: Boolean, default: false },
        percentage: { type: Number, default: 10, min: 0, max: 100 },
        upstreamIndex: { type: Number, default: 0, min: 0 },
      },
      default: () => ({}),
    },
    bffRoutes: {
      type: [
        {
          path: { type: String, required: true },
          upstreamIndices: { type: [Number], required: true },
          priority: { type: Number, required: true, min: 1 },
        },
      ],
      default: [],
    },
    bodyTransforms: {
      type: [
        {
          path: { type: String, required: true },
          phase: { type: String, enum: ['request', 'response'], default: 'response' },
          stripFields: { type: [String], default: [] },
          renameFields: {
            type: [
              {
                from: { type: String, required: true },
                to: { type: String, required: true },
              },
            ],
            default: [],
          },
        },
      ],
      default: [],
    },
    schemaRules: {
      type: [
        {
          path: { type: String, required: true },
          method: { type: String, default: 'ANY' },
          requiredFields: { type: [String], default: [] },
          fieldTypes: {
            type: [
              {
                field: { type: String, required: true },
                type: { type: String, enum: ['string', 'number', 'boolean', 'array'], required: true },
              },
            ],
            default: [],
          },
        },
      ],
      default: [],
    },
    canary: {
      type: {
        enabled: { type: Boolean, default: false },
        percentage: { type: Number, default: 10, min: 0, max: 100 },
        upstreamIndex: { type: Number, default: 0, min: 0 },
      },
      default: () => ({}),
    },
    ipRules: {
      type: [
        {
          value: { type: String, required: true },
          action: { type: String, enum: ['allow', 'deny'], required: true },
        },
      ],
      default: [],
    },
    mockRoutes: {
      type: [
        {
          path: { type: String, required: true },
          method: {
            type: String,
            enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'ANY'],
            default: 'ANY',
          },
          status: { type: Number, required: true, min: 200, max: 599 },
          body: { type: String, default: '' },
          contentType: { type: String, default: 'application/json' },
        },
      ],
      default: [],
    },
    rateLimitEnabled: {
      type: Boolean,
      default: false,
    },
    rateLimitRequestsPerMinute: {
      type: Number,
      default: null,
      min: 1,
      max: 100000,
    },
    rateLimitKeyType: {
      type: String,
      enum: ['ip', 'header', 'jwt'],
      default: 'ip',
    },
    rateLimitHeaderName: {
      type: String,
      default: 'X-API-Key',
    },
    pathRateLimits: {
      type: [
        {
          path: { type: String, required: true },
          requestsPerMinute: { type: Number, required: true, min: 1, max: 100000 },
          priority: { type: Number, required: true, min: 1 },
        },
      ],
      default: [],
    },
    ipOriginRecords: {
      type: [
        {
          originalUrl: { type: String, required: true },
          hostname: { type: String, required: true },
          dnsRecordId: { type: String, required: true },
        },
      ],
      default: [],
    },
    placement: {
      type: {
        smartPlacement: { type: Boolean, default: true },
        region: { type: String, default: null },
      },
      default: { smartPlacement: true },
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'inactive'],
      default: 'active',
    },
    pauseMode: {
      type: String,
      enum: ['release-domain', 'keep-domain'],
      default: null,
    },
    workerUrl: {
      type: String,
      required: [true, 'Worker URL is required'],
    },
  },
  {
    timestamps: true,
  }
);

// Same scoping lesson as load balancers: Worker names only have to be unique within a
// Cloudflare account, and each account belongs to one user.
GatewaySchema.index({ userId: 1 });
GatewaySchema.index({ userId: 1, scriptName: 1 }, { unique: true });

export const Gateway = mongoose.model<IGateway>('Gateway', GatewaySchema);

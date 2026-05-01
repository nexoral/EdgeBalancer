import mongoose, { Schema, Document } from 'mongoose';
import { WORKER_SCRIPT_NAME_REGEX } from '../utils/workerName';

export interface IOriginServer {
  url: string;
  weight: number;
  geoCities?: string[];
  geoSubdivisions?: string[];
  geoCountries?: string[];
  geoContinents?: string[];
  isFallback?: boolean;
}

export interface IPlacementConfig {
  smartPlacement?: boolean;
  region?: string;
}

export interface ILoadBalancer extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  scriptName: string;
  domain: string;
  subdomain?: string;
  origins: IOriginServer[];
  strategy: string;
  weightedEnabled: boolean;
  placement: IPlacementConfig;
  zoneId: string;
  status: 'active' | 'paused' | 'inactive';
  pauseMode?: 'release-domain' | 'keep-domain';
  workerUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

const LoadBalancerSchema = new Schema<ILoadBalancer>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    name: {
      type: String,
      required: [true, 'Load balancer name is required'],
      trim: true,
      minlength: [3, 'Name must be at least 3 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
      match: [WORKER_SCRIPT_NAME_REGEX, 'Name must use only lowercase letters, numbers, and hyphens'],
    },
    scriptName: {
      type: String,
      required: [true, 'Script name is required'],
      unique: true,
    },
    domain: {
      type: String,
      required: [true, 'Domain is required'],
    },
    subdomain: {
      type: String,
      default: null,
    },
    origins: {
      type: [
        {
          url: { type: String, required: true },
          weight: { type: Number, required: true, default: 1, min: 1 },
          geoCities: { type: [String], default: [] },
          geoSubdivisions: { type: [String], default: [] },
          geoCountries: { type: [String], default: [] },
          geoContinents: { type: [String], default: [] },
          isFallback: { type: Boolean, default: false },
        },
      ],
      required: [true, 'At least one origin server is required'],
      validate: {
        validator: (v: IOriginServer[]) => v.length > 0,
        message: 'At least one origin server is required',
      },
    },
    strategy: {
      type: String,
      required: [true, 'Strategy is required'],
      enum: ['round-robin', 'weighted-round-robin', 'ip-hash', 'cookie-sticky', 'weighted-cookie-sticky', 'failover', 'geo-steering'],
      default: 'round-robin',
    },
    weightedEnabled: {
      type: Boolean,
      default: false,
    },
    placement: {
      type: {
        smartPlacement: { type: Boolean, default: true },
        region: { type: String, default: null },
      },
      default: { smartPlacement: true },
    },
    zoneId: {
      type: String,
      required: [true, 'Zone ID is required'],
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

// Index for performance on userId queries
LoadBalancerSchema.index({ userId: 1 });

// Note: scriptName index is already created by 'unique: true' field option
// No need for explicit schema.index() to avoid duplicate index warning

export const LoadBalancer = mongoose.model<ILoadBalancer>('LoadBalancer', LoadBalancerSchema);

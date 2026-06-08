import mongoose, { Schema, Document } from 'mongoose';

export interface ISession extends Document {
  userId: mongoose.Types.ObjectId;
  email: string | null;
  content: string;
  loadBalancerName: string;
  domain: string;
  subdomain: string | null;
  strategy: string;
  placement: { smartPlacement?: boolean; region?: string | null } | null;
  actionType: 'create' | 'edit';
  isActive: boolean;
  loadBalancerId: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    email: {
      type: String,
      default: null,
    },
    content: {
      type: String,
      required: [true, 'Worker script content is required'],
    },
    loadBalancerName: {
      type: String,
      required: [true, 'Load balancer name is required'],
    },
    domain: {
      type: String,
      required: [true, 'Domain is required'],
    },
    subdomain: {
      type: String,
      default: null,
    },
    strategy: {
      type: String,
      required: [true, 'Strategy is required'],
    },
    placement: {
      type: {
        smartPlacement: { type: Boolean, default: null },
        region: { type: String, default: null },
      },
      default: null,
    },
    actionType: {
      type: String,
      enum: ['create', 'edit'],
      required: [true, 'Action type is required'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    loadBalancerId: {
      type: Schema.Types.ObjectId,
      ref: 'LoadBalancer',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

SessionSchema.index({ userId: 1 });
SessionSchema.index({ loadBalancerId: 1 });

export const Session = mongoose.model<ISession>('Session', SessionSchema);

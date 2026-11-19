import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITotpDevice {
  _id: Types.ObjectId;
  name: string;
  secret: string;
  iv: string;
  tag: string;
  confirmed: boolean;
  createdAt: Date;
}

export interface IPasskey {
  _id: Types.ObjectId;
  name: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string[];
  createdAt: Date;
}

export type SecondFactorMethod = 'totp' | 'passkey';

export interface IUser extends Document {
  name: string;
  email?: string | null;
  username: string;
  firebaseUid?: string | null;
  // Manual credentials (legacy, still supported)
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
  cloudflareAccountIdIv?: string;
  cloudflareTokenIv?: string;
  cloudflareAccountIdTag?: string;
  cloudflareTokenTag?: string;
  cloudflareAccountHash?: string;
  // OAuth credentials
  cloudflareOAuthToken?: string;
  cloudflareOAuthTokenIv?: string;
  cloudflareOAuthTokenTag?: string;
  cloudflareRefreshToken?: string;
  cloudflareRefreshTokenIv?: string;
  cloudflareRefreshTokenTag?: string;
  cloudflareTokenExpiresAt?: Date;
  cloudflareOAuthConnected?: boolean;
  totpDevices: Types.DocumentArray<ITotpDevice>;
  passkeys: Types.DocumentArray<IPasskey>;
  preferredSecondFactor?: SecondFactorMethod | null;
  paymentId?: Types.ObjectId | null;
  hasEverSubscribed?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TotpDeviceSchema = new Schema<ITotpDevice>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [30, 'Device name cannot exceed 30 characters'],
    },
    secret: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true },
    confirmed: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const PasskeySchema = new Schema<IPasskey>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [30, 'Passkey name cannot exceed 30 characters'],
    },
    credentialId: { type: String, required: true },
    publicKey: { type: String, required: true },
    counter: { type: Number, default: 0 },
    transports: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      sparse: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
      default: null,
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    firebaseUid: {
      type: String,
      unique: true,
      sparse: true,
      default: null,
    },
    cloudflareAccountId: {
      type: String,
      default: null,
    },
    cloudflareAccountHash: {
      type: String,
      index: {
        unique: true,
        partialFilterExpression: { cloudflareAccountHash: { $type: 'string' } },
      },
    },
    cloudflareApiToken: {
      type: String,
      default: null,
    },
    cloudflareAccountIdIv: {
      type: String,
      default: null,
    },
    cloudflareTokenIv: {
      type: String,
      default: null,
    },
    cloudflareAccountIdTag: {
      type: String,
      default: null,
    },
    cloudflareTokenTag: {
      type: String,
      default: null,
    },
    cloudflareOAuthToken: {
      type: String,
      default: null,
    },
    cloudflareOAuthTokenIv: {
      type: String,
      default: null,
    },
    cloudflareOAuthTokenTag: {
      type: String,
      default: null,
    },
    cloudflareRefreshToken: {
      type: String,
      default: null,
    },
    cloudflareRefreshTokenIv: {
      type: String,
      default: null,
    },
    cloudflareRefreshTokenTag: {
      type: String,
      default: null,
    },
    cloudflareTokenExpiresAt: {
      type: Date,
      default: null,
    },
    cloudflareOAuthConnected: {
      type: Boolean,
      default: false,
    },
    totpDevices: {
      type: [TotpDeviceSchema],
      default: [],
    },
    passkeys: {
      type: [PasskeySchema],
      default: [],
    },
    preferredSecondFactor: {
      type: String,
      enum: ['totp', 'passkey', null],
      default: null,
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: 'PaymentHistory',
      default: null,
    },
    hasEverSubscribed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Note: Indexes are already created by 'unique: true' on email and username fields
// No need for explicit schema.index() calls to avoid duplicate index warnings

export const User = mongoose.model<IUser>('User', UserSchema);

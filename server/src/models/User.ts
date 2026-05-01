import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email?: string | null;
  username: string;
  firebaseUid?: string | null;
  password?: string | null;
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
  cloudflareAccountIdIv?: string;
  cloudflareTokenIv?: string;
  cloudflareAccountIdTag?: string;
  cloudflareTokenTag?: string;
  createdAt: Date;
  updatedAt: Date;
}

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
    password: {
      type: String,
      default: null,
      validate: {
        validator(value: string | null | undefined) {
          if (!value) {
            return true;
          }

          return value.length >= 8;
        },
        message: 'Password must be at least 8 characters',
      },
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
  },
  {
    timestamps: true,
  }
);

// Note: Indexes are already created by 'unique: true' on email and username fields
// No need for explicit schema.index() calls to avoid duplicate index warnings

export const User = mongoose.model<IUser>('User', UserSchema);

import mongoose from 'mongoose';
import { User } from '../../models/User';
import { LoadBalancer } from '../../models/LoadBalancer';

export async function connectTestDb() {
  const uri = process.env.MONGODB_URI!;
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
}

export async function clearCollections() {
  await User.deleteMany({});
  await LoadBalancer.deleteMany({});
}

export async function closeTestDb() {
  await mongoose.disconnect();
}

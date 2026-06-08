import mongoose from 'mongoose';
import { Session } from '../models/Session';

interface CreateSessionParams {
  userId: string;
  email: string | null;
  content: string;
  loadBalancerName: string;
  domain: string;
  subdomain?: string | null;
  strategy: string;
  placement?: { smartPlacement?: boolean; region?: string } | null;
  actionType: 'create' | 'edit';
  loadBalancerId: string;
}

export async function createSession(params: CreateSessionParams): Promise<void> {
  await Session.create({
    userId: new mongoose.Types.ObjectId(params.userId),
    email: params.email ?? null,
    content: params.content,
    loadBalancerName: params.loadBalancerName,
    domain: params.domain,
    subdomain: params.subdomain ?? null,
    strategy: params.strategy,
    placement: params.placement ?? null,
    actionType: params.actionType,
    isActive: true,
    loadBalancerId: new mongoose.Types.ObjectId(params.loadBalancerId),
  });
}

export async function deactivateSessionsForLoadBalancer(loadBalancerId: string): Promise<void> {
  await Session.updateMany(
    { loadBalancerId: new mongoose.Types.ObjectId(loadBalancerId), isActive: true },
    { $set: { isActive: false, loadBalancerId: null, content: '' } }
  );
}

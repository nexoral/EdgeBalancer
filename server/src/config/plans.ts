export type PlanType = 'free' | 'trial' | 'student' | 'pro' | 'student-annual' | 'pro-annual';

export interface PlanConfig {
  name: string;
  label: string;
  price: number;
  durationDays: number;
  lbLimit: number;
  allowedStrategies: string[];   // empty = all
  maxHealthCheckLBs: number;     // 0 = none, -1 = unlimited
  hasAnalytics: boolean;
  hasScriptDownload: boolean;
  hasAi: boolean;
  hasRateLimit: boolean;
  canEditPlacement: boolean;
  maxGateways: number;              // -1 = unlimited
  maxGatewayRoutes: number;
  maxGatewayRateLimitRules: number;
  maxGatewayHeaderRules: number;
  maxGatewayIpRules: number;
  maxGatewayMockRoutes: number;
  hasJwtAuth: boolean;
  hasCaching: boolean;
  hasCanary: boolean;
  hasIdentityRateLimit: boolean;
  hasBffAggregation: boolean;
  hasTrafficShadowing: boolean;
  hasHeaderInjection: boolean;
  maxRbacRules: number;
  maxSchemaRules: number;
  maxBodyShapingRules: number;
}

const ALL_STRATEGIES: string[] = [];

export const PLANS: Record<PlanType, PlanConfig> = {
  free: {
    name: 'Free',
    label: 'Free',
    price: 0,
    durationDays: 0,
    lbLimit: 5,
    allowedStrategies: ALL_STRATEGIES,
    maxHealthCheckLBs: 2,
    hasAnalytics: false,
    hasScriptDownload: false,
    hasAi: false,
    hasRateLimit: false,
    canEditPlacement: false,
    maxGateways: 1,
    maxGatewayRoutes: 5,
    maxGatewayRateLimitRules: 1,
    maxGatewayHeaderRules: 3,
    maxGatewayIpRules: 5,
    maxGatewayMockRoutes: 2,
    hasJwtAuth: false,
    hasCaching: false,
    hasCanary: false,
    hasIdentityRateLimit: false,
    hasBffAggregation: false,
    hasTrafficShadowing: false,
    hasHeaderInjection: false,
    maxRbacRules: 0,
    maxSchemaRules: 1,
    maxBodyShapingRules: 1,
  },
  trial: {
    name: "Student's Support — Trial",
    label: 'Trial',
    price: 0,
    durationDays: 14,
    lbLimit: 10,
    allowedStrategies: ALL_STRATEGIES,
    maxHealthCheckLBs: 5,
    hasAnalytics: true,
    hasScriptDownload: true,
    hasAi: false,
    hasRateLimit: false,
    canEditPlacement: true,
    maxGateways: 3,
    maxGatewayRoutes: 20,
    maxGatewayRateLimitRules: 5,
    maxGatewayHeaderRules: 10,
    maxGatewayIpRules: 20,
    maxGatewayMockRoutes: 10,
    hasJwtAuth: true,
    hasCaching: true,
    hasCanary: false,
    hasIdentityRateLimit: true,
    hasBffAggregation: false,
    hasTrafficShadowing: false,
    hasHeaderInjection: false,
    maxRbacRules: 5,
    maxSchemaRules: 5,
    maxBodyShapingRules: 5,
  },
  student: {
    name: "Student's Support",
    label: 'Student',
    price: 49,
    durationDays: 30,
    lbLimit: 10,
    allowedStrategies: ALL_STRATEGIES,
    maxHealthCheckLBs: 5,
    hasAnalytics: true,
    hasScriptDownload: true,
    hasAi: false,
    hasRateLimit: false,
    canEditPlacement: true,
    maxGateways: 3,
    maxGatewayRoutes: 20,
    maxGatewayRateLimitRules: 5,
    maxGatewayHeaderRules: 10,
    maxGatewayIpRules: 20,
    maxGatewayMockRoutes: 10,
    hasJwtAuth: true,
    hasCaching: true,
    hasCanary: false,
    hasIdentityRateLimit: true,
    hasBffAggregation: false,
    hasTrafficShadowing: false,
    hasHeaderInjection: false,
    maxRbacRules: 5,
    maxSchemaRules: 5,
    maxBodyShapingRules: 5,
  },
  pro: {
    name: 'Pro',
    label: 'Pro',
    price: 299,
    durationDays: 30,
    lbLimit: 0,
    allowedStrategies: ALL_STRATEGIES,
    maxHealthCheckLBs: -1,
    hasAnalytics: true,
    hasScriptDownload: true,
    hasAi: true,
    hasRateLimit: true,
    canEditPlacement: true,
    maxGateways: -1,
    maxGatewayRoutes: -1,
    maxGatewayRateLimitRules: -1,
    maxGatewayHeaderRules: -1,
    maxGatewayIpRules: -1,
    maxGatewayMockRoutes: -1,
    hasJwtAuth: true,
    hasCaching: true,
    hasCanary: true,
    hasIdentityRateLimit: true,
    hasBffAggregation: true,
    hasTrafficShadowing: true,
    hasHeaderInjection: true,
    maxRbacRules: -1,
    maxSchemaRules: -1,
    maxBodyShapingRules: -1,
  },
  'student-annual': {
    name: "Student's Support (Annual)",
    label: 'Student',
    price: 470,
    durationDays: 365,
    lbLimit: 10,
    allowedStrategies: ALL_STRATEGIES,
    maxHealthCheckLBs: 5,
    hasAnalytics: true,
    hasScriptDownload: true,
    hasAi: false,
    hasRateLimit: false,
    canEditPlacement: true,
    maxGateways: 3,
    maxGatewayRoutes: 20,
    maxGatewayRateLimitRules: 5,
    maxGatewayHeaderRules: 10,
    maxGatewayIpRules: 20,
    maxGatewayMockRoutes: 10,
    hasJwtAuth: true,
    hasCaching: true,
    hasCanary: false,
    hasIdentityRateLimit: true,
    hasBffAggregation: false,
    hasTrafficShadowing: false,
    hasHeaderInjection: false,
    maxRbacRules: 5,
    maxSchemaRules: 5,
    maxBodyShapingRules: 5,
  },
  'pro-annual': {
    name: 'Pro (Annual)',
    label: 'Pro',
    price: 2870,
    durationDays: 365,
    lbLimit: 0,
    allowedStrategies: ALL_STRATEGIES,
    maxHealthCheckLBs: -1,
    hasAnalytics: true,
    hasScriptDownload: true,
    hasAi: true,
    hasRateLimit: true,
    canEditPlacement: true,
    maxGateways: -1,
    maxGatewayRoutes: -1,
    maxGatewayRateLimitRules: -1,
    maxGatewayHeaderRules: -1,
    maxGatewayIpRules: -1,
    maxGatewayMockRoutes: -1,
    hasJwtAuth: true,
    hasCaching: true,
    hasCanary: true,
    hasIdentityRateLimit: true,
    hasBffAggregation: true,
    hasTrafficShadowing: true,
    hasHeaderInjection: true,
    maxRbacRules: -1,
    maxSchemaRules: -1,
    maxBodyShapingRules: -1,
  },
};

/** Check if a strategy is allowed for the given plan */
export function isStrategyAllowed(plan: PlanType, strategy: string): boolean {
  const allowed = PLANS[plan].allowedStrategies;
  return allowed.length === 0 || allowed.includes(strategy);
}

/** Get the active plan for a user — checks expiry, reverts to free if expired */
export function resolvePlan(plan: PlanType | undefined | null, planExpiresAt: Date | undefined | null): PlanType {
  if (!plan || plan === 'free') return 'free';
  if (planExpiresAt && planExpiresAt <= new Date()) return 'free';
  return plan;
}

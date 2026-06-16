import { readFileSync } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { normalizeWorkerScriptName } from '../utils/workerName';

export interface OriginServer {
  url: string;
  weight: number;
  geoCities?: string[];
  geoSubdivisions?: string[];
  geoCountries?: string[];
  geoContinents?: string[];
  isFallback?: boolean;
}

export type WorkerStrategy =
  | 'round-robin'
  | 'weighted-round-robin'
  | 'ip-hash'
  | 'cookie-sticky'
  | 'weighted-cookie-sticky'
  | 'failover'
  | 'geo-steering'
  | 'paused';

export interface WorkerConfig {
  origins: OriginServer[];
  strategy: WorkerStrategy;
  exposeRealOrigin?: boolean;
  corsEnabled?: boolean;
  corsOrigins?: string[];
}

const TEMPLATE_MAP: Record<WorkerStrategy, string> = {
  'round-robin': 'roundRobin.js',
  'weighted-round-robin': 'weightedRoundRobin.js',
  'ip-hash': 'ipHash.js',
  'cookie-sticky': 'cookieSticky.js',
  'weighted-cookie-sticky': 'weightedCookieSticky.js',
  'failover': 'failover.js',
  'geo-steering': 'geoSteering.js',
  'paused': 'paused.js',
};

const TEMPLATE_DIR = path.join(__dirname, 'workerTemplates');

const getTemplateContents = (strategy: WorkerStrategy) => {
  return readFileSync(path.join(TEMPLATE_DIR, TEMPLATE_MAP[strategy]), 'utf8');
};

const toWorkerOrigin = (origin: OriginServer, index: number) => ({
  id: `origin_${index}_${createHash('sha1').update(origin.url.trim().toLowerCase()).digest('hex').slice(0, 12)}`,
  url: origin.url.trim(),
  weight: origin.weight,
  geoCities: Array.isArray(origin.geoCities)
    ? origin.geoCities.map((value) => value.trim().toUpperCase()).filter(Boolean)
    : [],
  geoSubdivisions: Array.isArray(origin.geoSubdivisions)
    ? origin.geoSubdivisions.map((value) => value.trim().toUpperCase()).filter(Boolean)
    : [],
  geoCountries: Array.isArray(origin.geoCountries) ? origin.geoCountries : [],
  geoContinents: Array.isArray(origin.geoContinents) ? origin.geoContinents : [],
  isFallback: origin.isFallback === true,
});

export const generateWorkerCode = (config: WorkerConfig): string => {
  const template = getTemplateContents(config.strategy);
  const workerConfig = {
    origins: config.origins.map(toWorkerOrigin),
    stickyCookieName: 'edgebalancer_origin',
    stickyMaxAge: 86400,
    exposeRealOrigin: config.exposeRealOrigin ?? false,
    corsEnabled: config.corsEnabled ?? false,
    corsOrigins: config.corsOrigins ?? [],
  };

  return template.replace('__CONFIG__', JSON.stringify(workerConfig, null, 2));
};

export const generateScriptName = (name: string): string => {
  return normalizeWorkerScriptName(name);
};

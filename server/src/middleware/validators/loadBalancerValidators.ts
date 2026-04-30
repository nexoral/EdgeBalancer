import { validateBody } from '../validation';
import { WORKER_SCRIPT_NAME_REGEX } from '../../utils/workerName';

const DOMAIN_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-_.]*[a-zA-Z0-9]$/;
const SUBDOMAIN_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
const REGION_REGEX = /^(aws|gcp|azure):[a-z0-9-]+$/;
const GEO_COUNTRY_REGEX = /^[A-Z]{2}$/;
const GEO_COLO_REGEX = /^[A-Z0-9]{3,4}$/;
const GEO_CONTINENT_REGEX = /^(AF|AN|AS|EU|NA|OC|SA)$/;

const SUPPORTED_STRATEGIES = new Set([
  'round-robin',
  'weighted-round-robin',
  'ip-hash',
  'cookie-sticky',
  'weighted-cookie-sticky',
  'failover',
  'geo-steering',
]);

export const createLoadBalancerValidator = [
  validateBody((body) => {
    const errors: string[] = [];
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const domain = typeof body?.domain === 'string' ? body.domain.trim() : '';
    const subdomain = typeof body?.subdomain === 'string' ? body.subdomain.trim() : '';
    const zoneId = typeof body?.zoneId === 'string' ? body.zoneId.trim() : '';
    const strategy = typeof body?.strategy === 'string' ? body.strategy.trim() : '';
    const weightedEnabled = typeof body?.weightedEnabled === 'boolean' ? body.weightedEnabled : null;
    const placement = body?.placement;
    const origins = Array.isArray(body?.origins) ? body.origins : null;

    if (!name) {
      errors.push('Load balancer name is required');
    } else if (name.length < 3 || name.length > 50) {
      errors.push('Name must be between 3 and 50 characters');
    } else if (!WORKER_SCRIPT_NAME_REGEX.test(name)) {
      errors.push('Name must use only lowercase letters, numbers, and hyphens');
    }

    if (!domain) {
      errors.push('Domain is required');
    } else if (domain.length < 3 || domain.length > 253) {
      errors.push('Domain must be between 3 and 253 characters');
    } else if (!DOMAIN_REGEX.test(domain)) {
      errors.push('Invalid domain format');
    }

    if (subdomain) {
      if (subdomain.length > 63) {
        errors.push('Subdomain must not exceed 63 characters');
      } else if (!SUBDOMAIN_REGEX.test(subdomain)) {
        errors.push('Invalid subdomain format');
      }
    }

    if (!zoneId) {
      errors.push('Zone ID is required');
    } else if (zoneId.length !== 32) {
      errors.push('Zone ID must be 32 characters');
    }

    if (!origins || origins.length === 0) {
      errors.push('At least one origin server is required');
    } else {
      origins.forEach((origin: any, index: number) => {
        const url = typeof origin?.url === 'string' ? origin.url.trim() : '';
        const weight = origin?.weight;

        if (!url) {
          errors.push('Origin URL is required');
        } else if (!/^https?:\/\/.+/.test(url)) {
          errors.push('Origin URL must start with http:// or https://');
        }

        if (!Number.isInteger(weight) || weight < 1 || weight > 100) {
          errors.push('Weight must be an integer between 1 and 100');
        }

        if (origin?.geoCountries !== undefined) {
          if (!Array.isArray(origin.geoCountries)) {
            errors.push('geoCountries must be an array');
          } else if (origin.geoCountries.some((code: any) => typeof code !== 'string' || !GEO_COUNTRY_REGEX.test(code.trim()))) {
            errors.push('Geo country codes must use 2-letter uppercase ISO country codes');
          }
        }

        if (origin?.geoColos !== undefined) {
          if (!Array.isArray(origin.geoColos)) {
            errors.push('geoColos must be an array');
          } else if (origin.geoColos.some((code: any) => typeof code !== 'string' || !GEO_COLO_REGEX.test(code.trim()))) {
            errors.push('Geo colo codes must use 3-4 uppercase letters or digits');
          }
        }

        if (origin?.geoContinents !== undefined) {
          if (!Array.isArray(origin.geoContinents)) {
            errors.push('geoContinents must be an array');
          } else if (origin.geoContinents.some((code: any) => typeof code !== 'string' || !GEO_CONTINENT_REGEX.test(code.trim()))) {
            errors.push('Geo continent codes must be one of AF, AN, AS, EU, NA, OC, SA');
          }
        }

        // Validate geo-steering requirements
        if (strategy === 'geo-steering') {
          const hasCountries = Array.isArray(origin.geoCountries) && origin.geoCountries.length > 0;
          const hasColos = Array.isArray(origin.geoColos) && origin.geoColos.length > 0;
          const hasContinents = Array.isArray(origin.geoContinents) && origin.geoContinents.length > 0;

          if (!hasCountries && !hasColos && !hasContinents) {
            errors.push(`Origin ${index + 1} requires at least one geo field (countries, regions, or continents) when using geo-steering`);
          }
        }
      });
    }

    if (!strategy) {
      errors.push('Strategy is required');
    } else if (!SUPPORTED_STRATEGIES.has(strategy)) {
      errors.push('Strategy must be a supported routing mode');
    }

    if (weightedEnabled === null) {
      errors.push('weightedEnabled must be a boolean');
    }

    if (!placement || typeof placement !== 'object' || Array.isArray(placement)) {
      errors.push('Placement configuration is required');
    } else {
      if (placement.smartPlacement !== undefined && typeof placement.smartPlacement !== 'boolean') {
        errors.push('smartPlacement must be a boolean');
      }

      if (placement.region !== undefined) {
        if (typeof placement.region !== 'string' || !REGION_REGEX.test(placement.region.trim())) {
          errors.push('Region must be in format "provider:region" (e.g., aws:us-east-1)');
        }
      }
    }

    return errors;
  }),
];

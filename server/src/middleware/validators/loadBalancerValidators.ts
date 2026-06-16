import { validateBody } from '../validation';
import { WORKER_SCRIPT_NAME_REGEX } from '../../utils/workerName';

const DOMAIN_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-_.]*[a-zA-Z0-9]$/;
const SUBDOMAIN_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
const REGION_REGEX = /^(aws|gcp|azure):[a-z0-9-]+$/;
const GEO_COUNTRY_REGEX = /^[A-Z]{2}$/;
const GEO_CONTINENT_REGEX = /^(AF|AN|AS|EU|NA|OC|SA)$/;
const GEO_SUBDIVISION_REGEX = /^[A-Z0-9]{1,3}$/;
const GEO_CITY_REGEX = /^[A-Z0-9 .'\-]{2,64}$/;

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

        if (origin?.geoCities !== undefined) {
          if (!Array.isArray(origin.geoCities)) {
            errors.push('geoCities must be an array');
          } else if (origin.geoCities.some((value: any) => typeof value !== 'string' || !GEO_CITY_REGEX.test(value.trim().toUpperCase()))) {
            errors.push('Geo city names must be 2-64 characters: letters, digits, spaces, hyphens, dots, or apostrophes');
          }
        }

        if (origin?.geoSubdivisions !== undefined) {
          if (!Array.isArray(origin.geoSubdivisions)) {
            errors.push('geoSubdivisions must be an array');
          } else if (origin.geoSubdivisions.some((code: any) => typeof code !== 'string' || !GEO_SUBDIVISION_REGEX.test(code.trim().toUpperCase()))) {
            errors.push('Geo subdivision codes must be 1-3 uppercase letters or digits (ISO 3166-2 subdivision)');
          }
        }

        if (origin?.geoCountries !== undefined) {
          if (!Array.isArray(origin.geoCountries)) {
            errors.push('geoCountries must be an array');
          } else if (origin.geoCountries.some((code: any) => typeof code !== 'string' || !GEO_COUNTRY_REGEX.test(code.trim()))) {
            errors.push('Geo country codes must use 2-letter uppercase ISO country codes');
          }
        }

        if (origin?.geoContinents !== undefined) {
          if (!Array.isArray(origin.geoContinents)) {
            errors.push('geoContinents must be an array');
          } else if (origin.geoContinents.some((code: any) => typeof code !== 'string' || !GEO_CONTINENT_REGEX.test(code.trim()))) {
            errors.push('Geo continent codes must be one of AF, AN, AS, EU, NA, OC, SA');
          }
        }

        if (origin?.isFallback !== undefined && typeof origin.isFallback !== 'boolean') {
          errors.push('isFallback must be a boolean');
        }

        // Validate geo-steering requirements
        if (strategy === 'geo-steering') {
          const hasCities = Array.isArray(origin.geoCities) && origin.geoCities.length > 0;
          const hasSubdivisions = Array.isArray(origin.geoSubdivisions) && origin.geoSubdivisions.length > 0;
          const hasCountries = Array.isArray(origin.geoCountries) && origin.geoCountries.length > 0;
          const hasContinents = Array.isArray(origin.geoContinents) && origin.geoContinents.length > 0;
          const isFallback = origin?.isFallback === true;

          if (!isFallback && !hasCities && !hasSubdivisions && !hasCountries && !hasContinents) {
            errors.push(`Origin ${index + 1} requires at least one geo field (cities, subdivisions, countries, or continents), or must be marked as a fallback origin`);
          }
        }
      });

      // Enforce single fallback origin for geo-steering
      if (strategy === 'geo-steering') {
        const fallbackCount = origins.filter((o: any) => o?.isFallback === true).length;
        if (fallbackCount > 1) {
          errors.push('Only one origin can be marked as the fallback origin');
        }
      }
    }

    if (!strategy) {
      errors.push('Strategy is required');
    } else if (!SUPPORTED_STRATEGIES.has(strategy)) {
      errors.push('Strategy must be a supported routing mode');
    }

    if (weightedEnabled === null) {
      errors.push('weightedEnabled must be a boolean');
    }

    const corsEnabled = body?.corsEnabled;
    if (corsEnabled !== undefined && typeof corsEnabled !== 'boolean') {
      errors.push('corsEnabled must be a boolean');
    }

    const corsOrigins = body?.corsOrigins;
    if (corsOrigins !== undefined) {
      if (!Array.isArray(corsOrigins)) {
        errors.push('corsOrigins must be an array');
      } else {
        corsOrigins.forEach((o: any, i: number) => {
          if (typeof o !== 'string' || !/^https?:\/\/[^/]+$/.test(o.trim())) {
            errors.push(`corsOrigins[${i}] must be a valid origin (e.g. https://example.com)`);
          }
        });
      }
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

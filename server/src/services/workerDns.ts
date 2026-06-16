import axios from 'axios';
import { retryWithBackoff } from '../utils/retry';
import type { OriginServer } from './workerGenerator';

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

export interface IpOriginRecord {
  originalUrl: string;  // raw IP URL the user entered — shown in UI
  hostname: string;     // generated internal hostname used in worker script
  dnsRecordId: string;  // Cloudflare DNS record ID for update/delete
}

export function isRawIpOrigin(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
  } catch {
    return false;
  }
}

export function buildIpOriginHostname(scriptName: string, index: number, domain: string): string {
  return `${scriptName}-o${index + 1}.${domain}`;
}

// Augmented origin type that carries the optional pre-converted rawIp from the UI
export type OriginWithRawIp = OriginServer & { rawIp?: string };

function resolveIpUrl(originalUrl: string, generatedHostname: string): string {
  try {
    const u = new URL(originalUrl);
    const port = u.port ? `:${u.port}` : '';
    return `${u.protocol}//${generatedHostname}${port}`;
  } catch {
    return originalUrl;
  }
}

export async function createIpDnsRecord(params: {
  apiToken: string;
  zoneId: string;
  hostname: string;
  ip: string;
}): Promise<string> {
  const { apiToken, zoneId, hostname, ip } = params;

  let response: any;
  try {
    response = await retryWithBackoff(
      () => axios.post(
        `${CLOUDFLARE_API_BASE}/zones/${zoneId}/dns_records`,
        {
          type: 'A',
          name: hostname,
          content: ip,
          ttl: 1,
          proxied: false,
          comment: 'EdgeBalancer internal — do not delete',
        },
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      ),
      {
        maxRetries: 3,
        initialDelay: 1000,
        retryableStatusCodes: [429, 500, 502, 503, 504],
      }
    );
  } catch (error: any) {
    if (error.response?.status === 403) {
      const err = new Error('Your Cloudflare API token is missing the Zone > DNS > Edit permission. Please update your token at dash.cloudflare.com/profile/api-tokens to use raw IP origins.');
      (err as any).statusCode = 422;
      throw err;
    }
    throw error;
  }

  if (!response.data.success) {
    throw new Error(`Failed to create DNS record for ${hostname}: ${response.data.errors?.[0]?.message}`);
  }

  return response.data.result.id as string;
}

export async function updateIpDnsRecord(params: {
  apiToken: string;
  zoneId: string;
  recordId: string;
  hostname: string;
  newIp: string;
}): Promise<void> {
  const { apiToken, zoneId, recordId, hostname, newIp } = params;

  const response = await retryWithBackoff(
    () => axios.put(
      `${CLOUDFLARE_API_BASE}/zones/${zoneId}/dns_records/${recordId}`,
      {
        type: 'A',
        name: hostname,
        content: newIp,
        ttl: 1,
        proxied: false,
        comment: 'EdgeBalancer internal — do not delete',
      },
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    ),
    {
      maxRetries: 3,
      initialDelay: 1000,
      retryableStatusCodes: [429, 500, 502, 503, 504],
    }
  );

  if (!response.data.success) {
    throw new Error(`Failed to update DNS record ${recordId}: ${response.data.errors?.[0]?.message}`);
  }
}

export async function deleteIpDnsRecord(params: {
  apiToken: string;
  zoneId: string;
  recordId: string;
}): Promise<void> {
  const { apiToken, zoneId, recordId } = params;
  try {
    await retryWithBackoff(
      () => axios.delete(
        `${CLOUDFLARE_API_BASE}/zones/${zoneId}/dns_records/${recordId}`,
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      ),
      {
        maxRetries: 3,
        initialDelay: 1000,
        retryableStatusCodes: [429, 500, 502, 503, 504],
      }
    );
  } catch (error: any) {
    if (error.response?.status === 404) return; // already gone — silent
    throw error;
  }
}

/**
 * Create orchestrator: create DNS A records for all raw IP origins.
 * Also handles origins where the user already converted the IP to a hostname in the UI
 * (indicated by rawIp being set on the origin).
 * Rolls back any created records if an error occurs mid-loop.
 */
export async function resolveIpOrigins(params: {
  origins: OriginWithRawIp[];
  scriptName: string;
  domain: string;
  zoneId: string;
  apiToken: string;
}): Promise<{
  resolvedOrigins: OriginServer[];
  ipOriginRecords: IpOriginRecord[];
}> {
  const { origins, scriptName, domain, zoneId, apiToken } = params;

  const resolvedOrigins: OriginServer[] = origins.map(({ rawIp: _, ...rest }) => ({ ...rest }));
  const ipOriginRecords: IpOriginRecord[] = [];
  const createdRecordIds: string[] = [];

  try {
    for (let i = 0; i < origins.length; i++) {
      const origin = origins[i];

      if (isRawIpOrigin(origin.url)) {
        // Auto-convert: user submitted raw IP, we generate the hostname
        const ip = new URL(origin.url).hostname;
        const generatedHostname = buildIpOriginHostname(scriptName, i, domain);
        const recordId = await createIpDnsRecord({ apiToken, zoneId, hostname: generatedHostname, ip });
        createdRecordIds.push(recordId);

        resolvedOrigins[i] = { ...resolvedOrigins[i], url: resolveIpUrl(origin.url, generatedHostname) };
        ipOriginRecords.push({ originalUrl: origin.url, hostname: generatedHostname, dnsRecordId: recordId });

      } else if (origin.rawIp) {
        // User clicked "Convert to Domain" in the UI: origin.url is already the hostname,
        // rawIp holds the original IP to point the DNS record at
        const hostname = new URL(origin.url).hostname;
        const protocol = new URL(origin.url).protocol;
        const originalUrl = `${protocol}//${origin.rawIp}`;
        const recordId = await createIpDnsRecord({ apiToken, zoneId, hostname, ip: origin.rawIp });
        createdRecordIds.push(recordId);

        // resolvedOrigins[i].url is already the hostname — no substitution needed
        ipOriginRecords.push({ originalUrl, hostname, dnsRecordId: recordId });
      }
    }
  } catch (error) {
    await Promise.allSettled(
      createdRecordIds.map(id => deleteIpDnsRecord({ apiToken, zoneId, recordId: id }))
    );
    throw error;
  }

  return { resolvedOrigins, ipOriginRecords };
}

/**
 * Update orchestrator — Phase 1: create new records and update changed IPs.
 * Deletion of obsolete records happens AFTER the DB update succeeds (Phase 2),
 * so the old worker always has valid DNS until the new one is live.
 *
 * Returns:
 *   resolvedOrigins    — origins with IP URLs substituted by internal hostnames
 *   ipOriginRecords    — updated mapping to store in DB
 *   createdRecordIds   — IDs of newly created records (for rollback on deploy failure)
 *   obsoleteRecords    — records to delete after DB update completes
 */
export async function provisionIpDnsChanges(params: {
  newOrigins: OriginWithRawIp[];
  existingRecords: IpOriginRecord[];
  scriptName: string;
  domain: string;
  zoneId: string;
  apiToken: string;
}): Promise<{
  resolvedOrigins: OriginServer[];
  ipOriginRecords: IpOriginRecord[];
  createdRecordIds: string[];
  obsoleteRecords: IpOriginRecord[];
}> {
  const { newOrigins, existingRecords, scriptName, domain, zoneId, apiToken } = params;

  const resolvedOrigins: OriginServer[] = newOrigins.map(({ rawIp: _, ...rest }) => ({ ...rest }));
  const newIpOriginRecords: IpOriginRecord[] = [];
  const createdRecordIds: string[] = [];
  const handledHostnames = new Set<string>();

  try {
    for (let i = 0; i < newOrigins.length; i++) {
      const origin = newOrigins[i];

      if (isRawIpOrigin(origin.url)) {
        // Auto-convert: raw IP URL
        const newIp = new URL(origin.url).hostname;
        const generatedHostname = buildIpOriginHostname(scriptName, i, domain);
        handledHostnames.add(generatedHostname);

        const existing = existingRecords.find(r => r.hostname === generatedHostname);
        if (existing) {
          const existingIp = new URL(existing.originalUrl).hostname;
          if (existingIp === newIp) {
            resolvedOrigins[i] = { ...resolvedOrigins[i], url: resolveIpUrl(origin.url, generatedHostname) };
            newIpOriginRecords.push(existing);
          } else {
            await updateIpDnsRecord({ apiToken, zoneId, recordId: existing.dnsRecordId, hostname: generatedHostname, newIp });
            resolvedOrigins[i] = { ...resolvedOrigins[i], url: resolveIpUrl(origin.url, generatedHostname) };
            newIpOriginRecords.push({ originalUrl: origin.url, hostname: generatedHostname, dnsRecordId: existing.dnsRecordId });
          }
        } else {
          const recordId = await createIpDnsRecord({ apiToken, zoneId, hostname: generatedHostname, ip: newIp });
          createdRecordIds.push(recordId);
          resolvedOrigins[i] = { ...resolvedOrigins[i], url: resolveIpUrl(origin.url, generatedHostname) };
          newIpOriginRecords.push({ originalUrl: origin.url, hostname: generatedHostname, dnsRecordId: recordId });
        }

      } else if (origin.rawIp) {
        // User clicked "Convert to Domain": url is already the hostname, rawIp is the original IP
        const hostname = new URL(origin.url).hostname;
        const protocol = new URL(origin.url).protocol;
        const originalUrl = `${protocol}//${origin.rawIp}`;
        handledHostnames.add(hostname);

        const existing = existingRecords.find(r => r.hostname === hostname);
        if (existing) {
          const existingIp = new URL(existing.originalUrl).hostname;
          if (existingIp === origin.rawIp) {
            // Same IP — no-op, reuse record
            newIpOriginRecords.push(existing);
          } else {
            await updateIpDnsRecord({ apiToken, zoneId, recordId: existing.dnsRecordId, hostname, newIp: origin.rawIp });
            newIpOriginRecords.push({ originalUrl, hostname, dnsRecordId: existing.dnsRecordId });
          }
        } else {
          const recordId = await createIpDnsRecord({ apiToken, zoneId, hostname, ip: origin.rawIp });
          createdRecordIds.push(recordId);
          newIpOriginRecords.push({ originalUrl, hostname, dnsRecordId: recordId });
        }
        // resolvedOrigins[i].url is already the hostname — no substitution
      }
    }
  } catch (error) {
    await Promise.allSettled(
      createdRecordIds.map(id => deleteIpDnsRecord({ apiToken, zoneId, recordId: id }))
    );
    throw error;
  }

  const obsoleteRecords = existingRecords.filter(r => !handledHostnames.has(r.hostname));

  return { resolvedOrigins, ipOriginRecords: newIpOriginRecords, createdRecordIds, obsoleteRecords };
}

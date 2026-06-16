import axios from 'axios';
import {
  isRawIpOrigin,
  buildIpOriginHostname,
  createIpDnsRecord,
  updateIpDnsRecord,
  deleteIpDnsRecord,
  resolveIpOrigins,
  provisionIpDnsChanges,
} from '../../services/workerDns';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('axios');
jest.mock('../../utils/retry', () => ({
  retryWithBackoff: jest.fn().mockImplementation((fn: () => any) => fn()),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

// ─── Constants ───────────────────────────────────────────────────────────────

const BASE_PARAMS = {
  apiToken: 'test-token',
  zoneId: 'zone-123',
};

// ─── isRawIpOrigin ───────────────────────────────────────────────────────────

describe('isRawIpOrigin', () => {
  it('returns true for a bare IPv4 URL', () => {
    expect(isRawIpOrigin('http://18.60.112.44')).toBe(true);
  });

  it('returns true for an IPv4 URL with port and path', () => {
    expect(isRawIpOrigin('http://18.60.112.44:8080/path')).toBe(true);
  });

  it('returns false for a regular hostname', () => {
    expect(isRawIpOrigin('https://example.com')).toBe(false);
  });

  it('returns false for a generated internal hostname', () => {
    expect(isRawIpOrigin('https://prod-lb-o1.example.com')).toBe(false);
  });

  it('returns false for an empty string (URL parse error)', () => {
    expect(isRawIpOrigin('')).toBe(false);
  });

  it('returns true for any protocol with an IPv4 address', () => {
    expect(isRawIpOrigin('ftp://18.60.112.44')).toBe(true);
  });

  it('returns false for IPv6 addresses', () => {
    expect(isRawIpOrigin('http://[::1]')).toBe(false);
  });
});

// ─── buildIpOriginHostname ────────────────────────────────────────────────────

describe('buildIpOriginHostname', () => {
  it('generates o1 for index 0', () => {
    expect(buildIpOriginHostname('my-lb', 0, 'nexoral.in')).toBe('my-lb-o1.nexoral.in');
  });

  it('generates o3 for index 2', () => {
    expect(buildIpOriginHostname('my-lb', 2, 'nexoral.in')).toBe('my-lb-o3.nexoral.in');
  });
});

// ─── createIpDnsRecord ────────────────────────────────────────────────────────

describe('createIpDnsRecord', () => {
  const CREATE_PARAMS = {
    ...BASE_PARAMS,
    hostname: 'my-lb-o1.example.com',
    ip: '1.2.3.4',
  };

  it('returns the record ID on success', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { success: true, result: { id: 'rec-123' } },
    });

    const id = await createIpDnsRecord(CREATE_PARAMS);
    expect(id).toBe('rec-123');
  });

  it('throws 422 with permission message on a 403 response', async () => {
    const cfError = Object.assign(new Error('Forbidden'), {
      response: { status: 403 },
    });
    mockedAxios.post.mockRejectedValueOnce(cfError);

    await expect(createIpDnsRecord(CREATE_PARAMS)).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringContaining('Zone > DNS > Edit'),
    });
  });

  it('throws when Cloudflare returns success: false', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { success: false, errors: [{ message: 'already exists' }] },
    });

    await expect(createIpDnsRecord(CREATE_PARAMS)).rejects.toThrow('already exists');
  });
});

// ─── deleteIpDnsRecord ────────────────────────────────────────────────────────

describe('deleteIpDnsRecord', () => {
  const DELETE_PARAMS = { ...BASE_PARAMS, recordId: 'rec-123' };

  it('resolves without throwing on success', async () => {
    mockedAxios.delete.mockResolvedValueOnce({ data: { success: true } });

    await expect(deleteIpDnsRecord(DELETE_PARAMS)).resolves.toBeUndefined();
  });

  it('resolves silently on a 404 (record already gone)', async () => {
    const notFound = Object.assign(new Error('Not Found'), {
      response: { status: 404 },
    });
    mockedAxios.delete.mockRejectedValueOnce(notFound);

    await expect(deleteIpDnsRecord(DELETE_PARAMS)).resolves.toBeUndefined();
  });

  it('re-throws on a 500 error', async () => {
    const serverError = Object.assign(new Error('Internal Server Error'), {
      response: { status: 500 },
    });
    mockedAxios.delete.mockRejectedValueOnce(serverError);

    await expect(deleteIpDnsRecord(DELETE_PARAMS)).rejects.toThrow('Internal Server Error');
  });
});

// ─── resolveIpOrigins ─────────────────────────────────────────────────────────

describe('resolveIpOrigins', () => {
  const RESOLVE_PARAMS = {
    ...BASE_PARAMS,
    scriptName: 'my-lb',
    domain: 'example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns same origins with empty ipOriginRecords when there are no IPs', async () => {
    const origins = [{ url: 'https://backend.example.com', weight: 100 }];
    const result = await resolveIpOrigins({ ...RESOLVE_PARAMS, origins });

    expect(result.resolvedOrigins).toHaveLength(1);
    expect(result.resolvedOrigins[0].url).toBe('https://backend.example.com');
    expect(result.ipOriginRecords).toHaveLength(0);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('creates a DNS record for a raw IP origin and returns ipOriginRecords entry', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { success: true, result: { id: 'dns-rec-1' } },
    });

    const origins = [{ url: 'http://1.2.3.4', weight: 100 }];
    const result = await resolveIpOrigins({ ...RESOLVE_PARAMS, origins });

    expect(result.resolvedOrigins[0].url).toBe('http://my-lb-o1.example.com');
    expect(result.ipOriginRecords).toHaveLength(1);
    expect(result.ipOriginRecords[0]).toMatchObject({
      originalUrl: 'http://1.2.3.4',
      hostname: 'my-lb-o1.example.com',
      dnsRecordId: 'dns-rec-1',
    });
  });

  it('handles a pre-converted origin (rawIp set) using rawIp as the DNS IP', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { success: true, result: { id: 'dns-rec-2' } },
    });

    const origins = [{ url: 'http://my-lb-o1.example.com', weight: 100, rawIp: '5.6.7.8' }];
    const result = await resolveIpOrigins({ ...RESOLVE_PARAMS, origins });

    // url already has the hostname — should remain unchanged
    expect(result.resolvedOrigins[0].url).toBe('http://my-lb-o1.example.com');
    expect(result.ipOriginRecords[0]).toMatchObject({
      originalUrl: 'http://5.6.7.8',
      hostname: 'my-lb-o1.example.com',
      dnsRecordId: 'dns-rec-2',
    });
  });

  it('only creates a DNS record for the raw IP origin in a mixed list', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { success: true, result: { id: 'dns-rec-3' } },
    });

    const origins = [
      { url: 'http://1.2.3.4', weight: 50 },
      { url: 'https://backend.example.com', weight: 50 },
    ];
    const result = await resolveIpOrigins({ ...RESOLVE_PARAMS, origins });

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(result.ipOriginRecords).toHaveLength(1);
    expect(result.resolvedOrigins[0].url).toBe('http://my-lb-o1.example.com');
    expect(result.resolvedOrigins[1].url).toBe('https://backend.example.com');
  });

  it('rolls back the first created record when a later one fails', async () => {
    mockedAxios.post
      .mockResolvedValueOnce({ data: { success: true, result: { id: 'rec-first' } } })
      .mockResolvedValueOnce({ data: { success: false, errors: [{ message: 'quota exceeded' }] } });

    mockedAxios.delete.mockResolvedValueOnce({ data: { success: true } });

    const origins = [
      { url: 'http://1.1.1.1', weight: 50 },
      { url: 'http://2.2.2.2', weight: 50 },
    ];

    await expect(resolveIpOrigins({ ...RESOLVE_PARAMS, origins })).rejects.toThrow();
    expect(mockedAxios.delete).toHaveBeenCalledTimes(1);
    expect(mockedAxios.delete.mock.calls[0][0] as string).toContain('rec-first');
  });
});

// ─── provisionIpDnsChanges ────────────────────────────────────────────────────

describe('provisionIpDnsChanges', () => {
  const PROVISION_PARAMS = {
    ...BASE_PARAMS,
    scriptName: 'my-lb',
    domain: 'example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty results with no IP origins', async () => {
    const result = await provisionIpDnsChanges({
      ...PROVISION_PARAMS,
      newOrigins: [{ url: 'https://backend.example.com', weight: 100 }],
      existingRecords: [],
    });

    expect(result.ipOriginRecords).toHaveLength(0);
    expect(result.createdRecordIds).toHaveLength(0);
    expect(result.obsoleteRecords).toHaveLength(0);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('creates a record for a new raw IP not in existingRecords', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { success: true, result: { id: 'new-rec' } },
    });

    const result = await provisionIpDnsChanges({
      ...PROVISION_PARAMS,
      newOrigins: [{ url: 'http://1.2.3.4', weight: 100 }],
      existingRecords: [],
    });

    expect(result.createdRecordIds).toContain('new-rec');
    expect(result.ipOriginRecords[0].dnsRecordId).toBe('new-rec');
  });

  it('reuses an existing record when the IP has not changed (no-op)', async () => {
    const result = await provisionIpDnsChanges({
      ...PROVISION_PARAMS,
      newOrigins: [{ url: 'http://1.2.3.4', weight: 100 }],
      existingRecords: [
        { originalUrl: 'http://1.2.3.4', hostname: 'my-lb-o1.example.com', dnsRecordId: 'old-rec' },
      ],
    });

    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(mockedAxios.put).not.toHaveBeenCalled();
    expect(result.createdRecordIds).toHaveLength(0);
    expect(result.ipOriginRecords[0].dnsRecordId).toBe('old-rec');
  });

  it('calls updateIpDnsRecord when the IP changes for an existing record', async () => {
    mockedAxios.put.mockResolvedValueOnce({
      data: { success: true },
    });

    const result = await provisionIpDnsChanges({
      ...PROVISION_PARAMS,
      newOrigins: [{ url: 'http://9.9.9.9', weight: 100 }],
      existingRecords: [
        { originalUrl: 'http://1.2.3.4', hostname: 'my-lb-o1.example.com', dnsRecordId: 'old-rec' },
      ],
    });

    expect(mockedAxios.put).toHaveBeenCalledTimes(1);
    expect(result.createdRecordIds).toHaveLength(0);
    expect(result.ipOriginRecords[0].dnsRecordId).toBe('old-rec');
  });

  it('marks a record as obsolete when its hostname is not in the new origins', async () => {
    const result = await provisionIpDnsChanges({
      ...PROVISION_PARAMS,
      newOrigins: [{ url: 'https://backend.example.com', weight: 100 }],
      existingRecords: [
        { originalUrl: 'http://1.2.3.4', hostname: 'my-lb-o1.example.com', dnsRecordId: 'stale-rec' },
      ],
    });

    expect(result.obsoleteRecords).toHaveLength(1);
    expect(result.obsoleteRecords[0].dnsRecordId).toBe('stale-rec');
  });

  it('reuses existing record for pre-converted origin with same IP (no-op)', async () => {
    const result = await provisionIpDnsChanges({
      ...PROVISION_PARAMS,
      newOrigins: [{ url: 'http://my-lb-o1.example.com', weight: 100, rawIp: '1.2.3.4' }],
      existingRecords: [
        { originalUrl: 'http://1.2.3.4', hostname: 'my-lb-o1.example.com', dnsRecordId: 'existing-rec' },
      ],
    });

    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(mockedAxios.put).not.toHaveBeenCalled();
    expect(result.createdRecordIds).toHaveLength(0);
    expect(result.ipOriginRecords[0].dnsRecordId).toBe('existing-rec');
  });

  it('calls updateIpDnsRecord for pre-converted origin with changed IP', async () => {
    mockedAxios.put.mockResolvedValueOnce({ data: { success: true } });

    const result = await provisionIpDnsChanges({
      ...PROVISION_PARAMS,
      newOrigins: [{ url: 'http://my-lb-o1.example.com', weight: 100, rawIp: '9.9.9.9' }],
      existingRecords: [
        { originalUrl: 'http://1.2.3.4', hostname: 'my-lb-o1.example.com', dnsRecordId: 'existing-rec' },
      ],
    });

    expect(mockedAxios.put).toHaveBeenCalledTimes(1);
    expect(result.createdRecordIds).toHaveLength(0);
  });

  it('creates a new record for a pre-converted origin with no existing record', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { success: true, result: { id: 'brand-new-rec' } },
    });

    const result = await provisionIpDnsChanges({
      ...PROVISION_PARAMS,
      newOrigins: [{ url: 'http://my-lb-o1.example.com', weight: 100, rawIp: '5.5.5.5' }],
      existingRecords: [],
    });

    expect(result.createdRecordIds).toContain('brand-new-rec');
  });
});

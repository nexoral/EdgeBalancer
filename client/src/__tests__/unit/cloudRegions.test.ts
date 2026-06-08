import { isValidRegionFormat, parseRegion, AWS_REGIONS, GCP_REGIONS, AZURE_REGIONS } from '@/lib/cloudRegions';

describe('isValidRegionFormat', () => {
  it('accepts valid AWS region format', () => {
    expect(isValidRegionFormat('aws:us-east-1')).toBe(true);
  });

  it('accepts valid GCP region format', () => {
    expect(isValidRegionFormat('gcp:us-central1')).toBe(true);
  });

  it('accepts valid Azure region format', () => {
    expect(isValidRegionFormat('azure:eastus')).toBe(true);
  });

  it('rejects plain region without provider prefix', () => {
    expect(isValidRegionFormat('us-east-1')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidRegionFormat('')).toBe(false);
  });

  it('rejects unknown provider prefix', () => {
    expect(isValidRegionFormat('unknown:us-east-1')).toBe(false);
  });
});

describe('parseRegion', () => {
  it('parses AWS region correctly', () => {
    const result = parseRegion('aws:us-east-1');
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('aws');
    expect(result!.region).toBe('us-east-1');
  });

  it('parses GCP region correctly', () => {
    const result = parseRegion('gcp:us-central1');
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('gcp');
    expect(result!.region).toBe('us-central1');
  });

  it('returns null for invalid format', () => {
    expect(parseRegion('invalid-region')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseRegion('')).toBeNull();
  });
});

describe('Region arrays', () => {
  it('AWS_REGIONS is non-empty and all codes start with aws:', () => {
    expect(AWS_REGIONS.length).toBeGreaterThan(0);
    expect(AWS_REGIONS.every(r => r.code.startsWith('aws:'))).toBe(true);
  });

  it('GCP_REGIONS is non-empty and all codes start with gcp:', () => {
    expect(GCP_REGIONS.length).toBeGreaterThan(0);
    expect(GCP_REGIONS.every(r => r.code.startsWith('gcp:'))).toBe(true);
  });

  it('AZURE_REGIONS is non-empty and all codes start with azure:', () => {
    expect(AZURE_REGIONS.length).toBeGreaterThan(0);
    expect(AZURE_REGIONS.every(r => r.code.startsWith('azure:'))).toBe(true);
  });
});

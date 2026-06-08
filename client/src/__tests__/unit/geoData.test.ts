import {
  getFlagEmoji,
  getCitiesByCountry,
  getSubdivisionsByCountry,
  CONTINENTS,
  COUNTRIES,
} from '@/lib/geoData';

describe('getFlagEmoji', () => {
  it('returns flag emoji for US', () => {
    expect(getFlagEmoji('US')).toBe('🇺🇸');
  });

  it('returns flag emoji for IN', () => {
    expect(getFlagEmoji('IN')).toBe('🇮🇳');
  });

  it('returns flag emoji for GB', () => {
    expect(getFlagEmoji('GB')).toBe('🇬🇧');
  });

  it('returns flag emoji for DE', () => {
    expect(getFlagEmoji('DE')).toBe('🇩🇪');
  });
});

describe('getCitiesByCountry', () => {
  it('returns non-empty array for India (IN)', () => {
    const cities = getCitiesByCountry('IN');
    expect(Array.isArray(cities)).toBe(true);
    expect(cities.length).toBeGreaterThan(0);
  });

  it('returns non-empty array for US', () => {
    const cities = getCitiesByCountry('US');
    expect(Array.isArray(cities)).toBe(true);
    expect(cities.length).toBeGreaterThan(0);
  });

  it('returns empty array for unknown country code', () => {
    const cities = getCitiesByCountry('XX');
    expect(Array.isArray(cities)).toBe(true);
    expect(cities).toHaveLength(0);
  });
});

describe('getSubdivisionsByCountry', () => {
  it('returns subdivisions for US', () => {
    const subs = getSubdivisionsByCountry('US');
    expect(Array.isArray(subs)).toBe(true);
    expect(subs.length).toBeGreaterThan(0);
  });

  it('returns empty array for unknown country code', () => {
    const subs = getSubdivisionsByCountry('XX');
    expect(Array.isArray(subs)).toBe(true);
    expect(subs).toHaveLength(0);
  });
});

describe('CONTINENTS', () => {
  it('has 7 entries', () => {
    expect(CONTINENTS).toHaveLength(7);
  });
});

describe('COUNTRIES', () => {
  it('is non-empty', () => {
    expect(COUNTRIES.length).toBeGreaterThan(0);
  });

  it('all entries have a code and name', () => {
    expect(COUNTRIES.every(c => c.code && c.name)).toBe(true);
  });
});

/**
 * Geographic data for load balancer routing
 * Sources:
 * - Continents: Standard 7-continent model
 * - Countries: ISO 3166-1 alpha-2 codes
 * - Regions: Cloudflare data center colo codes (IATA airport codes)
 * - Data from: https://github.com/Netrvin/cloudflare-colo-list
 */

export const CONTINENTS = [
  { code: 'AF', name: 'Africa' },
  { code: 'AN', name: 'Antarctica' },
  { code: 'AS', name: 'Asia' },
  { code: 'EU', name: 'Europe' },
  { code: 'NA', name: 'North America' },
  { code: 'OC', name: 'Oceania' },
  { code: 'SA', name: 'South America' },
] as const;

export const COUNTRIES = [
  // Asia
  { code: 'IN', name: 'India', continent: 'AS' },
  { code: 'CN', name: 'China', continent: 'AS' },
  { code: 'JP', name: 'Japan', continent: 'AS' },
  { code: 'KR', name: 'South Korea', continent: 'AS' },
  { code: 'SG', name: 'Singapore', continent: 'AS' },
  { code: 'MY', name: 'Malaysia', continent: 'AS' },
  { code: 'TH', name: 'Thailand', continent: 'AS' },
  { code: 'VN', name: 'Vietnam', continent: 'AS' },
  { code: 'ID', name: 'Indonesia', continent: 'AS' },
  { code: 'PH', name: 'Philippines', continent: 'AS' },
  { code: 'PK', name: 'Pakistan', continent: 'AS' },
  { code: 'BD', name: 'Bangladesh', continent: 'AS' },
  { code: 'LK', name: 'Sri Lanka', continent: 'AS' },
  { code: 'HK', name: 'Hong Kong', continent: 'AS' },
  { code: 'TW', name: 'Taiwan', continent: 'AS' },

  // Europe
  { code: 'GB', name: 'United Kingdom', continent: 'EU' },
  { code: 'DE', name: 'Germany', continent: 'EU' },
  { code: 'FR', name: 'France', continent: 'EU' },
  { code: 'IT', name: 'Italy', continent: 'EU' },
  { code: 'ES', name: 'Spain', continent: 'EU' },
  { code: 'NL', name: 'Netherlands', continent: 'EU' },
  { code: 'SE', name: 'Sweden', continent: 'EU' },
  { code: 'NO', name: 'Norway', continent: 'EU' },
  { code: 'DK', name: 'Denmark', continent: 'EU' },
  { code: 'FI', name: 'Finland', continent: 'EU' },
  { code: 'PL', name: 'Poland', continent: 'EU' },
  { code: 'CH', name: 'Switzerland', continent: 'EU' },
  { code: 'AT', name: 'Austria', continent: 'EU' },
  { code: 'BE', name: 'Belgium', continent: 'EU' },
  { code: 'IE', name: 'Ireland', continent: 'EU' },
  { code: 'PT', name: 'Portugal', continent: 'EU' },
  { code: 'RU', name: 'Russia', continent: 'EU' },

  // North America
  { code: 'US', name: 'United States', continent: 'NA' },
  { code: 'CA', name: 'Canada', continent: 'NA' },
  { code: 'MX', name: 'Mexico', continent: 'NA' },

  // South America
  { code: 'BR', name: 'Brazil', continent: 'SA' },
  { code: 'AR', name: 'Argentina', continent: 'SA' },
  { code: 'CL', name: 'Chile', continent: 'SA' },
  { code: 'CO', name: 'Colombia', continent: 'SA' },
  { code: 'PE', name: 'Peru', continent: 'SA' },

  // Oceania
  { code: 'AU', name: 'Australia', continent: 'OC' },
  { code: 'NZ', name: 'New Zealand', continent: 'OC' },

  // Africa
  { code: 'ZA', name: 'South Africa', continent: 'AF' },
  { code: 'NG', name: 'Nigeria', continent: 'AF' },
  { code: 'EG', name: 'Egypt', continent: 'AF' },
  { code: 'KE', name: 'Kenya', continent: 'AF' },

  // Middle East
  { code: 'AE', name: 'United Arab Emirates', continent: 'AS' },
  { code: 'SA', name: 'Saudi Arabia', continent: 'AS' },
  { code: 'IL', name: 'Israel', continent: 'AS' },
  { code: 'TR', name: 'Turkey', continent: 'AS' },
] as const;

// Cloudflare data center regions (colo codes) by country
export const REGIONS_BY_COUNTRY: Record<string, Array<{ code: string; name: string }>> = {
  'IN': [ // India
    { code: 'AGR', name: 'Agra' },
    { code: 'AMD', name: 'Ahmedabad' },
    { code: 'BLR', name: 'Bangalore' },
    { code: 'BOM', name: 'Mumbai' },
    { code: 'CCU', name: 'Kolkata' },
    { code: 'CJB', name: 'Coimbatore' },
    { code: 'CNN', name: 'Kannur' },
    { code: 'COK', name: 'Kochi' },
    { code: 'DEL', name: 'New Delhi' },
    { code: 'HYD', name: 'Hyderabad' },
    { code: 'IXC', name: 'Chandigarh' },
    { code: 'KNU', name: 'Kanpur' },
    { code: 'MAA', name: 'Chennai' },
    { code: 'NAG', name: 'Nagpur' },
    { code: 'PAT', name: 'Patna' },
    { code: 'PNQ', name: 'Pune' },
  ],
  'US': [ // United States (major cities)
    { code: 'ATL', name: 'Atlanta' },
    { code: 'BOS', name: 'Boston' },
    { code: 'ORD', name: 'Chicago' },
    { code: 'DFW', name: 'Dallas' },
    { code: 'DEN', name: 'Denver' },
    { code: 'DTW', name: 'Detroit' },
    { code: 'IAH', name: 'Houston' },
    { code: 'LAS', name: 'Las Vegas' },
    { code: 'LAX', name: 'Los Angeles' },
    { code: 'MIA', name: 'Miami' },
    { code: 'MSP', name: 'Minneapolis' },
    { code: 'EWR', name: 'Newark' },
    { code: 'JFK', name: 'New York' },
    { code: 'PHL', name: 'Philadelphia' },
    { code: 'PHX', name: 'Phoenix' },
    { code: 'SEA', name: 'Seattle' },
    { code: 'SFO', name: 'San Francisco' },
    { code: 'SJC', name: 'San Jose' },
    { code: 'IAD', name: 'Washington DC' },
  ],
  'GB': [ // United Kingdom
    { code: 'LHR', name: 'London' },
    { code: 'MAN', name: 'Manchester' },
    { code: 'EDI', name: 'Edinburgh' },
    { code: 'BHX', name: 'Birmingham' },
  ],
  'DE': [ // Germany
    { code: 'FRA', name: 'Frankfurt' },
    { code: 'MUC', name: 'Munich' },
    { code: 'TXL', name: 'Berlin' },
    { code: 'HAM', name: 'Hamburg' },
    { code: 'DUS', name: 'Düsseldorf' },
  ],
  'FR': [ // France
    { code: 'CDG', name: 'Paris' },
    { code: 'MRS', name: 'Marseille' },
    { code: 'LYS', name: 'Lyon' },
  ],
  'JP': [ // Japan
    { code: 'NRT', name: 'Tokyo' },
    { code: 'KIX', name: 'Osaka' },
  ],
  'AU': [ // Australia
    { code: 'SYD', name: 'Sydney' },
    { code: 'MEL', name: 'Melbourne' },
    { code: 'BNE', name: 'Brisbane' },
    { code: 'PER', name: 'Perth' },
  ],
  'SG': [ // Singapore
    { code: 'SIN', name: 'Singapore' },
  ],
  'CA': [ // Canada
    { code: 'YYZ', name: 'Toronto' },
    { code: 'YVR', name: 'Vancouver' },
    { code: 'YUL', name: 'Montreal' },
  ],
  'BR': [ // Brazil
    { code: 'GRU', name: 'São Paulo' },
    { code: 'GIG', name: 'Rio de Janeiro' },
  ],
  'NL': [ // Netherlands
    { code: 'AMS', name: 'Amsterdam' },
  ],
  'CN': [ // China (major cities)
    { code: 'PEK', name: 'Beijing' },
    { code: 'PVG', name: 'Shanghai' },
    { code: 'CAN', name: 'Guangzhou' },
    { code: 'SZX', name: 'Shenzhen' },
  ],
  'HK': [ // Hong Kong
    { code: 'HKG', name: 'Hong Kong' },
  ],
  'TH': [ // Thailand
    { code: 'BKK', name: 'Bangkok' },
  ],
  'MY': [ // Malaysia
    { code: 'KUL', name: 'Kuala Lumpur' },
  ],
  'AE': [ // United Arab Emirates
    { code: 'DXB', name: 'Dubai' },
  ],
};

// Helper function to get regions for a country
export function getRegionsByCountry(countryCode: string) {
  return REGIONS_BY_COUNTRY[countryCode] || [];
}

// Helper function to get all unique regions
export function getAllRegions() {
  const allRegions: Array<{ code: string; name: string; country: string }> = [];
  Object.entries(REGIONS_BY_COUNTRY).forEach(([countryCode, regions]) => {
    const country = COUNTRIES.find(c => c.code === countryCode);
    regions.forEach(region => {
      allRegions.push({
        ...region,
        country: country?.name || countryCode,
      });
    });
  });
  return allRegions.sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * Cloud provider region data for Worker Placement hints
 * Used to help Cloudflare position workers closer to origin infrastructure
 */

export interface CloudRegion {
  code: string;
  name: string;
  provider: 'aws' | 'gcp' | 'azure';
}

export const AWS_REGIONS: CloudRegion[] = [
  // US Regions
  { code: 'aws:us-east-1', name: 'US East (N. Virginia)', provider: 'aws' },
  { code: 'aws:us-east-2', name: 'US East (Ohio)', provider: 'aws' },
  { code: 'aws:us-west-1', name: 'US West (N. California)', provider: 'aws' },
  { code: 'aws:us-west-2', name: 'US West (Oregon)', provider: 'aws' },

  // Europe
  { code: 'aws:eu-west-1', name: 'Europe (Ireland)', provider: 'aws' },
  { code: 'aws:eu-west-2', name: 'Europe (London)', provider: 'aws' },
  { code: 'aws:eu-west-3', name: 'Europe (Paris)', provider: 'aws' },
  { code: 'aws:eu-central-1', name: 'Europe (Frankfurt)', provider: 'aws' },
  { code: 'aws:eu-north-1', name: 'Europe (Stockholm)', provider: 'aws' },

  // Asia Pacific
  { code: 'aws:ap-south-1', name: 'Asia Pacific (Mumbai)', provider: 'aws' },
  { code: 'aws:ap-northeast-1', name: 'Asia Pacific (Tokyo)', provider: 'aws' },
  { code: 'aws:ap-northeast-2', name: 'Asia Pacific (Seoul)', provider: 'aws' },
  { code: 'aws:ap-northeast-3', name: 'Asia Pacific (Osaka)', provider: 'aws' },
  { code: 'aws:ap-southeast-1', name: 'Asia Pacific (Singapore)', provider: 'aws' },
  { code: 'aws:ap-southeast-2', name: 'Asia Pacific (Sydney)', provider: 'aws' },

  // South America
  { code: 'aws:sa-east-1', name: 'South America (São Paulo)', provider: 'aws' },

  // Canada
  { code: 'aws:ca-central-1', name: 'Canada (Central)', provider: 'aws' },
];

export const GCP_REGIONS: CloudRegion[] = [
  // Americas
  { code: 'gcp:us-east1', name: 'South Carolina, USA', provider: 'gcp' },
  { code: 'gcp:us-east4', name: 'Northern Virginia, USA', provider: 'gcp' },
  { code: 'gcp:us-west1', name: 'Oregon, USA', provider: 'gcp' },
  { code: 'gcp:us-west2', name: 'Los Angeles, USA', provider: 'gcp' },
  { code: 'gcp:us-west3', name: 'Salt Lake City, USA', provider: 'gcp' },
  { code: 'gcp:us-west4', name: 'Las Vegas, USA', provider: 'gcp' },
  { code: 'gcp:us-central1', name: 'Iowa, USA', provider: 'gcp' },

  // Europe
  { code: 'gcp:europe-west1', name: 'Belgium', provider: 'gcp' },
  { code: 'gcp:europe-west2', name: 'London, UK', provider: 'gcp' },
  { code: 'gcp:europe-west3', name: 'Frankfurt, Germany', provider: 'gcp' },
  { code: 'gcp:europe-west4', name: 'Netherlands', provider: 'gcp' },
  { code: 'gcp:europe-west6', name: 'Zurich, Switzerland', provider: 'gcp' },
  { code: 'gcp:europe-north1', name: 'Finland', provider: 'gcp' },

  // Asia Pacific
  { code: 'gcp:asia-south1', name: 'Mumbai, India', provider: 'gcp' },
  { code: 'gcp:asia-south2', name: 'Delhi, India', provider: 'gcp' },
  { code: 'gcp:asia-southeast1', name: 'Singapore', provider: 'gcp' },
  { code: 'gcp:asia-southeast2', name: 'Jakarta, Indonesia', provider: 'gcp' },
  { code: 'gcp:asia-northeast1', name: 'Tokyo, Japan', provider: 'gcp' },
  { code: 'gcp:asia-northeast2', name: 'Osaka, Japan', provider: 'gcp' },
  { code: 'gcp:asia-northeast3', name: 'Seoul, South Korea', provider: 'gcp' },
  { code: 'gcp:asia-east1', name: 'Taiwan', provider: 'gcp' },
  { code: 'gcp:australia-southeast1', name: 'Sydney, Australia', provider: 'gcp' },

  // South America
  { code: 'gcp:southamerica-east1', name: 'São Paulo, Brazil', provider: 'gcp' },
];

export const AZURE_REGIONS: CloudRegion[] = [
  // Americas
  { code: 'azure:eastus', name: 'East US (Virginia)', provider: 'azure' },
  { code: 'azure:eastus2', name: 'East US 2 (Virginia)', provider: 'azure' },
  { code: 'azure:westus', name: 'West US (California)', provider: 'azure' },
  { code: 'azure:westus2', name: 'West US 2 (Washington)', provider: 'azure' },
  { code: 'azure:westus3', name: 'West US 3 (Phoenix)', provider: 'azure' },
  { code: 'azure:centralus', name: 'Central US (Iowa)', provider: 'azure' },
  { code: 'azure:southcentralus', name: 'South Central US (Texas)', provider: 'azure' },

  // Europe
  { code: 'azure:northeurope', name: 'North Europe (Ireland)', provider: 'azure' },
  { code: 'azure:westeurope', name: 'West Europe (Netherlands)', provider: 'azure' },
  { code: 'azure:uksouth', name: 'UK South (London)', provider: 'azure' },
  { code: 'azure:ukwest', name: 'UK West (Cardiff)', provider: 'azure' },
  { code: 'azure:francecentral', name: 'France Central (Paris)', provider: 'azure' },
  { code: 'azure:germanywestcentral', name: 'Germany West Central (Frankfurt)', provider: 'azure' },
  { code: 'azure:swedencentral', name: 'Sweden Central (Gävle)', provider: 'azure' },

  // Asia Pacific
  { code: 'azure:centralindia', name: 'Central India (Pune)', provider: 'azure' },
  { code: 'azure:southindia', name: 'South India (Chennai)', provider: 'azure' },
  { code: 'azure:westindia', name: 'West India (Mumbai)', provider: 'azure' },
  { code: 'azure:eastasia', name: 'East Asia (Hong Kong)', provider: 'azure' },
  { code: 'azure:southeastasia', name: 'Southeast Asia (Singapore)', provider: 'azure' },
  { code: 'azure:japaneast', name: 'Japan East (Tokyo)', provider: 'azure' },
  { code: 'azure:japanwest', name: 'Japan West (Osaka)', provider: 'azure' },
  { code: 'azure:koreacentral', name: 'Korea Central (Seoul)', provider: 'azure' },
  { code: 'azure:australiaeast', name: 'Australia East (Sydney)', provider: 'azure' },
  { code: 'azure:australiasoutheast', name: 'Australia Southeast (Melbourne)', provider: 'azure' },

  // South America
  { code: 'azure:brazilsouth', name: 'Brazil South (São Paulo)', provider: 'azure' },

  // Canada
  { code: 'azure:canadacentral', name: 'Canada Central (Toronto)', provider: 'azure' },
  { code: 'azure:canadaeast', name: 'Canada East (Quebec)', provider: 'azure' },
];

// Combined list of all cloud regions
export const ALL_CLOUD_REGIONS = [
  ...AWS_REGIONS,
  ...GCP_REGIONS,
  ...AZURE_REGIONS,
].sort((a, b) => {
  // Sort by provider first, then by name
  if (a.provider !== b.provider) {
    return a.provider.localeCompare(b.provider);
  }
  return a.name.localeCompare(b.name);
});

// Group regions by provider for easier display
export const REGIONS_BY_PROVIDER = {
  aws: AWS_REGIONS,
  gcp: GCP_REGIONS,
  azure: AZURE_REGIONS,
};

// Helper to validate region format
export function isValidRegionFormat(region: string): boolean {
  return /^(aws|gcp|azure):[a-z0-9-]+$/.test(region);
}

// Helper to parse region
export function parseRegion(region: string): { provider: string; region: string } | null {
  const match = region.match(/^(aws|gcp|azure):(.+)$/);
  if (!match) return null;
  return { provider: match[1], region: match[2] };
}

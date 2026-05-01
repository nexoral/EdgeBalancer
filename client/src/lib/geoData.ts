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

// City names exactly as returned by cf.city (Cloudflare/IPinfo, title case).
// Worker generator uppercases these before embedding; worker also uppercases cf.city at runtime.
export const CITIES_BY_COUNTRY: Record<string, Array<{ code: string; name: string }>> = {
  'IN': [
    // Andhra Pradesh
    { code: 'Visakhapatnam', name: 'Visakhapatnam' },
    { code: 'Vijayawada', name: 'Vijayawada' },
    { code: 'Guntur', name: 'Guntur' },
    { code: 'Nellore', name: 'Nellore' },
    { code: 'Kurnool', name: 'Kurnool' },
    { code: 'Rajahmundry', name: 'Rajahmundry' },
    { code: 'Tirupati', name: 'Tirupati' },
    { code: 'Kakinada', name: 'Kakinada' },
    { code: 'Kadapa', name: 'Kadapa' },
    // Arunachal Pradesh
    { code: 'Itanagar', name: 'Itanagar' },
    // Assam
    { code: 'Guwahati', name: 'Guwahati' },
    { code: 'Dibrugarh', name: 'Dibrugarh' },
    { code: 'Jorhat', name: 'Jorhat' },
    { code: 'Silchar', name: 'Silchar' },
    // Bihar
    { code: 'Patna', name: 'Patna' },
    { code: 'Gaya', name: 'Gaya' },
    { code: 'Bhagalpur', name: 'Bhagalpur' },
    { code: 'Muzaffarpur', name: 'Muzaffarpur' },
    { code: 'Darbhanga', name: 'Darbhanga' },
    // Chhattisgarh
    { code: 'Raipur', name: 'Raipur' },
    { code: 'Bhilai', name: 'Bhilai' },
    { code: 'Durg', name: 'Durg' },
    { code: 'Bilaspur', name: 'Bilaspur' },
    // Goa
    { code: 'Panaji', name: 'Panaji' },
    { code: 'Vasco da Gama', name: 'Vasco da Gama' },
    { code: 'Margao', name: 'Margao' },
    // Gujarat
    { code: 'Ahmedabad', name: 'Ahmedabad' },
    { code: 'Surat', name: 'Surat' },
    { code: 'Vadodara', name: 'Vadodara' },
    { code: 'Rajkot', name: 'Rajkot' },
    { code: 'Bhavnagar', name: 'Bhavnagar' },
    { code: 'Jamnagar', name: 'Jamnagar' },
    { code: 'Gandhinagar', name: 'Gandhinagar' },
    // Haryana
    { code: 'Faridabad', name: 'Faridabad' },
    { code: 'Gurugram', name: 'Gurugram' },
    { code: 'Panipat', name: 'Panipat' },
    { code: 'Ambala', name: 'Ambala' },
    { code: 'Hisar', name: 'Hisar' },
    { code: 'Rohtak', name: 'Rohtak' },
    { code: 'Karnal', name: 'Karnal' },
    // Himachal Pradesh
    { code: 'Shimla', name: 'Shimla' },
    { code: 'Dharamsala', name: 'Dharamsala' },
    { code: 'Solan', name: 'Solan' },
    // Jharkhand
    { code: 'Ranchi', name: 'Ranchi' },
    { code: 'Jamshedpur', name: 'Jamshedpur' },
    { code: 'Dhanbad', name: 'Dhanbad' },
    { code: 'Bokaro', name: 'Bokaro' },
    // Karnataka
    { code: 'Bangalore', name: 'Bangalore' },
    { code: 'Mysore', name: 'Mysore' },
    { code: 'Hubli', name: 'Hubli' },
    { code: 'Mangalore', name: 'Mangalore' },
    { code: 'Belgaum', name: 'Belgaum' },
    { code: 'Davangere', name: 'Davangere' },
    { code: 'Tumkur', name: 'Tumkur' },
    // Kerala
    { code: 'Kochi', name: 'Kochi' },
    { code: 'Thiruvananthapuram', name: 'Thiruvananthapuram' },
    { code: 'Kozhikode', name: 'Kozhikode' },
    { code: 'Thrissur', name: 'Thrissur' },
    { code: 'Kollam', name: 'Kollam' },
    { code: 'Kannur', name: 'Kannur' },
    { code: 'Palakkad', name: 'Palakkad' },
    // Madhya Pradesh
    { code: 'Bhopal', name: 'Bhopal' },
    { code: 'Indore', name: 'Indore' },
    { code: 'Jabalpur', name: 'Jabalpur' },
    { code: 'Gwalior', name: 'Gwalior' },
    { code: 'Ujjain', name: 'Ujjain' },
    { code: 'Sagar', name: 'Sagar' },
    // Maharashtra
    { code: 'Mumbai', name: 'Mumbai' },
    { code: 'Pune', name: 'Pune' },
    { code: 'Nagpur', name: 'Nagpur' },
    { code: 'Nashik', name: 'Nashik' },
    { code: 'Aurangabad', name: 'Aurangabad' },
    { code: 'Solapur', name: 'Solapur' },
    { code: 'Kolhapur', name: 'Kolhapur' },
    { code: 'Thane', name: 'Thane' },
    { code: 'Amravati', name: 'Amravati' },
    // Manipur
    { code: 'Imphal', name: 'Imphal' },
    // Meghalaya
    { code: 'Shillong', name: 'Shillong' },
    // Mizoram
    { code: 'Aizawl', name: 'Aizawl' },
    // Nagaland
    { code: 'Kohima', name: 'Kohima' },
    { code: 'Dimapur', name: 'Dimapur' },
    // Odisha
    { code: 'Bhubaneswar', name: 'Bhubaneswar' },
    { code: 'Cuttack', name: 'Cuttack' },
    { code: 'Rourkela', name: 'Rourkela' },
    { code: 'Brahmapur', name: 'Brahmapur' },
    { code: 'Sambalpur', name: 'Sambalpur' },
    // Punjab
    { code: 'Ludhiana', name: 'Ludhiana' },
    { code: 'Amritsar', name: 'Amritsar' },
    { code: 'Jalandhar', name: 'Jalandhar' },
    { code: 'Patiala', name: 'Patiala' },
    { code: 'Bathinda', name: 'Bathinda' },
    // Rajasthan
    { code: 'Jaipur', name: 'Jaipur' },
    { code: 'Jodhpur', name: 'Jodhpur' },
    { code: 'Kota', name: 'Kota' },
    { code: 'Udaipur', name: 'Udaipur' },
    { code: 'Ajmer', name: 'Ajmer' },
    { code: 'Bikaner', name: 'Bikaner' },
    // Sikkim
    { code: 'Gangtok', name: 'Gangtok' },
    // Tamil Nadu
    { code: 'Chennai', name: 'Chennai' },
    { code: 'Coimbatore', name: 'Coimbatore' },
    { code: 'Madurai', name: 'Madurai' },
    { code: 'Tiruchirappalli', name: 'Tiruchirappalli' },
    { code: 'Salem', name: 'Salem' },
    { code: 'Tirunelveli', name: 'Tirunelveli' },
    { code: 'Vellore', name: 'Vellore' },
    { code: 'Erode', name: 'Erode' },
    { code: 'Tiruppur', name: 'Tiruppur' },
    // Telangana
    { code: 'Hyderabad', name: 'Hyderabad' },
    { code: 'Warangal', name: 'Warangal' },
    { code: 'Nizamabad', name: 'Nizamabad' },
    { code: 'Karimnagar', name: 'Karimnagar' },
    { code: 'Khammam', name: 'Khammam' },
    // Tripura
    { code: 'Agartala', name: 'Agartala' },
    // Uttar Pradesh
    { code: 'Lucknow', name: 'Lucknow' },
    { code: 'Kanpur', name: 'Kanpur' },
    { code: 'Agra', name: 'Agra' },
    { code: 'Varanasi', name: 'Varanasi' },
    { code: 'Meerut', name: 'Meerut' },
    { code: 'Prayagraj', name: 'Prayagraj' },
    { code: 'Ghaziabad', name: 'Ghaziabad' },
    { code: 'Bareilly', name: 'Bareilly' },
    { code: 'Aligarh', name: 'Aligarh' },
    { code: 'Gorakhpur', name: 'Gorakhpur' },
    { code: 'Moradabad', name: 'Moradabad' },
    { code: 'Mathura', name: 'Mathura' },
    { code: 'Jhansi', name: 'Jhansi' },
    // Uttarakhand
    { code: 'Dehradun', name: 'Dehradun' },
    { code: 'Haridwar', name: 'Haridwar' },
    { code: 'Roorkee', name: 'Roorkee' },
    { code: 'Rishikesh', name: 'Rishikesh' },
    // West Bengal
    { code: 'Kolkata', name: 'Kolkata' },
    { code: 'Howrah', name: 'Howrah' },
    { code: 'Durgapur', name: 'Durgapur' },
    { code: 'Asansol', name: 'Asansol' },
    { code: 'Siliguri', name: 'Siliguri' },
    { code: 'Kharagpur', name: 'Kharagpur' },
    // UTs
    { code: 'Port Blair', name: 'Port Blair' },
    { code: 'Chandigarh', name: 'Chandigarh' },
    { code: 'Delhi', name: 'Delhi' },
    { code: 'New Delhi', name: 'New Delhi' },
    { code: 'Daman', name: 'Daman' },
    { code: 'Silvassa', name: 'Silvassa' },
    { code: 'Srinagar', name: 'Srinagar' },
    { code: 'Jammu', name: 'Jammu' },
    { code: 'Leh', name: 'Leh' },
    { code: 'Puducherry', name: 'Puducherry' },
  ],
  'US': [
    { code: 'New York', name: 'New York' },
    { code: 'Los Angeles', name: 'Los Angeles' },
    { code: 'Chicago', name: 'Chicago' },
    { code: 'Houston', name: 'Houston' },
    { code: 'Dallas', name: 'Dallas' },
    { code: 'San Francisco', name: 'San Francisco' },
    { code: 'Seattle', name: 'Seattle' },
    { code: 'Atlanta', name: 'Atlanta' },
    { code: 'Boston', name: 'Boston' },
    { code: 'Miami', name: 'Miami' },
    { code: 'Phoenix', name: 'Phoenix' },
    { code: 'Denver', name: 'Denver' },
    { code: 'Washington', name: 'Washington' },
    { code: 'Philadelphia', name: 'Philadelphia' },
    { code: 'Detroit', name: 'Detroit' },
    { code: 'Minneapolis', name: 'Minneapolis' },
    { code: 'Las Vegas', name: 'Las Vegas' },
    { code: 'San Jose', name: 'San Jose' },
    { code: 'Newark', name: 'Newark' },
  ],
  'GB': [
    { code: 'London', name: 'London' },
    { code: 'Manchester', name: 'Manchester' },
    { code: 'Birmingham', name: 'Birmingham' },
    { code: 'Edinburgh', name: 'Edinburgh' },
    { code: 'Glasgow', name: 'Glasgow' },
    { code: 'Bristol', name: 'Bristol' },
    { code: 'Leeds', name: 'Leeds' },
  ],
  'DE': [
    { code: 'Berlin', name: 'Berlin' },
    { code: 'Munich', name: 'Munich' },
    { code: 'Hamburg', name: 'Hamburg' },
    { code: 'Frankfurt', name: 'Frankfurt' },
    { code: 'Cologne', name: 'Cologne' },
    { code: 'Stuttgart', name: 'Stuttgart' },
    { code: 'Düsseldorf', name: 'Düsseldorf' },
  ],
  'FR': [
    { code: 'Paris', name: 'Paris' },
    { code: 'Lyon', name: 'Lyon' },
    { code: 'Marseille', name: 'Marseille' },
    { code: 'Toulouse', name: 'Toulouse' },
    { code: 'Nice', name: 'Nice' },
    { code: 'Bordeaux', name: 'Bordeaux' },
  ],
  'JP': [
    { code: 'Tokyo', name: 'Tokyo' },
    { code: 'Osaka', name: 'Osaka' },
    { code: 'Kyoto', name: 'Kyoto' },
    { code: 'Yokohama', name: 'Yokohama' },
    { code: 'Nagoya', name: 'Nagoya' },
    { code: 'Sapporo', name: 'Sapporo' },
    { code: 'Fukuoka', name: 'Fukuoka' },
  ],
  'AU': [
    { code: 'Sydney', name: 'Sydney' },
    { code: 'Melbourne', name: 'Melbourne' },
    { code: 'Brisbane', name: 'Brisbane' },
    { code: 'Perth', name: 'Perth' },
    { code: 'Adelaide', name: 'Adelaide' },
    { code: 'Canberra', name: 'Canberra' },
  ],
  'CA': [
    { code: 'Toronto', name: 'Toronto' },
    { code: 'Vancouver', name: 'Vancouver' },
    { code: 'Montreal', name: 'Montreal' },
    { code: 'Calgary', name: 'Calgary' },
    { code: 'Ottawa', name: 'Ottawa' },
    { code: 'Edmonton', name: 'Edmonton' },
  ],
  'BR': [
    { code: 'São Paulo', name: 'São Paulo' },
    { code: 'Rio de Janeiro', name: 'Rio de Janeiro' },
    { code: 'Brasília', name: 'Brasília' },
    { code: 'Salvador', name: 'Salvador' },
    { code: 'Fortaleza', name: 'Fortaleza' },
    { code: 'Belo Horizonte', name: 'Belo Horizonte' },
  ],
  'SG': [
    { code: 'Singapore', name: 'Singapore' },
  ],
  'NL': [
    { code: 'Amsterdam', name: 'Amsterdam' },
    { code: 'Rotterdam', name: 'Rotterdam' },
    { code: 'The Hague', name: 'The Hague' },
  ],
  'CN': [
    { code: 'Beijing', name: 'Beijing' },
    { code: 'Shanghai', name: 'Shanghai' },
    { code: 'Guangzhou', name: 'Guangzhou' },
    { code: 'Shenzhen', name: 'Shenzhen' },
    { code: 'Chengdu', name: 'Chengdu' },
    { code: 'Wuhan', name: 'Wuhan' },
    { code: 'Hangzhou', name: 'Hangzhou' },
  ],
  'HK': [
    { code: 'Hong Kong', name: 'Hong Kong' },
  ],
  'AE': [
    { code: 'Dubai', name: 'Dubai' },
    { code: 'Abu Dhabi', name: 'Abu Dhabi' },
  ],
  'KR': [
    { code: 'Seoul', name: 'Seoul' },
    { code: 'Busan', name: 'Busan' },
    { code: 'Incheon', name: 'Incheon' },
  ],
  'TH': [
    { code: 'Bangkok', name: 'Bangkok' },
    { code: 'Chiang Mai', name: 'Chiang Mai' },
  ],
  'MY': [
    { code: 'Kuala Lumpur', name: 'Kuala Lumpur' },
    { code: 'Penang', name: 'Penang' },
    { code: 'Johor Bahru', name: 'Johor Bahru' },
  ],
  'ZA': [
    { code: 'Johannesburg', name: 'Johannesburg' },
    { code: 'Cape Town', name: 'Cape Town' },
    { code: 'Durban', name: 'Durban' },
  ],
  'NG': [
    { code: 'Lagos', name: 'Lagos' },
    { code: 'Abuja', name: 'Abuja' },
  ],
  'TR': [
    { code: 'Istanbul', name: 'Istanbul' },
    { code: 'Ankara', name: 'Ankara' },
    { code: 'Izmir', name: 'Izmir' },
  ],
  'RU': [
    { code: 'Moscow', name: 'Moscow' },
    { code: 'Saint Petersburg', name: 'Saint Petersburg' },
    { code: 'Novosibirsk', name: 'Novosibirsk' },
  ],
  'IL': [
    { code: 'Tel Aviv', name: 'Tel Aviv' },
    { code: 'Jerusalem', name: 'Jerusalem' },
  ],
  'SA': [
    { code: 'Riyadh', name: 'Riyadh' },
    { code: 'Jeddah', name: 'Jeddah' },
    { code: 'Mecca', name: 'Mecca' },
  ],
  'EG': [
    { code: 'Cairo', name: 'Cairo' },
    { code: 'Alexandria', name: 'Alexandria' },
  ],
  'AR': [
    { code: 'Buenos Aires', name: 'Buenos Aires' },
    { code: 'Córdoba', name: 'Córdoba' },
  ],
  'MX': [
    { code: 'Mexico City', name: 'Mexico City' },
    { code: 'Guadalajara', name: 'Guadalajara' },
    { code: 'Monterrey', name: 'Monterrey' },
  ],
  'PK': [
    { code: 'Karachi', name: 'Karachi' },
    { code: 'Lahore', name: 'Lahore' },
    { code: 'Islamabad', name: 'Islamabad' },
  ],
  'BD': [
    { code: 'Dhaka', name: 'Dhaka' },
    { code: 'Chittagong', name: 'Chittagong' },
  ],
  'PH': [
    { code: 'Manila', name: 'Manila' },
    { code: 'Quezon City', name: 'Quezon City' },
  ],
  'ID': [
    { code: 'Jakarta', name: 'Jakarta' },
    { code: 'Surabaya', name: 'Surabaya' },
    { code: 'Bandung', name: 'Bandung' },
  ],
  'VN': [
    { code: 'Ho Chi Minh City', name: 'Ho Chi Minh City' },
    { code: 'Hanoi', name: 'Hanoi' },
  ],
  'TW': [
    { code: 'Taipei', name: 'Taipei' },
    { code: 'Kaohsiung', name: 'Kaohsiung' },
  ],
  'NZ': [
    { code: 'Auckland', name: 'Auckland' },
    { code: 'Wellington', name: 'Wellington' },
  ],
  'KE': [
    { code: 'Nairobi', name: 'Nairobi' },
  ],
  'LK': [
    { code: 'Colombo', name: 'Colombo' },
  ],
  'CO': [
    { code: 'Bogotá', name: 'Bogotá' },
    { code: 'Medellín', name: 'Medellín' },
  ],
  'CL': [
    { code: 'Santiago', name: 'Santiago' },
  ],
  'PE': [
    { code: 'Lima', name: 'Lima' },
  ],
  'ES': [
    { code: 'Madrid', name: 'Madrid' },
    { code: 'Barcelona', name: 'Barcelona' },
    { code: 'Valencia', name: 'Valencia' },
  ],
  'IT': [
    { code: 'Rome', name: 'Rome' },
    { code: 'Milan', name: 'Milan' },
    { code: 'Naples', name: 'Naples' },
  ],
  'PT': [
    { code: 'Lisbon', name: 'Lisbon' },
    { code: 'Porto', name: 'Porto' },
  ],
  'SE': [
    { code: 'Stockholm', name: 'Stockholm' },
    { code: 'Gothenburg', name: 'Gothenburg' },
  ],
  'NO': [
    { code: 'Oslo', name: 'Oslo' },
  ],
  'DK': [
    { code: 'Copenhagen', name: 'Copenhagen' },
  ],
  'FI': [
    { code: 'Helsinki', name: 'Helsinki' },
  ],
  'PL': [
    { code: 'Warsaw', name: 'Warsaw' },
    { code: 'Kraków', name: 'Kraków' },
  ],
  'CH': [
    { code: 'Zurich', name: 'Zurich' },
    { code: 'Geneva', name: 'Geneva' },
  ],
  'AT': [
    { code: 'Vienna', name: 'Vienna' },
  ],
  'BE': [
    { code: 'Brussels', name: 'Brussels' },
    { code: 'Antwerp', name: 'Antwerp' },
  ],
  'IE': [
    { code: 'Dublin', name: 'Dublin' },
  ],
};

export function getCitiesByCountry(countryCode: string) {
  return CITIES_BY_COUNTRY[countryCode] || [];
}

// Maps country → subdivision → city codes (must match keys in CITIES_BY_COUNTRY)
export const CITIES_BY_SUBDIVISION: Record<string, Record<string, string[]>> = {
  'IN': {
    'AP': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Rajahmundry', 'Tirupati', 'Kakinada', 'Kadapa'],
    'AR': ['Itanagar'],
    'AS': ['Guwahati', 'Dibrugarh', 'Jorhat', 'Silchar'],
    'BR': ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga'],
    'CG': ['Raipur', 'Bhilai', 'Durg', 'Bilaspur'],
    'GA': ['Panaji', 'Vasco da Gama', 'Margao'],
    'GJ': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Gandhinagar'],
    'HR': ['Faridabad', 'Gurugram', 'Panipat', 'Ambala', 'Hisar', 'Rohtak', 'Karnal'],
    'HP': ['Shimla', 'Dharamsala', 'Solan'],
    'JH': ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro'],
    'KA': ['Bangalore', 'Mysore', 'Hubli', 'Mangalore', 'Belgaum', 'Davangere', 'Tumkur'],
    'KL': ['Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Thrissur', 'Kollam', 'Kannur', 'Palakkad'],
    'MP': ['Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar'],
    'MH': ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Solapur', 'Kolhapur', 'Thane', 'Amravati'],
    'MN': ['Imphal'],
    'ML': ['Shillong'],
    'MZ': ['Aizawl'],
    'NL': ['Kohima', 'Dimapur'],
    'OR': ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Brahmapur', 'Sambalpur'],
    'PB': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda'],
    'RJ': ['Jaipur', 'Jodhpur', 'Kota', 'Udaipur', 'Ajmer', 'Bikaner'],
    'SK': ['Gangtok'],
    'TN': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Vellore', 'Erode', 'Tiruppur'],
    'TS': ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam'],
    'TR': ['Agartala'],
    'UP': ['Lucknow', 'Kanpur', 'Agra', 'Varanasi', 'Meerut', 'Prayagraj', 'Ghaziabad', 'Bareilly', 'Aligarh', 'Gorakhpur', 'Moradabad', 'Mathura', 'Jhansi'],
    'UT': ['Dehradun', 'Haridwar', 'Roorkee', 'Rishikesh'],
    'WB': ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri', 'Kharagpur'],
    'AN': ['Port Blair'],
    'CH': ['Chandigarh'],
    'DH': ['Daman', 'Silvassa'],
    'DL': ['Delhi', 'New Delhi'],
    'JK': ['Srinagar', 'Jammu'],
    'LA': ['Leh'],
    'PY': ['Puducherry'],
  },
  'US': {
    'NY': ['New York'],
    'CA': ['Los Angeles', 'San Francisco', 'San Jose'],
    'IL': ['Chicago'],
    'TX': ['Houston', 'Dallas'],
    'WA': ['Seattle'],
    'GA': ['Atlanta'],
    'MA': ['Boston'],
    'FL': ['Miami'],
    'AZ': ['Phoenix'],
    'CO': ['Denver'],
    'DC': ['Washington'],
    'PA': ['Philadelphia'],
    'MI': ['Detroit'],
    'MN': ['Minneapolis'],
    'NV': ['Las Vegas'],
    'NJ': ['Newark'],
  },
  'GB': {
    'ENG': ['London', 'Manchester', 'Birmingham', 'Bristol', 'Leeds'],
    'SCT': ['Edinburgh', 'Glasgow'],
  },
  'DE': {
    'BE': ['Berlin'],
    'BY': ['Munich'],
    'HH': ['Hamburg'],
    'HE': ['Frankfurt'],
    'NW': ['Cologne', 'Düsseldorf'],
    'BW': ['Stuttgart'],
  },
  'FR': {
    'IDF': ['Paris'],
    'ARA': ['Lyon'],
    'PAC': ['Marseille', 'Nice'],
    'OCC': ['Toulouse'],
    'NAQ': ['Bordeaux'],
  },
  'JP': {
    '01': ['Sapporo'],
    '13': ['Tokyo'],
    '14': ['Yokohama'],
    '23': ['Nagoya'],
    '26': ['Kyoto'],
    '27': ['Osaka'],
    '40': ['Fukuoka'],
  },
  'AU': {
    'NSW': ['Sydney'],
    'VIC': ['Melbourne'],
    'QLD': ['Brisbane'],
    'WA': ['Perth'],
    'SA': ['Adelaide'],
    'ACT': ['Canberra'],
  },
  'CA': {
    'ON': ['Toronto', 'Ottawa'],
    'BC': ['Vancouver'],
    'QC': ['Montreal'],
    'AB': ['Calgary', 'Edmonton'],
  },
  'BR': {
    'SP': ['São Paulo'],
    'RJ': ['Rio de Janeiro'],
    'DF': ['Brasília'],
    'BA': ['Salvador'],
    'CE': ['Fortaleza'],
    'MG': ['Belo Horizonte'],
  },
  'CN': {
    'BJ': ['Beijing'],
    'SH': ['Shanghai'],
    'GD': ['Guangzhou', 'Shenzhen'],
    'SC': ['Chengdu'],
    'HB': ['Wuhan'],
    'ZJ': ['Hangzhou'],
  },
  'RU': {
    'MOW': ['Moscow'],
    'SPE': ['Saint Petersburg'],
    'NVS': ['Novosibirsk'],
  },
  'MX': {
    'CMX': ['Mexico City'],
    'JAL': ['Guadalajara'],
    'NLE': ['Monterrey'],
  },
  'ZA': {
    'GP': ['Johannesburg'],
    'WC': ['Cape Town'],
    'KZN': ['Durban'],
  },
  'KR': {
    '11': ['Seoul'],
    '26': ['Busan'],
    '28': ['Incheon'],
  },
  'TR': {
    '34': ['Istanbul'],
    '06': ['Ankara'],
    '35': ['Izmir'],
  },
};

export function getCitiesBySubdivision(countryCode: string, subdivisionCode: string) {
  const cityCodes = CITIES_BY_SUBDIVISION[countryCode]?.[subdivisionCode] || [];
  return getCitiesByCountry(countryCode).filter(c => cityCodes.includes(c.code));
}

// ISO 3166-2 subdivision codes as returned by cf.regionCode (subdivision part only, e.g. "WB" not "IN-WB")
export const SUBDIVISIONS_BY_COUNTRY: Record<string, Array<{ code: string; name: string }>> = {
  'IN': [
    // States
    { code: 'AP', name: 'Andhra Pradesh' },
    { code: 'AR', name: 'Arunachal Pradesh' },
    { code: 'AS', name: 'Assam' },
    { code: 'BR', name: 'Bihar' },
    { code: 'CG', name: 'Chhattisgarh' },
    { code: 'GA', name: 'Goa' },
    { code: 'GJ', name: 'Gujarat' },
    { code: 'HR', name: 'Haryana' },
    { code: 'HP', name: 'Himachal Pradesh' },
    { code: 'JH', name: 'Jharkhand' },
    { code: 'KA', name: 'Karnataka' },
    { code: 'KL', name: 'Kerala' },
    { code: 'MP', name: 'Madhya Pradesh' },
    { code: 'MH', name: 'Maharashtra' },
    { code: 'MN', name: 'Manipur' },
    { code: 'ML', name: 'Meghalaya' },
    { code: 'MZ', name: 'Mizoram' },
    { code: 'NL', name: 'Nagaland' },
    { code: 'OR', name: 'Odisha' },
    { code: 'PB', name: 'Punjab' },
    { code: 'RJ', name: 'Rajasthan' },
    { code: 'SK', name: 'Sikkim' },
    { code: 'TN', name: 'Tamil Nadu' },
    { code: 'TS', name: 'Telangana' },
    { code: 'TR', name: 'Tripura' },
    { code: 'UP', name: 'Uttar Pradesh' },
    { code: 'UT', name: 'Uttarakhand' },
    { code: 'WB', name: 'West Bengal' },
    // Union Territories
    { code: 'AN', name: 'Andaman & Nicobar Islands' },
    { code: 'CH', name: 'Chandigarh' },
    { code: 'DH', name: 'Dadra & Nagar Haveli and Daman & Diu' },
    { code: 'DL', name: 'Delhi' },
    { code: 'JK', name: 'Jammu & Kashmir' },
    { code: 'LA', name: 'Ladakh' },
    { code: 'LD', name: 'Lakshadweep' },
    { code: 'PY', name: 'Puducherry' },
  ],
  'US': [
    { code: 'AZ', name: 'Arizona' },
    { code: 'CA', name: 'California' },
    { code: 'CO', name: 'Colorado' },
    { code: 'FL', name: 'Florida' },
    { code: 'GA', name: 'Georgia' },
    { code: 'IL', name: 'Illinois' },
    { code: 'MA', name: 'Massachusetts' },
    { code: 'MI', name: 'Michigan' },
    { code: 'MN', name: 'Minnesota' },
    { code: 'NJ', name: 'New Jersey' },
    { code: 'NV', name: 'Nevada' },
    { code: 'NY', name: 'New York' },
    { code: 'NC', name: 'North Carolina' },
    { code: 'OH', name: 'Ohio' },
    { code: 'OR', name: 'Oregon' },
    { code: 'PA', name: 'Pennsylvania' },
    { code: 'TN', name: 'Tennessee' },
    { code: 'TX', name: 'Texas' },
    { code: 'VA', name: 'Virginia' },
    { code: 'WA', name: 'Washington' },
  ],
  'GB': [
    { code: 'ENG', name: 'England' },
    { code: 'NIR', name: 'Northern Ireland' },
    { code: 'SCT', name: 'Scotland' },
    { code: 'WLS', name: 'Wales' },
  ],
  'DE': [
    { code: 'BE', name: 'Berlin' },
    { code: 'BW', name: 'Baden-Württemberg' },
    { code: 'BY', name: 'Bavaria' },
    { code: 'HE', name: 'Hesse' },
    { code: 'HH', name: 'Hamburg' },
    { code: 'NI', name: 'Lower Saxony' },
    { code: 'NW', name: 'North Rhine-Westphalia' },
    { code: 'SN', name: 'Saxony' },
  ],
  'FR': [
    { code: 'ARA', name: 'Auvergne-Rhône-Alpes' },
    { code: 'BRE', name: 'Brittany' },
    { code: 'IDF', name: 'Île-de-France' },
    { code: 'NAQ', name: 'Nouvelle-Aquitaine' },
    { code: 'OCC', name: 'Occitanie' },
    { code: 'PAC', name: 'Provence-Alpes-Côte d\'Azur' },
  ],
  'JP': [
    { code: '01', name: 'Hokkaido' },
    { code: '13', name: 'Tokyo' },
    { code: '14', name: 'Kanagawa' },
    { code: '23', name: 'Aichi' },
    { code: '26', name: 'Kyoto' },
    { code: '27', name: 'Osaka' },
    { code: '40', name: 'Fukuoka' },
  ],
  'AU': [
    { code: 'ACT', name: 'Australian Capital Territory' },
    { code: 'NSW', name: 'New South Wales' },
    { code: 'QLD', name: 'Queensland' },
    { code: 'SA', name: 'South Australia' },
    { code: 'VIC', name: 'Victoria' },
    { code: 'WA', name: 'Western Australia' },
  ],
  'CA': [
    { code: 'AB', name: 'Alberta' },
    { code: 'BC', name: 'British Columbia' },
    { code: 'MB', name: 'Manitoba' },
    { code: 'ON', name: 'Ontario' },
    { code: 'QC', name: 'Quebec' },
  ],
  'BR': [
    { code: 'BA', name: 'Bahia' },
    { code: 'CE', name: 'Ceará' },
    { code: 'DF', name: 'Distrito Federal' },
    { code: 'MG', name: 'Minas Gerais' },
    { code: 'RJ', name: 'Rio de Janeiro' },
    { code: 'SP', name: 'São Paulo' },
  ],
  'CN': [
    { code: 'BJ', name: 'Beijing' },
    { code: 'GD', name: 'Guangdong' },
    { code: 'HB', name: 'Hubei' },
    { code: 'SC', name: 'Sichuan' },
    { code: 'SH', name: 'Shanghai' },
    { code: 'ZJ', name: 'Zhejiang' },
  ],
  'RU': [
    { code: 'MOW', name: 'Moscow' },
    { code: 'SPE', name: 'Saint Petersburg' },
    { code: 'NVS', name: 'Novosibirsk Oblast' },
  ],
  'MX': [
    { code: 'CMX', name: 'Mexico City' },
    { code: 'JAL', name: 'Jalisco' },
    { code: 'NLE', name: 'Nuevo León' },
  ],
  'ZA': [
    { code: 'GP', name: 'Gauteng' },
    { code: 'KZN', name: 'KwaZulu-Natal' },
    { code: 'WC', name: 'Western Cape' },
  ],
  'KR': [
    { code: '11', name: 'Seoul' },
    { code: '26', name: 'Busan' },
    { code: '28', name: 'Incheon' },
  ],
  'TR': [
    { code: '34', name: 'Istanbul' },
    { code: '06', name: 'Ankara' },
    { code: '35', name: 'Izmir' },
  ],
};

export function getSubdivisionsByCountry(countryCode: string) {
  return SUBDIVISIONS_BY_COUNTRY[countryCode] || [];
}

export function getFlagEmoji(countryCode: string): string {
  return [...countryCode.toUpperCase()].map(c => String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0))).join('');
}

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

/** A place the almanac can be set to when the browser will not say where the reader is. */
export interface City {
  name: string;
  country: string;
  lat: number;
  lon: number;
  /** The IANA zone the city keeps time in, so its sunrise reads in its own clock. */
  timeZone: string;
}

// name | country | latitude | longitude | time zone — the world's larger cities and the paper's home ground, to a hundredth of a degree.
const ROWS = `
Amsterdam|Netherlands|52.37|4.90|Europe/Amsterdam
Rotterdam|Netherlands|51.92|4.48|Europe/Amsterdam
The Hague|Netherlands|52.08|4.31|Europe/Amsterdam
Utrecht|Netherlands|52.09|5.12|Europe/Amsterdam
Eindhoven|Netherlands|51.44|5.47|Europe/Amsterdam
Groningen|Netherlands|53.22|6.57|Europe/Amsterdam
Maastricht|Netherlands|50.85|5.69|Europe/Amsterdam
Brussels|Belgium|50.85|4.35|Europe/Brussels
Antwerp|Belgium|51.22|4.40|Europe/Brussels
Ghent|Belgium|51.05|3.72|Europe/Brussels
Luxembourg|Luxembourg|49.61|6.13|Europe/Luxembourg
Paris|France|48.86|2.35|Europe/Paris
Lyon|France|45.76|4.84|Europe/Paris
Marseille|France|43.30|5.37|Europe/Paris
Bordeaux|France|44.84|-0.58|Europe/Paris
Lille|France|50.63|3.06|Europe/Paris
London|United Kingdom|51.51|-0.13|Europe/London
Manchester|United Kingdom|53.48|-2.24|Europe/London
Birmingham|United Kingdom|52.48|-1.90|Europe/London
Edinburgh|United Kingdom|55.95|-3.19|Europe/London
Glasgow|United Kingdom|55.86|-4.25|Europe/London
Dublin|Ireland|53.35|-6.26|Europe/Dublin
Berlin|Germany|52.52|13.41|Europe/Berlin
Hamburg|Germany|53.55|9.99|Europe/Berlin
Munich|Germany|48.14|11.58|Europe/Berlin
Cologne|Germany|50.94|6.96|Europe/Berlin
Frankfurt|Germany|50.11|8.68|Europe/Berlin
Stuttgart|Germany|48.78|9.18|Europe/Berlin
Düsseldorf|Germany|51.23|6.78|Europe/Berlin
Leipzig|Germany|51.34|12.37|Europe/Berlin
Zurich|Switzerland|47.38|8.54|Europe/Zurich
Geneva|Switzerland|46.20|6.14|Europe/Zurich
Bern|Switzerland|46.95|7.45|Europe/Zurich
Vienna|Austria|48.21|16.37|Europe/Vienna
Prague|Czechia|50.08|14.44|Europe/Prague
Warsaw|Poland|52.23|21.01|Europe/Warsaw
Kraków|Poland|50.06|19.94|Europe/Warsaw
Budapest|Hungary|47.50|19.04|Europe/Budapest
Bratislava|Slovakia|48.15|17.11|Europe/Bratislava
Copenhagen|Denmark|55.68|12.57|Europe/Copenhagen
Stockholm|Sweden|59.33|18.07|Europe/Stockholm
Gothenburg|Sweden|57.71|11.97|Europe/Stockholm
Oslo|Norway|59.91|10.75|Europe/Oslo
Tromsø|Norway|69.65|18.96|Europe/Oslo
Helsinki|Finland|60.17|24.94|Europe/Helsinki
Reykjavík|Iceland|64.15|-21.94|Atlantic/Reykjavik
Tallinn|Estonia|59.44|24.75|Europe/Tallinn
Riga|Latvia|56.95|24.11|Europe/Riga
Vilnius|Lithuania|54.69|25.28|Europe/Vilnius
Madrid|Spain|40.42|-3.70|Europe/Madrid
Barcelona|Spain|41.39|2.17|Europe/Madrid
Valencia|Spain|39.47|-0.38|Europe/Madrid
Seville|Spain|37.39|-5.99|Europe/Madrid
Lisbon|Portugal|38.72|-9.14|Europe/Lisbon
Porto|Portugal|41.15|-8.61|Europe/Lisbon
Rome|Italy|41.90|12.50|Europe/Rome
Milan|Italy|45.46|9.19|Europe/Rome
Naples|Italy|40.85|14.27|Europe/Rome
Turin|Italy|45.07|7.69|Europe/Rome
Florence|Italy|43.77|11.26|Europe/Rome
Venice|Italy|45.44|12.33|Europe/Rome
Athens|Greece|37.98|23.73|Europe/Athens
Istanbul|Turkey|41.01|28.98|Europe/Istanbul
Ankara|Turkey|39.93|32.86|Europe/Istanbul
Bucharest|Romania|44.43|26.10|Europe/Bucharest
Sofia|Bulgaria|42.70|23.32|Europe/Sofia
Belgrade|Serbia|44.79|20.46|Europe/Belgrade
Zagreb|Croatia|45.81|15.98|Europe/Zagreb
Ljubljana|Slovenia|46.06|14.51|Europe/Ljubljana
Sarajevo|Bosnia and Herzegovina|43.86|18.41|Europe/Sarajevo
Kyiv|Ukraine|50.45|30.52|Europe/Kyiv
Minsk|Belarus|53.90|27.57|Europe/Minsk
Moscow|Russia|55.76|37.62|Europe/Moscow
Saint Petersburg|Russia|59.93|30.32|Europe/Moscow
Cairo|Egypt|30.04|31.24|Africa/Cairo
Casablanca|Morocco|33.57|-7.59|Africa/Casablanca
Algiers|Algeria|36.75|3.06|Africa/Algiers
Tunis|Tunisia|36.81|10.18|Africa/Tunis
Lagos|Nigeria|6.52|3.38|Africa/Lagos
Accra|Ghana|5.60|-0.19|Africa/Accra
Dakar|Senegal|14.72|-17.47|Africa/Dakar
Kinshasa|DR Congo|-4.32|15.31|Africa/Kinshasa
Nairobi|Kenya|-1.29|36.82|Africa/Nairobi
Addis Ababa|Ethiopia|9.03|38.74|Africa/Addis_Ababa
Johannesburg|South Africa|-26.20|28.05|Africa/Johannesburg
Cape Town|South Africa|-33.93|18.42|Africa/Johannesburg
Tel Aviv|Israel|32.08|34.78|Asia/Jerusalem
Jerusalem|Israel|31.77|35.21|Asia/Jerusalem
Beirut|Lebanon|33.89|35.50|Asia/Beirut
Amman|Jordan|31.95|35.93|Asia/Amman
Riyadh|Saudi Arabia|24.71|46.68|Asia/Riyadh
Dubai|United Arab Emirates|25.20|55.27|Asia/Dubai
Doha|Qatar|25.29|51.53|Asia/Qatar
Tehran|Iran|35.69|51.39|Asia/Tehran
Baghdad|Iraq|33.31|44.37|Asia/Baghdad
Mumbai|India|19.08|72.88|Asia/Kolkata
Delhi|India|28.61|77.21|Asia/Kolkata
Bangalore|India|12.97|77.59|Asia/Kolkata
Chennai|India|13.08|80.27|Asia/Kolkata
Kolkata|India|22.57|88.36|Asia/Kolkata
Karachi|Pakistan|24.86|67.01|Asia/Karachi
Lahore|Pakistan|31.55|74.34|Asia/Karachi
Dhaka|Bangladesh|23.81|90.41|Asia/Dhaka
Colombo|Sri Lanka|6.93|79.85|Asia/Colombo
Kathmandu|Nepal|27.72|85.32|Asia/Kathmandu
Bangkok|Thailand|13.76|100.50|Asia/Bangkok
Hanoi|Vietnam|21.03|105.85|Asia/Ho_Chi_Minh
Ho Chi Minh City|Vietnam|10.82|106.63|Asia/Ho_Chi_Minh
Kuala Lumpur|Malaysia|3.14|101.69|Asia/Kuala_Lumpur
Singapore|Singapore|1.35|103.82|Asia/Singapore
Jakarta|Indonesia|-6.21|106.85|Asia/Jakarta
Manila|Philippines|14.60|120.98|Asia/Manila
Hong Kong|China|22.32|114.17|Asia/Hong_Kong
Taipei|Taiwan|25.03|121.57|Asia/Taipei
Shanghai|China|31.23|121.47|Asia/Shanghai
Beijing|China|39.90|116.41|Asia/Shanghai
Shenzhen|China|22.54|114.06|Asia/Shanghai
Guangzhou|China|23.13|113.26|Asia/Shanghai
Chengdu|China|30.57|104.07|Asia/Shanghai
Seoul|South Korea|37.57|126.98|Asia/Seoul
Busan|South Korea|35.18|129.08|Asia/Seoul
Tokyo|Japan|35.68|139.69|Asia/Tokyo
Osaka|Japan|34.69|135.50|Asia/Tokyo
Kyoto|Japan|35.01|135.77|Asia/Tokyo
Sapporo|Japan|43.06|141.35|Asia/Tokyo
Fukuoka|Japan|33.59|130.40|Asia/Tokyo
Ulaanbaatar|Mongolia|47.89|106.91|Asia/Ulaanbaatar
Almaty|Kazakhstan|43.24|76.89|Asia/Almaty
Tashkent|Uzbekistan|41.30|69.24|Asia/Tashkent
Sydney|Australia|-33.87|151.21|Australia/Sydney
Melbourne|Australia|-37.81|144.96|Australia/Melbourne
Brisbane|Australia|-27.47|153.03|Australia/Brisbane
Perth|Australia|-31.95|115.86|Australia/Perth
Adelaide|Australia|-34.93|138.60|Australia/Adelaide
Auckland|New Zealand|-36.85|174.76|Pacific/Auckland
Wellington|New Zealand|-41.29|174.78|Pacific/Auckland
Christchurch|New Zealand|-43.53|172.63|Pacific/Auckland
Honolulu|United States|21.31|-157.86|Pacific/Honolulu
New York|United States|40.71|-74.01|America/New_York
Los Angeles|United States|34.05|-118.24|America/Los_Angeles
Chicago|United States|41.88|-87.63|America/Chicago
Houston|United States|29.76|-95.37|America/Chicago
Phoenix|United States|33.45|-112.07|America/Phoenix
Philadelphia|United States|39.95|-75.17|America/New_York
San Antonio|United States|29.42|-98.49|America/Chicago
San Diego|United States|32.72|-117.16|America/Los_Angeles
Dallas|United States|32.78|-96.80|America/Chicago
San Francisco|United States|37.77|-122.42|America/Los_Angeles
Seattle|United States|47.61|-122.33|America/Los_Angeles
Denver|United States|39.74|-104.99|America/Denver
Boston|United States|42.36|-71.06|America/New_York
Washington|United States|38.91|-77.04|America/New_York
Miami|United States|25.76|-80.19|America/New_York
Atlanta|United States|33.75|-84.39|America/New_York
Minneapolis|United States|44.98|-93.27|America/Chicago
Detroit|United States|42.33|-83.05|America/Detroit
Portland|United States|45.52|-122.68|America/Los_Angeles
Las Vegas|United States|36.17|-115.14|America/Los_Angeles
Austin|United States|30.27|-97.74|America/Chicago
Nashville|United States|36.16|-86.78|America/Chicago
New Orleans|United States|29.95|-90.07|America/Chicago
Salt Lake City|United States|40.76|-111.89|America/Denver
Anchorage|United States|61.22|-149.90|America/Anchorage
Toronto|Canada|43.65|-79.38|America/Toronto
Montreal|Canada|45.50|-73.57|America/Toronto
Vancouver|Canada|49.28|-123.12|America/Vancouver
Calgary|Canada|51.05|-114.07|America/Edmonton
Ottawa|Canada|45.42|-75.70|America/Toronto
Mexico City|Mexico|19.43|-99.13|America/Mexico_City
Guadalajara|Mexico|20.66|-103.35|America/Mexico_City
Monterrey|Mexico|25.69|-100.32|America/Monterrey
Havana|Cuba|23.11|-82.37|America/Havana
Guatemala City|Guatemala|14.63|-90.51|America/Guatemala
Panama City|Panama|8.98|-79.52|America/Panama
Bogotá|Colombia|4.71|-74.07|America/Bogota
Caracas|Venezuela|10.48|-66.88|America/Caracas
Quito|Ecuador|-0.18|-78.47|America/Guayaquil
Lima|Peru|-12.05|-77.04|America/Lima
La Paz|Bolivia|-16.50|-68.15|America/La_Paz
Santiago|Chile|-33.45|-70.67|America/Santiago
Buenos Aires|Argentina|-34.60|-58.38|America/Argentina/Buenos_Aires
Montevideo|Uruguay|-34.90|-56.16|America/Montevideo
São Paulo|Brazil|-23.55|-46.63|America/Sao_Paulo
Rio de Janeiro|Brazil|-22.91|-43.17|America/Sao_Paulo
Brasília|Brazil|-15.79|-47.88|America/Sao_Paulo
Salvador|Brazil|-12.97|-38.51|America/Bahia
Recife|Brazil|-8.05|-34.88|America/Recife
Manaus|Brazil|-3.12|-60.02|America/Manaus
`;

export const CITIES: City[] = ROWS.trim()
  .split("\n")
  .map((row) => {
    const [name, country, lat, lon, timeZone] = row.split("|");
    return { name, country, lat: Number(lat), lon: Number(lon), timeZone };
  });

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Cities whose name starts with the query, then those that merely contain it; accents and case do not matter. */
export function findCities(query: string, limit = 8): City[] {
  const q = fold(query);
  if (!q) return [];
  const starts = CITIES.filter((city) => fold(city.name).startsWith(q));
  const contains = CITIES.filter((city) => !starts.includes(city) && (fold(city.name).includes(q) || fold(`${city.name}, ${city.country}`) === q));
  return [...starts, ...contains].slice(0, limit);
}

const RAD = Math.PI / 180;

/** Great-circle distance in kilometres. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * RAD;
  const dLon = (lon2 - lon1) * RAD;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/** The listed city nearest a point, when one lies within reach: a name for a place the browser gave as numbers. */
export function nearestCity(lat: number, lon: number, withinKm = 120): City | undefined {
  let best: City | undefined;
  let bestDistance = withinKm;
  for (const city of CITIES) {
    const distance = distanceKm(lat, lon, city.lat, city.lon);
    if (distance <= bestDistance) {
      best = city;
      bestDistance = distance;
    }
  }
  return best;
}

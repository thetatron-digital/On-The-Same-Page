// Weather, sunrise/sunset, and geocoding utilities
// Uses Open-Meteo API — free, no API key required

export interface WeatherData {
  date: string;
  tempHigh: number;       // Fahrenheit
  tempLow: number;        // Fahrenheit
  description: string;    // Human-readable weather
  precipChance: number;   // Percentage
  sunrise: string;        // Time string e.g. "6:42 AM"
  sunset: string;         // Time string e.g. "7:15 PM"
  windSpeed: number;      // mph
  windGusts: number;      // mph
}

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  name: string;
  country: string;
  state?: string;
}

// WMO Weather interpretation codes → human-readable descriptions
const WMO_CODES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

// Convert Celsius to Fahrenheit
const cToF = (c: number): number => Math.round((c * 9 / 5) + 32);

// Convert km/h to mph
const kmhToMph = (kmh: number): number => Math.round(kmh * 0.621371);

// Format 24h time string (e.g. "2026-03-01T06:42") to "6:42 AM"
const formatTime = (isoTime: string): string => {
  const timePart = isoTime.split('T')[1];
  if (!timePart) return '';
  const [hoursStr, minutesStr] = timePart.split(':');
  let hours = parseInt(hoursStr);
  const minutes = minutesStr;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  if (hours === 0) hours = 12;
  else if (hours > 12) hours -= 12;
  return `${hours}:${minutes} ${ampm}`;
};

/**
 * Fetch weather forecast for a location on a specific date.
 * Uses Open-Meteo free API (no key needed).
 */
export async function fetchWeather(
  latitude: number,
  longitude: number,
  date: string // ISO date string e.g. "2026-03-15"
): Promise<WeatherData | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max,` +
      `sunrise,sunset,windspeed_10m_max,windgusts_10m_max` +
      `&temperature_unit=celsius&windspeed_unit=kmh&timezone=auto` +
      `&start_date=${date}&end_date=${date}`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const daily = data.daily;
    if (!daily || !daily.time || daily.time.length === 0) return null;

    const weatherCode = daily.weathercode?.[0] ?? 0;

    return {
      date,
      tempHigh: cToF(daily.temperature_2m_max[0]),
      tempLow: cToF(daily.temperature_2m_min[0]),
      description: WMO_CODES[weatherCode] || 'Unknown',
      precipChance: daily.precipitation_probability_max?.[0] ?? 0,
      sunrise: formatTime(daily.sunrise[0]),
      sunset: formatTime(daily.sunset[0]),
      windSpeed: kmhToMph(daily.windspeed_10m_max?.[0] ?? 0),
      windGusts: kmhToMph(daily.windgusts_10m_max?.[0] ?? 0),
    };
  } catch {
    return null;
  }
}

/**
 * Geocode a location name/address to lat/long.
 * Tries Nominatim (OpenStreetMap) first for full address support,
 * falls back to Open-Meteo geocoding for city-level results.
 */
export async function geocodeAddress(query: string): Promise<GeocodingResult | null> {
  // Try Nominatim first (supports full street addresses)
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'OTSP-BaseCamp/1.0 (production-scheduling-app)' },
    });
    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0) {
        const result = data[0];
        return {
          latitude: parseFloat(result.lat),
          longitude: parseFloat(result.lon),
          name: result.display_name?.split(',')[0] || query,
          country: result.address?.country || '',
          state: result.address?.state || undefined,
        };
      }
    }
  } catch {
    // Nominatim failed, try fallback
  }

  // Fallback: Open-Meteo geocoding (city/place names only, but very reliable)
  try {
    // Extract city-like terms from the query for Open-Meteo
    const cityQuery = query.split(',').slice(1).join(',').trim() || query;
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityQuery)}&count=1&language=en&format=json`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.results || data.results.length === 0) return null;

    const result = data.results[0];
    return {
      latitude: result.latitude,
      longitude: result.longitude,
      name: result.name,
      country: result.country || '',
      state: result.admin1 || undefined,
    };
  } catch {
    return null;
  }
}

export interface NearestHospitalResult {
  name: string;
  address: string;
  phone?: string;
  latitude: number;
  longitude: number;
  distance?: string;
}

/**
 * Find nearby hospitals/ERs near the given coordinates.
 * Uses Overpass API (OpenStreetMap) to find hospitals within ~15km radius.
 * Filters out children's hospitals and returns up to 5 options sorted by distance.
 */
export async function findNearbyHospitals(lat: number, lng: number): Promise<NearestHospitalResult[]> {
  // Keywords indicating a children's/pediatric hospital (not ideal for general production ER)
  const childrenKeywords = ['children', 'pediatric', 'paediatric', 'kids', "children's"];

  const isChildrensHospital = (name: string): boolean => {
    const lower = name.toLowerCase();
    return childrenKeywords.some(kw => lower.includes(kw));
  };

  const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  try {
    // Overpass API query for hospitals within ~15km, get up to 10
    const query = `[out:json][timeout:10];(node["amenity"="hospital"](around:15000,${lat},${lng});way["amenity"="hospital"](around:15000,${lat},${lng}););out center 10;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    const response = await fetch(url);
    if (!response.ok) {
      return findNearbyHospitalsFallback(lat, lng);
    }

    const data = await response.json();
    if (!data.elements || data.elements.length === 0) {
      return findNearbyHospitalsFallback(lat, lng);
    }

    const results: NearestHospitalResult[] = data.elements
      .map((el: { center?: { lat: number; lon: number }; lat?: number; lon?: number; tags?: Record<string, string> }) => {
        const hLat = el.center?.lat || el.lat || 0;
        const hLng = el.center?.lon || el.lon || 0;
        const tags = el.tags || {};
        const name = tags.name || 'Hospital';

        const addrParts = [
          tags['addr:housenumber'] && tags['addr:street'] ? `${tags['addr:housenumber']} ${tags['addr:street']}` : tags['addr:street'],
          tags['addr:city'],
          tags['addr:state'],
          tags['addr:postcode'],
        ].filter(Boolean);

        const dist = haversineDistance(lat, lng, hLat, hLng);

        return {
          name,
          address: addrParts.join(', ') || `${hLat.toFixed(4)}, ${hLng.toFixed(4)}`,
          phone: tags.phone || tags['contact:phone'] || undefined,
          latitude: hLat,
          longitude: hLng,
          distance: `${dist.toFixed(1)} km`,
          _distKm: dist,
          _isChildrens: isChildrensHospital(name),
        };
      })
      // Sort: non-children's first, then by distance
      .sort((a: { _isChildrens: boolean; _distKm: number }, b: { _isChildrens: boolean; _distKm: number }) => {
        if (a._isChildrens !== b._isChildrens) return a._isChildrens ? 1 : -1;
        return a._distKm - b._distKm;
      })
      .slice(0, 5)
      .map(({ _distKm, _isChildrens, ...rest }: { _distKm: number; _isChildrens: boolean; name: string; address: string; phone?: string; latitude: number; longitude: number; distance?: string }) => rest);

    return results;
  } catch {
    return findNearbyHospitalsFallback(lat, lng);
  }
}

/** Backwards-compatible wrapper that returns just the first (best) result */
export async function findNearestHospital(lat: number, lng: number): Promise<NearestHospitalResult | null> {
  const results = await findNearbyHospitals(lat, lng);
  return results[0] || null;
}

async function findNearbyHospitalsFallback(lat: number, lng: number): Promise<NearestHospitalResult[]> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=hospital+near+${lat},${lng}&format=json&limit=5&addressdetails=1`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'OTSP-BaseCamp/1.0 (production-scheduling-app)' },
    });
    if (!response.ok) return [];

    const data = await response.json();
    if (!data || data.length === 0) return [];

    return data.map((result: { display_name?: string; lat: string; lon: string }) => ({
      name: result.display_name?.split(',')[0] || 'Hospital',
      address: result.display_name?.split(',').slice(0, 4).join(',').trim() || '',
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
    }));
  } catch {
    return [];
  }
}

/**
 * Generate a Google Maps URL from address components.
 */
export function generateMapsLink(address: {
  streetAddress?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  mapLink?: string;
}): string {
  // Use custom map link if provided
  if (address.mapLink) return address.mapLink;

  // If we have coordinates, use them directly
  if (address.latitude && address.longitude) {
    return `https://www.google.com/maps?q=${address.latitude},${address.longitude}`;
  }

  // Otherwise build from address components
  const parts = [
    address.streetAddress,
    address.city,
    address.state,
    address.postalCode,
  ].filter(Boolean);

  if (parts.length === 0) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', '))}`;
}

/**
 * Look up the IANA timezone for a lat/lng using Open-Meteo's forecast endpoint.
 * Open-Meteo returns the timezone in its response headers/body for any coordinate.
 */
export async function lookupTimezone(lat: number, lng: number): Promise<string | null> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max&start_date=${today}&end_date=${today}&timezone=auto`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return data.timezone || null;
  } catch {
    return null;
  }
}

// ============================================
// SUN POSITION AND TIMES (offline, any date)
// ============================================
// Standard low-precision solar position (as in the NOAA solar calculator
// and public astronomy texts): good to about a minute for times and a
// fraction of a degree for direction, which is plenty for planning.
// Golden hour: sun between 6° above and 4° below the horizon. Blue hour:
// 4° to 6° below. Times are returned as Date (UTC instants).

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const J1970 = 2440588;
const J2000 = 2451545;

const toJulian = (date: Date) => date.getTime() / DAY_MS - 0.5 + J1970;
const fromJulian = (j: number) => new Date((j + 0.5 - J1970) * DAY_MS);
const toDays = (date: Date) => toJulian(date) - J2000;

const OBLIQUITY = RAD * 23.4397;
const declination = (l: number) => Math.asin(Math.sin(OBLIQUITY) * Math.sin(l));
const rightAscension = (l: number) => Math.atan2(Math.sin(l) * Math.cos(OBLIQUITY), Math.cos(l));
const solarMeanAnomaly = (d: number) => RAD * (357.5291 + 0.98560028 * d);
const eclipticLongitude = (m: number) => {
  const c = RAD * (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m));
  return m + c + RAD * 102.9372 + Math.PI;
};
const siderealTime = (d: number, lw: number) => RAD * (280.16 + 360.9856235 * d) - lw;

export interface SunPosition {
  altitude: number; // degrees above the horizon
  azimuth: number;  // degrees clockwise from north
}

export function sunPosition(date: Date, lat: number, lng: number): SunPosition {
  const lw = RAD * -lng;
  const phi = RAD * lat;
  const d = toDays(date);
  const l = eclipticLongitude(solarMeanAnomaly(d));
  const dec = declination(l);
  const h = siderealTime(d, lw) - rightAscension(l);
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(h));
  const az = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  return { altitude: alt / RAD, azimuth: ((az / RAD + 180) % 360 + 360) % 360 };
}

// Time the sun crosses an altitude, rising or setting, around solar noon
function crossing(altDeg: number, noonJ: number, lw: number, phi: number, dec: number, n: number, m: number, l: number, rising: boolean): Date | null {
  const cosH = (Math.sin(altDeg * RAD) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
  if (cosH < -1 || cosH > 1) return null; // never reaches it today (polar day/night)
  const w = Math.acos(cosH);
  const a = (w + lw) / (2 * Math.PI) + n;
  const j = J2000 + 0.0009 + a + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * l);
  return fromJulian(rising ? noonJ - (j - noonJ) : j);
}

export interface SunTimes {
  solarNoon: Date;
  sunrise: Date | null;
  sunset: Date | null;
  goldenMorningEnd: Date | null;   // sun reaches +6°
  goldenEveningStart: Date | null; // sun drops to +6°
  blueMorningStart: Date | null;   // -6° (civil dawn)
  blueMorningEnd: Date | null;     // -4°
  blueEveningStart: Date | null;   // -4°
  blueEveningEnd: Date | null;     // -6° (civil dusk)
  dayLengthMinutes: number | null;
}

/** Sun times for the calendar day containing `date` at that place */
export function sunTimes(date: Date, lat: number, lng: number): SunTimes {
  const lw = RAD * -lng;
  const phi = RAD * lat;
  const d = toDays(date);
  const n = Math.round(d - 0.0009 - lw / (2 * Math.PI));
  const ds = 0.0009 + lw / (2 * Math.PI) + n;
  const m = solarMeanAnomaly(ds);
  const l = eclipticLongitude(m);
  const dec = declination(l);
  const noonJ = J2000 + ds + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * l);
  // -0.833° accounts for refraction and the sun's radius at sunrise/sunset
  const at = (alt: number, rising: boolean) => crossing(alt, noonJ, lw, phi, dec, n, m, l, rising);
  const sunrise = at(-0.833, true);
  const sunset = at(-0.833, false);
  return {
    solarNoon: fromJulian(noonJ),
    sunrise,
    sunset,
    goldenMorningEnd: at(6, true),
    goldenEveningStart: at(6, false),
    blueMorningStart: at(-6, true),
    blueMorningEnd: at(-4, true),
    blueEveningStart: at(-4, false),
    blueEveningEnd: at(-6, false),
    dayLengthMinutes: sunrise && sunset ? Math.round((sunset.getTime() - sunrise.getTime()) / 60000) : null,
  };
}

/** Compass point for an azimuth: N, NNE, NE … */
export function compass(azimuth: number): string {
  const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return points[Math.round((((azimuth % 360) + 360) % 360) / 22.5) % 16];
}

/** Clock time in a time zone (IANA name), or the browser's own */
export function clockIn(date: Date | null, timeZone?: string): string {
  if (!date) return '—';
  try {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', ...(timeZone ? { timeZone } : {}) });
  } catch {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
}

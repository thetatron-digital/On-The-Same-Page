// Sun times and path for a location on a date: golden and blue hours,
// sunrise and sunset, solar noon, and where the sun is (offline maths).
import { useMemo, useState } from 'react';
import type { ProductionLocation } from '../../types/screenplay';
import { clockIn, compass, sunPosition, sunTimes } from '../../engine/sun';
import { useSunPanel } from './sunPanelState';
import './basecampTools.css';

const SIZE = 220;
const R = 90;

export function SunPanel({ location, shootDates }: { location: ProductionLocation; shootDates: string[] }) {
  const { date, set } = useSunPanel();
  const [hover, setHover] = useState<number | null>(null);
  const lat = location.latitude!;
  const lng = location.longitude!;
  const tz = location.timezone;
  // Noon UTC on the chosen date, nudged by longitude so we land on that local day
  const day = useMemo(() => new Date(new Date(`${date}T12:00:00Z`).getTime() - (lng / 15) * 3_600_000), [date, lng]);
  const t = useMemo(() => sunTimes(day, lat, lng), [day, lat, lng]);
  const path = useMemo(() => {
    const start = t.blueMorningStart ?? new Date(t.solarNoon.getTime() - 12 * 3_600_000);
    const end = t.blueEveningEnd ?? new Date(t.solarNoon.getTime() + 12 * 3_600_000);
    const pts: { at: Date; alt: number; az: number }[] = [];
    for (let ms = start.getTime(); ms <= end.getTime(); ms += 10 * 60_000) {
      const p = sunPosition(new Date(ms), lat, lng);
      pts.push({ at: new Date(ms), alt: p.altitude, az: p.azimuth });
    }
    return pts;
  }, [t, lat, lng]);
  // Top-down sky map: north up, horizon at the rim, overhead at the centre
  const xy = (alt: number, az: number) => {
    const r = R * (1 - Math.max(-6, alt) / 90);
    return [SIZE / 2 + r * Math.sin(az * Math.PI / 180), SIZE / 2 - r * Math.cos(az * Math.PI / 180)];
  };
  const up = path.filter((p) => p.alt > -0.833);
  const rise = t.sunrise ? sunPosition(t.sunrise, lat, lng) : null;
  const set_ = t.sunset ? sunPosition(t.sunset, lat, lng) : null;
  const noon = sunPosition(t.solarNoon, lat, lng);
  const hp = hover !== null ? path[hover] : null;

  const rows: [string, string, string][] = [
    ['Blue hour', `${clockIn(t.blueMorningStart, tz)} – ${clockIn(t.blueMorningEnd, tz)}`, `${clockIn(t.blueEveningStart, tz)} – ${clockIn(t.blueEveningEnd, tz)}`],
    ['Golden hour', `${clockIn(t.blueMorningEnd, tz)} – ${clockIn(t.goldenMorningEnd, tz)}`, `${clockIn(t.goldenEveningStart, tz)} – ${clockIn(t.blueEveningStart, tz)}`],
    ['Sunrise / Sunset', `${clockIn(t.sunrise, tz)}${rise ? ` · ${compass(rise.azimuth)}` : ''}`, `${clockIn(t.sunset, tz)}${set_ ? ` · ${compass(set_.azimuth)}` : ''}`],
  ];

  return (
    <section className="bct-sun">
      <div className="bct-sun-head">
        <h3>☀ {location.name}</h3>
        <input type="date" value={date} onChange={(e) => e.target.value && set({ date: e.target.value })} aria-label="Date" />
        {shootDates.length > 0 && (
          <select value="" onChange={(e) => e.target.value && set({ date: e.target.value })} aria-label="Jump to a shoot day">
            <option value="">Shoot days…</option>
            {shootDates.map((d, i) => <option key={d} value={d}>Day {i + 1} · {d}</option>)}
          </select>
        )}
        <button className="bc-icon-btn" onClick={() => set({ locationId: null })} aria-label="Close sun panel">×</button>
      </div>
      <div className="bct-sun-body">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Sun path seen from above, north at the top"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const mx = e.clientX - r.left, my = e.clientY - r.top;
            let best = 0, bestD = Infinity;
            path.forEach((p, i) => { const [x, y] = xy(p.alt, p.az); const d = (x - mx) ** 2 + (y - my) ** 2; if (d < bestD) { bestD = d; best = i; } });
            setHover(bestD < 400 ? best : null);
          }}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} className="bct-sun-horizon" />
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R * (2 / 3)} className="bct-sun-ring" />
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R / 3} className="bct-sun-ring" />
          {['N', 'E', 'S', 'W'].map((c, i) => {
            const [x, y] = xy(-14, i * 90);
            return <text key={c} x={x} y={y + 4} className="bct-sun-compass">{c}</text>;
          })}
          <polyline points={path.map((p) => xy(p.alt, p.az).join(',')).join(' ')} className="bct-sun-twilight" />
          <polyline points={up.map((p) => xy(p.alt, p.az).join(',')).join(' ')} className="bct-sun-path" />
          {rise && <circle cx={xy(0, rise.azimuth)[0]} cy={xy(0, rise.azimuth)[1]} r={4} className="bct-sun-rise" />}
          {set_ && <circle cx={xy(0, set_.azimuth)[0]} cy={xy(0, set_.azimuth)[1]} r={4} className="bct-sun-set" />}
          <circle cx={xy(noon.altitude, noon.azimuth)[0]} cy={xy(noon.altitude, noon.azimuth)[1]} r={5} className="bct-sun-noon" />
          {hp && <circle cx={xy(hp.alt, hp.az)[0]} cy={xy(hp.alt, hp.az)[1]} r={6} className="bct-sun-hover" />}
        </svg>
        <div className="bct-sun-facts">
          <table className="bct-sort-table">
            <thead><tr><th></th><th>Morning</th><th>Evening</th></tr></thead>
            <tbody>{rows.map(([label, am, pm]) => <tr key={label}><th>{label}</th><td>{am}</td><td>{pm}</td></tr>)}</tbody>
          </table>
          <p>Solar noon <strong>{clockIn(t.solarNoon, tz)}</strong> · sun {Math.round(noon.altitude)}° high in the {compass(noon.azimuth)}
            {t.dayLengthMinutes !== null && <> · {Math.floor(t.dayLengthMinutes / 60)}h {t.dayLengthMinutes % 60}m of daylight</>}
            {t.sunrise === null && <> · {noon.altitude > 0 ? 'the sun does not set' : 'the sun does not rise'}</>}
          </p>
          <p className="bct-muted">
            {hp ? <>At {clockIn(hp.at, tz)}: {Math.round(hp.alt)}° high, {compass(hp.az)} ({Math.round(hp.az)}°); shadows point {compass((hp.az + 180) % 360)}.</>
              : <>Hover the path for the sun's height and direction at any time.</>}
            {' '}Times in {tz ?? 'this computer\'s time zone'}. Golden hour: sun under 6°; blue hour: 4–6° below the horizon.
          </p>
        </div>
      </div>
    </section>
  );
}

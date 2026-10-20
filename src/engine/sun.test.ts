import { describe, expect, it } from 'vitest';
import { clockIn, compass, sunPosition, sunTimes } from './sun';

const near = (actual: Date | null, isoUtc: string, minutes = 3) =>
  expect(Math.abs(actual!.getTime() - new Date(isoUtc).getTime()) / 60000).toBeLessThan(minutes);

describe('sun', () => {
  it('matches published sunrise and sunset for New York on the June solstice', () => {
    // NOAA: 2026-06-21 sunrise 05:25 EDT (09:25Z), sunset 20:31 EDT (00:31Z next day)
    const t = sunTimes(new Date('2026-06-21T16:00:00Z'), 40.7128, -74.006);
    near(t.sunrise, '2026-06-21T09:25:00Z');
    near(t.sunset, '2026-06-22T00:31:00Z');
    expect(t.dayLengthMinutes).toBeGreaterThan(900);
    expect(clockIn(t.sunrise, 'America/New_York')).toMatch(/5:2\d/);
  });

  it('orders the light of the day', () => {
    const t = sunTimes(new Date('2026-10-20T12:00:00Z'), 51.5074, -0.1278); // London
    const order = [t.blueMorningStart, t.blueMorningEnd, t.sunrise, t.goldenMorningEnd, t.solarNoon, t.goldenEveningStart, t.sunset, t.blueEveningStart, t.blueEveningEnd].map((d) => d!.getTime());
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    near(t.sunrise, '2026-10-20T06:31:00Z', 4); // ~07:31 BST
  });

  it('handles midnight sun and polar night', () => {
    const summer = sunTimes(new Date('2026-06-21T12:00:00Z'), 78.22, 15.65); // Svalbard
    expect(summer.sunrise).toBeNull();
    expect(summer.dayLengthMinutes).toBeNull();
  });

  it('points the sun south at noon in the northern hemisphere', () => {
    const t = sunTimes(new Date('2026-03-20T12:00:00Z'), 40.7128, -74.006);
    const p = sunPosition(t.solarNoon, 40.7128, -74.006);
    expect(compass(p.azimuth)).toBe('S');
    expect(p.altitude).toBeGreaterThan(45);
    expect(p.altitude).toBeLessThan(52);
  });
});

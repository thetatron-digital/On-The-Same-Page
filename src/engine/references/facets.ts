// Facet values for tagging reference images. Built from public film
// vocabulary (frame sizes, lens bands, lighting terms), not copied lists.
import type { FacetId } from '../../types/references';

export const FACETS: { id: FacetId; label: string; values: string[] }[] = [
  { id: 'mediaType', label: 'Media Type', values: ['Film', 'TV', 'Commercial', 'Music Video', 'Documentary', 'Own Photo', 'Location Scout', 'Artwork'] },
  { id: 'intExt', label: 'Int / Ext', values: ['INT', 'EXT', 'INT/EXT'] },
  { id: 'timeOfDay', label: 'Time of Day', values: ['Dawn', 'Sunrise', 'Day', 'Golden Hour', 'Sunset', 'Dusk / Blue Hour', 'Night'] },
  { id: 'frameSize', label: 'Frame Size', values: ['EWS', 'WS', 'MWS', 'MS', 'MCU', 'CU', 'ECU', 'Insert'] },
  { id: 'shotType', label: 'Shot Type', values: ['Clean Single', 'Dirty Single / OTS', 'Two Shot', 'Three Shot', 'Group', 'Establishing', 'Profile', 'POV'] },
  { id: 'angle', label: 'Angle', values: ['Eye Level', 'High', 'Low', 'Overhead', 'Aerial', 'Dutch'] },
  { id: 'lensSize', label: 'Lens Size', values: ['Ultra Wide', 'Wide', 'Medium', 'Long', 'Telephoto'] },
  { id: 'composition', label: 'Composition', values: ['Center', 'Left Heavy', 'Right Heavy', 'Symmetrical', 'Balanced', 'Short Side', 'Rule of Thirds', 'Leading Lines', 'Frame in Frame'] },
  { id: 'lighting', label: 'Lighting', values: ['Hard', 'Soft', 'High Key', 'Low Key', 'Backlight', 'Side Light', 'Top Light', 'Under Light', 'Silhouette', 'Practical'] },
  { id: 'lightSource', label: 'Light Source', values: ['Daylight', 'Overcast', 'Sun', 'Moonlight', 'Tungsten', 'Fluorescent', 'LED', 'Fire', 'Neon', 'Mixed'] },
  { id: 'mood', label: 'Mood', values: ['Tense', 'Romantic', 'Melancholy', 'Joyful', 'Eerie', 'Epic', 'Intimate', 'Lonely', 'Chaotic', 'Calm'] },
];

/** Lens bands by focal length on a Super 35 / APS-C sized sensor */
export function lensBand(focalLength: number): string {
  if (focalLength < 18) return 'Ultra Wide';
  if (focalLength < 35) return 'Wide';
  if (focalLength < 70) return 'Medium';
  if (focalLength < 200) return 'Long';
  return 'Telephoto';
}

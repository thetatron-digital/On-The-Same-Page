// Adding images to the reference library: thumbnail, look from the pixels,
// bytes kept like dailies (this browser, and Drive for Drive projects).
import { useScreenplayStore } from '../../store/screenplayStore';
import { useAuthStore } from '../../services/projectService';
import { storeClipMedia } from '../../services/mediaStore';
import { analyzeLook } from '../../engine/references/look';
import { clipsGoToDrive } from '../dailies/addClips';

const THUMB = 480;
const ANALYZE = 160;

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) return createImageBitmap(file);
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode();
  return img;
}

function draw(source: ImageBitmap | HTMLImageElement, w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, w, h);
  return { canvas, ctx };
}

export async function addReferenceFiles(files: File[], extra: { sceneId?: string } = {}): Promise<{ added: string[]; failed: string[] }> {
  const toDrive = clipsGoToDrive();
  const user = useAuthStore.getState().user;
  const added: string[] = [];
  const failed: string[] = [];
  for (const file of files) {
    if (!file.type.startsWith('image/')) { failed.push(`${file.name} isn't an image`); continue; }
    try {
      const bitmap = await decode(file);
      const width = bitmap.width;
      const height = bitmap.height;
      const scale = (max: number) => Math.min(1, max / Math.max(width, height));
      const thumb = draw(bitmap, Math.round(width * scale(THUMB)), Math.round(height * scale(THUMB)));
      const small = draw(bitmap, Math.max(1, Math.round(width * scale(ANALYZE))), Math.max(1, Math.round(height * scale(ANALYZE))));
      const look = analyzeLook(small.ctx.getImageData(0, 0, small.canvas.width, small.canvas.height).data);
      const media = await storeClipMedia(file, { toDrive });
      added.push(useScreenplayStore.getState().addReferenceImage({
        media,
        thumbnail: thumb.canvas.toDataURL('image/jpeg', 0.8),
        width,
        height,
        look,
        facets: {},
        credits: { title: file.name.replace(/\.[^.]+$/, '') },
        keywords: [],
        sceneIds: extra.sceneId ? [extra.sceneId] : [],
        shotIds: [],
        addedBy: user?.name,
        addedAt: new Date(),
      }));
    } catch (error) {
      failed.push(`${file.name}: ${error instanceof Error ? error.message : 'could not be read'}`);
    }
  }
  return { added, failed };
}

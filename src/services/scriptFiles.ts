// Opening and saving script files (File > Open/Import, File > Export):
// Final Draft (.fdx) and Fountain (.fountain, .spmd, or plain text).
import { useScreenplayStore } from '../store/screenplayStore';
import { toFountain } from '../utils/fountain';

export const SCRIPT_FILE_TYPES = '.fdx,.fountain,.spmd,.txt';

const baseName = (name: string) => name.replace(/\.(fdx|fountain|spmd|txt|pdf)$/i, '') || 'Untitled';

// Loads a script file into ReWriter. Throws when the file can't be read.
export const openScriptFile = async (file: File): Promise<void> => {
  const content = await file.text();
  const store = useScreenplayStore.getState();
  const isFdx = /\.fdx$/i.test(file.name) || /^\s*<\?xml[\s\S]*<FinalDraft/.test(content.slice(0, 2000));
  if (isFdx) {
    store.loadFromFDX(content);
    store.setFileName(file.name);
  } else {
    store.loadFromFountain(content);
    store.setFileName(`${baseName(file.name)}.fdx`);
  }
  store.setActiveApp('rewriter');
};

// Asks for a script file, then opens it
export const chooseScriptFile = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = SCRIPT_FILE_TYPES;
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) openScriptFile(file).catch(() => alert('Could not open that file. Is it a Final Draft (.fdx) or Fountain script?'));
  };
  input.click();
};

export const downloadText = (name: string, text: string, type: string) => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// File > Export > Final Draft (.fdx)
export const exportFdx = () => {
  const { exportToFDX, fileName } = useScreenplayStore.getState();
  downloadText(`${baseName(fileName)}.fdx`, exportToFDX(), 'application/xml');
};

// File > Export > Fountain (.fountain), with ScriptNotes as [[notes]]
export const exportFountain = () => {
  const { screenplay, scriptNotes, fileName } = useScreenplayStore.getState();
  downloadText(`${baseName(fileName)}.fountain`, toFountain(screenplay, scriptNotes), 'text/plain');
};

// Save a file from the browser
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const downloadText = (text: string, name: string, type = 'text/plain') =>
  downloadBlob(new Blob([text], { type: `${type};charset=utf-8` }), name);

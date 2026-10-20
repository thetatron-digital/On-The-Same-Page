// DOM helpers for ReWriter's contenteditable script.
//
// An element's div can hold non-editable decorations (scene numbers, page-break
// markers) next to its text. These helpers read and address only the editable
// text, so decorations never leak into the script or shift the caret.

export const DECORATION_ATTR = 'data-decoration';

const isDecoration = (node: Node): boolean =>
  node.nodeType === Node.ELEMENT_NODE && (node as Element).hasAttribute(DECORATION_ATTR);

// Text nodes of an element div in document order, skipping decorations
const textNodes = (container: Node): Text[] => {
  const out: Text[] = [];
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) out.push(child as Text);
      else if (!isDecoration(child)) walk(child);
    }
  };
  walk(container);
  return out;
};

// The element's editable text
export const editableText = (container: Node): string =>
  textNodes(container).map((t) => t.data).join('');

// Converts a DOM position (as found in a Selection) to a character offset in the editable text
export const offsetInElement = (container: Node, node: Node, offset: number): number => {
  const nodes = textNodes(container);
  const owner = nodes.find((t) => t === node);
  if (owner) {
    let pos = 0;
    for (const t of nodes) {
      if (t === owner) return pos + Math.min(offset, t.data.length);
      pos += t.data.length;
    }
  }
  // A position between nodes: count the text before it
  const range = document.createRange();
  range.setStart(container, 0);
  range.setEnd(node, offset);
  return nodes.filter((t) => range.intersectsNode(t)).reduce((sum, t) => sum + t.data.length, 0);
};

// Converts a character offset back to a DOM position for a Range
export const positionAt = (container: Node, offset: number): { node: Node; offset: number } => {
  const nodes = textNodes(container);
  let pos = 0;
  for (const t of nodes) {
    if (offset <= pos + t.data.length) return { node: t, offset: Math.max(0, offset - pos) };
    pos += t.data.length;
  }
  const last = nodes[nodes.length - 1];
  return last ? { node: last, offset: last.data.length } : { node: container, offset: 0 };
};

// Distance from the top of ancestor (which must be positioned) to the top of el
export const offsetTopWithin = (el: HTMLElement, ancestor: HTMLElement): number => {
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return y;
};

// Paragraphs covered by the script selection, kept for Production menu
// commands (Mark Revised, Omit Scene) that run after focus leaves the editor
let selectedIds: string[] = [];
export const setSelectedElementIds = (ids: string[]) => { selectedIds = ids; };
export const getSelectedElementIds = (): string[] => selectedIds;

import type { Screenplay, ScreenplayElement, TextRun, ElementType, TitlePageInfo, RevisionSettings } from '../types/screenplay';
import { createDefaultRevisionSettings, SCENE_COLORS, type SceneColor } from '../types/screenplay';

// Generate a unique ID
export const generateId = (): string => {
  return `elem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Create default title page
const createDefaultTitlePage = (title: string = '', author: string = ''): TitlePageInfo => ({
  title: title || 'Untitled Screenplay',
  credit: 'Written by',
  author: author || '',
  source: '',
  draftDate: new Date().toLocaleDateString(),
  contact: '',
  copyright: '',
});

// Parse FDX file content into Screenplay object
export const parseFDX = (xmlContent: string): Screenplay => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'text/xml');

  // Check for parsing errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid FDX file format');
  }

  let title = '';
  let author = '';
  let credit = 'Written by';
  let source = '';
  let contact = '';

  // Parse title page info if available
  const titlePageEl = doc.querySelector('TitlePage');
  if (titlePageEl) {
    const titleEl = titlePageEl.querySelector('Content Paragraph[Type="Title"] Text');
    if (titleEl) {
      title = titleEl.textContent || '';
    }

    // Get all author paragraphs
    const authorParagraphs = titlePageEl.querySelectorAll('Content Paragraph[Type="Author"]');
    authorParagraphs.forEach((para) => {
      const text = para.querySelector('Text')?.textContent || '';
      if (text.toLowerCase().includes('written by') || text.toLowerCase().includes('screenplay by')) {
        credit = text;
      } else if (text.trim()) {
        author = text;
      }
    });

    // Get source/based on
    const sourcePara = titlePageEl.querySelector('Content Paragraph[Type="Source"] Text');
    if (sourcePara) {
      source = sourcePara.textContent || '';
    }

    // Get contact
    const contactPara = titlePageEl.querySelector('Content Paragraph[Type="Contact"] Text');
    if (contactPara) {
      contact = contactPara.textContent || '';
    }
  }

  const titlePage = createDefaultTitlePage(title, author);
  titlePage.credit = credit;
  titlePage.source = source;
  titlePage.contact = contact;

  const screenplay: Screenplay = {
    title,
    author,
    titlePage,
    elements: [],
  };

  // Parse script content (skip TitlePage content)
  const content = doc.querySelector('FinalDraft > Content');
  if (content) {
    content.querySelectorAll(':scope > Paragraph, :scope > OmittedScene').forEach((node) => {
      // A Summary paragraph is the scene summary of the heading before it
      if (node.getAttribute('Type') === 'Summary') {
        const heading = [...screenplay.elements].reverse().find((el) => el.type === 'Scene Heading');
        const summary = parseRuns(node).map((r) => r.text).join('').trim();
        if (heading && summary) heading.scene = { ...heading.scene, summary };
        return;
      }
      screenplay.elements.push(...parseParagraphNode(node));
    });
  }

  const revisions = parseRevisions(doc);
  if (revisions) screenplay.revisions = revisions;

  // Ensure at least one element
  if (screenplay.elements.length === 0) {
    screenplay.elements.push({
      id: generateId(),
      type: 'Scene Heading',
      content: [{ text: '' }],
    });
  }

  return screenplay;
};

const TITLE_PAGE_TYPES = new Set(['Title', 'Author', 'Source', 'Contact']);

// Text runs directly inside a <Paragraph>
const parseRuns = (para: Element): TextRun[] =>
  Array.from(para.querySelectorAll(':scope > Text')).map((textEl) => {
    const run: TextRun = { text: textEl.textContent || '' };
    const style = textEl.getAttribute('Style') as TextRun['style'] | null;
    if (style) run.style = style;
    const revisionId = parseInt(textEl.getAttribute('RevisionID') || '0', 10);
    if (revisionId > 0) run.revisionId = revisionId;
    return run;
  });

// One <Paragraph> (or <OmittedScene>) of the script body as elements. A
// paragraph holding <DualDialogue> becomes its two side-by-side speeches; one
// holding <OmittedScene> becomes an OMITTED heading that keeps the scene.
const parseParagraphNode = (node: Element): ScreenplayElement[] => {
  if (node.tagName === 'OmittedScene') {
    const kept = Array.from(node.querySelectorAll(':scope > Paragraph')).flatMap(parseParagraphNode);
    if (kept.length === 0) return [];
    return [{
      id: generateId(),
      type: 'Scene Heading',
      content: [{ text: 'OMITTED' }],
      sceneNumber: kept[0].sceneNumber,
      omitted: kept,
    }];
  }

  const typeAttr = node.getAttribute('Type') || 'Action';
  if (TITLE_PAGE_TYPES.has(typeAttr)) return [];

  const dual = node.querySelector(':scope > DualDialogue');
  if (dual) {
    const speeches = Array.from(dual.querySelectorAll(':scope > Paragraph')).flatMap(parseParagraphNode);
    const second = speeches.findIndex((el, i) => i > 0 && el.type === 'Character');
    return speeches.map((el, i) => ({
      ...el,
      isDualDialogue: true,
      dualDialoguePosition: second > 0 && i >= second ? 'right' as const : 'left' as const,
    }));
  }

  const runs = parseRuns(node);
  const omittedNode = node.querySelector(':scope > OmittedScene');
  if (runs.length === 0 && !omittedNode && !node.textContent?.trim()) return [];

  const element: ScreenplayElement = {
    id: generateId(),
    type: mapFDXTypeToElementType(typeAttr),
    content: runs.length > 0 ? runs : [{ text: omittedNode ? 'OMITTED' : '' }],
  };
  const sceneNumber = node.getAttribute('Number');
  if (sceneNumber) element.sceneNumber = sceneNumber;
  const bookmark = node.getAttribute('Bookmark');
  if (bookmark) element.bookmark = bookmark;
  if (node.getAttribute('Alignment') === 'Center') element.centered = true;
  if (node.getAttribute('StartsNewPage') === 'Yes') element.pageBreakBefore = true;
  const revised = Math.max(0, ...runs.map((r) => r.revisionId ?? 0));
  if (revised > 0) element.revisionId = revised;
  const props = node.querySelector(':scope > SceneProperties');
  if (props && element.type === 'Scene Heading') {
    const scene: NonNullable<ScreenplayElement['scene']> = {};
    if (props.getAttribute('Title')) scene.title = props.getAttribute('Title')!;
    const color = sceneColorFromFdx(props.getAttribute('Color'));
    if (color) scene.color = color;
    if (scene.title || scene.color) element.scene = scene;
  }
  if (omittedNode) {
    element.omitted = Array.from(omittedNode.querySelectorAll(':scope > Paragraph')).flatMap(parseParagraphNode);
  }
  return [element];
};

// Scene colors: FDX stores a color; we keep the nearest named scene color
const sceneColorFromFdx = (value: string | null): SceneColor | undefined => {
  if (!value) return undefined;
  const hex = fromFdxColor(value, '');
  if (!hex) return undefined;
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = rgb(hex);
  let best: SceneColor | undefined;
  let bestDistance = Infinity;
  for (const [name, named] of Object.entries(SCENE_COLORS) as [SceneColor, string][]) {
    const [nr, ng, nb] = rgb(named);
    const d = (r - nr) ** 2 + (g - ng) ** 2 + (b - nb) ** 2;
    if (d < bestDistance) { bestDistance = d; best = name; }
  }
  return best;
};

// FDX colors are 48-bit (#RRRRGGGGBBBB); ours are #rrggbb
const fromFdxColor = (color: string | null, fallback: string): string => {
  const hex = color?.replace('#', '') ?? '';
  if (/^[0-9a-f]{12}$/i.test(hex)) return `#${hex.slice(0, 2)}${hex.slice(4, 6)}${hex.slice(8, 10)}`.toLowerCase();
  if (/^[0-9a-f]{6}$/i.test(hex)) return `#${hex}`.toLowerCase();
  return fallback;
};

const toFdxColor = (color: string): string => {
  const hex = color.replace('#', '').toUpperCase();
  return `#${hex.slice(0, 2).repeat(2)}${hex.slice(2, 4).repeat(2)}${hex.slice(4, 6).repeat(2)}`;
};

// <Revisions ActiveSet Location RevisionMode RevisionsShown ShowPageColor><Revision …/></Revisions>
const parseRevisions = (doc: Document): RevisionSettings | undefined => {
  const node = doc.querySelector('FinalDraft > Revisions');
  if (!node) return undefined;
  const defaults = createDefaultRevisionSettings();
  const sets = Array.from(node.querySelectorAll(':scope > Revision')).map((rev, i) => {
    const id = parseInt(rev.getAttribute('ID') || String(i + 1), 10);
    const fallback = defaults.sets.find((s) => s.id === id) ?? defaults.sets[0];
    return {
      id,
      label: rev.getAttribute('Name') || fallback.label,
      mark: rev.getAttribute('Mark') || '*',
      pageColor: fromFdxColor(rev.getAttribute('PageColor'), fallback.pageColor),
    };
  });
  return {
    sets: sets.length > 0 ? sets : defaults.sets,
    activeSetId: parseInt(node.getAttribute('ActiveSet') || '1', 10),
    revisionMode: node.getAttribute('RevisionMode') === 'Yes',
    marksShown: node.getAttribute('RevisionsShown') === 'All' ? 'all' : 'active',
    showPageColors: node.getAttribute('ShowPageColor') === 'Yes',
    markLocation: parseFloat(node.getAttribute('Location') || '') || defaults.markLocation,
  };
};

// Map FDX paragraph type to our ElementType
const mapFDXTypeToElementType = (fdxType: string): ElementType => {
  const typeMap: Record<string, ElementType> = {
    'Scene Heading': 'Scene Heading',
    'Action': 'Action',
    'Character': 'Character',
    'Dialogue': 'Dialogue',
    'Parenthetical': 'Parenthetical',
    'Transition': 'Transition',
    'Shot': 'Shot',
    'General': 'General',
  };
  return typeMap[fdxType] || 'Action';
};

// Convert Screenplay object to FDX XML string
export const generateFDX = (screenplay: Screenplay): string => {
  const escapeXml = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const tp = screenplay.titlePage;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Template="No" Version="5">
<Content>
<TitlePage>
<Content>
<Paragraph Type="Title" Alignment="Center">
<Text>${escapeXml(tp.title || screenplay.title || 'Untitled')}</Text>
</Paragraph>
<Paragraph Type="Author" Alignment="Center">
<Text>${escapeXml(tp.credit || 'Written by')}</Text>
</Paragraph>
<Paragraph Type="Author" Alignment="Center">
<Text>${escapeXml(tp.author || screenplay.author || '')}</Text>
</Paragraph>`;

  if (tp.source) {
    xml += `
<Paragraph Type="Source" Alignment="Center">
<Text>${escapeXml(tp.source)}</Text>
</Paragraph>`;
  }

  if (tp.contact) {
    xml += `
<Paragraph Type="Contact" Alignment="Left">
<Text>${escapeXml(tp.contact)}</Text>
</Paragraph>`;
  }

  xml += `
</Content>
</TitlePage>
`;

  // Add script content
  const paragraph = (element: ScreenplayElement): string => {
    const sceneNumAttr = element.sceneNumber ? ` Number="${escapeXml(element.sceneNumber)}"` : '';
    const bookmarkAttr = element.bookmark ? ` Bookmark="${escapeXml(element.bookmark)}"` : '';
    const layoutAttr = `${element.centered ? ' Alignment="Center"' : ''}${element.pageBreakBefore ? ' StartsNewPage="Yes"' : ''}`;
    let out = `<Paragraph Type="${element.type}"${sceneNumAttr}${bookmarkAttr}${layoutAttr}>\n`;
    element.content.forEach((run) => {
      const styleAttr = run.style ? ` Style="${run.style}"` : '';
      const revisionId = run.revisionId ?? element.revisionId;
      const revisionAttr = revisionId ? ` RevisionID="${revisionId}"` : '';
      out += `<Text${styleAttr}${revisionAttr}>${escapeXml(run.text)}</Text>\n`;
    });
    if (element.type === 'Scene Heading' && (element.scene?.title || element.scene?.color)) {
      const title = element.scene.title ? ` Title="${escapeXml(element.scene.title)}"` : '';
      const color = element.scene.color ? ` Color="${toFdxColor(SCENE_COLORS[element.scene.color])}"` : '';
      out += `<SceneProperties${title}${color}/>\n`;
    }
    if (element.omitted) {
      out += `<OmittedScene>\n${element.omitted.map(paragraph).join('')}</OmittedScene>\n`;
    }
    const summary = element.type === 'Scene Heading' && element.scene?.summary
      ? `<Paragraph Type="Summary">\n<Text>${escapeXml(element.scene.summary)}</Text>\n</Paragraph>\n`
      : '';
    return `${out}</Paragraph>\n${summary}`;
  };

  for (let i = 0; i < screenplay.elements.length; i++) {
    const element = screenplay.elements[i];
    if (element.isDualDialogue && element.dualDialoguePosition === 'left') {
      // Both speeches of a dual dialogue go in one <DualDialogue> paragraph
      let j = i;
      while (j < screenplay.elements.length && screenplay.elements[j].isDualDialogue) j++;
      xml += `<Paragraph>\n<DualDialogue>\n${screenplay.elements.slice(i, j).map(paragraph).join('')}</DualDialogue>\n</Paragraph>\n`;
      i = j - 1;
      continue;
    }
    xml += paragraph(element);
  }

  xml += `</Content>
<HeaderAndFooter>
<Header>
<Paragraph>
<Text></Text>
</Paragraph>
</Header>
<Footer>
<Paragraph>
<Text></Text>
</Paragraph>
</Footer>
</HeaderAndFooter>
<PageLayout>
<PageSize>Letter</PageSize>
<TopMargin>72</TopMargin>
<BottomMargin>72</BottomMargin>
<LeftMargin>108</LeftMargin>
<RightMargin>72</RightMargin>
<DefaultFont>Courier</DefaultFont>
<DefaultSize>12</DefaultSize>
</PageLayout>
<ElementSettings>
<ElementSetting Type="Scene Heading">
<FontSpec Font="Courier Final Draft" Size="12" Style="AllCaps"/>
<ParagraphSpec Alignment="Left" FirstIndent="0.00" Leading="1" LeftIndent="0.00" RightIndent="0.00" SpaceBefore="24" Spacing="1"/>
</ElementSetting>
<ElementSetting Type="Action">
<FontSpec Font="Courier Final Draft" Size="12" Style=""/>
<ParagraphSpec Alignment="Left" FirstIndent="0.00" Leading="1" LeftIndent="0.00" RightIndent="0.00" SpaceBefore="12" Spacing="1"/>
</ElementSetting>
<ElementSetting Type="Character">
<FontSpec Font="Courier Final Draft" Size="12" Style="AllCaps"/>
<ParagraphSpec Alignment="Left" FirstIndent="0.00" Leading="1" LeftIndent="2.20" RightIndent="0.00" SpaceBefore="12" Spacing="1"/>
</ElementSetting>
<ElementSetting Type="Dialogue">
<FontSpec Font="Courier Final Draft" Size="12" Style=""/>
<ParagraphSpec Alignment="Left" FirstIndent="0.00" Leading="1" LeftIndent="1.00" RightIndent="1.50" SpaceBefore="0" Spacing="1"/>
</ElementSetting>
<ElementSetting Type="Parenthetical">
<FontSpec Font="Courier Final Draft" Size="12" Style=""/>
<ParagraphSpec Alignment="Left" FirstIndent="0.00" Leading="1" LeftIndent="1.60" RightIndent="1.90" SpaceBefore="0" Spacing="1"/>
</ElementSetting>
<ElementSetting Type="Transition">
<FontSpec Font="Courier Final Draft" Size="12" Style="AllCaps"/>
<ParagraphSpec Alignment="Right" FirstIndent="0.00" Leading="1" LeftIndent="0.00" RightIndent="0.00" SpaceBefore="12" Spacing="1"/>
</ElementSetting>
</ElementSettings>
${revisionsXml(screenplay.revisions)}</FinalDraft>`;

  return xml;
};

// <Revisions> block; written only once a script has revision settings
const revisionsXml = (revisions: RevisionSettings | undefined): string => {
  if (!revisions) return '';
  const attr = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const sets = revisions.sets.map((s) =>
    `<Revision ID="${s.id}" Name="${attr(s.label)}" Mark="${attr(s.mark)}" Color="#000000000000" PageColor="${toFdxColor(s.pageColor)}" Style="" FullRevision="No"/>\n`,
  ).join('');
  return `<Revisions ActiveSet="${revisions.activeSetId}" Location="${revisions.markLocation}" RevisionMode="${revisions.revisionMode ? 'Yes' : 'No'}" RevisionsShown="${revisions.marksShown === 'all' ? 'All' : 'Active'}" ShowPageColor="${revisions.showPageColors ? 'Yes' : 'No'}">\n${sets}</Revisions>\n`;
};

// Create a new empty screenplay
export const createNewScreenplay = (): Screenplay => {
  const titlePage = createDefaultTitlePage();
  return {
    title: 'Untitled Screenplay',
    author: '',
    titlePage,
    elements: [
      {
        id: generateId(),
        type: 'Scene Heading',
        content: [{ text: '' }],
      },
    ],
  };
};

// Get plain text content from TextRun array
export const getPlainText = (content: TextRun[]): string => {
  return content.map((run) => run.text).join('');
};

// Create TextRun array from plain text
export const createTextRuns = (text: string): TextRun[] => {
  return [{ text }];
};

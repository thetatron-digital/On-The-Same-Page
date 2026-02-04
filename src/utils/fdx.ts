import type { Screenplay, ScreenplayElement, TextRun, ElementType, TitlePageInfo } from '../types/screenplay';

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
    // Get paragraphs that are NOT inside TitlePage
    const allParagraphs = content.querySelectorAll(':scope > Paragraph');

    allParagraphs.forEach((para) => {
      const typeAttr = para.getAttribute('Type');
      // Skip title page element types
      if (typeAttr === 'Title' || typeAttr === 'Author' || typeAttr === 'Source' || typeAttr === 'Contact') {
        return;
      }

      const elementType = mapFDXTypeToElementType(typeAttr || 'Action');

      const textRuns: TextRun[] = [];
      const textElements = para.querySelectorAll('Text');

      textElements.forEach((textEl) => {
        const style = textEl.getAttribute('Style') as TextRun['style'] | null;
        textRuns.push({
          text: textEl.textContent || '',
          style: style || undefined,
        });
      });

      // Only add if there's actual content
      if (textRuns.length > 0 || para.textContent?.trim()) {
        const element: ScreenplayElement = {
          id: generateId(),
          type: elementType,
          content: textRuns.length > 0 ? textRuns : [{ text: para.textContent || '' }],
        };

        // Handle scene numbers
        const sceneNumber = para.getAttribute('Number');
        if (sceneNumber) {
          element.sceneNumber = sceneNumber;
        }

        screenplay.elements.push(element);
      }
    });
  }

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
  screenplay.elements.forEach((element) => {
    const sceneNumAttr = element.sceneNumber ? ` Number="${element.sceneNumber}"` : '';
    xml += `<Paragraph Type="${element.type}"${sceneNumAttr}>\n`;

    element.content.forEach((run) => {
      const styleAttr = run.style ? ` Style="${run.style}"` : '';
      xml += `<Text${styleAttr}>${escapeXml(run.text)}</Text>\n`;
    });

    xml += `</Paragraph>\n`;
  });

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
</FinalDraft>`;

  return xml;
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

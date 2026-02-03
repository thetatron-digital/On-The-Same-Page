// Screenplay element types following Final Draft conventions
export type ElementType =
  | 'Scene Heading'
  | 'Action'
  | 'Character'
  | 'Dialogue'
  | 'Parenthetical'
  | 'Transition'
  | 'Shot'
  | 'General';

export interface TextRun {
  text: string;
  style?: 'Bold' | 'Italic' | 'Underline' | 'Bold+Italic' | 'Bold+Underline' | 'Italic+Underline' | 'Bold+Italic+Underline';
}

export interface ScreenplayElement {
  id: string;
  type: ElementType;
  content: TextRun[];
  sceneNumber?: string;
}

export interface Screenplay {
  title: string;
  author: string;
  contact?: string;
  draftDate?: string;
  copyright?: string;
  elements: ScreenplayElement[];
}

export interface DocumentMetadata {
  fileName: string;
  lastModified: Date;
  isDirty: boolean;
}

// Element formatting specifications (matching industry standards)
export interface ElementFormatting {
  leftMargin: number; // inches from left edge
  rightMargin: number; // inches from right edge
  firstIndent?: number;
  alignment: 'Left' | 'Center' | 'Right';
  allCaps: boolean;
  spaceBefore: number; // lines
  spaceAfter: number; // lines
}

export const ELEMENT_FORMATTING: Record<ElementType, ElementFormatting> = {
  'Scene Heading': {
    leftMargin: 1.5,
    rightMargin: 1,
    alignment: 'Left',
    allCaps: true,
    spaceBefore: 2,
    spaceAfter: 1,
  },
  'Action': {
    leftMargin: 1.5,
    rightMargin: 1,
    alignment: 'Left',
    allCaps: false,
    spaceBefore: 1,
    spaceAfter: 1,
  },
  'Character': {
    leftMargin: 3.7,
    rightMargin: 1,
    alignment: 'Left',
    allCaps: true,
    spaceBefore: 1,
    spaceAfter: 0,
  },
  'Dialogue': {
    leftMargin: 2.5,
    rightMargin: 2.5,
    alignment: 'Left',
    allCaps: false,
    spaceBefore: 0,
    spaceAfter: 1,
  },
  'Parenthetical': {
    leftMargin: 3.1,
    rightMargin: 2.9,
    alignment: 'Left',
    allCaps: false,
    spaceBefore: 0,
    spaceAfter: 0,
  },
  'Transition': {
    leftMargin: 1.5,
    rightMargin: 1,
    alignment: 'Right',
    allCaps: true,
    spaceBefore: 1,
    spaceAfter: 1,
  },
  'Shot': {
    leftMargin: 1.5,
    rightMargin: 1,
    alignment: 'Left',
    allCaps: true,
    spaceBefore: 1,
    spaceAfter: 1,
  },
  'General': {
    leftMargin: 1.5,
    rightMargin: 1,
    alignment: 'Left',
    allCaps: false,
    spaceBefore: 1,
    spaceAfter: 1,
  },
};

// Keyboard shortcuts for element switching
export const ELEMENT_SHORTCUTS: Record<string, ElementType> = {
  '1': 'Scene Heading',
  '2': 'Action',
  '3': 'Character',
  '4': 'Dialogue',
  '5': 'Parenthetical',
  '6': 'Transition',
};

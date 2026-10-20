// Header and footer text with Final Draft-style fields, filled in per page
import type { HeaderFooterSettings, Screenplay } from '../types/screenplay';
import { createDefaultHeaderFooter } from '../types/screenplay';
import type { Page } from '../engine/paginate';
import { getRevisionSettings, pageRevision } from '../engine/production';

export const getHeaderFooter = (script: Pick<Screenplay, 'headerFooter'>): HeaderFooterSettings =>
  script.headerFooter ?? createDefaultHeaderFooter();

export const HEADER_FIELDS = ['Page', 'Revision', 'Date', 'Title', 'File', 'Scene'] as const;

export interface HeaderContext {
  page: string;
  revision: string;
  date: string;
  title: string;
  file: string;
  scene: string;
}

export const fillFields = (template: string, ctx: HeaderContext): string =>
  template
    .replace(/\{Page\}/gi, ctx.page)
    .replace(/\{Revision\}/gi, ctx.revision)
    .replace(/\{Date\}/gi, ctx.date)
    .replace(/\{Title\}/gi, ctx.title)
    .replace(/\{File\}/gi, ctx.file)
    .replace(/\{Scene\}/gi, ctx.scene)
    .replace(/^\s*[.,:;-]\s*$/, ''); // a field that came out empty leaves no stray punctuation

// Fields for one page: its label, the latest revision on it, the first scene on it
export const headerContext = (page: Page, screenplay: Screenplay, fileName = '', date = new Date()): HeaderContext => {
  const revision = pageRevision(page, screenplay.elements, getRevisionSettings(screenplay));
  const firstScene = page.items.find((i) => i.kind === 'element' && i.type === 'Scene Heading');
  const sceneEl = firstScene?.kind === 'element' ? screenplay.elements[firstScene.elementIndex] : undefined;
  return {
    page: page.label,
    revision: revision ? [revision.label, revision.date].filter(Boolean).join(' ') : '',
    date: date.toLocaleDateString(),
    title: screenplay.title,
    file: fileName,
    scene: sceneEl?.sceneNumber ?? '',
  };
};

// Whether a page shows its header or footer (the first page usually doesn't)
export const showsHeader = (settings: HeaderFooterSettings, pageNumber: number) =>
  settings.showHeader && (pageNumber > 1 || settings.headerOnFirstPage);
export const showsFooter = (settings: HeaderFooterSettings, pageNumber: number) =>
  settings.showFooter && (pageNumber > 1 || settings.footerOnFirstPage);

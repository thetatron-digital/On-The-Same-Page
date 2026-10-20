import { useRef, useCallback, useEffect } from 'react';
import type { ScreenplayElement, ElementType } from '../types/screenplay';
import { ELEMENT_BEHAVIOR, ELEMENT_FORMATTING, MARGIN_LEFT, NOTE_COLORS } from '../types/screenplay';
import { applyMacro, findMacro, getMacros, macroBank } from '../engine/scriptTools';
import { getAutoCompleteLists } from '../utils/autoCompleteLists';
import { getRevisionSettings, showsRevisionMark } from '../engine/production';
import { CHARS_PER_INCH, DUAL_COLUMN_CHARS, elementWidthChars, firstLineWidthChars, paginateScript, wrapElement, type PageBreak, type Pagination } from '../engine/paginate';
import { useScreenplayStore } from '../store/screenplayStore';
import { useShallow } from 'zustand/react/shallow';
import { generateId, createTextRuns } from '../utils/fdx';
import { detectAutoCompleteTrigger } from '../utils/scriptParser';
import { AutoComplete } from './AutoComplete';
import { isMac } from './writingActions';
import { DECORATION_ATTR, editableText, offsetInElement, offsetTopWithin, positionAt, setSelectedElementIds } from './editorDom';
import { LINE_HEIGHT_PX, PAGE_STRIDE } from './pageLayout';
import './ScriptEditor.css';

// Characters from the left margin to an element type's left edge
const indentChars = (type: ElementType): number =>
  Math.round((ELEMENT_FORMATTING[type].leftEdge - MARGIN_LEFT) * CHARS_PER_INCH);

// Position an element div exactly as the pagination engine lays it out, so the
// browser wraps it at the same character count
const applyElementLayout = (div: HTMLElement, type: ElementType, spaceBefore?: number) => {
  div.style.marginLeft = `${indentChars(type)}ch`;
  div.style.width = `${elementWidthChars(type)}ch`;
  div.style.textIndent = `${elementWidthChars(type) - firstLineWidthChars(type)}ch`;
  div.style.textAlign = ELEMENT_FORMATTING[type].alignment;
  if (spaceBefore !== undefined) {
    div.style.marginTop = `${spaceBefore * LINE_HEIGHT_PX}px`;
  }
};

// An element in a dual dialogue column: 25 characters wide, with the
// character name and parentheticals indented as in the PDF
const DUAL_INDENT: Partial<Record<ElementType, number>> = { Character: 7.5, Parenthetical: 4 };
const layoutDualElement = (div: HTMLElement, type: ElementType) => {
  div.style.marginLeft = `${DUAL_INDENT[type] ?? 0}ch`;
  div.style.width = `${DUAL_COLUMN_CHARS}ch`;
  div.style.marginTop = '0px';
  div.style.textAlign = 'left';
};

// Non-editable page break: (MORE) at the foot of the page, a gap sized later by
// alignPageBreaks, then the speaker's (CONT'D) at the head of the next page
const makePageBreak = (brk: PageBreak, tag: 'div' | 'span', indent: number): HTMLElement => {
  const box = document.createElement(tag);
  box.className = 'page-break-spacer';
  box.setAttribute(DECORATION_ATTR, '');
  box.setAttribute('contenteditable', 'false');
  box.dataset.page = String(brk.page);

  const line = (text: string) => {
    const span = document.createElement('span');
    span.className = 'page-break-line';
    span.style.marginLeft = `${indent}ch`;
    span.textContent = text;
    return span;
  };

  if (brk.more) box.appendChild(line(brk.more));
  const gap = document.createElement('span');
  gap.className = 'page-break-gap';
  box.appendChild(gap);
  if (brk.contd) box.appendChild(line(brk.contd));
  return box;
};

// Identifies where pages break and which names get an automatic (CONT'D),
// to tell whether the DOM needs rebuilding
const layoutKey = (p: Pagination): string =>
  p.breaks.map((b) => [b.elementId, b.line, b.offset, b.more, b.contd].join(':')).join('|') +
  `#${p.continuedCharacters.join(',')}`;

// Element type formatting info
const ELEMENT_FORMAT: Record<ElementType, {
  allCaps: boolean;
  placeholder: string;
}> = {
  'Scene Heading': { allCaps: true, placeholder: 'INT./EXT. LOCATION - TIME' },
  'Action': { allCaps: false, placeholder: 'Describe the action...' },
  'Character': { allCaps: true, placeholder: 'CHARACTER NAME' },
  'Dialogue': { allCaps: false, placeholder: '' },
  'Parenthetical': { allCaps: false, placeholder: '(wrily)' },
  'Transition': { allCaps: true, placeholder: 'CUT TO:' },
  'Shot': { allCaps: true, placeholder: 'ANGLE ON' },
  'General': { allCaps: false, placeholder: '' },
};

// Enter switches to the element's Return element (one table with Tab and the status bar)
const getNextElementType = (currentType: ElementType): ElementType => ELEMENT_BEHAVIOR[currentType].returnKey;

// Get CSS class name for element type
const getElementClass = (type: ElementType): string => {
  return type.toLowerCase().replace(' ', '-');
};

// Get plain text from element content
const getPlainText = (content: { text: string }[]): string => {
  return content.map(run => run.text).join('');
};

export const ScriptEditor = () => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isUpdatingRef = useRef(false);
  const lastElementsRef = useRef<string>('');
  const renderedLayoutRef = useRef<string>('');

  const {
    screenplay,
    selectElement,
    setCurrentElementType,
    autoComplete,
    openAutoComplete,
    closeAutoComplete,
    refreshScriptData,
    showSceneNumbers,
    scriptNotes,
    showNotes,
    showAlts,
  } = useScreenplayStore(
    useShallow((s) => ({
      screenplay: s.screenplay,
      selectElement: s.selectElement,
      setCurrentElementType: s.setCurrentElementType,
      autoComplete: s.autoComplete,
      openAutoComplete: s.openAutoComplete,
      closeAutoComplete: s.closeAutoComplete,
      refreshScriptData: s.refreshScriptData,
      showSceneNumbers: s.showSceneNumbers,
      scriptNotes: s.scriptNotes,
      showNotes: s.visibility.scriptNotes,
      showAlts: s.visibility.alts,
    }))
  );

  // Get the text offset within an element from a node
  const getTextOffset = useCallback(
    (container: HTMLElement, node: Node, offset: number): number => offsetInElement(container, node, offset),
    []
  );

  // Size each page-break gap so the next page's text starts at the top of its page
  const alignPageBreaks = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.querySelectorAll<HTMLElement>('.page-break-spacer').forEach((box) => {
      const gap = box.querySelector<HTMLElement>('.page-break-gap');
      if (!gap) return;
      const target = (Number(box.dataset.page) - 1) * PAGE_STRIDE;
      gap.style.height = `${Math.max(0, target - offsetTopWithin(gap, editor))}px`;
    });
  }, []);

  // Render content into the contenteditable - only when elements actually change
  const renderContent = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || isUpdatingRef.current) return;

    // Check if elements actually changed (not just selection)
    const revisions = getRevisionSettings(screenplay);
    const openNotes = showNotes ? scriptNotes.filter((n) => !n.resolved && n.elementId) : [];
    const elementsKey = screenplay.elements.map(e => `${e.id}:${e.type}:${getPlainText(e.content)}:${e.revisionId ?? ''}:${e.omitted ? 'o' : ''}:${e.bookmark ?? ''}:${showAlts ? e.alts?.length ?? 0 : ''}:${e.pageBreakBefore ? 'p' : ''}${e.centered ? 'c' : ''}${e.lyric ? 'l' : ''}${e.outline ? 'h' : ''}`).join('|') +
      `#${revisions.activeSetId}:${revisions.marksShown}:${JSON.stringify(screenplay.lockedPages ?? [])}` +
      `#${openNotes.map((n) => `${n.id}:${n.elementId}:${n.color}`).join(',')}`;
    if (elementsKey === lastElementsRef.current) {
      return; // No actual content change, skip re-render to preserve selection
    }
    lastElementsRef.current = elementsKey;

    isUpdatingRef.current = true;

    // Save current selection
    const selection = window.getSelection();
    let savedSelection: { elementId: string; startOffset: number; endOffset: number; startElementId: string; endElementId: string } | null = null;

    if (selection && selection.rangeCount > 0 && editor.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);

      // Find start element
      let startNode = range.startContainer;
      let startElementId = '';
      let startOffset = 0;
      while (startNode && startNode !== editor) {
        if (startNode.nodeType === Node.ELEMENT_NODE) {
          const el = startNode as HTMLElement;
          if (el.hasAttribute('data-element-id')) {
            startElementId = el.getAttribute('data-element-id')!;
            startOffset = getTextOffset(el, range.startContainer, range.startOffset);
            break;
          }
        }
        startNode = startNode.parentNode as Node;
      }

      // Find end element
      let endNode = range.endContainer;
      let endElementId = '';
      let endOffset = 0;
      while (endNode && endNode !== editor) {
        if (endNode.nodeType === Node.ELEMENT_NODE) {
          const el = endNode as HTMLElement;
          if (el.hasAttribute('data-element-id')) {
            endElementId = el.getAttribute('data-element-id')!;
            endOffset = getTextOffset(el, range.endContainer, range.endOffset);
            break;
          }
        }
        endNode = endNode.parentNode as Node;
      }

      if (startElementId) {
        savedSelection = {
          elementId: startElementId,
          startOffset,
          endOffset,
          startElementId,
          endElementId: endElementId || startElementId,
        };
      }
    }

    // Clear and rebuild content
    editor.innerHTML = '';

    // Page breaks and spacing come from the shared pagination engine (same as the PDF)
    const pagination = paginateScript(screenplay);
    const breaksByElement = new Map<string, PageBreak[]>();
    pagination.breaks.forEach((brk) => {
      breaksByElement.set(brk.elementId, [...(breaksByElement.get(brk.elementId) || []), brk]);
    });
    const spaceBefore = new Map<string, number>();
    pagination.pages.forEach((page) => page.items.forEach((item) => {
      if (item.kind === 'element' && !item.continued) spaceBefore.set(item.elementId, item.spaceBefore);
      if (item.kind === 'dual') spaceBefore.set(item.left[0].elementId, item.spaceBefore);
    }));
    const characterIndent = indentChars('Character');

    // Dual dialogue blocks, found the same way the pagination engine finds
    // them: a run of left-column elements followed by a run of right ones
    const dualBlocks = new Map<number, { mid: number; end: number }>();
    const dualSide = new Map<number, 'left' | 'right'>();
    for (let i = 0; i < screenplay.elements.length; i++) {
      const isSide = (j: number, side: 'left' | 'right') =>
        screenplay.elements[j]?.isDualDialogue && screenplay.elements[j].dualDialoguePosition === side;
      if (!isSide(i, 'left') || isSide(i - 1, 'left')) continue;
      let mid = i;
      while (isSide(mid, 'left')) mid++;
      let end = mid;
      while (isSide(end, 'right')) end++;
      if (end === mid) continue;
      dualBlocks.set(i, { mid, end });
      for (let j = i; j < end; j++) dualSide.set(j, j < mid ? 'left' : 'right');
    }
    let dualColumns: { left: HTMLElement; right: HTMLElement } | null = null;
    const continuedCharacters = new Set(pagination.continuedCharacters);

    screenplay.elements.forEach((element, index) => {
      const text = getPlainText(element.content);
      const format = ELEMENT_FORMAT[element.type];

      const div = document.createElement('div');
      div.setAttribute('data-element-id', element.id);
      div.setAttribute('data-element-type', element.type);
      div.className = `script-element ${getElementClass(element.type)}`;
      applyElementLayout(div, element.type, spaceBefore.get(element.id));
      if (element.centered) div.style.textAlign = 'center';
      if (element.lyric) div.style.fontStyle = 'italic';
      // Sections, synopses and boneyard keep their place but take no space
      // (the Navigator lists sections and synopses)
      if (element.outline) div.style.display = 'none';

      if (!text && format.placeholder) {
        div.setAttribute('data-placeholder', format.placeholder);
      }

      // Add scene numbers for Scene Heading elements
      if (element.type === 'Scene Heading' && showSceneNumbers && element.sceneNumber) {
        const leftNum = document.createElement('span');
        leftNum.className = 'scene-number';
        leftNum.textContent = element.sceneNumber;
        leftNum.setAttribute('contenteditable', 'false');
        leftNum.setAttribute(DECORATION_ATTR, '');
        div.appendChild(leftNum);

        const rightNum = document.createElement('span');
        rightNum.className = 'scene-number-right';
        rightNum.textContent = element.sceneNumber;
        rightNum.setAttribute('contenteditable', 'false');
        rightNum.setAttribute(DECORATION_ATTR, '');
        div.appendChild(rightNum);
      }

      // Add text content - use <br> for empty
      if (text) {
        div.appendChild(document.createTextNode(text));
      } else {
        div.appendChild(document.createElement('br'));
      }

      // An omitted scene's OMITTED placeholder is not editable text
      if (element.omitted) {
        div.setAttribute('contenteditable', 'false');
        div.classList.add('omitted-scene');
      }

      // ScriptNote markers and a bookmark flag in the left margin
      openNotes.filter((n) => n.elementId === element.id).forEach((note, i) => {
        const marker = document.createElement('span');
        marker.className = 'note-marker';
        marker.dataset.noteId = note.id;
        marker.setAttribute('contenteditable', 'false');
        marker.setAttribute(DECORATION_ATTR, '');
        marker.title = note.title || note.content.slice(0, 60) || 'ScriptNote';
        marker.style.left = `${-indentChars(element.type) - 3 - i * 1.5}ch`;
        marker.style.background = note.color ?? NOTE_COLORS[0];
        div.appendChild(marker);
      });
      if (element.bookmark) {
        const flag = document.createElement('span');
        flag.className = 'bookmark-flag';
        flag.setAttribute('contenteditable', 'false');
        flag.setAttribute(DECORATION_ATTR, '');
        flag.title = `Bookmark: ${element.bookmark}`;
        flag.style.left = `${-indentChars(element.type) - 6}ch`;
        flag.textContent = '\u25B8';
        div.appendChild(flag);
      }

      // Alts: which version is showing; click to show the next
      if (showAlts && element.alts?.length) {
        const badge = document.createElement('span');
        badge.className = 'alt-badge';
        badge.dataset.altFor = element.id;
        badge.setAttribute('contenteditable', 'false');
        badge.setAttribute(DECORATION_ATTR, '');
        badge.title = 'Show the next alt';
        badge.style.left = `${64 - indentChars(element.type)}ch`;
        badge.textContent = `Alt 1/${element.alts.length + 1}`;
        div.appendChild(badge);
      }

      // Revision mark (*) in the right margin, one per line
      if (showsRevisionMark(element.revisionId, revisions)) {
        const set = revisions.sets.find((r) => r.id === element.revisionId);
        const mark = document.createElement('span');
        mark.className = 'revision-mark';
        mark.setAttribute('contenteditable', 'false');
        mark.setAttribute(DECORATION_ATTR, '');
        mark.style.left = `${Math.round((revisions.markLocation - MARGIN_LEFT) * CHARS_PER_INCH) - indentChars(element.type)}ch`;
        mark.textContent = Array(wrapElement(element).length).fill(set?.mark ?? '*').join('\n');
        div.appendChild(mark);
      }

      // Automatic (CONT'D) for a character speaking again in the same scene
      if (continuedCharacters.has(index)) {
        const contd = document.createElement('span');
        contd.className = 'auto-contd';
        contd.textContent = ` ${pagination.contdText}`;
        contd.setAttribute('contenteditable', 'false');
        contd.setAttribute(DECORATION_ATTR, '');
        div.appendChild(contd);
      }

      const breaks = breaksByElement.get(element.id) || [];

      // A page that starts with this element: break before it
      breaks.filter((brk) => brk.line === 0).forEach((brk) => {
        editor.appendChild(makePageBreak(brk, 'div', characterIndent));
      });

      // Dual dialogue: two columns side by side (as the engine and PDF lay them out)
      if (dualBlocks.has(index)) {
        const block = document.createElement('div');
        block.className = 'dual-dialogue-block';
        block.style.marginTop = `${(spaceBefore.get(element.id) ?? 1) * LINE_HEIGHT_PX}px`;
        const left = document.createElement('div');
        const right = document.createElement('div');
        left.className = 'dual-dialogue-column';
        right.className = 'dual-dialogue-column';
        block.append(left, right);
        editor.appendChild(block);
        dualColumns = { left, right };
      }
      const side = dualSide.get(index);
      if (side && dualColumns) {
        layoutDualElement(div, element.type);
        dualColumns[side].appendChild(div);
        return;
      }
      dualColumns = null;

      // A page that starts partway through this element: break inside its text
      breaks.filter((brk) => brk.line > 0).forEach((brk) => {
        const pos = positionAt(div, brk.offset);
        if (pos.node.nodeType !== Node.TEXT_NODE) return;
        const after = (pos.node as Text).splitText(pos.offset);
        div.insertBefore(makePageBreak(brk, 'span', characterIndent - indentChars(element.type)), after);
      });

      editor.appendChild(div);
    });

    alignPageBreaks();
    renderedLayoutRef.current = layoutKey(pagination);

    // Restore selection
    if (savedSelection && selection) {
      const startDiv = editor.querySelector(`[data-element-id="${savedSelection.startElementId}"]`);
      const endDiv = editor.querySelector(`[data-element-id="${savedSelection.endElementId}"]`);

      if (startDiv) {
        try {
          const range = document.createRange();

          const start = positionAt(startDiv, savedSelection.startOffset);
          range.setStart(start.node, start.offset);
          const end = positionAt(endDiv || startDiv, savedSelection.endOffset);
          range.setEnd(end.node, end.offset);

          selection.removeAllRanges();
          selection.addRange(range);
        } catch {
          // Ignore selection errors
        }
      }
    }

    isUpdatingRef.current = false;
  }, [screenplay, getTextOffset, showSceneNumbers, alignPageBreaks, scriptNotes, showNotes, showAlts]);

  // Re-render only when elements change (not selection). While typing the DOM is
  // left alone; once typing pauses, rebuild if the page breaks moved, otherwise
  // just re-align the page-break gaps to the reflowed text.
  useEffect(() => {
    renderContent();
    const timer = window.setTimeout(() => {
      const editor = editorRef.current;
      if (!editor || isUpdatingRef.current) return;
      const pagination = paginateScript(screenplay);
      const shown = editor.querySelectorAll('.page-break-spacer').length;
      if (layoutKey(pagination) !== renderedLayoutRef.current || shown !== pagination.breaks.length) {
        lastElementsRef.current = '';
        renderContent();
      } else {
        alignPageBreaks();
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [screenplay, renderContent, alignPageBreaks]);

  // Line wrapping can change once the script font loads
  useEffect(() => {
    document.fonts?.ready.then(alignPageBreaks);
  }, [alignPageBreaks]);

  // Find element containing the cursor
  const getCurrentElement = useCallback((): { element: ScreenplayElement; div: HTMLElement; offset: number } | null => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    let node: Node | null = range.startContainer;

    if (node === editorRef.current) {
      const childIndex = Math.min(range.startOffset, editorRef.current.children.length - 1);
      if (childIndex >= 0) {
        node = editorRef.current.children[childIndex];
      }
    }

    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.hasAttribute('data-element-id')) {
          const elementId = el.getAttribute('data-element-id');
          const element = screenplay.elements.find(e => e.id === elementId);
          if (element) {
            const offset = getTextOffset(el, range.startContainer, range.startOffset);
            return { element, div: el, offset };
          }
        }
      }
      node = node.parentNode;
    }
    return null;
  }, [screenplay.elements, getTextOffset]);

  // Get cursor position in viewport coordinates
  const getCursorPosition = useCallback((): { x: number; y: number } | null => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // If collapsed cursor, rect might be empty - use the element position
    if (rect.width === 0 && rect.height === 0) {
      const current = getCurrentElement();
      if (current?.div) {
        const divRect = current.div.getBoundingClientRect();
        return {
          x: divRect.left + current.offset * 9.6, // Approximate char width in Courier
          y: divRect.top + divRect.height,
        };
      }
      return null;
    }

    return {
      x: rect.left,
      y: rect.bottom,
    };
  }, [getCurrentElement]);

  // Check for auto-complete trigger on input
  const checkAutoComplete = useCallback(() => {
    const current = getCurrentElement();
    if (!current) {
      closeAutoComplete();
      return;
    }

    const text = getPlainText(current.element.content);
    const lists = getAutoCompleteLists(useScreenplayStore.getState().screenplay);
    const trigger = detectAutoCompleteTrigger(current.element, current.offset, text, lists.timeSeparator);

    if (trigger.triggerType && trigger.searchText.length >= 0) {
      const pos = getCursorPosition();
      if (pos) {
        openAutoComplete(trigger.triggerType, trigger.searchText, pos);
      }
    } else {
      closeAutoComplete();
    }
  }, [getCurrentElement, getCursorPosition, openAutoComplete, closeAutoComplete]);

  // Handle input changes - parse DOM back to data
  const handleInput = useCallback(() => {
    if (isUpdatingRef.current) return;

    const editor = editorRef.current;
    if (!editor) return;

    const state = useScreenplayStore.getState();
    const newElements: ScreenplayElement[] = [];

    // Only get actual element divs, not page break spacers
    const elementDivs = editor.querySelectorAll('[data-element-id]');
    elementDivs.forEach((div) => {
      // Skip page break spacers
      if (div.classList.contains('page-break-spacer')) return;

      const elementId = div.getAttribute('data-element-id');
      const elementType = div.getAttribute('data-element-type') as ElementType;
      const text = editableText(div);

      if (elementId) {
        const format = ELEMENT_FORMAT[elementType];
        const processedText = format?.allCaps ? text.toUpperCase() : text;

        // Keep the element's other fields (scene number, revision, dual dialogue)
        const existing = state.screenplay.elements.find((el) => el.id === elementId);
        newElements.push({
          ...existing,
          id: elementId,
          type: elementType,
          content: createTextRuns(processedText),
        });
      }
    });

    if (newElements.length > 0) {
      isUpdatingRef.current = true;
      state.setScreenplay({
        ...state.screenplay,
        elements: newElements,
      });
      setTimeout(() => {
        isUpdatingRef.current = false;
        // Check for auto-complete trigger after input
        checkAutoComplete();
      }, 0);
    }
  }, [checkAutoComplete]);

  // Set cursor position in an element
  const setCursorPosition = useCallback((elementId: string, offset: number) => {
    const editor = editorRef.current;
    if (!editor) return;

    setTimeout(() => {
      const targetDiv = editor.querySelector(`[data-element-id="${elementId}"]`);
      if (targetDiv) {
        const selection = window.getSelection();
        const range = document.createRange();

        try {
          const pos = positionAt(targetDiv, offset);
          range.setStart(pos.node, pos.offset);
          range.collapse(true);
          selection?.removeAllRanges();
          selection?.addRange(range);
          targetDiv.scrollIntoView({ block: 'nearest' });
        } catch {
          // Ignore errors
        }
      }
    }, 10);
  }, []);

  // Handle paste
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();

    const text = e.clipboardData.getData('text/plain');
    if (!text) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    if (!selection.isCollapsed) {
      range.deleteContents();
    }

    const textNode = document.createTextNode(text);
    range.insertNode(textNode);

    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    handleInput();
  }, [handleInput]);

  // Paragraphs the selection touches (the caret's paragraph when collapsed)
  const selectedElementIds = useCallback((): string[] => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return [];
    const range = selection.getRangeAt(0);
    const ids = Array.from(editor.querySelectorAll<HTMLElement>('[data-element-id]'))
      .filter((div) => range.intersectsNode(div))
      .map((div) => div.dataset.elementId!);
    if (ids.length > 0) return ids;
    const current = getCurrentElement();
    return current ? [current.element.id] : [];
  }, [getCurrentElement]);

  // Handle keyboard events
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const state = useScreenplayStore.getState();
    const current = getCurrentElement();

    // If auto-complete is open, let it handle navigation keys
    if (autoComplete.isOpen) {
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
        // AutoComplete handles these via capture phase
        return;
      }
    }

    const digit = /^Digit(\d)$/.exec(e.code)?.[1];

    // Macros: Ctrl+Opt+digit (Mac) or Alt+Shift+digit; bank 2 adds Shift / Ctrl
    const bank = digit ? macroBank(e, isMac) : 0;
    if (bank && digit) {
      const macro = findMacro(getMacros(state.screenplay), bank, digit);
      if (macro) {
        e.preventDefault();
        if (!current) return;
        const result = applyMacro(state.screenplay.elements, current.element.id, current.offset, macro);
        state.setScreenplay({ ...state.screenplay, elements: result.elements });
        const caretType = result.elements.find((el) => el.id === result.caret.id)?.type;
        if (caretType) setCurrentElementType(caretType);
        selectElement(result.caret.id);
        setCursorPosition(result.caret.id, result.caret.offset);
        return;
      }
    }

    // Element, Insert, Production and other menu shortcuts are handled by
    // the command registry (commands/registry.ts)

    // Shift+Enter - insert newline within same element
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);

      // Delete any selected content
      if (!selection.isCollapsed) {
        range.deleteContents();
      }

      // Insert newline
      const newlineNode = document.createTextNode('\n');
      range.insertNode(newlineNode);

      // Move cursor after newline
      range.setStartAfter(newlineNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);

      handleInput();
      return;
    }

    // Enter - create new element
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      if (!current) {
        const newId = generateId();
        state.saveToHistory();
        state.setScreenplay({
          ...state.screenplay,
          elements: [{
            id: newId,
            type: 'Scene Heading',
            content: [{ text: '' }],
          }],
        });
        selectElement(newId);
        setCurrentElementType('Scene Heading');
        setCursorPosition(newId, 0);
        return;
      }

      const text = getPlainText(current.element.content);
      const cursorPos = current.offset;

      const nextType = getNextElementType(current.element.type);
      const newId = generateId();

      const elements = [...state.screenplay.elements];
      const currentIndex = elements.findIndex(el => el.id === current.element.id);

      state.saveToHistory();

      if (cursorPos >= text.length) {
        // In a dual dialogue column, more speech stays in the column; anything
        // else goes after the whole side-by-side block rather than splitting it
        const dual = current.element.isDualDialogue && (nextType === 'Dialogue' || nextType === 'Parenthetical');
        let insertAt = currentIndex + 1;
        if (current.element.isDualDialogue && !dual) {
          while (insertAt < elements.length && elements[insertAt].isDualDialogue) insertAt++;
        }
        elements.splice(insertAt, 0, {
          id: newId,
          type: nextType,
          content: [{ text: '' }],
          ...(dual ? { isDualDialogue: true, dualDialoguePosition: current.element.dualDialoguePosition } : {}),
        });

        state.setScreenplay({ ...state.screenplay, elements });
        selectElement(newId);
        setCurrentElementType(nextType);
        setCursorPosition(newId, 0);
      } else {
        const beforeCursor = text.slice(0, cursorPos);
        const afterCursor = text.slice(cursorPos);

        elements[currentIndex] = {
          ...current.element,
          content: createTextRuns(beforeCursor),
        };

        elements.splice(currentIndex + 1, 0, {
          id: newId,
          type: current.element.type,
          content: createTextRuns(afterCursor),
        });

        state.setScreenplay({ ...state.screenplay, elements });
        selectElement(newId);
        setCursorPosition(newId, 0);
      }
      return;
    }

    // Tab - cycle element type
    if (e.key === 'Tab') {
      e.preventDefault();

      if (!current) return;

      // Tab switches to the element's Tab element; Shift+Tab steps back through the list
      const types: ElementType[] = ['Scene Heading', 'Action', 'Character', 'Parenthetical', 'Dialogue', 'Transition', 'Shot', 'General'];
      const nextType = e.shiftKey
        ? types[(types.indexOf(current.element.type) - 1 + types.length) % types.length]
        : ELEMENT_BEHAVIOR[current.element.type].tabKey;

      state.saveToHistory();

      const elements = state.screenplay.elements.map(el =>
        el.id === current.element.id ? { ...el, type: nextType } : el
      );

      const savedOffset = current.offset;
      state.setScreenplay({ ...state.screenplay, elements });
      setCurrentElementType(nextType);
      setCursorPosition(current.element.id, savedOffset);
      return;
    }

    // Backspace at start of element - merge with previous
    if (e.key === 'Backspace') {
      const selection = window.getSelection();
      if (!selection || !current) return;

      if (current.offset === 0 && selection.isCollapsed) {
        const elements = [...state.screenplay.elements];
        const currentIndex = elements.findIndex(el => el.id === current.element.id);

        // Merge into the previous visible paragraph (skipping hidden sections etc.)
        let prevIndex = currentIndex - 1;
        while (prevIndex >= 0 && elements[prevIndex].outline) prevIndex--;
        if (prevIndex < 0) return;

        e.preventDefault();

        const text = getPlainText(current.element.content);
        const previousElement = elements[prevIndex];
        const previousText = getPlainText(previousElement.content);

        state.saveToHistory();

        elements[prevIndex] = {
          ...previousElement,
          content: createTextRuns(previousText + text),
        };
        elements.splice(currentIndex, 1);

        state.setScreenplay({ ...state.screenplay, elements });
        selectElement(previousElement.id);
        setCursorPosition(previousElement.id, previousText.length);
        return;
      }
    }

    // Delete at end of element - merge with next
    if (e.key === 'Delete') {
      const selection = window.getSelection();
      if (!selection || !current) return;

      const text = getPlainText(current.element.content);

      if (current.offset >= text.length && selection.isCollapsed) {
        const elements = [...state.screenplay.elements];
        const currentIndex = elements.findIndex(el => el.id === current.element.id);

        // Merge the next visible paragraph in (skipping hidden sections etc.)
        let nextIndex = currentIndex + 1;
        while (nextIndex < elements.length && elements[nextIndex].outline) nextIndex++;
        if (nextIndex >= elements.length) return;

        e.preventDefault();

        const nextElement = elements[nextIndex];
        const nextText = getPlainText(nextElement.content);

        state.saveToHistory();

        elements[currentIndex] = {
          ...current.element,
          content: createTextRuns(text + nextText),
        };
        elements.splice(nextIndex, 1);

        state.setScreenplay({ ...state.screenplay, elements });
        setCursorPosition(current.element.id, text.length);
        return;
      }
    }
  }, [getCurrentElement, selectElement, setCurrentElementType, setCursorPosition, handleInput]);

  // Handle selection change to track current element (without re-render)
  const handleSelectionChange = useCallback(() => {
    if (isUpdatingRef.current) return;

    const editor = editorRef.current;
    if (!editor) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    if (!editor.contains(selection.anchorNode)) return;

    // Remember which paragraphs the selection covers, for Mark/Clear Revised from menus
    setSelectedElementIds(selectedElementIds());

    const current = getCurrentElement();
    if (current) {
      selectElement(current.element.id);
      setCurrentElementType(current.element.type);
    }
  }, [getCurrentElement, selectElement, setCurrentElementType, selectedElementIds]);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [handleSelectionChange]);

  // Handle click
  const handleClick = useCallback((e: React.MouseEvent) => {
    const editor = editorRef.current;
    if (!editor) return;

    const target = e.target as HTMLElement;

    // A ScriptNote marker opens its note; an alt badge shows the next alt
    const marker = target.closest<HTMLElement>('.note-marker');
    if (marker?.dataset.noteId) {
      useScreenplayStore.getState().setActiveNote(marker.dataset.noteId);
      return;
    }
    const badge = target.closest<HTMLElement>('.alt-badge');
    if (badge?.dataset.altFor) {
      useScreenplayStore.getState().cycleAlt(badge.dataset.altFor, 1);
      return;
    }

    if (target === editor || !target.closest('[data-element-id]')) {
      const elements = screenplay.elements;
      if (elements.length > 0) {
        const lastElement = elements[elements.length - 1];
        const text = getPlainText(lastElement.content);
        selectElement(lastElement.id);
        setCursorPosition(lastElement.id, text.length);
      }
    }
  }, [screenplay.elements, selectElement, setCursorPosition]);

  // Focus editor
  const focusEditor = useCallback(() => {
    const editor = editorRef.current;
    if (editor && document.activeElement !== editor) {
      editor.focus();
    }
  }, []);

  useEffect(() => {
    if (screenplay.elements.length === 0) {
      focusEditor();
    }
  }, []);

  // Refresh script data (characters/locations) when screenplay changes
  useEffect(() => {
    refreshScriptData();
  }, [screenplay.elements, refreshScriptData]);

  // Handle auto-complete selection
  const handleAutoCompleteSelect = useCallback((value: string) => {
    const current = getCurrentElement();
    if (!current) {
      closeAutoComplete();
      return;
    }

    const state = useScreenplayStore.getState();
    const text = getPlainText(current.element.content);
    const { triggerType } = state.autoComplete;

    let newText = value;

    if (current.element.type === 'Character') {
      if (triggerType === 'extension') {
        // Append extension to existing character name
        // Remove any partial extension being typed
        const cleanName = text.replace(/\s*\([^)]*$/, '').trim();
        newText = cleanName + ' ' + value;
      } else {
        // Replace with selected character name
        newText = value;
      }
    } else if (current.element.type === 'Scene Heading') {
      const lists = getAutoCompleteLists(state.screenplay);
      const separator = lists.timeSeparator.trim() ? lists.timeSeparator : ' - ';
      if (triggerType === 'intro') {
        // A scene intro, then its separator, ready for the location
        newText = value + lists.sceneIntroSeparator;
      } else if (triggerType === 'timeofday') {
        // Replace the time of day after the separator
        newText = text.split(separator)[0] + separator + value;
      } else if (triggerType === 'location') {
        // Parse existing scene heading and replace location
        const match = text.match(/^(INT\.?|EXT\.?|INT\/EXT\.?|I\/E\.?)\s*/i);
        if (match) {
          newText = match[0] + value;
          // Check if there was a time of day after " - "
          const timeMatch = text.match(/\s+-\s+(.+)$/);
          if (timeMatch) {
            newText += ' - ' + timeMatch[1];
          }
        }
      }
    }

    if (current.element.type === 'Transition' && triggerType === 'transition') {
      newText = value;
    }

    const format = ELEMENT_FORMAT[current.element.type];
    const processedText = format?.allCaps ? newText.toUpperCase() : newText;

    state.saveToHistory();

    const elements = state.screenplay.elements.map(el =>
      el.id === current.element.id
        ? { ...el, content: createTextRuns(processedText) }
        : el
    );

    state.setScreenplay({ ...state.screenplay, elements });
    closeAutoComplete();

    // Position cursor at end
    setCursorPosition(current.element.id, processedText.length);
  }, [getCurrentElement, closeAutoComplete, setCursorPosition]);

  // Handle auto-complete close
  const handleAutoCompleteClose = useCallback(() => {
    closeAutoComplete();
    editorRef.current?.focus();
  }, [closeAutoComplete]);

  return (
    <>
      <div
        ref={editorRef}
        className="script-editor-content"
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onPaste={handlePaste}
        spellCheck
      />
      <AutoComplete
        onSelect={handleAutoCompleteSelect}
        onClose={handleAutoCompleteClose}
      />
    </>
  );
};

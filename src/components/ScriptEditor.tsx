import { useRef, useCallback, useEffect } from 'react';
import type { ScreenplayElement, ElementType } from '../types/screenplay';
import { ELEMENT_FORMATTING, MARGIN_LEFT } from '../types/screenplay';
import { CHARS_PER_INCH, elementWidthChars, firstLineWidthChars, paginateScript, type PageBreak, type Pagination } from '../engine/paginate';
import { useScreenplayStore } from '../store/screenplayStore';
import { useShallow } from 'zustand/react/shallow';
import { generateId, createTextRuns } from '../utils/fdx';
import { detectAutoCompleteTrigger } from '../utils/scriptParser';
import { AutoComplete } from './AutoComplete';
import { DECORATION_ATTR, editableText, offsetInElement, offsetTopWithin, positionAt } from './editorDom';
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

// Determine next element type based on current type (for Enter key)
const getNextElementType = (currentType: ElementType): ElementType => {
  switch (currentType) {
    case 'Scene Heading':
      return 'Action';
    case 'Action':
      return 'Action';
    case 'Character':
      return 'Dialogue';
    case 'Dialogue':
      return 'Action';
    case 'Parenthetical':
      return 'Dialogue';
    case 'Transition':
      return 'Scene Heading';
    default:
      return 'Action';
  }
};

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
    const elementsKey = screenplay.elements.map(e => `${e.id}:${e.type}:${getPlainText(e.content)}`).join('|');
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
    const pagination = paginateScript(screenplay.elements);
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
    const continuedCharacters = new Set(pagination.continuedCharacters);

    screenplay.elements.forEach((element, index) => {
      const text = getPlainText(element.content);
      const format = ELEMENT_FORMAT[element.type];

      const div = document.createElement('div');
      div.setAttribute('data-element-id', element.id);
      div.setAttribute('data-element-type', element.type);
      div.className = `script-element ${getElementClass(element.type)}`;
      applyElementLayout(div, element.type, spaceBefore.get(element.id));

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
  }, [screenplay.elements, getTextOffset, showSceneNumbers, alignPageBreaks]);

  // Re-render only when elements change (not selection). While typing the DOM is
  // left alone; once typing pauses, rebuild if the page breaks moved, otherwise
  // just re-align the page-break gaps to the reflowed text.
  useEffect(() => {
    renderContent();
    const timer = window.setTimeout(() => {
      const editor = editorRef.current;
      if (!editor || isUpdatingRef.current) return;
      const pagination = paginateScript(screenplay.elements);
      const shown = editor.querySelectorAll('.page-break-spacer').length;
      if (layoutKey(pagination) !== renderedLayoutRef.current || shown !== pagination.breaks.length) {
        lastElementsRef.current = '';
        renderContent();
      } else {
        alignPageBreaks();
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [screenplay.elements, renderContent, alignPageBreaks]);

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
    const trigger = detectAutoCompleteTrigger(current.element, current.offset, text);

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

        newElements.push({
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
        elements.splice(currentIndex + 1, 0, {
          id: newId,
          type: nextType,
          content: [{ text: '' }],
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

      const types: ElementType[] = ['Scene Heading', 'Action', 'Character', 'Dialogue', 'Parenthetical', 'Transition'];
      const currentIndex = types.indexOf(current.element.type);
      const direction = e.shiftKey ? -1 : 1;
      const nextIndex = (currentIndex + direction + types.length) % types.length;
      const nextType = types[nextIndex];

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

        if (currentIndex === 0) return;

        e.preventDefault();

        const text = getPlainText(current.element.content);
        const previousElement = elements[currentIndex - 1];
        const previousText = getPlainText(previousElement.content);

        state.saveToHistory();

        elements[currentIndex - 1] = {
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

        if (currentIndex >= elements.length - 1) return;

        e.preventDefault();

        const nextElement = elements[currentIndex + 1];
        const nextText = getPlainText(nextElement.content);

        state.saveToHistory();

        elements[currentIndex] = {
          ...current.element,
          content: createTextRuns(text + nextText),
        };
        elements.splice(currentIndex + 1, 1);

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

    const current = getCurrentElement();
    if (current) {
      selectElement(current.element.id);
      setCurrentElementType(current.element.type);
    }
  }, [getCurrentElement, selectElement, setCurrentElementType]);

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
      if (triggerType === 'timeofday') {
        // Replace time of day portion after " - "
        const parts = text.split(' - ');
        if (parts.length >= 1) {
          newText = parts[0] + ' - ' + value;
        } else {
          newText = text + ' - ' + value;
        }
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

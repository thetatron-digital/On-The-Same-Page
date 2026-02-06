import { useRef, useCallback, useEffect } from 'react';
import type { ScreenplayElement, ElementType } from '../types/screenplay';
import { useScreenplayStore } from '../store/screenplayStore';
import { generateId, createTextRuns } from '../utils/fdx';
import './ScriptEditor.css';

// Page layout constants (must match Editor.tsx)
const PAGE_HEIGHT = 1056;    // 11 inches at 96 DPI
const PAGE_GAP = 48;         // Gap between pages
const TOP_MARGIN = 96;       // 1 inch top margin
const BOTTOM_MARGIN = 96;    // 1 inch bottom margin
const CONTENT_HEIGHT = PAGE_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN; // 864px usable per page

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

  const {
    screenplay,
    selectElement,
    setCurrentElementType,
  } = useScreenplayStore();

  // Get the text offset within an element from a node
  const getTextOffset = useCallback((container: HTMLElement, node: Node, offset: number): number => {
    if (node === container) {
      let textPos = 0;
      for (let i = 0; i < offset && i < container.childNodes.length; i++) {
        textPos += container.childNodes[i].textContent?.length || 0;
      }
      return textPos;
    }

    if (node.nodeType === Node.TEXT_NODE && node.parentNode === container) {
      let textPos = 0;
      for (const child of Array.from(container.childNodes)) {
        if (child === node) {
          return textPos + offset;
        }
        textPos += child.textContent?.length || 0;
      }
      return offset;
    }

    return offset;
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

    // Track content used on current page for page break calculation
    let currentPageContentUsed = 0;
    const PAGE_BREAK_SPACER_HEIGHT = BOTTOM_MARGIN + PAGE_GAP + TOP_MARGIN; // 240px

    screenplay.elements.forEach((element) => {
      const text = getPlainText(element.content);
      const format = ELEMENT_FORMAT[element.type];

      const div = document.createElement('div');
      div.setAttribute('data-element-id', element.id);
      div.setAttribute('data-element-type', element.type);
      div.className = `script-element ${getElementClass(element.type)}`;

      if (!text && format.placeholder) {
        div.setAttribute('data-placeholder', format.placeholder);
      }

      // Add text content - use <br> for empty
      if (text) {
        div.appendChild(document.createTextNode(text));
      } else {
        div.appendChild(document.createElement('br'));
      }

      editor.appendChild(div);

      // Measure element height after adding to DOM
      const elementHeight = div.offsetHeight;
      const marginTop = parseFloat(getComputedStyle(div).marginTop) || 0;
      const totalElementHeight = elementHeight + marginTop;

      // Check if this element would cross a page boundary
      if (currentPageContentUsed + totalElementHeight > CONTENT_HEIGHT && currentPageContentUsed > 0) {
        // Insert page break spacer before this element
        const spacer = document.createElement('div');
        spacer.className = 'page-break-spacer';
        spacer.style.height = `${PAGE_BREAK_SPACER_HEIGHT}px`;
        spacer.setAttribute('contenteditable', 'false'); // Prevent editing
        editor.insertBefore(spacer, div);

        // Reset page content tracking for new page
        currentPageContentUsed = totalElementHeight;
      } else {
        currentPageContentUsed += totalElementHeight;
      }
    });

    // Restore selection
    if (savedSelection && selection) {
      const startDiv = editor.querySelector(`[data-element-id="${savedSelection.startElementId}"]`);
      const endDiv = editor.querySelector(`[data-element-id="${savedSelection.endElementId}"]`);

      if (startDiv) {
        try {
          const range = document.createRange();

          // Set start position
          const startTextNode = startDiv.firstChild;
          if (startTextNode && startTextNode.nodeType === Node.TEXT_NODE) {
            const maxLen = startTextNode.textContent?.length || 0;
            range.setStart(startTextNode, Math.min(savedSelection.startOffset, maxLen));
          } else {
            range.setStart(startDiv, 0);
          }

          // Set end position
          if (endDiv && endDiv !== startDiv) {
            const endTextNode = endDiv.firstChild;
            if (endTextNode && endTextNode.nodeType === Node.TEXT_NODE) {
              const maxLen = endTextNode.textContent?.length || 0;
              range.setEnd(endTextNode, Math.min(savedSelection.endOffset, maxLen));
            } else {
              range.setEnd(endDiv, 0);
            }
          } else if (startDiv.firstChild && startDiv.firstChild.nodeType === Node.TEXT_NODE) {
            const maxLen = startDiv.firstChild.textContent?.length || 0;
            range.setEnd(startDiv.firstChild, Math.min(savedSelection.endOffset, maxLen));
          }

          selection.removeAllRanges();
          selection.addRange(range);
        } catch {
          // Ignore selection errors
        }
      }
    }

    isUpdatingRef.current = false;
  }, [screenplay.elements, getTextOffset]);

  // Re-render only when elements change (not selection)
  useEffect(() => {
    renderContent();
  }, [screenplay.elements, renderContent]);

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
      const text = div.textContent || '';

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
      }, 0);
    }
  }, []);

  // Set cursor position in an element
  const setCursorPosition = useCallback((elementId: string, offset: number) => {
    const editor = editorRef.current;
    if (!editor) return;

    setTimeout(() => {
      const targetDiv = editor.querySelector(`[data-element-id="${elementId}"]`);
      if (targetDiv) {
        const textNode = targetDiv.firstChild;
        const selection = window.getSelection();
        const range = document.createRange();

        try {
          if (textNode && textNode.nodeType === Node.TEXT_NODE) {
            const maxLen = textNode.textContent?.length || 0;
            const actualOffset = Math.min(offset, maxLen);
            range.setStart(textNode, actualOffset);
            range.collapse(true);
          } else {
            range.setStart(targetDiv, 0);
            range.collapse(true);
          }
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

  return (
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
  );
};

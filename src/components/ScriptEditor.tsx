import { useRef, useCallback, useEffect } from 'react';
import type { ScreenplayElement, ElementType } from '../types/screenplay';
import { useScreenplayStore } from '../store/screenplayStore';
import { generateId, createTextRuns } from '../utils/fdx';
import './ScriptEditor.css';

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

// Determine next element type based on current type
const getNextElementType = (currentType: ElementType): ElementType => {
  switch (currentType) {
    case 'Scene Heading':
      return 'Action';
    case 'Action':
      return 'Action';
    case 'Character':
      return 'Dialogue';
    case 'Dialogue':
      return 'Dialogue';
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

  const {
    screenplay,
    selectedElementId,
    selectElement,
    setCurrentElementType,
  } = useScreenplayStore();

  // Render content into the contenteditable
  const renderContent = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || isUpdatingRef.current) return;

    isUpdatingRef.current = true;

    // Save current selection
    const selection = window.getSelection();
    let savedRange: { elementId: string; startOffset: number; endOffset: number } | null = null;

    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      let startNode = range.startContainer;

      // Find containing element for start
      while (startNode && startNode !== editor) {
        if (startNode.nodeType === Node.ELEMENT_NODE) {
          const el = startNode as HTMLElement;
          if (el.hasAttribute('data-element-id')) {
            savedRange = {
              elementId: el.getAttribute('data-element-id')!,
              startOffset: range.startOffset,
              endOffset: range.endOffset,
            };
            break;
          }
        }
        startNode = startNode.parentNode as Node;
      }
    }

    // Clear and rebuild content
    editor.innerHTML = '';

    screenplay.elements.forEach((element, index) => {
      const text = getPlainText(element.content);
      const format = ELEMENT_FORMAT[element.type];
      const prevType = index > 0 ? screenplay.elements[index - 1].type : undefined;
      const isContinuation = prevType === element.type;
      const isSelected = selectedElementId === element.id && !isContinuation;

      const div = document.createElement('div');
      div.setAttribute('data-element-id', element.id);
      div.setAttribute('data-element-type', element.type);
      div.className = `script-element ${getElementClass(element.type)} ${isSelected ? 'selected' : ''}`;

      if (!text && format.placeholder) {
        div.setAttribute('data-placeholder', format.placeholder);
      }

      // Add text content
      div.textContent = text || '\u200B'; // Zero-width space for empty elements

      editor.appendChild(div);
    });

    // Restore selection
    if (savedRange && selection) {
      const targetDiv = editor.querySelector(`[data-element-id="${savedRange.elementId}"]`);
      if (targetDiv && targetDiv.firstChild) {
        try {
          const range = document.createRange();
          const maxLen = targetDiv.textContent?.length || 0;
          range.setStart(targetDiv.firstChild, Math.min(savedRange.startOffset, maxLen));
          range.setEnd(targetDiv.firstChild, Math.min(savedRange.endOffset, maxLen));
          selection.removeAllRanges();
          selection.addRange(range);
        } catch (e) {
          // Ignore selection errors
        }
      }
    }

    isUpdatingRef.current = false;
  }, [screenplay.elements, selectedElementId]);

  // Re-render when screenplay changes
  useEffect(() => {
    renderContent();
  }, [screenplay.elements, selectedElementId, renderContent]);

  // Find element containing the cursor
  const getCurrentElement = useCallback((): { element: ScreenplayElement; div: HTMLElement; offset: number } | null => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    let node = range.startContainer;

    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.hasAttribute('data-element-id')) {
          const elementId = el.getAttribute('data-element-id');
          const element = screenplay.elements.find(e => e.id === elementId);
          if (element) {
            return { element, div: el, offset: range.startOffset };
          }
        }
      }
      node = node.parentNode as Node;
    }
    return null;
  }, [screenplay.elements]);

  // Handle input changes - parse DOM back to data
  const handleInput = useCallback(() => {
    if (isUpdatingRef.current) return;

    const editor = editorRef.current;
    if (!editor) return;

    const state = useScreenplayStore.getState();
    const newElements: ScreenplayElement[] = [];

    // Parse all element divs
    const elementDivs = editor.querySelectorAll('[data-element-id]');
    elementDivs.forEach((div) => {
      const elementId = div.getAttribute('data-element-id');
      const elementType = div.getAttribute('data-element-type') as ElementType;
      let text = div.textContent || '';

      // Remove zero-width space placeholder
      if (text === '\u200B') text = '';

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
      // Don't re-render immediately, let the next effect cycle handle it
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
      if (targetDiv && targetDiv.firstChild) {
        const selection = window.getSelection();
        const range = document.createRange();
        try {
          const maxLen = targetDiv.textContent?.length || 0;
          const actualOffset = Math.min(offset, maxLen);
          range.setStart(targetDiv.firstChild, actualOffset);
          range.collapse(true);
          selection?.removeAllRanges();
          selection?.addRange(range);
        } catch (e) {
          // Ignore
        }
      }
    }, 0);
  }, []);

  // Handle keyboard events
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const state = useScreenplayStore.getState();
    const current = getCurrentElement();

    // Enter - create new element
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      if (!current) return;

      const selection = window.getSelection();
      if (!selection) return;

      const range = selection.getRangeAt(0);
      let text = current.div.textContent || '';
      if (text === '\u200B') text = '';

      const cursorPos = range.startOffset;
      const actualPos = text === '' ? 0 : cursorPos;

      // If at end of element, create new element after
      if (actualPos >= text.length) {
        const nextType = getNextElementType(current.element.type);
        const newId = generateId();

        const elements = [...state.screenplay.elements];
        const currentIndex = elements.findIndex(el => el.id === current.element.id);

        state.saveToHistory();
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
        // Split element at cursor
        const beforeCursor = text.slice(0, actualPos);
        const afterCursor = text.slice(actualPos);

        const newId = generateId();
        const elements = [...state.screenplay.elements];
        const currentIndex = elements.findIndex(el => el.id === current.element.id);

        state.saveToHistory();

        // Update current element
        elements[currentIndex] = {
          ...current.element,
          content: createTextRuns(beforeCursor),
        };

        // Insert new element with text after cursor
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

      const range = selection.getRangeAt(0);
      let text = current.div.textContent || '';
      if (text === '\u200B') text = '';

      // Check if at start of element with no selection and cursor at position 0 (or 1 for zero-width space)
      const atStart = range.startOffset === 0 || (range.startOffset === 1 && current.div.textContent === '\u200B');

      if (atStart && selection.isCollapsed) {
        const elements = [...state.screenplay.elements];
        const currentIndex = elements.findIndex(el => el.id === current.element.id);

        if (currentIndex === 0) return; // Can't merge first element

        e.preventDefault();

        const previousElement = elements[currentIndex - 1];
        const previousText = getPlainText(previousElement.content);

        state.saveToHistory();

        // Merge with previous element
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

      const range = selection.getRangeAt(0);
      let text = current.div.textContent || '';
      if (text === '\u200B') text = '';

      const atEnd = range.endOffset >= text.length || text === '';

      if (atEnd && selection.isCollapsed) {
        const elements = [...state.screenplay.elements];
        const currentIndex = elements.findIndex(el => el.id === current.element.id);

        if (currentIndex >= elements.length - 1) return; // Can't merge last element

        e.preventDefault();

        const nextElement = elements[currentIndex + 1];
        const nextText = getPlainText(nextElement.content);

        state.saveToHistory();

        // Merge with next element
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
  }, [getCurrentElement, selectElement, setCurrentElementType, setCursorPosition]);

  // Handle selection change to track current element
  const handleSelectionChange = useCallback(() => {
    const current = getCurrentElement();
    if (current) {
      selectElement(current.element.id);
      setCurrentElementType(current.element.type);
    }
  }, [getCurrentElement, selectElement, setCurrentElementType]);

  // Listen for selection changes
  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [handleSelectionChange]);

  // Handle click on empty area
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const editor = editorRef.current;

    if (!editor) return;

    // If clicked on the editor container itself (not an element)
    if (target === editor) {
      const elements = screenplay.elements;
      if (elements.length > 0) {
        const lastElement = elements[elements.length - 1];
        const text = getPlainText(lastElement.content);
        selectElement(lastElement.id);
        setCursorPosition(lastElement.id, text.length);
      }
    }
  }, [screenplay.elements, selectElement, setCursorPosition]);

  return (
    <div
      ref={editorRef}
      className="script-editor-content"
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      spellCheck
    />
  );
};

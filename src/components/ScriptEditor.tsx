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

  const {
    screenplay,
    selectedElementId,
    selectElement,
    setCurrentElementType,
  } = useScreenplayStore();

  // Get the text offset within an element from a node
  const getTextOffset = useCallback((container: HTMLElement, node: Node, offset: number): number => {
    // If the node is the container itself
    if (node === container) {
      // Offset is child index, calculate text position
      let textPos = 0;
      for (let i = 0; i < offset && i < container.childNodes.length; i++) {
        textPos += container.childNodes[i].textContent?.length || 0;
      }
      return textPos;
    }

    // If node is a text node directly in the container
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

    // Otherwise, it's the offset in the text node
    return offset;
  }, []);

  // Render content into the contenteditable
  const renderContent = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || isUpdatingRef.current) return;

    isUpdatingRef.current = true;

    // Save current selection
    const selection = window.getSelection();
    let savedRange: { elementId: string; startOffset: number; endOffset: number } | null = null;

    if (selection && selection.rangeCount > 0 && editor.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      let startNode = range.startContainer;

      // Find containing element for start
      while (startNode && startNode !== editor) {
        if (startNode.nodeType === Node.ELEMENT_NODE) {
          const el = startNode as HTMLElement;
          if (el.hasAttribute('data-element-id')) {
            const startOffset = getTextOffset(el, range.startContainer, range.startOffset);
            const endOffset = getTextOffset(el, range.endContainer, range.endOffset);
            savedRange = {
              elementId: el.getAttribute('data-element-id')!,
              startOffset,
              endOffset,
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

      // Add text content - use <br> for empty instead of zero-width space for better selection
      if (text) {
        div.appendChild(document.createTextNode(text));
      } else {
        div.appendChild(document.createElement('br'));
      }

      editor.appendChild(div);
    });

    // Restore selection
    if (savedRange && selection) {
      const targetDiv = editor.querySelector(`[data-element-id="${savedRange.elementId}"]`);
      if (targetDiv) {
        const textNode = targetDiv.firstChild;
        if (textNode) {
          try {
            const range = document.createRange();
            const isTextNode = textNode.nodeType === Node.TEXT_NODE;
            const maxLen = isTextNode ? (textNode.textContent?.length || 0) : 0;

            if (isTextNode && maxLen > 0) {
              range.setStart(textNode, Math.min(savedRange.startOffset, maxLen));
              range.setEnd(textNode, Math.min(savedRange.endOffset, maxLen));
            } else {
              range.setStart(targetDiv, 0);
              range.collapse(true);
            }
            selection.removeAllRanges();
            selection.addRange(range);
          } catch {
            // Ignore selection errors
          }
        }
      }
    }

    isUpdatingRef.current = false;
  }, [screenplay.elements, selectedElementId, getTextOffset]);

  // Re-render when screenplay changes
  useEffect(() => {
    renderContent();
  }, [screenplay.elements, selectedElementId, renderContent]);

  // Find element containing the cursor
  const getCurrentElement = useCallback((): { element: ScreenplayElement; div: HTMLElement; offset: number } | null => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    let node: Node | null = range.startContainer;

    // If selection is at the editor level, find the child element
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

    // Parse all element divs
    const elementDivs = editor.querySelectorAll('[data-element-id]');
    elementDivs.forEach((div) => {
      const elementId = div.getAttribute('data-element-id');
      const elementType = div.getAttribute('data-element-type') as ElementType;
      let text = div.textContent || '';

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
            // Empty element or <br>
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

  // Handle paste to regenerate element IDs
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();

    const text = e.clipboardData.getData('text/plain');
    if (!text) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    // Delete any selected content first
    if (!selection.isCollapsed) {
      range.deleteContents();
    }

    // Insert text at cursor position
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);

    // Move cursor to end of inserted text
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    // Trigger input handler to sync with store
    handleInput();
  }, [handleInput]);

  // Handle keyboard events
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const state = useScreenplayStore.getState();
    const current = getCurrentElement();

    // Enter - create new element
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      if (!current) {
        // No current element, create first one
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

      // Determine next element type
      const nextType = getNextElementType(current.element.type);
      const newId = generateId();

      const elements = [...state.screenplay.elements];
      const currentIndex = elements.findIndex(el => el.id === current.element.id);

      state.saveToHistory();

      if (cursorPos >= text.length) {
        // At end of element - create new element with next type
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
        const beforeCursor = text.slice(0, cursorPos);
        const afterCursor = text.slice(cursorPos);

        // Update current element with text before cursor
        elements[currentIndex] = {
          ...current.element,
          content: createTextRuns(beforeCursor),
        };

        // Insert new element with same type containing text after cursor
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

      const text = getPlainText(current.element.content);

      if (current.offset >= text.length && selection.isCollapsed) {
        const elements = [...state.screenplay.elements];
        const currentIndex = elements.findIndex(el => el.id === current.element.id);

        if (currentIndex >= elements.length - 1) return;

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
    if (isUpdatingRef.current) return;

    const editor = editorRef.current;
    if (!editor) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    // Check if selection is within our editor
    if (!editor.contains(selection.anchorNode)) return;

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

  // Handle click - focus and position cursor
  const handleClick = useCallback((e: React.MouseEvent) => {
    const editor = editorRef.current;
    if (!editor) return;

    const target = e.target as HTMLElement;

    // If clicked on the editor container itself (not an element)
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

  // Focus editor when needed
  const focusEditor = useCallback(() => {
    const editor = editorRef.current;
    if (editor && document.activeElement !== editor) {
      editor.focus();
    }
  }, []);

  // Expose focus method
  useEffect(() => {
    // Focus on mount if no content
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

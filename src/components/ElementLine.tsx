import { useRef, useEffect, useState, type KeyboardEvent } from 'react';
import type { ScreenplayElement, ElementType } from '../types/screenplay';
import { ELEMENT_SHORTCUTS } from '../types/screenplay';
import { getPlainText, createTextRuns } from '../utils/fdx';
import { useScreenplayStore } from '../store/screenplayStore';
import './ElementLine.css';

interface ElementLineProps {
  element: ScreenplayElement;
  onFocus: () => void;
  isSelected: boolean;
}

// Determine next element type based on current type (smart element progression)
const getNextElementType = (currentType: ElementType): ElementType => {
  switch (currentType) {
    case 'Scene Heading':
      return 'Action';
    case 'Action':
      return 'Action';
    case 'Character':
      return 'Dialogue';
    case 'Dialogue':
      return 'Character';
    case 'Parenthetical':
      return 'Dialogue';
    case 'Transition':
      return 'Scene Heading';
    default:
      return 'Action';
  }
};

// Element type formatting info
const ELEMENT_FORMAT: Record<ElementType, {
  allCaps: boolean;
  placeholder: string;
}> = {
  'Scene Heading': { allCaps: true, placeholder: 'INT./EXT. LOCATION - TIME' },
  'Action': { allCaps: false, placeholder: 'Describe the action...' },
  'Character': { allCaps: true, placeholder: 'CHARACTER NAME' },
  'Dialogue': { allCaps: false, placeholder: 'Dialogue...' },
  'Parenthetical': { allCaps: false, placeholder: '(wrily)' },
  'Transition': { allCaps: true, placeholder: 'CUT TO:' },
  'Shot': { allCaps: true, placeholder: 'ANGLE ON' },
  'General': { allCaps: false, placeholder: '' },
};

export const ElementLine = ({ element, onFocus, isSelected }: ElementLineProps) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [localValue, setLocalValue] = useState(getPlainText(element.content));

  const {
    updateElement,
    updateElementType,
    addElement,
    deleteElement,
    selectElement,
    mergeWithPrevious,
    setCurrentElementType,
  } = useScreenplayStore();

  const format = ELEMENT_FORMAT[element.type];

  // Sync local value with element content when element changes
  useEffect(() => {
    setLocalValue(getPlainText(element.content));
  }, [element.id, element.content]);

  // Focus input when selected
  useEffect(() => {
    if (isSelected && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSelected]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let value = e.target.value;

    // Auto-capitalize for certain element types
    if (format.allCaps) {
      value = value.toUpperCase();
    }

    setLocalValue(value);
    updateElement(element.id, createTextRuns(value));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const cursorPosition = textarea.selectionStart;
    const text = localValue;

    // Enter key - create new element
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      // If cursor is at the end, create new element after
      if (cursorPosition >= text.length) {
        const nextType = getNextElementType(element.type);
        const newId = addElement(element.id, nextType);
        selectElement(newId);
        setCurrentElementType(nextType);
      } else {
        // Split the text at cursor position
        const beforeCursor = text.slice(0, cursorPosition);
        const afterCursor = text.slice(cursorPosition);

        // Update current element with text before cursor
        updateElement(element.id, createTextRuns(beforeCursor));

        // Create new element with text after cursor
        const nextType = getNextElementType(element.type);
        const newId = addElement(element.id, nextType);

        // Set the new element's content to the text after cursor
        setTimeout(() => {
          useScreenplayStore.getState().updateElement(newId, createTextRuns(afterCursor));
          selectElement(newId);
        }, 0);
      }
      return;
    }

    // Tab key - cycle through element types
    if (e.key === 'Tab') {
      e.preventDefault();
      const types: ElementType[] = ['Scene Heading', 'Action', 'Character', 'Dialogue', 'Parenthetical', 'Transition'];
      const currentIndex = types.indexOf(element.type);
      const direction = e.shiftKey ? -1 : 1;
      const nextIndex = (currentIndex + direction + types.length) % types.length;
      const nextType = types[nextIndex];
      updateElementType(element.id, nextType);
      setCurrentElementType(nextType);
      return;
    }

    // Backspace at beginning - merge with previous or delete
    if (e.key === 'Backspace' && cursorPosition === 0 && textarea.selectionEnd === 0) {
      e.preventDefault();
      if (text.length === 0) {
        deleteElement(element.id);
      } else {
        mergeWithPrevious(element.id);
      }
      return;
    }

    // Ctrl/Cmd + number for element type shortcuts
    if ((e.ctrlKey || e.metaKey) && ELEMENT_SHORTCUTS[e.key]) {
      e.preventDefault();
      const newType = ELEMENT_SHORTCUTS[e.key];
      updateElementType(element.id, newType);
      setCurrentElementType(newType);
      return;
    }

    // Arrow up at start - go to previous element
    if (e.key === 'ArrowUp' && cursorPosition === 0) {
      const state = useScreenplayStore.getState();
      const elements = state.screenplay.elements;
      const currentIndex = elements.findIndex((el) => el.id === element.id);
      if (currentIndex > 0) {
        selectElement(elements[currentIndex - 1].id);
      }
      return;
    }

    // Arrow down at end - go to next element
    if (e.key === 'ArrowDown' && cursorPosition >= text.length) {
      const state = useScreenplayStore.getState();
      const elements = state.screenplay.elements;
      const currentIndex = elements.findIndex((el) => el.id === element.id);
      if (currentIndex < elements.length - 1) {
        selectElement(elements[currentIndex + 1].id);
      }
      return;
    }
  };

  const handleFocus = () => {
    onFocus();
    selectElement(element.id);
    setCurrentElementType(element.type);
  };

  // Get CSS class name for element type
  const getElementClass = () => {
    return element.type.toLowerCase().replace(' ', '-');
  };

  return (
    <div
      className={`element-line ${getElementClass()} ${isSelected ? 'selected' : ''}`}
      data-type={element.type}
    >
      <textarea
        ref={inputRef}
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        placeholder={format.placeholder}
        className="element-input"
        rows={1}
        spellCheck
      />
    </div>
  );
};

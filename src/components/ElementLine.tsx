import { useRef, useEffect, useState, type KeyboardEvent } from 'react';
import type { ScreenplayElement, ElementType } from '../types/screenplay';
import { ELEMENT_FORMATTING, ELEMENT_SHORTCUTS } from '../types/screenplay';
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

  const formatting = ELEMENT_FORMATTING[element.type];

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
    if (formatting.allCaps) {
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

  // Calculate dynamic styles based on element type
  const getElementStyle = () => {
    const baseStyle: React.CSSProperties = {
      textAlign: formatting.alignment.toLowerCase() as 'left' | 'center' | 'right',
      textTransform: formatting.allCaps ? 'uppercase' : 'none',
    };

    // Apply indentation based on element type
    // These values are relative to the editor width, simulating the screenplay format
    switch (element.type) {
      case 'Character':
        baseStyle.paddingLeft = '35%';
        break;
      case 'Dialogue':
        baseStyle.paddingLeft = '15%';
        baseStyle.paddingRight = '20%';
        break;
      case 'Parenthetical':
        baseStyle.paddingLeft = '25%';
        baseStyle.paddingRight = '25%';
        break;
      case 'Transition':
        baseStyle.paddingRight = '5%';
        break;
      default:
        break;
    }

    return baseStyle;
  };

  // Get placeholder text based on element type
  const getPlaceholder = () => {
    switch (element.type) {
      case 'Scene Heading':
        return 'INT./EXT. LOCATION - TIME';
      case 'Action':
        return 'Describe the action...';
      case 'Character':
        return 'CHARACTER NAME';
      case 'Dialogue':
        return 'Dialogue...';
      case 'Parenthetical':
        return '(wrily)';
      case 'Transition':
        return 'CUT TO:';
      default:
        return '';
    }
  };

  return (
    <div
      className={`element-line ${element.type.toLowerCase().replace(' ', '-')} ${isSelected ? 'selected' : ''}`}
      data-type={element.type}
    >
      <div className="element-type-indicator">
        {element.type.charAt(0)}
      </div>
      <textarea
        ref={inputRef}
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        placeholder={getPlaceholder()}
        className="element-input"
        style={getElementStyle()}
        rows={1}
        spellCheck
      />
    </div>
  );
};

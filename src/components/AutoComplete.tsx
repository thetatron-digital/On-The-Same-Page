import { useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useScreenplayStore } from '../store/screenplayStore';
import type { AutoCompleteSuggestion } from '../types/screenplay';
import './AutoComplete.css';

interface AutoCompleteProps {
  onSelect: (value: string) => void;
  onClose: () => void;
}

export const AutoComplete = ({ onSelect, onClose }: AutoCompleteProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const {
    autoComplete,
    moveAutoCompleteSelection,
    closeAutoComplete,
  } = useScreenplayStore();

  const { isOpen, suggestions, selectedIndex, position, triggerType } = autoComplete;

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        moveAutoCompleteSelection('down');
        break;
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        moveAutoCompleteSelection('up');
        break;
      case 'Enter':
        e.preventDefault();
        e.stopPropagation();
        if (suggestions[selectedIndex]) {
          onSelect(suggestions[selectedIndex].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        onClose();
        break;
      case 'Tab':
        e.preventDefault();
        e.stopPropagation();
        if (suggestions[selectedIndex]) {
          onSelect(suggestions[selectedIndex].value);
        } else {
          onClose();
        }
        break;
    }
  }, [isOpen, suggestions, selectedIndex, moveAutoCompleteSelection, onSelect, onClose]);

  // Attach keyboard listener
  useEffect(() => {
    if (isOpen) {
      // Use capture phase to intercept before editor
      document.addEventListener('keydown', handleKeyDown, true);
      return () => {
        document.removeEventListener('keydown', handleKeyDown, true);
      };
    }
  }, [isOpen, handleKeyDown]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && isOpen) {
      const selectedItem = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, isOpen]);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.autocomplete-dropdown')) {
        closeAutoComplete();
      }
    };

    // Delay to avoid closing on the same click that opened it
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen, closeAutoComplete]);

  if (!isOpen || suggestions.length === 0) {
    return null;
  }

  // Calculate position - show below the cursor
  const dropdownStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${position.x}px`,
    top: `${position.y + 20}px`, // Offset below cursor
    zIndex: 10000,
  };

  // Adjust if would go off screen
  const viewportHeight = window.innerHeight;
  const dropdownHeight = Math.min(suggestions.length * 36 + 16, 200); // Max height 200px

  if (position.y + 20 + dropdownHeight > viewportHeight - 20) {
    // Show above instead
    dropdownStyle.top = `${position.y - dropdownHeight - 5}px`;
  }

  // Keep within viewport horizontally
  const dropdownWidth = 280;
  if (position.x + dropdownWidth > window.innerWidth - 20) {
    dropdownStyle.left = `${window.innerWidth - dropdownWidth - 20}px`;
  }

  const getSourceIcon = (suggestion: AutoCompleteSuggestion) => {
    if (suggestion.source === 'blueprint') {
      return (
        <span className="suggestion-source blueprint" title="From BluePrint">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        </span>
      );
    }
    return (
      <span className="suggestion-source script" title="From Script">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </span>
    );
  };

  const getTypeIcon = (type: 'character' | 'location' | 'extension' | 'timeofday') => {
    if (type === 'character') {
      return (
        <span className="suggestion-type character" title="Character">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </span>
      );
    }
    if (type === 'location') {
      return (
        <span className="suggestion-type location" title="Location">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </span>
      );
    }
    if (type === 'extension') {
      return (
        <span className="suggestion-type extension" title="Extension">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </span>
      );
    }
    if (type === 'timeofday') {
      return (
        <span className="suggestion-type timeofday" title="Time of Day">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        </span>
      );
    }
    return null;
  };

  const getHeaderText = () => {
    switch (triggerType) {
      case 'character': return 'Characters';
      case 'location': return 'Locations';
      case 'extension': return 'Extensions';
      case 'timeofday': return 'Time of Day';
      default: return 'Suggestions';
    }
  };

  return ReactDOM.createPortal(
    <div className="autocomplete-dropdown" style={dropdownStyle}>
      <div className="autocomplete-header">
        {getHeaderText()}
      </div>
      <div className="autocomplete-list" ref={listRef}>
        {suggestions.map((suggestion, index) => (
          <div
            key={`${suggestion.value}-${index}`}
            className={`autocomplete-item ${index === selectedIndex ? 'selected' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect(suggestion.value);
            }}
            onMouseEnter={() => useScreenplayStore.getState().selectAutoCompleteSuggestion(index)}
          >
            {getTypeIcon(suggestion.type)}
            <span className="suggestion-value">{suggestion.value}</span>
            {suggestion.occurrences !== undefined && suggestion.occurrences > 0 && (
              <span className="suggestion-count">({suggestion.occurrences})</span>
            )}
            {getSourceIcon(suggestion)}
          </div>
        ))}
      </div>
      <div className="autocomplete-footer">
        <span><kbd>↑↓</kbd> navigate</span>
        <span><kbd>Enter</kbd> select</span>
        <span><kbd>Esc</kbd> close</span>
      </div>
    </div>,
    document.body
  );
};

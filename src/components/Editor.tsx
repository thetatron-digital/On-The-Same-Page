import { useEffect, useRef } from 'react';
import { useScreenplayStore } from '../store/screenplayStore';
import { ElementLine } from './ElementLine';
import './Editor.css';

export const Editor = () => {
  const editorRef = useRef<HTMLDivElement>(null);

  const {
    screenplay,
    selectedElementId,
    selectElement,
  } = useScreenplayStore();

  // Auto-resize textareas
  useEffect(() => {
    const textareas = editorRef.current?.querySelectorAll('textarea');
    textareas?.forEach((textarea) => {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    });
  }, [screenplay.elements]);

  // Handle click on empty area - focus last element or add new one
  const handleEditorClick = (e: React.MouseEvent) => {
    if (e.target === editorRef.current || (e.target as HTMLElement).classList.contains('editor-content')) {
      const lastElement = screenplay.elements[screenplay.elements.length - 1];
      if (lastElement) {
        selectElement(lastElement.id);
      }
    }
  };

  // Handle keyboard shortcuts at editor level
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + N - New document
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        useScreenplayStore.getState().newScreenplay();
      }

      // Ctrl/Cmd + S - Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const fdxContent = useScreenplayStore.getState().exportToFDX();
        const fileName = useScreenplayStore.getState().fileName;
        const blob = new Blob([fdxContent], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName.endsWith('.fdx') ? fileName : `${fileName}.fdx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        useScreenplayStore.getState().setDirty(false);
      }

      // Ctrl/Cmd + O - Open
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.fdx';
        input.onchange = async (ev) => {
          const file = (ev.target as HTMLInputElement).files?.[0];
          if (file) {
            try {
              const content = await file.text();
              useScreenplayStore.getState().loadFromFDX(content);
              useScreenplayStore.getState().setFileName(file.name);
            } catch (error) {
              alert('Failed to open file.');
            }
          }
        };
        input.click();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="editor" ref={editorRef} onClick={handleEditorClick}>
      <div className="editor-page">
        <div className="page-header">
          <input
            type="text"
            className="title-input"
            placeholder="Untitled Screenplay"
            value={screenplay.title}
            onChange={(e) => useScreenplayStore.getState().setTitle(e.target.value)}
          />
          <input
            type="text"
            className="author-input"
            placeholder="Written by..."
            value={screenplay.author}
            onChange={(e) => useScreenplayStore.getState().setAuthor(e.target.value)}
          />
        </div>

        <div className="editor-content">
          {screenplay.elements.map((element) => (
            <ElementLine
              key={element.id}
              element={element}
              isSelected={selectedElementId === element.id}
              onFocus={() => selectElement(element.id)}
            />
          ))}
        </div>

        <div className="page-footer">
          <span className="element-count">{screenplay.elements.length} elements</span>
        </div>
      </div>
    </div>
  );
};

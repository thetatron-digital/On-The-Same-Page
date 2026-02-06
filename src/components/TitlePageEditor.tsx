import { useRef, useState } from 'react';
import { useScreenplayStore } from '../store/screenplayStore';
import { downloadPDF } from '../utils/pdf';
import './TitlePageEditor.css';

type TextAlign = 'left' | 'center' | 'right';

interface TextStyle {
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

export const TitlePageEditor = () => {
  const { screenplay, updateTitlePage, togglePanel } = useScreenplayStore();
  const { titlePage } = screenplay;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track styling for title field
  const [titleAlign, setTitleAlign] = useState<TextAlign>('center');
  const [titleStyle, setTitleStyle] = useState<TextStyle>({ bold: false, italic: false, underline: true });

  const handlePrint = () => {
    const pdfFileName = (titlePage.title || 'Untitled') + ' - Title Page.pdf';
    downloadPDF(screenplay, pdfFileName);
  };

  const handleInsertImage = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image size should be less than 2MB.');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      updateTitlePage({ image: base64 });
    };
    reader.readAsDataURL(file);

    e.target.value = '';
  };

  const handleRemoveImage = () => {
    updateTitlePage({ image: undefined });
  };

  const toggleStyle = (style: keyof TextStyle) => {
    setTitleStyle(prev => ({ ...prev, [style]: !prev[style] }));
  };

  const getTitleStyles = () => {
    const styles: React.CSSProperties = {
      textAlign: titleAlign,
    };
    if (titleStyle.bold) styles.fontWeight = 'bold';
    if (titleStyle.italic) styles.fontStyle = 'italic';
    if (titleStyle.underline) styles.textDecoration = 'underline';
    return styles;
  };

  return (
    <div className="title-page-overlay">
      <div className="title-page-editor">
        {/* Enhanced Toolbar */}
        <div className="title-page-toolbar">
          <div className="toolbar-group">
            <button className="tp-btn" onClick={handlePrint} title="Print/Export PDF">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              <span>Print</span>
            </button>

            <button className="tp-btn" onClick={handleInsertImage} title="Insert Image">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span>Insert Image</span>
            </button>
          </div>

          <div className="toolbar-divider" />

          <div className="toolbar-group styles-group">
            <span className="group-label">Styles</span>
            <button
              className={`style-btn ${titleStyle.bold ? 'active' : ''}`}
              onClick={() => toggleStyle('bold')}
              title="Bold"
            >
              B
            </button>
            <button
              className={`style-btn ${titleStyle.italic ? 'active' : ''}`}
              onClick={() => toggleStyle('italic')}
              title="Italic"
              style={{ fontStyle: 'italic' }}
            >
              I
            </button>
            <button
              className={`style-btn ${titleStyle.underline ? 'active' : ''}`}
              onClick={() => toggleStyle('underline')}
              title="Underline"
              style={{ textDecoration: 'underline' }}
            >
              U
            </button>
          </div>

          <div className="toolbar-divider" />

          <div className="toolbar-group alignment-group">
            <span className="group-label">Alignment</span>
            <button
              className={`align-btn ${titleAlign === 'left' ? 'active' : ''}`}
              onClick={() => setTitleAlign('left')}
              title="Align Left"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="15" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <button
              className={`align-btn ${titleAlign === 'center' ? 'active' : ''}`}
              onClick={() => setTitleAlign('center')}
              title="Center"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="6" y1="12" x2="18" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <button
              className={`align-btn ${titleAlign === 'right' ? 'active' : ''}`}
              onClick={() => setTitleAlign('right')}
              title="Align Right"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="9" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>

          <div className="toolbar-spacer" />

          <button className="tp-btn close-btn" onClick={() => togglePanel('titlePage')} title="Close Title Page">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span>Close Title Page</span>
          </button>
        </div>

        {/* Title Page Content */}
        <div className="title-page-content">
          <div className="title-page-paper">
            {/* Image at top if present */}
            {titlePage.image && (
              <div className="tp-image-container">
                <img src={titlePage.image} alt="Title page image" className="tp-image" />
                <button className="remove-image-btn" onClick={handleRemoveImage} title="Remove image">
                  ×
                </button>
              </div>
            )}

            {/* Main content - centered section */}
            <div className="tp-main-content">
              <input
                type="text"
                className="tp-title-input"
                value={titlePage.title}
                onChange={(e) => updateTitlePage({ title: e.target.value })}
                placeholder="SCRIPT TITLE"
                style={getTitleStyles()}
              />

              <div className="tp-credit-line">
                <select
                  value={titlePage.credit}
                  onChange={(e) => updateTitlePage({ credit: e.target.value })}
                  className="tp-credit-select"
                >
                  <option value="Written by">Written by</option>
                  <option value="Screenplay by">Screenplay by</option>
                  <option value="Original screenplay by">Original screenplay by</option>
                  <option value="Screen story by">Screen story by</option>
                </select>
              </div>

              <input
                type="text"
                className="tp-author-input"
                value={titlePage.author}
                onChange={(e) => updateTitlePage({ author: e.target.value })}
                placeholder="Name of First Writer"
              />

              <input
                type="text"
                className="tp-source-input"
                value={titlePage.source || ''}
                onChange={(e) => updateTitlePage({ source: e.target.value })}
                placeholder="Based on, If Any"
              />
            </div>

            {/* Bottom section - contact info */}
            <div className="tp-bottom-content">
              <textarea
                className="tp-contact-input"
                value={titlePage.contact || ''}
                onChange={(e) => updateTitlePage({ contact: e.target.value })}
                placeholder="Address&#10;Phone Number"
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Auto-fill form */}
        <div className="title-page-form-sidebar">
          <h4>Quick Fill</h4>

          <div className="form-group">
            <label>Draft Date</label>
            <input
              type="text"
              value={titlePage.draftDate || ''}
              onChange={(e) => updateTitlePage({ draftDate: e.target.value })}
              placeholder={new Date().toLocaleDateString()}
            />
          </div>

          <div className="form-group">
            <label>Copyright</label>
            <input
              type="text"
              value={titlePage.copyright || ''}
              onChange={(e) => updateTitlePage({ copyright: e.target.value })}
              placeholder={`© ${new Date().getFullYear()}`}
            />
          </div>

          <button
            className="autofill-btn"
            onClick={() => {
              updateTitlePage({
                draftDate: new Date().toLocaleDateString(),
                copyright: `© ${new Date().getFullYear()} ${titlePage.author || 'Author Name'}`,
              });
            }}
          >
            Auto-fill Dates
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
};

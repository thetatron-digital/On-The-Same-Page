import { useScreenplayStore } from '../store/screenplayStore';
import './TitlePageEditor.css';

export const TitlePageEditor = () => {
  const { screenplay, updateTitlePage, togglePanel } = useScreenplayStore();
  const { titlePage } = screenplay;

  return (
    <div className="title-page-overlay">
      <div className="title-page-editor">
        <div className="panel-header">
          <h3>Title Page</h3>
          <button className="panel-close" onClick={() => togglePanel('titlePage')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="title-page-form">
          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              value={titlePage.title}
              onChange={(e) => updateTitlePage({ title: e.target.value })}
              placeholder="Your Screenplay Title"
              className="title-input-large"
            />
          </div>

          <div className="form-group">
            <label>Credit</label>
            <select
              value={titlePage.credit}
              onChange={(e) => updateTitlePage({ credit: e.target.value })}
            >
              <option value="Written by">Written by</option>
              <option value="Screenplay by">Screenplay by</option>
              <option value="Original screenplay by">Original screenplay by</option>
              <option value="Screen story by">Screen story by</option>
            </select>
          </div>

          <div className="form-group">
            <label>Author</label>
            <input
              type="text"
              value={titlePage.author}
              onChange={(e) => updateTitlePage({ author: e.target.value })}
              placeholder="Your Name"
            />
          </div>

          <div className="form-group">
            <label>Based on (optional)</label>
            <input
              type="text"
              value={titlePage.source || ''}
              onChange={(e) => updateTitlePage({ source: e.target.value })}
              placeholder='e.g., Based on the novel "..." by ...'
            />
          </div>

          <div className="form-group">
            <label>Draft Date (optional)</label>
            <input
              type="text"
              value={titlePage.draftDate || ''}
              onChange={(e) => updateTitlePage({ draftDate: e.target.value })}
              placeholder={new Date().toLocaleDateString()}
            />
          </div>

          <div className="form-group">
            <label>Contact Information (optional)</label>
            <textarea
              value={titlePage.contact || ''}
              onChange={(e) => updateTitlePage({ contact: e.target.value })}
              placeholder="Your contact details&#10;Address, phone, email, etc."
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Copyright (optional)</label>
            <input
              type="text"
              value={titlePage.copyright || ''}
              onChange={(e) => updateTitlePage({ copyright: e.target.value })}
              placeholder={`© ${new Date().getFullYear()} Your Name`}
            />
          </div>
        </div>

        <div className="title-page-preview">
          <div className="preview-label">Preview</div>
          <div className="preview-content">
            <div className="preview-title">{titlePage.title || 'UNTITLED'}</div>
            <div className="preview-credit">{titlePage.credit || 'Written by'}</div>
            <div className="preview-author">{titlePage.author || 'Author Name'}</div>
            {titlePage.source && <div className="preview-source">{titlePage.source}</div>}
            {titlePage.contact && <div className="preview-contact">{titlePage.contact}</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

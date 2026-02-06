# Re-writer Project Log

## Ground Rules (High Priority)

1. **Don't do anything without confirming with me** - All actions require user approval before execution.
2. **Remember that I have low technical proficiency** - Explanations should be in plain language, avoiding jargon.
3. **Cite sources when relevant** - Reference documentation, standards, or external information sources.
4. **Recommend alternative solutions** - Suggest better approaches when identified.

---

## Project Overview

**Goal:** Create a web-based screenwriting software that replicates the functionality and appearance of Final Draft.

### Core Features (Requested)
- [x] Read and write .fdx files (Final Draft format)
- [x] Dark mode support (affects entire document, not just UI)
- [x] Export to PDF
- [ ] Professional UI matching Final Draft's look and feel

### Features Skipped (Per User Request)
- Revision tracking
- Beat board
- Reports

---

## Current Status

**Date:** February 6, 2026

### Completed
1. Basic FDX file parsing and writing
2. Dark mode that affects entire document (dark background, light text)
3. PDF export functionality
4. Toolbar with file operations (New, Open, Save, PDF export)
5. Element type switching (Scene Heading, Action, Character, Dialogue, Parenthetical, Transition)
6. Navigator panel for scene outline
7. Writing Stats panel (page count, word count, runtime)
8. Title Page editor
9. Zoom controls (now functional)
10. Continuous scrolling document view (matching Final Draft's Normal View)
11. Selection highlighting fixed (no highlight for continued same-type elements)

### In Progress
- Refining UI to more closely match Final Draft's appearance
- Adjusting spacing and layout based on user feedback

### Known Issues
- None currently documented

---

## Version History

### v2.3 - February 6, 2026
- Reduced dead space on sides
- Implemented working zoom functionality
- Fixed selection highlighting for paragraph breaks in dialogue

### v2.2 - February 6, 2026
- Dark mode now affects entire document
- Switched to continuous scrolling view (removed white page)
- Fixed element positioning to match Final Draft

### v2.1 - February 6, 2026
- Added professional toolbar with panel toggles
- Added Navigator, Writing Stats, Title Page panels
- Added ruler and status bar

### v1.0 - Initial Release
- Basic FDX support
- Simple editor interface
- PDF export

---

## Reference Materials

- **FDX Format:** XML-based, open format from Final Draft
- **Industry Standards:** Courier 12pt, 1.5" left margin, 1" other margins, 55 lines per page
- **Element Positioning (from left edge of page):**
  - Scene Heading: 1.5" (at margin)
  - Action: 1.5" (at margin)
  - Character: 3.7"
  - Dialogue: 2.5"
  - Parenthetical: 3.1"
  - Transition: Right-aligned

Sources:
- Final Draft documentation
- https://www.finaldraft.com/learn/how-to-format-a-screenplay/
- https://screenwriting.io/what-is-standard-screenplay-format/

---

## Notes

*Add notes here as the project progresses.*

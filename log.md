# Re-writer Project Log

## Ground Rules (High Priority)

1. **Don't do anything without confirming with me** - All actions require user approval before execution.
2. **Remember that I have low technical proficiency** - Explanations should be in plain language, avoiding jargon.
3. **Cite sources when relevant** - Reference documentation, standards, or external information sources.
4. **Recommend alternative solutions** - Suggest better approaches when identified.

---

## Long-Term Vision

**Product Name:** Re-writer (may expand to a suite name later)

**Vision:** A complete film production ecosystem - one web application with multiple modules that work together. Built for scalability and commercial use.

**Platform:** Web application (works on any device with a browser - MacOS, Windows, tablets, phones)

---

## Product Roadmap

### Phase 1: Screenwriting (Current)
- [x] Basic screenwriting editor
- [ ] Match Final Draft UI/UX
- [ ] Firebase integration (user accounts, cloud storage)
- [ ] Real-time collaboration

### Phase 2: Pre-Production Tools
- [ ] Script Breakdown (tag cast, props, locations, etc.)
- [ ] Shoot Scheduling
- [ ] Budgeting

### Phase 3: Production Tools
- [ ] Call Sheets
- [ ] Prop Shopping Tool (for production designers)

### Future Consideration
- Role-based dashboards (Writer, Director, Producer, AD, etc.)

---

## Technical Infrastructure

**Data Storage:** Firebase (Google)
- Google login for authentication
- Cloud database for projects
- Real-time collaboration support

**Free Tier Limits:**
- 1 GB storage
- 50,000 reads/day
- 20,000 writes/day
- Unlimited users

Source: https://firebase.google.com/pricing

---

## Competitors/Reference

- StudioBinder
- SetHero
- Movie Magic Scheduling/Budgeting
- Final Draft

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
9. Zoom controls (slider in status bar)
10. Continuous scrolling document view (matching Final Draft's Normal View)
11. Selection highlighting fixed (no highlight for continued same-type elements)
12. Toolbar buttons use vertical layout (icon above text) like Final Draft
13. Panels dropdown menu with checkmark toggles
14. Fixed page dimensions to match standard 8.5" x 11" screenplay format
15. Courier 12pt font (16px at 96 DPI)
16. Inch-based margins: 1.5" left, 1" right, 1" top/bottom
17. Visible page borders with shadow (like Final Draft)
18. Ruler shows full 8.5" width with highlighted end mark
19. Undo (Cmd+Z) and Redo (Cmd+Shift+Z) functionality

### In Progress
- Planning Firebase integration

### Known Issues
- None currently documented

---

## Version History

### v2.6 - February 6, 2026
- Added visible page borders with shadow (clear page boundaries)
- Darker background outside the page area (like Final Draft)
- Ruler now shows full 8.5" width with highlighted end mark
- Implemented undo (Cmd+Z) and redo (Cmd+Shift+Z / Cmd+Y)
- Tracks up to 100 history entries

### v2.5 - February 6, 2026
- Fixed page dimensions to match standard 8.5" x 11" US Letter size
- Page width: 816px at 96 DPI (100% zoom shows actual page size)
- Font: Courier 12pt (16px)
- Margins: 1.5" left, 1" right, 1" top/bottom
- Proper element spacing for screenplay formatting

### v2.4 - February 6, 2026
- Toolbar buttons now use vertical layout (icon above text) matching Final Draft
- Added Panels dropdown menu with checkmark toggles
- Replaced zoom +/- buttons with slider control
- Moved zoom slider to status bar (bottom right)

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

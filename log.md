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
20. Cross-element text selection (can select text across multiple elements like Word/Google Docs)
21. Smart element type progression (Scene Heading → Action, Character → Dialogue on Enter)
22. Element indicator in status bar with [Tab] and [Enter] hints
23. Click anywhere on page to focus editor and start typing
24. Visual page breaks with page numbers (starting from page 2)
25. Story Mode with Plot, Characters, Acts, and Beats development
26. Split View with synced and independent editing modes
27. Cards (Beat Board) with drag/resize and script navigation
28. Scene Navigator with real-time scene updates
29. Version Management for script snapshots
30. Truly centered element dropdown in toolbar

### In Progress
- Planning Firebase integration

### Known Issues
- None currently documented

---

## Version History

### v3.1 - February 6, 2026
App naming standardization and planned feature additions:

**App Naming (Case Sensitive)**
- Renamed apps to proper case format: BluePrint, CorkBoard, ReWriter
- Future apps planned: BreakDown (script breakdown), ViewFinder (director's tools)
- Updated all display names in Toolbar.tsx and related files

**Planned Features (Next Phases)**
- Smart Type / Auto-Complete: Auto-suggest character names and locations as you type
- BreakDown App: Industry-standard script breakdown with element tagging
- ViewFinder App: Shot list, script lining, camera blocking tools

### v3.0 - February 6, 2026
Major feature release with Story Development and enhanced workflow tools:

**Production Flow (Toolbar Reorder)**
- Buttons ordered: BluePrint → CorkBoard → ReWriter (follows natural production path)
- Story development app named "BluePrint"
- Visual planning app named "CorkBoard"
- Screenwriting app named "ReWriter"

**BluePrint (Outline Mode)**
- Plot Overview: Title, logline, themes, story types, genres, tone, audience, setting, B-story
- Characters: Name, role, arc, archetypes, physical description, personality, want/need/lie/ghost
- Acts Overview: ACT 1, ACT 2A, ACT 2B, ACT 3 with structured summaries
- Beat Sheet: 28 structured story beats across all acts with hints and descriptions
- Tag selectors for multi-select fields (themes, genres, archetypes)
- Generate buttons prepared for future AI integration (Coming Soon)

**CorkBoard Cards**
- Beat Sheet tab auto-populates from BluePrint → Beats
- Cards arranged by act with color coding (Act 1 blue, 2A green, 2B yellow, 3 red)
- Editable beat descriptions directly on cards
- Create additional custom boards for alternate storylines, ideas, etc.
- Drag handle allows moving cards while editing
- Resize handle for adjustable card dimensions
- Send to Script navigates to the created scene

**Split View (Audio/Visual)**
- Two-column view for commercial scripts, music videos, documentaries
- Synced Mode: Automatically splits script into audio/video columns (read-only)
- Independent Mode: Edit audio/video content separately from main script
- Swap Sides button to flip columns

**Scene Navigator Fixes**
- Scenes now appear immediately as you type (real-time updates)
- Fixed page count calculation to show all pages correctly
- Page numbers row with scene heading chips

**Toolbar Improvements**
- Element dropdown truly centered using absolute positioning
- Balanced left/right sections

**Version Management**
- Create named script versions
- Switch between versions
- Delete unused versions

### v2.10 - February 6, 2026
- Added page break spacers that automatically push content to next page margins
- Content now respects Final Draft standard 1" top and bottom margins
- Fixed visual artifact line that appeared on page 2
- Page backgrounds remain fixed at exactly 11" (1056px) height
- Text no longer obscured at page breaks - proper spacing calculated

### v2.9 - February 6, 2026
- Fixed page height to stay exactly 11 inches (1056px) - pages no longer grow
- Page backgrounds now render at fixed positions with visual breaks between
- Click anywhere on page positions cursor at end of content (like Pages/Google Docs)
- Content flows continuously over fixed page backgrounds for proper multi-page support

### v2.8 - February 6, 2026
- Fixed smart element type progression (Scene Heading → Action, Character → Dialogue, etc.)
- Added element indicator in status bar showing [Tab] and [Enter] hints
- Improved click handling - click anywhere on page to focus and start typing
- Fixed copy/paste to insert plain text without ID conflicts
- Added visual page breaks between pages with page numbers (starting page 2)
- Fixed text selection to work in all directions (up/left/right/down)

### v2.7 - February 6, 2026
- Cross-element text selection enabled (major architecture change)
- Replaced individual textarea elements with single contenteditable editor
- Text can now be selected across multiple elements (like Word/Google Docs)
- Improved cursor navigation between elements
- Maintained all existing keyboard shortcuts (Tab, Enter, Backspace)

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

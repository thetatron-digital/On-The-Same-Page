# OTSP - On The Same Page

A complete film production ecosystem from development to wrap. Write, break down, schedule, and manage your production all in one place.

## Features

- **FDX File Support**: Read and write Final Draft (.fdx) files
- **PDF Export**: Export your screenplay to industry-standard PDF format
- **Dark Mode**: Easy on the eyes for those late-night writing sessions
- **Smart Element Formatting**: Automatic formatting for Scene Headings, Action, Character, Dialogue, Parenthetical, and Transition elements
- **Keyboard Shortcuts**: Fast workflow with Tab to cycle elements, Ctrl+1-6 for quick element switching
- **Responsive Design**: Works on desktop and mobile devices
- **No Account Required**: Start writing immediately, all processing happens in your browser

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Tab` | Cycle through element types |
| `Shift+Tab` | Cycle element types (reverse) |
| `Enter` | Create new element |
| `Ctrl/Cmd + 1` | Scene Heading |
| `Ctrl/Cmd + 2` | Action |
| `Ctrl/Cmd + 3` | Character |
| `Ctrl/Cmd + 4` | Dialogue |
| `Ctrl/Cmd + 5` | Parenthetical |
| `Ctrl/Cmd + 6` | Transition |
| `Ctrl/Cmd + S` | Save (download .fdx) |
| `Ctrl/Cmd + O` | Open .fdx file |
| `Ctrl/Cmd + N` | New screenplay |

## Smart Element Progression

When you press Enter, the editor intelligently suggests the next element type:

- Scene Heading → Action
- Action → Action
- Character → Dialogue
- Dialogue → Character
- Parenthetical → Dialogue
- Transition → Scene Heading

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

### Netlify

This project includes a `netlify.toml` configuration file. Simply:

1. Push your code to GitHub
2. Connect your repository to Netlify
3. Deploy!

### Vercel

This project includes a `vercel.json` configuration file. Simply:

1. Push your code to GitHub
2. Import your repository on Vercel
3. Deploy!

### SquareSpace

To embed on SquareSpace:

1. Deploy to Netlify or Vercel first
2. Add a Code Block in SquareSpace
3. Use an iframe to embed:

```html
<iframe
  src="https://your-deployed-url.netlify.app"
  width="100%"
  height="800px"
  frameborder="0">
</iframe>
```

## Technology Stack

- React 19
- TypeScript
- Vite
- Zustand (state management)
- jsPDF (PDF generation)

## FDX File Format

The FDX format is an XML-based open format used by Final Draft and compatible with many screenwriting applications including:

- Final Draft
- Fade In
- WriterSolo
- Celtx
- And more...

## License

MIT

// ReWriter menu bar: File · Edit · View · Format · Insert · Document · Tools ·
// Production · Help, built from the command registry.
import { useEffect, useRef, useState } from 'react';
import { useScreenplayStore } from '../store/screenplayStore';
import { COMMAND_BY_ID, MENUS, labelOf, type MenuEntry } from '../commands/registry';
import { formatBinding } from '../commands/keys';
import './AppMenuBar.css';

const MenuItems = ({ items, onDone }: { items: MenuEntry[]; onDone: () => void }) => (
  <>
    {items.map((entry, i) => {
      if (entry === '---') return <div key={`sep-${i}`} className="menubar-separator" role="separator" />;
      if (typeof entry === 'object') {
        return (
          <div key={entry.submenu} className="menubar-item has-submenu" role="menuitem" aria-haspopup="menu" tabIndex={-1}>
            <span className="menubar-check" />
            <span className="menubar-label">{entry.submenu}</span>
            <span className="menubar-arrow">▸</span>
            <div className="menubar-dropdown submenu" role="menu">
              <MenuItems items={entry.items} onDone={onDone} />
            </div>
          </div>
        );
      }
      const command = COMMAND_BY_ID.get(entry);
      if (!command) return null;
      const enabled = command.enabled ? command.enabled() : true;
      const checked = command.checked?.();
      const shortcut = command.keys?.[0] ? formatBinding(command.keys[0]) : command.hint ? formatBinding({ code: `Key${command.hint}`, mod: true }) : '';
      return (
        <button
          key={entry}
          className="menubar-item"
          role={checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
          aria-checked={checked}
          disabled={!enabled}
          onClick={() => { onDone(); command.run(); }}
        >
          <span className="menubar-check">{checked ? '✓' : ''}</span>
          <span className="menubar-label">{labelOf(command)}</span>
          {shortcut && <span className="menubar-shortcut">{shortcut}</span>}
        </button>
      );
    })}
  </>
);

export const AppMenuBar = () => {
  const [open, setOpen] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  // Re-render on store changes so checks and enabled states stay current
  useScreenplayStore((s) => s.screenplay);
  useScreenplayStore((s) => s.visibility);
  useScreenplayStore((s) => s.panels);
  useScreenplayStore((s) => s.selectedElementId);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!barRef.current?.contains(e.target as Node)) setOpen(null); };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
  }, [open]);

  return (
    <div className="app-menubar" role="menubar" ref={barRef}>
      {MENUS.map((menu) => (
        <div key={menu.title} className="menubar-menu">
          <button
            className={`menubar-title ${open === menu.title ? 'open' : ''}`}
            aria-haspopup="menu"
            aria-expanded={open === menu.title}
            // Keep the script selection when a menu opens (Mark Revised etc. act on it)
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpen(open === menu.title ? null : menu.title)}
            onMouseEnter={() => { if (open && open !== menu.title) setOpen(menu.title); }}
          >
            {menu.title}
          </button>
          {open === menu.title && (
            <div className="menubar-dropdown" role="menu" onMouseDown={(e) => e.preventDefault()}>
              <MenuItems items={menu.items} onDone={() => setOpen(null)} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

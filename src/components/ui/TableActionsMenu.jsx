import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  FileSpreadsheet,
  FileText,
  MoreHorizontal,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

function MenuButton({
  icon: Icon,
  children,
  onClick,
  disabled = false,
  tone = 'default',
}) {
  const toneClass = tone === 'danger'
    ? 'text-red-600 hover:bg-red-50 disabled:text-red-300'
    : 'text-navy-700 hover:bg-navy-50 disabled:text-navy-300';

  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors text-left disabled:cursor-not-allowed disabled:hover:bg-transparent ${toneClass}`}
    >
      <Icon size={16} className="shrink-0" />
      {children}
    </button>
  );
}

export default function TableActionsMenu({
  label = 'Actions',
  selectedCount = 0,
  disabled = false,
  actions = [],
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointer = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const close = () => setOpen(false);

  const runAction = (action) => {
    if (action.disabled || disabled) return;
    close();
    action.onClick?.();
  };

  return (
    <div ref={rootRef} className="relative inline-flex items-center gap-2">
      {selectedCount > 0 && (
        <span className="text-xs font-medium text-navy-500">
          {selectedCount} selected
        </span>
      )}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1.5 rounded-xl border border-navy-200 bg-white px-3 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50 disabled:opacity-50"
      >
        <MoreHorizontal size={16} />
        {label}
        <ChevronDown size={14} className={`text-navy-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-52 rounded-xl border border-navy-100 bg-white py-2 shadow-lg shadow-navy-900/10"
        >
          <div className="px-2 space-y-0.5">
            {actions.map((action) => {
              if (action.type === 'divider') {
                return <div key={action.key} className="my-1 border-t border-navy-100" />;
              }

              const Icon = action.icon
                || (action.key === 'export-csv' ? FileSpreadsheet
                  : action.key === 'export-pdf' ? FileText
                    : action.key === 'delete' ? Trash2
                      : action.key === 'status-active' ? ToggleRight
                        : action.key === 'status-inactive' ? ToggleLeft
                          : MoreHorizontal);

              return (
                <MenuButton
                  key={action.key}
                  icon={Icon}
                  onClick={() => runAction(action)}
                  disabled={Boolean(action.disabled || disabled)}
                  tone={action.tone}
                >
                  {action.label}
                </MenuButton>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

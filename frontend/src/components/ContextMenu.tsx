import { useEffect, useRef } from 'react';
import { Users, Route, Focus, EyeOff } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  word: string;
  onClose: () => void;
  onShowNeighbors: (word: string) => void;
  onFindPathFrom: (word: string) => void;
  onFindPathTo: (word: string) => void;
  onFocusCluster: (word: string) => void;
  onHideNode: (word: string) => void;
  pathSource?: string | null;
}

export function ContextMenu({
  x,
  y,
  word,
  onClose,
  onShowNeighbors,
  onFindPathFrom,
  onFindPathTo,
  onFocusCluster,
  onHideNode,
  pathSource,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  const items = [
    {
      label: 'Show Neighbors',
      icon: <Users className="w-3.5 h-3.5" />,
      onClick: () => { onShowNeighbors(word); onClose(); },
    },
    {
      label: pathSource ? `Find Path: ${pathSource} → ${word}` : 'Find Path From Here',
      icon: <Route className="w-3.5 h-3.5" />,
      onClick: () => {
        if (pathSource) {
          onFindPathTo(word);
        } else {
          onFindPathFrom(word);
        }
        onClose();
      },
    },
    {
      label: 'Focus Cluster',
      icon: <Focus className="w-3.5 h-3.5" />,
      onClick: () => { onFocusCluster(word); onClose(); },
    },
    {
      label: 'Hide Node',
      icon: <EyeOff className="w-3.5 h-3.5" />,
      onClick: () => { onHideNode(word); onClose(); },
    },
  ];

  return (
    <div
      ref={ref}
      style={{ left: x, top: y }}
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[180px]"
    >
      <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700">
        {word}
      </div>
      {items.map((item, i) => (
        <button
          key={i}
          onClick={item.onClick}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

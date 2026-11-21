// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

import { X } from 'lucide-react';

const GOE88ModalShell = ({
  children,
  onClose,
  showClose = false,
  panelLayoutClassName = 'w-full max-w-4xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-4 sm:p-6',
  panelClassName = 'goe-glass rounded-2xl',
  panelStyle,
  backdropStyle,
}) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center p-4"
    onClick={(event) => event.target === event.currentTarget && onClose()}
  >
    <div
      className="absolute inset-0"
      style={backdropStyle || { background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    />
    <div
      className={`relative z-10 ${panelLayoutClassName} ${panelClassName}`}
      style={panelStyle}
      onClick={(event) => event.stopPropagation()}
    >
      {showClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-gray-400 hover:text-gray-600"
          aria-label="Close GOE88 chat"
        >
          <X size={20} />
        </button>
      )}
      {children}
    </div>
  </div>
);

export default GOE88ModalShell;

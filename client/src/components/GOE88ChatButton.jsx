// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

import { useState } from 'react';
import GOE88ChatPanel from '@/components/GOE88ChatPanel';
import GOE88ModalShell from '@/components/GOE88ModalShell';

const isChatEnabled = import.meta.env.VITE_CHAT_ENABLED === 'true';

const GOE88ChatButton = ({ gradient = null, cardType = 'creative' }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-100">
        <button
          onClick={() => setOpen(true)}
          className={`block w-full text-center px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
            gradient
              ? `bg-gradient-to-r ${gradient} text-white border-transparent hover:opacity-90`
              : 'border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
          }`}
        >
          Chat with GOE88
        </button>
      </div>

      {open && (
        <GOE88ModalShell
          onClose={() => setOpen(false)}
          showClose={!isChatEnabled}
          panelLayoutClassName={isChatEnabled
            ? undefined
            : 'w-full max-w-sm mx-4 rounded-xl p-5'}
          panelClassName={isChatEnabled ? undefined : 'goe-glass'}
          backdropStyle={isChatEnabled ? undefined : { background: 'rgba(0,0,0,0.25)' }}
        >
          {!isChatEnabled ? (
            <>
              <h3 className="text-base font-semibold text-gray-800 mb-3">GOE88 Chat</h3>

              <div className="space-y-3 text-sm text-gray-600 font-light leading-relaxed">
                <p>
                  GOE88 Chat is one conversation that moves across your GOE cards, carrying the context of your body, patterns and life. It combines what your data shows over time with what you bring into the conversation now.
                </p>
                <p>Your intelligence leads; the technology exists to support you in living more creatively.</p>
              </div>
            </>
          ) : (
            <GOE88ChatPanel cardType={cardType} gradient={gradient} onClose={() => setOpen(false)} />
          )}
        </GOE88ModalShell>
      )}
    </>
  );
};

export default GOE88ChatButton;

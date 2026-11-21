// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

import { useState } from 'react';
import { ChevronDown, ChevronUp, Info, X } from 'lucide-react';

const IntelligenceCardHeader = ({
  title,
  subtitle,
  description,
  icon: Icon,
  gradient,
  useCases = [],
  coreModules = [],
  worksWithItems = [],
  brandLabel,
  brandNote,
  heroSymbol,
  onCoreModulesInfo,
  onWorksWithInfo,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [showCoreModulesModal, setShowCoreModulesModal] = useState(false);
  const [showWorksWithModal, setShowWorksWithModal] = useState(false);
  const handleCoreModulesInfo = () => {
    if (onCoreModulesInfo) onCoreModulesInfo();
    else setShowCoreModulesModal(true);
  };

  const handleWorksWithInfo = () => {
    if (onWorksWithInfo) onWorksWithInfo();
    else setShowWorksWithModal(true);
  };

  return (
    <div className="goe-glass rounded-xl p-6">
      <div className="text-center mb-6">
        <div className={`w-16 h-16 bg-gradient-to-br ${gradient} rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg relative overflow-hidden`}>
          <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-30 rounded-full animate-pulse`}></div>
          {heroSymbol
            ? <span className="text-white text-2xl relative z-10">{heroSymbol}</span>
            : <Icon size={28} className="text-white relative z-10 drop-shadow-sm" />
          }
        </div>
        <h2 className="text-2xl font-semibold text-foreground mb-2 tracking-wide">{title}</h2>
        <p className="text-sm text-muted-foreground font-normal mb-2">{subtitle}</p>
        {description && (
          <p className="text-xs text-muted-foreground/80 font-normal italic mb-3">{description}</p>
        )}
        <div className="flex items-start justify-center gap-1.5 mt-1">
          <Icon size={13} className="text-gray-400 mt-0.5 flex-shrink-0 hidden sm:block" />
          <span className="text-xs text-muted-foreground font-normal">
            {brandLabel || 'Modular System'} · Commercial licensing available · Open source
          </span>
        </div>
        {brandNote && <p className="text-xs text-muted-foreground font-light mt-0.5">{brandNote}</p>}
      </div>

      <div className="border-t border-gray-100 pt-4">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full flex items-center justify-center gap-2 p-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <span>Architectural Intelligence</span>
          {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showDetails && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3 tracking-wide">Use Cases</h4>
                <div className="space-y-2">
                  {useCases.map((ex, i) => (
                    <div key={i} className="flex items-start space-x-2">
                      <div className="w-2 h-2 bg-gray-300 rounded-full flex-shrink-0 mt-1.5"></div>
                      <span className="text-sm text-gray-600 font-light">{ex}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3 tracking-wide flex items-center gap-1">
                  Core Modules
                  <button onClick={handleCoreModulesInfo} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <Info size={14} />
                  </button>
                </h4>
                {coreModules.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {coreModules.map((mod, i) => {
                      return mod.href ? (
                        <a key={i} href={mod.href} target="_blank" rel="noopener noreferrer"
                          className="px-3 py-1 min-h-[28px] flex items-center justify-center rounded-full border text-xs font-light hover:opacity-80 transition-colors text-center bg-gray-100 text-gray-600 border-gray-200">
                          {mod.label}
                        </a>
                      ) : (
                        <span key={i} className="px-3 py-1 min-h-[28px] flex items-center justify-center rounded-full border text-xs font-light text-center bg-gray-100 text-gray-600 border-gray-200">
                          {mod.label}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {worksWithItems.length > 0 && (
              <div className="border-t border-gray-100 pt-4">
                <h4 className="text-sm font-semibold text-foreground mb-3 tracking-wide flex items-center justify-center gap-1">
                  Works With
                  <button onClick={handleWorksWithInfo} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <Info size={14} />
                  </button>
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {worksWithItems.map((item, i) => (
                    <div key={i} className="w-full min-h-[48px] flex items-center justify-center p-2 md:p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <span className="text-xs md:text-sm text-muted-foreground font-normal text-center">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showCoreModulesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50 p-4" onClick={() => setShowCoreModulesModal(false)}>
          <div className="goe-glass relative rounded-xl p-5 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowCoreModulesModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
            <h3 className="text-base font-semibold text-gray-800 mb-3">Core Modules</h3>
            <p className="text-sm text-gray-600 font-light leading-relaxed">
              The areas of intelligence this card draws from — the sources GOE88 is reading across.
            </p>
          </div>
        </div>
      )}

      {showWorksWithModal && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50 p-4" onClick={() => setShowWorksWithModal(false)}>
          <div className="goe-glass relative rounded-xl p-5 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowWorksWithModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
            <h3 className="text-base font-semibold text-gray-800 mb-3">Works With</h3>
            <p className="text-sm text-gray-600 font-light leading-relaxed">
              Other system cards this one is capable of conversing with. Each connection made becomes source intelligence for GOE88.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntelligenceCardHeader;

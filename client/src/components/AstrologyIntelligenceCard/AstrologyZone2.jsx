// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md
// Zone 2 — Gene Keys tab: Genius / Love / Prosperity / Star Pearl sequences

import { ChevronLeft, ChevronRight, X } from 'lucide-react';

const SequenceSection = ({ title, subtitle, data, scrollRef, onScrollLeft, onScrollRight, selectedCard, setSelectedCard }) => (
  <div className="goe-glass rounded-xl p-4 flex-1 flex flex-col mb-4">
    <div className="mb-4">
      <h3 className="font-semibold text-foreground text-lg tracking-wide">{title}</h3>
      <p className="text-sm text-muted-foreground font-normal">{subtitle}</p>
    </div>
    <div className="relative flex-1 mb-4">
      <button onClick={onScrollLeft} className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 bg-white rounded-full shadow-lg p-2 hover:bg-gray-50 border">
        <ChevronLeft size={20} />
      </button>
      <div
        ref={scrollRef}
        className="flex gap-6 overflow-x-auto px-8 h-full items-center min-h-[200px]"
        style={{ touchAction: 'pan-x' }}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        {data.map((card) => {
          const gateNumber = card.subtitle.split(' - ')[0];
          const transformation = card.subtitle.split(' - ')[1];
          const [shadow, gift, siddhi] = transformation.split(' → ').map(s => s.trim());
          return (
            <div
              key={card.id}
              className="flex-shrink-0 w-40 md:w-48 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-3 md:p-4 text-center cursor-pointer hover:from-gray-100 hover:to-gray-200 border border-gray-200 relative flex flex-col justify-center shadow-lg transition-all duration-200 transform hover:scale-105 min-h-[140px] md:min-h-[160px]"
              onClick={() => setSelectedCard(selectedCard === card.id ? null : card.id)}
              data-testid={`card-gk-${card.id}`}
            >
              <div className="text-lg font-medium text-gray-700 mb-2 tracking-wide">{card.title}</div>
              <div className="text-lg font-medium text-gray-800 mb-2">{gateNumber}</div>
              <div className="text-xs text-gray-600 font-light leading-snug space-y-0.5">
                <div>{siddhi}</div>
                <div>{gift}</div>
                <div>{shadow}</div>
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={onScrollRight} className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 bg-white rounded-full shadow-lg p-2 hover:bg-gray-50 border">
        <ChevronRight size={20} />
      </button>
    </div>
  </div>
);

const AstrologyZone2 = ({
  geneKeysStaticData,
  geneKeysData,
  harmonyContent,
  selectedCard, setSelectedCard,
  gkGeniusScrollRef, gkLoveScrollRef, gkProsperityScrollRef, gkHarmonyScrollRef,
  scrollGkGenius, scrollGkLove, scrollGkProsperity, scrollGkHarmony,
  getGeneKeysContent,
}) => (
  <div>
    <SequenceSection
      title="Genius Sequence"
      subtitle="Your authentic path and purpose"
      data={geneKeysStaticData.geniusSequence}
      scrollRef={gkGeniusScrollRef}
      onScrollLeft={() => scrollGkGenius('left')}
      onScrollRight={() => scrollGkGenius('right')}
      selectedCard={selectedCard}
      setSelectedCard={setSelectedCard}
    />
    <SequenceSection
      title="Love Sequence"
      subtitle="Your relational intelligence"
      data={geneKeysStaticData.loveSequence}
      scrollRef={gkLoveScrollRef}
      onScrollLeft={() => scrollGkLove('left')}
      onScrollRight={() => scrollGkLove('right')}
      selectedCard={selectedCard}
      setSelectedCard={setSelectedCard}
    />
    <SequenceSection
      title="Prosperity Sequence"
      subtitle="Your material and creative abundance"
      data={geneKeysStaticData.prosperitySequence}
      scrollRef={gkProsperityScrollRef}
      onScrollLeft={() => scrollGkProsperity('left')}
      onScrollRight={() => scrollGkProsperity('right')}
      selectedCard={selectedCard}
      setSelectedCard={setSelectedCard}
    />
    <SequenceSection
      title="Star Pearl"
      subtitle="Your integration and synthesis path"
      data={geneKeysStaticData.harmonySequence}
      scrollRef={gkHarmonyScrollRef}
      onScrollLeft={() => scrollGkHarmony('left')}
      onScrollRight={() => scrollGkHarmony('right')}
      selectedCard={selectedCard}
      setSelectedCard={setSelectedCard}
    />

    {/* Gene Keys Card Popup */}
    {selectedCard !== null && (harmonyContent[selectedCard] || geneKeysData) && (
      <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50 p-4" onClick={() => setSelectedCard(null)}>
        <div className="goe-glass rounded-xl p-4 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-start mb-3">
            <div className="text-lg font-semibold text-gray-700">
              {(() => { const content = getGeneKeysContent(selectedCard); return content?.title || 'Gene Key'; })()}
            </div>
            <button onClick={() => setSelectedCard(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
          <div className="text-sm text-gray-600 font-semibold mb-3">
            {(() => {
              const content = getGeneKeysContent(selectedCard);
              if (!content) return '';
              return `${content.gate}.${content.line} - ${content.transformation}`;
            })()}
          </div>
          <div className="text-sm text-gray-800 leading-relaxed">
            {(() => { const content = getGeneKeysContent(selectedCard); return content?.content || 'Loading interpretation...'; })()}
          </div>
        </div>
      </div>
    )}
  </div>
);

export default AstrologyZone2;

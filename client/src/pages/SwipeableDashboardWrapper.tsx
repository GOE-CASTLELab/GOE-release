import React, { useState, useRef, useEffect, lazy, Suspense, startTransition } from 'react';
import { Home } from 'lucide-react';
import OrbHomeScreen from '@/components/OrbHomeScreen';

// Card pages are code-split so the home screen bundle stays small on first load.
const CyclicalIntelligenceCard = lazy(() => import('@/components/CyclicalIntelligenceCard/index.jsx'));
const SacredRestCard = lazy(() => import('@/components/RestIntelligenceCard/index.jsx'));
const AstrologyIntelligenceCard = lazy(() => import('@/components/AstrologyIntelligenceCard/index.jsx'));
const MovementIntelligenceCard = lazy(() => import('@/components/MovementIntelligenceCard/index.jsx'));

const SwipeableDashboardWrapper = () => {
  const [currentCard, setCurrentCard] = useState(0);
  const [showHome, setShowHome] = useState(true);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);
  const touchEndYRef = useRef<number | null>(null);

  // Reset any page scroll left over from the card view so the fixed home
  // overlay lines up with the visual viewport (iOS Safari).
  // Also keep the browser theme-color in sync: dark over the home screen,
  // light over the card pages, so iOS never shows a mismatched status bar.
  useEffect(() => {
    if (showHome) window.scrollTo(0, 0);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', showHome ? '#0a0a0f' : '#f8fafc');
  }, [showHome]);

  const cards = [
    // — Group 1: Internal —
    {
      id: 'cyclical',
      component: CyclicalIntelligenceCard, 
      name: "Cyclical Intelligence",
      domain: "Cycle Tracking • Body Wisdom • Rhythmic Patterns",
      group: "internal",
      color: "pink",
      gradient: "from-pink-400 to-rose-600", 
      headerDot: "bg-gradient-to-r from-pink-400 to-rose-600",
      footerBg: "bg-gradient-to-r from-pink-100 to-rose-200 text-pink-800 border-pink-300"
    },
    {
      id: 'rest',
      component: SacredRestCard, 
      name: "Rest & Restore Intelligence",
      domain: "Rest • Nervous System • Restorative Practice",
      group: "internal",
      color: "blue",
      gradient: "from-blue-400 to-indigo-600",
      headerDot: "bg-gradient-to-r from-blue-400 to-indigo-600", 
      footerBg: "bg-gradient-to-r from-blue-100 to-indigo-200 text-blue-800 border-blue-300"
    },
    {
      id: 'movement',
      component: MovementIntelligenceCard,
      name: "Movement Intelligence",
      domain: "Movement • Body Intelligence • Energy Patterns",
      group: "internal",
      color: "amber",
      gradient: "from-amber-400 to-orange-500",
      headerDot: "bg-gradient-to-r from-amber-400 to-orange-500",
      footerBg: "bg-gradient-to-r from-amber-100 to-orange-200 text-amber-800 border-amber-300"
    },
    {
      id: 'astrology',
      component: AstrologyIntelligenceCard, 
      name: "Astrology Intelligence",
      domain: "Natal Chart • Transits • Gene Keys • Human Design",
      group: "internal",
      color: "purple",
      gradient: "from-purple-400 to-violet-600",
      headerDot: "bg-gradient-to-r from-purple-400 to-violet-600",
      footerBg: "bg-gradient-to-r from-purple-100 to-violet-200 text-purple-800 border-purple-300"
    },
  ];

  // Card components are lazy-loaded; switching cards inside startTransition
  // keeps the current view up while the next card's chunk loads (no fallback flash).
  const nextCard = () => {
    startTransition(() => setCurrentCard((prev) => (prev + 1) % cards.length));
  };

  const prevCard = () => {
    startTransition(() => setCurrentCard((prev) => (prev - 1 + cards.length) % cards.length));
  };

  const handleOpenCard = (id: string) => {
    if (id === 'sky') { window.location.href = '/sky'; return; }
    const idx = cards.findIndex((card) => card.id === id);
    if (idx >= 0) {
      startTransition(() => {
        setCurrentCard(idx);
        setShowHome(false);
      });
    }
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const idx = (e as CustomEvent).detail?.index;
      if (Number.isInteger(idx) && idx >= 0 && idx < cards.length) {
        startTransition(() => { setCurrentCard(idx); setShowHome(false); });
      }
    };
    window.addEventListener('goe-navigate-card', handler);
    return () => window.removeEventListener('goe-navigate-card', handler);
  }, [cards.length]);

  // Touch swipe handlers — direction lock + swipe-down-to-home
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.targetTouches[0].clientX;
    touchStartYRef.current = e.targetTouches[0].clientY;
    touchEndXRef.current = null;
    touchEndYRef.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndXRef.current = e.targetTouches[0].clientX;
    touchEndYRef.current = e.targetTouches[0].clientY;
  };

  const handleTouchEnd = () => {
    if (!touchStartXRef.current || !touchStartYRef.current || !touchEndXRef.current || !touchEndYRef.current) return;
    const deltaX = touchStartXRef.current - touchEndXRef.current;
    const deltaY = touchStartYRef.current - touchEndYRef.current;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Swipe-down to home: downward, more vertical than horizontal, initiated in top 200px
    if (deltaY < -80 && absDeltaY > absDeltaX * 1.5 && touchStartYRef.current < 200) {
      setShowHome(true);
      touchStartXRef.current = null; touchStartYRef.current = null;
      touchEndXRef.current = null; touchEndYRef.current = null;
      return;
    }

    // Horizontal swipe: only fires if more horizontal than vertical AND > 50px
    if (absDeltaX > absDeltaY * 1.5 && absDeltaX > 50) {
      if (deltaX > 0) nextCard();
      else prevCard();
    }

    touchStartXRef.current = null; touchStartYRef.current = null;
    touchEndXRef.current = null; touchEndYRef.current = null;
  };

  const CurrentCardComponent = cards[currentCard].component;

  return (
    <div className="min-h-screen w-full flex flex-col relative overflow-hidden bg-slate-50">
      {/* Home screen overlay — slides in from above.
          At rest the transform is 'none': iOS Safari misplaces fixed elements
          that keep an active transform after the page underneath has scrolled,
          which let the card's white header peek through at the top. */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          transform: showHome ? 'none' : 'translateY(-100%)',
          transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: showHome ? 'auto' : 'none',
        }}
      >
        <OrbHomeScreen onOpenCard={handleOpenCard} />
      </div>

      {/* Navigation Header */}
      <div className="bg-white shadow-sm border-b border-slate-200 px-4 py-3 md:py-5">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900 mb-2 md:mb-3">{cards[currentCard].name}</h1>
          <div className="flex items-center justify-center">
            {/* Home — integrated into nav cluster */}
            <button
              onClick={() => setShowHome(true)}
              className="py-3 px-3 md:py-4 md:px-4 text-gray-400 hover:text-gray-700 transition-colors"
              aria-label="Home"
            >
              <Home size={20} strokeWidth={1.75} />
            </button>
            <div className="w-px h-3 md:h-5 bg-gray-200 mx-1 md:mx-2 flex-shrink-0" />
            {/* Card pills — large tap target, slim visual bar */}
            {cards.map((card, idx) => (
              <button
                key={idx}
                onClick={() => startTransition(() => setCurrentCard(idx))}
                className="py-3 px-1.5 md:py-4 md:px-2 flex items-center justify-center"
                aria-label={card.name}
              >
                <div className={`rounded-full transition-all duration-300 ${card.headerDot} ${
                  idx === currentCard ? 'w-5 h-1.5 md:w-8 md:h-2' : 'w-2 h-1.5 md:w-3 md:h-2 opacity-35'
                }`} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Card Container with pull-down handle */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex justify-center pt-2 pb-0">
          <div className="w-10 h-1 rounded-full bg-gray-300 opacity-60" />
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl">
            <Suspense fallback={<div className="min-h-[40vh]" />}>
              <CurrentCardComponent />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SwipeableDashboardWrapper;

// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Shared HRV components — used by MovementZone1 and OrbHomeScreen popup

import { useRef, useCallback } from 'react';
export function ReadinessGauge({ value, onChange }) {
  const trackRef = useRef(null);

  const getValueFromX = useCallback((clientX) => {
    if (!trackRef.current) return value;
    const rect = trackRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.max(1, Math.min(10, Math.round(pct * 9) + 1));
  }, [value]);

  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    onChange(getValueFromX(clientX));

    const handleMove = (ev) => {
      const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      onChange(getValueFromX(cx));
    };
    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleUp);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleUp);
  }, [getValueFromX, onChange]);

  const pct = ((value - 1) / 9) * 100;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-900">How ready do you feel to train today?</p>
      <div
        ref={trackRef}
        className="relative h-7 rounded-full cursor-pointer select-none shadow-inner"
        style={{
          background: 'linear-gradient(to right, #fca5a5, #fdba74, #fde68a, #86efac)',
          touchAction: 'none',
          overscrollBehaviorX: 'contain',
        }}
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
        onTouchMove={(event) => event.stopPropagation()}
      >
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-rose-900/60 font-light pointer-events-none select-none">sluggish</span>
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 bg-white rounded-full shadow-md border border-gray-200 pointer-events-none"
          style={{ left: `calc(${pct / 100} * (100% - 20px) + 10px)` }}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-emerald-900/60 font-light pointer-events-none select-none">motivated</span>
      </div>
    </div>
  );
}

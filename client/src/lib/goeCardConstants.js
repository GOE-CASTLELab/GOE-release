// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
//
// GOE Card Design System — reference constants for building intelligence cards.
// Any card (first-party or marketplace) must follow these patterns to be
// recognised as a GOE card. The structural rules here mirror what
// IntelligenceCardHeader.jsx renders — if the constants change, both update.

// ── Container ─────────────────────────────────────────────────────────────
// All cards sit inside a full-width wrapper with this treatment:
export const CARD_CONTAINER = 'w-full max-w-4xl mx-auto p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl';

// Each zone inside a card uses this treatment:
export const ZONE_CONTAINER = 'bg-white rounded-xl p-6 shadow-lg border border-gray-100';

// ── Typography scale ───────────────────────────────────────────────────────
export const TYPE = {
  cardTitle:       'text-2xl font-semibold text-foreground tracking-wide',
  cardSubtitle:    'text-sm text-muted-foreground font-normal',
  cardDescription: 'text-xs text-muted-foreground/80 font-normal italic',
  zoneSectionHead: 'text-sm font-semibold text-foreground tracking-wide',
  zoneBodyText:    'text-sm text-gray-700 font-normal',
  pillText:        'text-xs font-normal',
  brandLabel:      'text-sm text-muted-foreground font-normal',
  brandNote:       'text-xs text-muted-foreground font-light',
};

// ── Spacing ────────────────────────────────────────────────────────────────
export const SPACING = {
  heroBottomMargin:   'mb-6',
  sectionGap:         'space-y-4',
  accordionPadding:   'pt-4',
  pillsRow:           'flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-2',
  worksWithGrid:      'grid grid-cols-2 md:grid-cols-4 gap-2',
};

// ── Hero icon circle ───────────────────────────────────────────────────────
export const HERO_CIRCLE = 'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg relative overflow-hidden';

// ── Pills ──────────────────────────────────────────────────────────────────
// Use these classes on every Core Module pill. min-h ensures consistent
// height regardless of label length on any screen size.
export const PILL_BASE = 'px-3 py-1 min-h-[28px] flex items-center justify-center rounded-full border text-xs font-light text-center';

// Color variants for pills and tags.
export const PILL_COLORS = {
  teal:   'bg-teal-100 text-teal-700 border-teal-200',
  amber:  'bg-amber-100 text-amber-700 border-amber-200',
  lime:   'bg-lime-100 text-lime-700 border-lime-200',
  rose:   'bg-rose-100 text-rose-700 border-rose-200',
  pink:   'bg-pink-100 text-pink-700 border-pink-200',
  blue:   'bg-blue-100 text-blue-700 border-blue-200',
  indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  gray:   'bg-gray-100 text-gray-600 border-gray-200',
};

// ── Works With cells ───────────────────────────────────────────────────────
// min-h-[48px] keeps cells consistent when text wraps on narrow viewports.
export const WORKS_WITH_CELL = 'w-full min-h-[48px] flex items-center justify-center p-2 md:p-3 bg-gray-50 rounded-lg border border-gray-200';

// ── Use Cases bullets ─────────────────────────────────────────────────────
// items-start + mt-1.5 on the dot keeps the bullet aligned to the first
// line of text even when the label wraps to multiple lines on mobile.
export const USE_CASE_ROW  = 'flex items-start space-x-2';
export const USE_CASE_DOT  = 'w-2 h-2 bg-gray-300 rounded-full flex-shrink-0 mt-1.5';
export const USE_CASE_TEXT = 'text-sm text-gray-700 font-normal';

// ── Card colour identities ────────────────────────────────────────────────
// Gradient strings for the hero icon circle per card type.
// Import and use whichever matches the card being built.
export const CARD_GRADIENTS = {
  cyclical:    'from-pink-400 to-rose-500',
  rest:        'from-indigo-400 to-indigo-600',
  movement:    'from-amber-400 to-orange-500',
  astrology:   'from-violet-400 to-purple-600',
  collectiveSky: 'from-sky-400 to-blue-500',
};

// ── Accordion toggle button ────────────────────────────────────────────────
// Used for the "Architectural Intelligence" expand/collapse button.
export const ACCORDION_BTN = 'w-full flex items-center justify-center gap-2 p-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors';

// ── Info modal (i) — standard for all cards ────────────────────────────────
// Triggered by the (i) icon next to any zone header. Always scrollable.
// Inner panel: max-w-lg gives comfortable reading width on all screens.
// Usage: wrap with MODAL_OVERLAY, backdrop div with MODAL_BACKDROP class,
//        then inner panel with MODAL_PANEL. Close button: top-4 right-4.
export const MODAL_OVERLAY  = 'fixed inset-0 z-50 flex items-center justify-center px-4';
export const MODAL_BACKDROP = 'absolute inset-0 bg-black/20';
export const MODAL_PANEL    = 'relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg z-10 max-h-[85vh] overflow-y-auto';

// ── Info button — inline (i) next to zone section headers ─────────────────
// Always paired with the zone title in a flex items-center gap-2 row.
// Usage: <button onClick={() => setShowModal(true)} className={INFO_BTN}><Info size={16} /></button>
export const INFO_BTN = 'text-gray-400 hover:text-gray-600 transition-colors';

// ── Day popup — standard for calendar cell taps across all cards ──────────
// Appears when tapping a logged day in any calendar zone.
// Narrower than info modals (max-w-sm) — compact record view, not reference text.
// Structure: date header → context sub-row → labeled section cards → coloured notes.
// Notes section background should match the day's signal colour.
export const DAY_POPUP_PANEL = 'relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm z-10 max-h-[85vh] overflow-y-auto';

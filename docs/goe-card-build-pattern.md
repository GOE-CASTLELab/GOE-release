# GOE Card Build Pattern
## Reference for all Intelligence Card builds

> Built from the Movement and Cyclical card implementations.
> Read this before starting any new card. Every pattern here was earned in code.

---

## 1. Directory Structure

Each card is a self-contained module under `client/src/components/`:

```
{Name}IntelligenceCard/
  index.jsx            — orchestrator: global state, all modals, cross-card queries
  {Name}Header.jsx     — IntelligenceCardHeader wrapper with (i) modal trigger
  {Name}Zone1.jsx      — Zone 1: primary input or today's read
  {Name}Zone2.jsx      — Zone 2: signal / what the data means today
  {Name}Zone3.jsx      — Zone 3: calendar / pattern over time
  {name}Insights.js    — pre-authored copy, signal constants (card-internal only)
```

`{name}Insights.js` is **never imported by another card**. It is the card's private authored data layer.

---

## 2. Zone Responsibilities

| Zone | Purpose | Key contents |
|------|---------|-------------|
| Zone 1 | Primary input / today's read | Form, Bluetooth/manual entry, submit, readiness score |
| Zone 2 | Signal — what it means today | Colour signal pill, interpreted copy, cross-card reference |
| Zone 3 | Calendar — pattern over time | Month grid, cell colours, day popup, month navigation |

---

## 3. Header Pattern

Every card uses `IntelligenceCardHeader`:

```jsx
import IntelligenceCardHeader from '@/components/IntelligenceCardHeader';

<IntelligenceCardHeader
  title="Movement Intelligence"
  subtitle="Training Signal"
  useCases={['HRV-guided training', 'Recovery tracking', 'Cycle-aware movement']}
  worksWithItems={['Cyclical Intelligence', 'Rest & Restore']}
  onInfo={() => setShowModal(true)}
/>
```

**Rules:**
- `useCases` and `worksWithItems` must be completely distinct — no overlap
- `onInfo` opens the card's own (i) modal — never the shared header modal
- The (i) trigger lives in the header, not below action buttons

---

## 4. (i) Modal Format

All (i) modals match this exact pattern:

```jsx
<div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
  <div className="absolute inset-0 bg-black/20" />
  <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg z-10 max-h-[85vh] overflow-y-auto"
       onClick={e => e.stopPropagation()}>
    <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
      <X size={16} />
    </button>
    <h3 className="text-lg font-medium text-gray-700 tracking-wide mb-1">{Card Name}</h3>
    <p className="text-xs text-gray-400 font-light mb-4">{Section Name}</p>
    <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
      <p>Opening paragraph...</p>
      <div className="pt-2 border-t border-gray-100">
        <h4 className="font-medium text-gray-700 mb-2">{Section Header}</h4>
        <p>Section content...</p>
      </div>
    </div>
  </div>
</div>
```

**Typography rules:**
- Title: `text-lg font-medium text-gray-700 tracking-wide mb-1`
- Subtitle: `text-xs text-gray-400 font-light mb-4`
- Body wrapper: `space-y-3 text-sm text-gray-700 leading-relaxed`
- Section separator: `pt-2 border-t border-gray-100`
- Section headers: `font-medium text-gray-700 mb-2` — **always left-aligned, never `text-center`**
- Sub-headers: `font-medium text-gray-700 mb-1` — left-aligned, no colour classes
- Authored copy: verbatim, untouchable — treat as data

---

## 5. Calendar Architecture

### Query pattern
```js
const calendarQueryKey = ['/api/{card}/calendar', currentCalendarYear, currentCalendarMonth + 1];

const { data: calendarLogs } = useQuery({
  queryKey: calendarQueryKey,
  queryFn: () =>
    fetch(`/api/{card}/calendar?year=${currentCalendarYear}&month=${currentCalendarMonth + 1}`)
      .then(r => r.json()),
  staleTime: Infinity,
});
```

- Month is **1-indexed** in the URL, 0-indexed in React state
- Always use explicit `queryFn` for dynamic URLs (not the default fetcher)
- `staleTime: Infinity` — never refetch on focus; invalidate manually after mutations
- After a save: `queryClient.invalidateQueries({ queryKey: calendarQueryKey })`

### Log map (for O(1) day lookup)
```js
const logMap = useMemo(() => {
  const map = {};
  (calendarLogs || []).forEach(log => { if (log.date) map[log.date] = log; });
  return map;
}, [calendarLogs]);
```

### Cell colouring
- Cells are coloured by **signal value** (Movement uses `movementColour`) — not raw data
- Empty cells: neutral white, still clickable
- Colour constants live in `{name}Insights.js`

### Month navigation state
`currentCalendarMonth` and `currentCalendarYear` live in `index.jsx`, passed down as props.

---

## 6. Day Popup Structure

```
max-w-lg modal, bg-black bg-opacity-50 backdrop
  Date header (weekday, month, day)         — text-xl font-semibold, text-center
  Primary data section                       — card-specific
  Cross-card signal section (if applicable) — see §7
  Secondary context section                  — e.g. moon center, phase guidance
  Notes textarea (if applicable)             — min-h-[60px], notes section mb-2
  Close button                               — btn-standard, centered
```

**Section headers:** `font-medium text-gray-800 mb-3 text-center`
**Inner cards:** `bg-gray-50 rounded-lg p-4`
**Pill label standard:** `{Label} signal` — e.g. "Yellow signal"

---

## Rest & Rising Cycle placeholder contract

The four Cycle-tab phase tiles — Menstruation, Follicular, Ovulatory, and Luteal — render authored placeholder patterns before personal history exists so a new demo or fork is not blank. As Rest and Rising entries accumulate, personal aggregates replace the corresponding values. Early and Late Luteal entries both populate the single Luteal tile. Placeholders are UI-only: they are not observed user data and must not enter Movement calculations, cross-card context, chat data, or contribution payloads.

---

## 7. Cross-Card Data Contract

Movement's API returns separate `rhythmColour`, `movementColour` and a saved `signalContext`.
Cross-card consumers render the named field they need.

```jsx
{selectedLog?.movementColour && (
  <span className={SIGNAL_PILL[selectedLog.movementColour]}>
    {SIGNAL_LABEL[selectedLog.movementColour]} Movement Read
  </span>
)}
```

- Keep Your Rhythm and Movement Read separate.
  ✅ `rhythmColour` for HRV, `movementColour` for experience. ❌ One colour for both.
- Render stored archive values.
  ✅ Saved `signalContext`. ❌ A recalculation using today's phase.
- Keep authored read assembly within Movement.
  ✅ Movement's own read helpers. ❌ A sibling card's copy lookup table.

---

## 8. Signal Constants (card-internal)

Each card's `{name}Insights.js` owns its signal styling and copy:

```js
// Styling — exported for use within the card's Zones
export const SIGNAL_STYLES = {
  green:  { label: 'Green', bg: 'bg-emerald-50', dot: 'bg-emerald-500',
            text: 'text-emerald-700', border: 'border-emerald-200',
            pill: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  yellow: { ... },
  orange: { ... },
  red:    { ... },
};

// Movement copy is assembled from its saved split snapshot:
// getRhythmText({ signalContext })
// getMovementReadText({ signalContext })
```

Use approved copy verbatim.
✅ Approved read sentences. ❌ Reworded signal descriptions.

---

## 9. Signal Pill Render Pattern

```jsx
// Pill only (no inline description — description goes below):
<span className={`inline-block px-3 py-1.5 rounded-full text-sm font-medium ${SIGNAL_STYLES[signal].pill}`}>
  {SIGNAL_STYLES[signal].label} signal
</span>

// Description below the pill (not inside it):
<p className="text-sm text-gray-600 leading-relaxed mt-1">{signalDescription}</p>
```

The description is **never** concatenated inside the pill span.

---

## 10. Query Patterns

```js
// Static endpoint — default fetcher is fine
useQuery({ queryKey: ['/api/{card}/today'], staleTime: Infinity })

// Dynamic URL (calendar, specific date) — explicit queryFn required
useQuery({
  queryKey: ['/api/{card}/calendar', year, month],
  queryFn: () => fetch(`/api/{card}/calendar?year=${year}&month=${month}`).then(r => r.json()),
  staleTime: Infinity,
})

// After mutation — always invalidate the affected query key
queryClient.invalidateQueries({ queryKey: ['/api/{card}/calendar', year, month] })
```

- Always use **array query keys** — never template literal strings alone
- `staleTime: Infinity` everywhere — trust the cache, invalidate explicitly

---

## 11. Font and Copy Standards

| Use | Class |
|-----|-------|
| Body text | `font-normal text-gray-700` |
| Section labels | `font-semibold` |
| Modal section headers | `font-medium text-gray-700` |
| Secondary/muted text | `text-gray-500` or `text-muted-foreground` |

- **Never** use `font-light` on body text
- **Authored copy** (AI prompts, phase descriptions, signal text, modal paragraphs) is untouchable — read the full file before editing any section containing it

---

## 12. Naming Conventions

| Name | Meaning |
|------|---------|
| `rhythmColour` | RMSSD-only Your Rhythm colour |
| `movementColour` | Readiness plus Rest/Rising Movement Read colour; calendar cell |
| `signalContext` | Saved split calculation, reference, flags and phase |
| `practiceSignal` | Practice category; calendar dot |
| `PRACTICE_CARD_BG` | Practice-category tint in the day popup |

Use Movement Read for calendar cells and practice category for dots.
✅ Orange cell with a green practice dot. ❌ A practice category repainting the day's experience.

---

## 13. GOE88 Chat Button

All cards include the disabled GOE88 chat placeholder at the bottom:

```jsx
import GOE88ChatButton from '@/components/GOE88ChatButton';

// Placed after the last zone, before the closing tag of the card wrapper
<GOE88ChatButton />
```

This is wired up when GOE88 (task #9) is built. Do not remove or replace it.

---

## 14. Per-Card Data Hooks (MANDATORY — Task #48 complete)

Every card **must** consume its data via its own hook. Cards must never call `useDashboard()` directly.

### Existing hooks (all live)
| Hook | Card | File |
|---|---|---|
| `useMovementContext()` | MovementIntelligenceCard | `client/src/hooks/useMovementContext.ts` |
| `useCycleData()` | CyclicalIntelligenceCard | `client/src/hooks/useCycleData.ts` |
| `useAstrologyData()` | AstrologyIntelligenceCard | `client/src/hooks/useAstrologyData.ts` |
| `useRestData()` | RestIntelligenceCard | `client/src/hooks/useRestData.ts` |

### Pattern for every new card

```ts
// client/src/hooks/use{Card}Data.ts
import { useDashboard } from '@/contexts/DashboardContext';

export function use{Card}Data() {
  const { globalState, update{Card}Data, apiHelpers } = useDashboard();
  return {
    {card}Data:    globalState.{card}Data,
    chatHistory:  globalState.chatHistories.{card} || [],
    update{Card}Data,
    analyze{Card}: apiHelpers.analyze{Card},
    sendChatMessage: apiHelpers.sendChatMessage,
  };
}
```

The hook is a **thin facade** over DashboardContext. The card only imports from its own hook — this is the split-ready pattern. When a card is extracted to its own service, only the hook internals change; card code stays unchanged.

Cross-card data (e.g. cycle info inside Movement) follows **Option B**: the server includes it in the API response. No cross-directory hook imports between cards.

### Outer container spacing (MANDATORY)

The inner `flex flex-col` wrapper in every card index **must** include `gap-4` to ensure consistent spacing between the header and each zone:

```jsx
<div className="w-full h-full flex flex-col gap-4">
  <{Card}Header />
  <{Card}Zone1 ... />
  ...
</div>
```

---

## 15. Server Route Pattern for Calendar

```ts
app.get('/api/{card}/calendar', isAuthenticated, async (req, res) => {
  const year  = parseInt(req.query.year)  || new Date().getFullYear();
  const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
  const logs  = await storage.get{Card}Calendar(userId, year, month);

  // Return saved colours and snapshots for each recorded day.
  res.json(logs);
});
```

Movement returns its saved snapshot and explicit colours.
✅ Stored day-specific fields. ❌ Today's inputs applied to a historical record.

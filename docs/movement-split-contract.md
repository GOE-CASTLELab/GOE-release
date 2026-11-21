# Movement — instrument 0.2.0

## Contract

Your Rhythm reads RMSSD against personal source-specific history.
Movement Read reads readiness plus prior-night Rest/Rising flags.
Movement Read selects practices. The two colours are independent.
SDNN is stored/displayed context.

`shared/movementSignal.ts` owns the pure calculation.
`server/lib/movementRead.ts` owns the owner-scoped refresh/persistence path.
The fresh-install Drizzle schema contains only this Movement contract.

## Numeric policy fixed in pass 1

- Cycling: all supplied valid prior same-phase, same-source daily readings.
- Perimenopause/postmenopause: the latest **28 prior same-source readings**,
  exclusive of today; phase does not filter and date gaps do not reset observation.
  This is a product window chosen for this implementation, not a medical standard.
- Today's reading is excluded from its reference. Three prior eligible readings
  are required: readings 1–3 observe; reading 4 can produce a colour. A source change
  can return to observing when fewer than three same-source priors are available.
- Within = mean ± one **population** standard deviation, endpoints included.
  Above the upper endpoint = green; within = yellow; below the lower = orange.
  A zero-variance reference makes only exact equality yellow. No display rounding
  enters comparisons.
- Red requires today and the immediately preceding local calendar day to be below
  their respective established references. Yesterday uses its own earlier history
  and its own phase, including at phase boundaries. An observing/missing yesterday,
  a date gap, or a different HRV source cannot establish red. The supplied life stage
  applies to the calculation; persistence retains the calculation
  snapshot so archives retain their recorded life stage.
- Readiness preserves the existing four numeric colour boundaries: 8–10 motivated /
  green; 6–7 rising / yellow; 4–5 easing / orange; 1–3 sluggish / red.
- Rest points: alcohol 1; sweats 2; wakings 1–2 = 1, 3+ = 2. Points 0–2 keep the
  colour, 3 lowers one step, 4–5 lowers two, with red as floor.
- `restLogged` follows the existing presence convention: at least one valid recovery
  input is present. An empty submission is not a recorded zero. Partial records use
  only known flags; no new full-form completion requirement is introduced.
- Readiness against Rhythm compares the **unmodified** readiness colour, not the
  final Movement colour. No comparison is made while Rhythm has no colour.

## Persistence

`movement_logs` retains raw HRV/source/readiness, date, cycle, notes and practice records.
Its calculated fields are `rhythmColour`, `movementColour`,
`movementInstrumentVersion` and the typed JSONB `signalContext`.
The snapshot stores reference statistics, status, readiness word, Rest flags/points,
phase-for-words, life stage and logged phase/day.

The client captures one profile-local date for an HRV/readiness pair and sends it
with both writes. Both endpoints reject a missing date instead of resolving their
own server dates. HRV capture, readiness save, today's reload, Rest-triggered refresh
and native chat share the same calculation path. Equal snapshots cause no extra writes.
Calendar/history returns saved snapshots. Practice category remains independent.

Life stage comes from `users.life_stage`; local date comes from the profile timezone.
Missing/invalid RMSSD has no Rhythm colour. Missing readiness has no Movement colour.
An absent source compares only with absent-source readings. Missing cycling phase
keeps Rhythm unclassified. Missing Rest stays explicitly incomplete.
An observing HRV record retains its RMSSD and snapshot with a null Rhythm colour.

## Owner and fork

Owner Movement starts empty after the authorized reset; other cards retain their data.
The private pre-reset backup is outside this repository.
The fork's fresh database starts with empty personal tables and the new schema.
Movement charts and calendars render only records written by the fork owner.

## Research boundary

All raw records, source history, dates, life stage, Rest flags and snapshots remain
owner-private locally. Authored copy belongs to personal presentation, not research.

| Field | Definition/version |
|---|---|
| `rmssd`, `sdnn` | Milliseconds; `rmssd.v1`, `sdnn-sample.v1` |
| `hrv_source`, `hrv_quality` | Adapter identifier; quality percent |
| `readiness_score` | Integer 1–10; `movement-readiness.v2` |
| `rhythm_colour` | RMSSD-only; `phase-or-recent-rmssd.v1` |
| `movement_colour` | Readiness/Rest points; `readiness-rest-points.v1` |
| `practice_category`, `practice_duration` | Recorded practice and minutes; existing versions |

Movement's manifest is independently declared as 0.2.0 with mapping `pending`.
The acceptance registry excludes it. Configured grants containing Movement pause;
projection independently skips it. Other cards' accepted manifests are unchanged.
Mapping approval and consent are separate release decisions.
Historical versions in the separate brokerage repository are outside this package.

## Verification

- `test:movement`: 11 calculation groups, including all 120 readiness/Rest combinations.
- `test:movement-routes`: 12 HTTP/storage groups, required captured dates,
  observing save/reload, immutable archives and isolation.
- `test:movement-db`: generates fresh SQL directly from the shipping Drizzle schema;
  creates a transaction-local temporary table; verifies its columns and JSONB roundtrip.
- `test:movement-presentation`: approved assembled example, 120 copy cases, missing
  inputs, owner/demo chart/calendar gates and populated component rendering.
- Rest/Rising, card-context, HRV, agent-feed and contribution regression tests.
- Typecheck and production build.
- Live owner reset: 20 Movement rows removed; 29 other tables / 1,939 rows unchanged
  by transaction-level checksums. Production restarted; HTTP 200 and empty Movement APIs.
- Presentation regression renders the actual owner/demo card components, including
  the established slider, universal-practice colour inheritance, archive popup,
  missing-input states and observing state. Production build and live HTTP pass.

## Presentation boundary

The split retains the established pre-`ee5856d`/`bf39065` visual treatment. The Home
popup and full card carry the necessary Your Rhythm / Movement Read wiring without
the abandoned four-word slider, result-panel recolouring, added result SDNN line,
expanded archive layout or long missing-HRV copy. Universal practices have no extra
UI category and inherit the current Movement Read colour in selection and saved
records. `Your readiness is yet to be logged.` appears once on the full card after
HRV exists and readiness does not; it is absent from Home and Archive.

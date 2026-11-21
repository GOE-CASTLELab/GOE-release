# Agent Context Layer — current-read module

This folder is the cohort-shipped current-read seam between a GOE instance and its owner's agent.

## Stable boundary

`agent-context-snapshot.ts` defines one inward, identified projection over the same four card domains used by Stage 2's outward contribution projection:

- cyclical
- rest_restore
- movement
- astrology_energetic

The envelope stays stable while fields are added inside a card record. Breaking meaning changes require a snapshot schema-version change. Each record carries `values`, field-level `provenance`, and explicit `missing` reasons.

## Files

- `agent-context-snapshot.ts` — versioned snapshot contract and validation.
- `feed-writer.mjs` — builds the snapshot from owner-scoped localhost endpoints, then renders the USER.md adapter.
- `run-feed.sh` — executable entry point.
- `USER-block-template.md` — marked USER.md destinations.
- `response-calibration-template.md` — fork-owner policy template for how current data adjusts response shape.
- `test-feed-writer.mjs` — snapshot, missingness, provenance, rendering, static-chart, and marker-preservation checks.

## App seams

The module borrows card semantics and calculations rather than copying them. Cycle, Rest/Rising, Movement, and recovery calculations remain in shared app code. `server/lib/agentFeedRefresh.ts` is the thin runtime trigger that calls this module after a saved reading.

The current snapshot is not the deferred longitudinal interpretation layer. Physiological and energetic arcs, the Creative container, retrieval, and EightyEight classification extend this seam later.

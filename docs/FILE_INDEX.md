# File Index

This index explains what is inside the four-card GOE source folder. It is for finding a part, not for reading the code from beginning to end.

## Start with the folders

| Folder     | Open it when you want to find…                                             |
| ---------- | -------------------------------------------------------------------------- |
| `client/`  | Something visible in Home, a card, chat or an image                        |
| `server/`  | Saving, reading, writing generation, private connections or scheduled work |
| `shared/`  | The agreed shape or meaning of a record used on both sides                 |
| `setup/`   | The agent feed, static-chart preparation or moon-centre connection         |
| `scripts/` | A setup, import, generation or proof command                               |
| `docs/`    | A guide to the source or one technical boundary                            |

## Top level — the package itself

| File                            | What it is                                                                                                       |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `.env.example`                  | Setup template with safe defaults and blank private settings. The real `.env` stays outside source history.      |
| `.github/workflows/quality.yml` | Runs install, security, lint, formatting, TypeScript, boundary, notice and build checks when the source changes. |
| `.gitignore`                    | Keeps private, generated and local-only files out of Git.                                                        |
| `.prettierrc.json`              | Formatting settings used by the source checks.                                                                   |
| `README.md`                     | The front door to the package.                                                                                   |
| `COMMERCIAL.md`                 | The route for a separate commercial licence.                                                                     |
| `LICENSE`                       | GOE's AGPL-3.0 source licence.                                                                                   |
| `THIRD_PARTY_NOTICES.md`        | Readable list of the locked third-party packages and their licences.                                             |
| `package.json`                  | GOE's commands, software dependencies, name and licence declaration.                                             |
| `package-lock.json`             | Exact dependency versions used by this release.                                                                  |
| `components.json`               | Settings for the reusable interface components under `client/src/components/ui/`.                                |
| `drizzle.config.ts`             | Database-schema command settings.                                                                                |
| `eslint.config.js`              | Zero-warning checks for the JavaScript and JSX interface.                                                        |
| `postcss.config.js`             | CSS processing settings.                                                                                         |
| `tailwind.config.ts`            | Existing interface style settings and file paths.                                                                |
| `tsconfig.json`                 | TypeScript checks and shared import paths.                                                                       |
| `vite.config.ts`                | Browser-app build settings and the local development connection.                                                 |

## `client/` — what appears on screen

### Entry files

| File                                             | What it is                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------- |
| `client/index.html`                              | The browser page that receives the built app.                       |
| `client/src/main.tsx`                            | Starts the visible app.                                             |
| `client/src/App.tsx`                             | Wraps Home in its data, dashboard, tooltip and message providers.   |
| `client/src/index.css`                           | The existing global styles, colours, type and responsive treatment. |
| `client/src/pages/SwipeableDashboardWrapper.tsx` | The desktop and mobile frame around Home and card movement.         |
| `client/src/pages/not-found.tsx`                 | The fallback view for an unknown page.                              |
| `client/src/contexts/DashboardContext.tsx`       | Keeps the visible dashboard’s open-card and movement state.         |

### Images and video

| File                                      | Where it appears                                      |
| ----------------------------------------- | ----------------------------------------------------- |
| `client/public/favicon.ico`               | Browser-tab icon for older browsers.                  |
| `client/public/favicon.png`               | Browser-tab and app icon.                             |
| `client/public/images/Cyclical.webp`      | Cyclical image on Home and in its pop up.             |
| `client/public/images/RR.webp`            | Rest & Restore image on Home and in its pop up.       |
| `client/public/images/Movement.webp`      | Movement image on Home and in its pop up.             |
| `client/public/images/Astrology.webp`     | Astrology image on Home and in its pop up.            |
| `client/public/images/CollectiveSky.webp` | Collective-sky image used inside Astrology.           |
| `client/public/images/horses.mp4`         | Desktop Home background video.                        |
| `client/public/images/horses.webm`        | Browser-ready alternate form of the background video. |
| `client/public/images/horses_still.jpg`   | Still background and video fallback.                  |

### Home, shared card frame and chat

| File                                               | What it controls                                                      |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| `client/src/components/OrbHomeScreen.jsx`          | Home, the four card openings, background media and their image paths. |
| `client/src/components/GOE88ModalShell.jsx`        | Shared pop-up frame around the four cards.                            |
| `client/src/components/IntelligenceCardHeader.jsx` | Shared card-header structure.                                         |
| `client/src/components/GOE88ChatButton.jsx`        | Opens Home or card chat when chat is enabled.                         |
| `client/src/components/GOE88ChatPanel.jsx`         | Visible chat, history and reset interaction.                          |
| `client/src/lib/goeCardConstants.js`               | Names, colours and shared identifiers for the four visible cards.     |

### Cyclical

| File                                                                | What it controls                                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `client/src/components/CyclicalIntelligenceCard/index.jsx`          | Opens and arranges the Cyclical card.                                    |
| `client/src/components/CyclicalIntelligenceCard/CyclicalHeader.jsx` | Cyclical header and current-position summary.                            |
| `client/src/components/CyclicalIntelligenceCard/CyclicalZone1.jsx`  | Cyclical calendar, cycle position, moon phase and connected moon centre. |
| `client/src/hooks/useCycleData.ts`                                  | Reads, saves and refreshes the owner’s cycle record.                     |
| `client/src/hooks/useMoonPattern.ts`                                | Reads and refreshes the connected moon-centre pattern.                   |
| `client/src/lib/cycleClientState.ts`                                | Keeps browser-side cycle updates consistent.                             |
| `client/src/lib/moonPatternClientState.ts`                          | Keeps browser-side moon-pattern revisions consistent.                    |
| `client/src/lib/moonCentres.ts`                                     | Visible moon-centre names and client helpers.                            |
| `client/src/lib/moonPhase.js`                                       | Browser-side moon-phase calculation.                                     |
| `client/src/utils/cycleCalculations.ts`                             | Visible cycle-position calculations.                                     |

### Rest & Restore

| File                                                             | What it controls                                        |
| ---------------------------------------------------------------- | ------------------------------------------------------- |
| `client/src/components/RestIntelligenceCard/index.jsx`           | Opens and arranges Rest & Restore.                      |
| `client/src/components/RestIntelligenceCard/RestHeader.jsx`      | Rest header and current summary.                        |
| `client/src/components/RestIntelligenceCard/RestZone1.jsx`       | Rest and Rising check-ins and current reading.          |
| `client/src/components/RestIntelligenceCard/RestZone2.jsx`       | Rest history and connected cycle view.                  |
| `client/src/components/RestIntelligenceCard/restCalculations.js` | Rest display calculations.                              |
| `client/src/hooks/useRestData.ts`                                | Reads, saves and refreshes Rest and Rising information. |

### Movement

| File                                                                 | What it controls                                         |
| -------------------------------------------------------------------- | -------------------------------------------------------- |
| `client/src/components/MovementIntelligenceCard/index.jsx`           | Opens and arranges Movement.                             |
| `client/src/components/MovementIntelligenceCard/MovementHeader.jsx`  | Movement header and current summary.                     |
| `client/src/components/MovementIntelligenceCard/MovementShared.jsx`  | Pieces reused across Movement’s views.                   |
| `client/src/components/MovementIntelligenceCard/MovementZone1.jsx`   | Current HRV and Movement reading.                        |
| `client/src/components/MovementIntelligenceCard/MovementZone2.jsx`   | Movement practices and library.                          |
| `client/src/components/MovementIntelligenceCard/MovementZone3.jsx`   | Movement archive and past records.                       |
| `client/src/components/MovementIntelligenceCard/movementInsights.js` | Supplied Movement insight language.                      |
| `client/src/components/HrvReader.jsx`                                | The visible 60-second camera or Bluetooth HRV reader.    |
| `client/src/components/HrvSourceSetup.jsx`                           | Source choice and connection state for HRV.              |
| `client/src/hooks/useMovementContext.ts`                             | Reads and refreshes Movement context.                    |
| `client/src/lib/hrv/adapterRegistry.js`                              | Register of available HRV sources.                       |
| `client/src/lib/hrv/processing.js`                                   | Converts beat intervals into the saved HRV measurements. |
| `client/src/lib/hrv/sources.js`                                      | Camera and Bluetooth source definitions.                 |
| `client/src/lib/hrv/adapters/exampleAdapter.js.template`             | Starting shape for a future HRV source adapter.          |

### Astrology

| File                                                                  | What it controls                                                 |
| --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `client/src/components/AstrologyIntelligenceCard/index.jsx`           | Opens and arranges Astrology.                                    |
| `client/src/components/AstrologyIntelligenceCard/AstrologyHeader.jsx` | Astrology header and current summary.                            |
| `client/src/components/AstrologyIntelligenceCard/AstrologyZone1.jsx`  | Birth chart and current sky.                                     |
| `client/src/components/AstrologyIntelligenceCard/AstrologyZone2.jsx`  | Current transits and weekly reading.                             |
| `client/src/components/AstrologyIntelligenceCard/AstrologyZone3.jsx`  | Gene Keys and Human Design views.                                |
| `client/src/hooks/useAstrologyData.ts`                                | Reads and refreshes saved Astrology records.                     |
| `client/src/lib/staticCharts.js`                                      | Browser helpers for prepared Gene Keys and Human Design records. |

### General browser helpers

| File                                   | What it does                                                                |
| -------------------------------------- | --------------------------------------------------------------------------- |
| `client/src/hooks/useAuth.ts`          | Reads this instance’s fixed local owner.                                    |
| `client/src/hooks/useLocalDate.js`     | Keeps visible dates in the owner’s saved time zone.                         |
| `client/src/hooks/useReturnPattern.ts` | Records a qualified return and visible active time in the owner’s instance. |
| `client/src/hooks/use-mobile.tsx`      | Detects the small-screen layout.                                            |
| `client/src/hooks/use-toast.ts`        | Supplies brief on-screen messages.                                          |
| `client/src/lib/authUtils.ts`          | Handles owner-response errors in the browser.                               |
| `client/src/lib/queryClient.ts`        | Shared connection between the visible app and server routes.                |
| `client/src/lib/utils.ts`              | Small shared browser-format helpers.                                        |

### Reusable interface pieces

`client/src/components/ui/` contains the seven small building blocks actually used by Home and the cards: `button`, `calendar`, `card`, `popover`, `toast`, `toaster` and `tooltip`.

These files support the fixed interface. A change here can affect more than one card.

## `server/` — saving, reading and connections

### Start, owner and database

| File                         | What it does                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `server/index.ts`            | Starts GOE, its routes, safe request logging, scheduled work and shutdown.     |
| `server/vite.ts`             | Serves the visible app in development or from the finished build.              |
| `server/config.ts`           | Reads the server-side chat switch.                                             |
| `server/ownerGate.ts`        | Requires the one local owner on every retained data route.                     |
| `server/db.ts`               | Opens the owner’s PostgreSQL connection.                                       |
| `server/storage.ts`          | Main read-and-save layer for the four cards, Return Pattern and owner profile. |
| `server/apiRequestLogger.ts` | Logs only request method, route, status and duration.                          |

### Owner-only routes

| File                             | What it receives and returns                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| `server/routes/index.ts`         | Registers only the retained route groups and keeps chat absent while disabled.       |
| `server/routes/auth.ts`          | Local owner, profile, time zone and shared card state.                               |
| `server/routes/cycle.ts`         | Cycle record, cycle actions and connected moon-centre pattern.                       |
| `server/routes/rest.ts`          | Sleep, Rest and Rising records and Rest practice.                                    |
| `server/routes/movement.ts`      | HRV, Movement readings, practices, archive and notes.                                |
| `server/routes/astrology.ts`     | Birth chart, sky, transits, weekly writing, Gene Keys and Human Design.              |
| `server/routes/practices.ts`     | Retained audio and Movement practice records.                                        |
| `server/routes/chat.ts`          | Home and card conversations, history and reset when chat is enabled.                 |
| `server/routes/contributions.ts` | Local contribution status and the owner-confirmed first send.                        |
| `server/routes/returnPattern.ts` | Owner-only read, record, update and deletion path for local Return Pattern sessions. |
| `server/routes/shared.ts`        | Shared model-provider selection and request helper.                                  |

### Astrology and writing

| File                                  | What it does                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| `server/astroAppAuth.ts`              | Uses owner-supplied AstroApp details to obtain and hold its short-lived session.            |
| `server/astrologyTransformations.ts`  | Translates provider chart, sky and transit records into GOE's stored shapes.                |
| `server/goePrompts.ts`                | Builds the approved Astrology writing requests from stored records.                         |
| `server/goeReference.ts`              | Editable GOE vocabulary and method supplied to chat.                                        |
| `server/prompts/chatPrompts.ts`       | Home, Cyclical, Rest, Movement and Astrology chat instructions.                             |
| `server/prompts/wiredProsePrompts.ts` | Weekly Astrology and Gene Keys/Human Design thread instructions.                            |
| `server/chatDelivery.ts`              | Sends an enabled chat to the owner’s chosen direct provider or private OpenClaw connection. |
| `server/scheduler.ts`                 | Runs the production-only daily sky, transit and writing refresh.                            |

### Card context and focused helpers

| File                                  | What it does                                                                             |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| `server/cardContext.ts`               | Collects the available four-card context for Home and card chat.                         |
| `server/moonCentres.ts`               | Reads the two moon-centre enable switches.                                               |
| `server/lib/agentFeedRefresh.ts`      | Runs the enabled local agent-feed refresh after relevant saves.                          |
| `server/lib/astrologyBoundaries.ts`   | Calculates the displayed timing boundaries for Astrology events.                         |
| `server/lib/astroAppChiron.ts`        | Gets Chiron sign crossings from AstroApp and derives stations from dated speed readings. |
| `server/lib/astrologyDisplayDates.ts` | Keeps Astrology dates in the owner’s local day.                                          |
| `server/lib/astrologyRefreshGate.ts`  | Keeps automatic paid refresh to the configured production path.                          |
| `server/lib/birthChartSetup.ts`       | Validates and protects one-time birth-chart creation.                                    |
| `server/lib/cycleContext.ts`          | Builds the current cycle context used across cards.                                      |
| `server/lib/movementRead.ts`          | Builds the Movement reading from the current approved inputs.                            |
| `server/lib/recovery.ts`              | Reads the latest recoverable stored record where a route needs it.                       |
| `server/lib/userDate.ts`              | Resolves “today” from the owner’s saved time zone.                                       |

### Health import

| File                                 | What it does                                                    |
| ------------------------------------ | --------------------------------------------------------------- |
| `server/health/appleHealth.ts`       | Reads the Apple Health export structure.                        |
| `server/health/appleHealthImport.ts` | Translates supported menstrual-flow and sleep records into GOE. |

### Local file storage

| File                                 | What it does                                                   |
| ------------------------------------ | -------------------------------------------------------------- |
| `server/storage/objectStore.ts`      | The small storage interface used by the app.                   |
| `server/storage/localObjectStore.ts` | Saves and reads files from the owner-chosen local-disk folder. |
| `server/storage/index.ts`            | Selects that local-disk store once at startup.                 |

### Optional contribution

| File                               | What it does                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| `server/contributionConfig.ts`     | Validates the owner’s selected contribution areas, credential, consent and instrument versions.  |
| `server/contributionClient.ts`     | Checks current authorization and submits a prepared package to the official receiving address.   |
| `server/contributionProjection.ts` | Builds only the approved fields and relative timing for currently authorized contribution areas. |
| `server/contributionService.ts`    | Creates one no-gap contribution window and advances only after acceptance.                       |
| `server/contributionScheduler.ts`  | Checks every six hours and sends when 14 days have passed.                                       |
| `server/contributionState.ts`      | Keeps the random contribution ID, accepted sequence and last window in a private local file.     |

## `shared/` — record meanings used across GOE

| File                             | What it defines                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `shared/schema.ts`               | PostgreSQL tables and the app’s database record types.                                                 |
| `shared/cycleCore.ts`            | Cycle day, phase, calendar fertility window and related calculations.                                  |
| `shared/moonCentreCatalogue.ts`  | The eleven Kundalini moon-centre identifiers and names used by GOE.                                    |
| `shared/moonPattern.ts`          | The owner-entered pattern, revisions and connection checks.                                            |
| `shared/moonPhase.ts`            | Shared moon-phase calculation.                                                                         |
| `shared/restRisingCore.ts`       | Merges Rest and Rising answers into one daily observation.                                             |
| `shared/movementSignal.ts`       | Movement instrument values and signal boundaries.                                                      |
| `shared/intelligenceProfile.ts`  | Shared profile fields used across the four-card experience.                                            |
| `shared/staticChartImport.ts`    | Gene Keys and Human Design package structure and import validation.                                    |
| `shared/staticChartReadings.ts`  | Required reading containers for those two charts.                                                      |
| `shared/contributionContract.ts` | Accepted four-card and Return Pattern versions, field manifests, payload shape and privacy validation. |

## `setup/` — owner-chosen additions

### Agent feed

| File                                                | What it is                                                                  |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| `setup/agent-feed/README.md`                        | Technical setup and boundary for the local agent feed.                      |
| `setup/agent-feed/USER-block-template.md`           | Marked sections placed in the owner’s chosen `USER.md`.                     |
| `setup/agent-feed/response-calibration-template.md` | Starting example for how an agent can work with current GOE context.        |
| `setup/agent-feed/agent-context-snapshot.ts`        | Reads owner-scoped GOE routes into one bounded snapshot.                    |
| `setup/agent-feed/feed-writer.mjs`                  | Writes only the marked sections and preserves the rest of the owner’s file. |
| `setup/agent-feed/run-feed.sh`                      | Runs the snapshot and writer together.                                      |
| `setup/agent-feed/test-feed-writer.mjs`             | Checks marker handling and private atomic writes.                           |
| `setup/agent-feed/test-clean-package.mjs`           | Checks the complete feed included in a clean package.                       |

### Static charts

| File                                                    | What it is                                                                    |
| ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `setup/chart-prompts/README.md`                         | Preparation path for verified Gene Keys and Human Design values and readings. |
| `setup/chart-prompts/canonical-chart-prompt-adapter.ts` | Applies the supplied prompts to the prepared chart package.                   |
| `setup/chart-prompts/gene-keys-chart-prompt.txt`        | Supplied Gene Keys chart-reading instructions.                                |
| `setup/chart-prompts/human-design-chart-prompt.txt`     | Supplied Human Design chart-reading instructions.                             |

### Moon centres

| File                    | What it is                                                                        |
| ----------------------- | --------------------------------------------------------------------------------- |
| `setup/moon-centres.md` | Centre identifiers and the checked connection process for an owner-known pattern. |

## `scripts/` — commands you or an agent can run

### Setup, import and generation

| File                                        | Command purpose                                                                          |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `scripts/setup-local-owner.ts`              | Creates one random local owner and protects an existing owner.                           |
| `scripts/apply-goe-setup.ts`                | Safely applies the optional connection file without replacing owner settings.            |
| `scripts/check-storage-setup.ts`            | Saves and reads back a small proof file in the chosen storage folder.                    |
| `scripts/import-apple-health.ts`            | Imports supported records from an Apple Health export.                                   |
| `scripts/apple-health-fixture.ts`           | Shared synthetic Apple Health records used by import proof.                              |
| `scripts/generate-apple-health-fixture.ts`  | Creates the synthetic export used by that proof.                                         |
| `scripts/import-static-charts.ts`           | Validates and imports prepared Gene Keys and Human Design records.                       |
| `scripts/generate-static-chart-readings.ts` | Generates chart readings while preserving verified source values and original responses. |
| `scripts/generate-design-thread.ts`         | Generates the weekly Gene Keys and Human Design threads from stored records.             |
| `scripts/generate-third-party-notices.mjs`  | Regenerates or checks the notices file from the exact lockfile.                          |
| `scripts/check-format-baseline.mjs`         | Checks changed files against the established application formatting.                     |

### Boundary and connection proofs

| File                                    | What it checks                                                                                            |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `scripts/test-clean-boundary.mjs`       | Checks configured source exclusions and permitted documentation references; does not inspect Git history. |
| `scripts/test-astroapp-chiron.ts`       | Provider-response replay, Chiron timing, cache reuse, failures and timezone handling.                     |
| `scripts/fixtures/chiron-provider.json` | Non-personal AstroApp positions and ingress responses used by the Chiron proof.                           |
| `scripts/test-api-request-logger.ts`    | Logs contain method, route, status and duration, with no response body.                                   |
| `scripts/test-apply-goe-setup.ts`       | Safe connection-file merge, validation and file permissions.                                              |
| `scripts/test-owner-setup-db.ts`        | Empty database, one local owner and repeat protection.                                                    |
| `scripts/test-local-object-store.ts`    | Private local-disk file save, read and path boundary.                                                     |
| `scripts/test-contribution.ts`          | Four-card and Return Pattern projection, privacy, no-gap windows, scheduled send and accepted state.      |
| `scripts/test-return-pattern-db.ts`     | Isolated owner-database proof for Return Pattern storage, active time, range reads and deletion.          |
| `scripts/test-return-pattern-routes.ts` | Qualified-return, visibility, active-time and route behaviour without personal records.                   |
| `scripts/test-card-context.ts`          | Four-card context supplied to Home and card chat.                                                         |
| `scripts/test-chat-delivery.ts`         | Disabled chat and both configured delivery paths.                                                         |
| `scripts/test-chat-conversations-db.ts` | Saved conversation, history, archive and reset behaviour.                                                 |
| `scripts/test-apple-health-import.ts`   | Synthetic Apple Health menstrual-flow and sleep import.                                                   |

### Cyclical and moon proofs

| File                                      | What it checks                                                              |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| `scripts/test-cycle-live-update.ts`       | Browser cycle state after a saved update.                                   |
| `scripts/test-cycle-manual-acceptance.ts` | Period history, new start, usual length and refresh through the real route. |
| `scripts/test-moon-phase.ts`              | Shared moon-phase results.                                                  |
| `scripts/test-moon-pattern.ts`            | Pattern validation, save and revision behaviour.                            |
| `scripts/test-moon-pattern-timing.ts`     | Centre timing across the repeating owner-entered pattern.                   |
| `scripts/test-moon-centre-context.ts`     | Same connected centre across the retained context surfaces.                 |
| `scripts/test-local-week.ts`              | Owner-local week and date boundary.                                         |

### Movement and Rest proofs

| File                                    | What it checks                                       |
| --------------------------------------- | ---------------------------------------------------- |
| `scripts/test-hrv-adapters.ts`          | Camera, Bluetooth and adapter boundary.              |
| `scripts/test-movement-split.ts`        | Movement instrument split and reading inputs.        |
| `scripts/test-movement-presentation.ts` | Visible Movement labels and retained interface.      |
| `scripts/test-movement-db.ts`           | Movement record persistence in an isolated database. |
| `scripts/test-rest-rising.ts`           | Rest and Rising merge, save and privacy boundaries.  |

### Astrology and chart proofs

| File                                     | What it checks                                             |
| ---------------------------------------- | ---------------------------------------------------------- |
| `scripts/test-astrology-boundaries.ts`   | Planetary event timing boundaries.                         |
| `scripts/test-astrology-refresh-gate.ts` | Production-only automatic refresh and explicit off switch. |
| `scripts/test-birth-chart-setup.ts`      | One-time chart creation, validation and protection.        |
| `scripts/test-static-chart-import.ts`    | Prepared Gene Keys and Human Design import.                |
| `scripts/test-static-chart-readings.ts`  | Required chart-reading containers and mapping.             |

## `docs/` — source references

| File                              | What it explains                                                             |
| --------------------------------- | ---------------------------------------------------------------------------- |
| `docs/INSIDE_YOUR_GOE.md`         | The visual structure guide.                                                  |
| `docs/FILE_INDEX.md`              | This detailed lookup.                                                        |
| `docs/goe-card-build-pattern.md`  | Technical pattern for building a complete card without skipping its layers.  |
| `docs/hrv-source-adapters.md`     | How HRV sources connect and how another source would be added.               |
| `docs/movement-split-contract.md` | Boundary between measured Movement inputs, the reading and practice records. |

## Generated folders you may see after setup

These are working results rather than source files:

| Name            | Why it appears                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------- |
| `node_modules/` | Installed supporting software after `npm ci`. It is not in Git or the delivered source history. |
| `dist/`         | Finished browser and server build after `npm run build`. It can be rebuilt from source.         |
| `.env`          | The owner’s private settings after setup. It stays out of Git.                                  |

The owner’s PostgreSQL database, chosen file-storage folder and contribution-state file remain outside the source folder.

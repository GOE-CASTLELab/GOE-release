# Enter or import your Kundalini moon-centre pattern

The Kundalini moon centre is the position calculated from the Kundalini
moon-centre pattern you connected to GOE. Kundalini moon centres use a personal
pattern stored in GOE's database. There is no default
personal sequence. The eleven centre names and write-ups are shared teaching
material; their catalogue order is not a woman's cycle order.

The existing timing is retained: 2.5 days per centre, read by calendar date. A
period date does not set or reset a moon-centre pattern. An old
`moonCenterStartDate` alone is retained but cannot supply a sequence.

## Entering your Kundalini moon-centre pattern

For someone who already knows her pattern, collect:

- The date she is identifying her centre for—normally today.
- Her centre on that date.
- Whether she is on day 1 or day 2 of that centre.
- Her repeating order of all eleven centres, including that centre.

She supplies those answers; the setup translates them into the saved pattern.
For example, entering a centre on day 2 makes the following calendar date read
the next centre in her supplied order. No elapsed-time calculation is required
from her.

### Prepare the instance

A new instance gets `moon_patterns` and its append-only revision history when its normal database setup runs. For an
existing instance receiving this source update, back up its database and run
`npm run db:push` against that instance's configured database before restarting
the updated app. This adds the new table; it does not populate a personal pattern
or change period records. Review any unrelated schema changes before applying them.

Kundalini moon centres still ship off. To make them available in an instance, set both in
its private root `.env`:

```dotenv
MOON_CENTRES_ENABLED=true
VITE_MOON_CENTRES_ENABLED=true
```

Run `npm run check` and `npm run build`, then restart that instance's existing
GOE service. The `VITE_` setting is a build-time flag. A separately launched
agent-feed writer must receive the server flag too. Availability alone does not
create a personal centre: a complete, enabled pattern must also be connected.

### Read the existing connection

On the computer or server running GOE:

```sh
curl --fail-with-body -sS http://127.0.0.1:5000/api/cycle/moon-pattern
```

Use the instance's configured port if it differs. The response includes
`pattern`, `effectiveEnabled` and `asOfDate` (the profile-local date).
`pattern: null` means no pattern has been connected. Otherwise keep its current
`revision` for the replacement request. Review a saved pattern before replacing it.

### Save the supplied pattern

Create a private JSON file on the machine running GOE. This is a setup input,
not a requirement for the future lunar card. The request has this structure:

```json
{
  "expectedRevision": 0,
  "pattern": {
    "enabled": true,
    "anchorDate": "<YYYY-MM-DD>",
    "anchorCentreId": "<CURRENT-CENTRE-ID>",
    "dayInCentre": 2,
    "order": ["<ID-1>", "<ID-2>", "<ID-3>", "<ID-4>", "<ID-5>", "<ID-6>", "<ID-7>", "<ID-8>", "<ID-9>", "<ID-10>", "<ID-11>"]
  }
}
```

Replace the placeholders with her answers, set `dayInCentre` to her day, and
use `expectedRevision: 0` only for the first connection. For a replacement,
use the revision returned by the read. All eleven IDs must appear once, in her
order. The array can begin anywhere in the repeating sequence; the explicitly
identified current centre fixes its position against the date.

These are identifiers, **not a sequence**:

| Centre | ID |
|---|---|
| Breasts | `breasts` |
| Cheeks | `cheeks` |
| Clitoris | `clitoris` |
| Earlobes | `earlobes` |
| Eyebrows | `eyebrows` |
| Hairline | `hairline` |
| Inner Thighs | `inner-thighs` |
| Lips | `lips` |
| Nape of Neck | `nape-of-neck` |
| Navel | `navel` |
| Vagina | `vagina` |

For a file named `moon-pattern.json` in the current terminal directory:

```sh
chmod 600 moon-pattern.json
curl --fail-with-body -sS -X PUT http://127.0.0.1:5000/api/cycle/moon-pattern \
  -H 'Content-Type: application/json' \
  --data-binary @moon-pattern.json
```

Read the connection again and confirm the sequence, date, current centre and
new revision. The saved response represents the day internally as
`anchorElapsedDays`; this is the calculation's position, not another question
to ask the woman. Her period data is not part of this request.

Refresh GOE. Check today's centre in Home's Cyclical popup, the Cyclical calendar
and Rest & Restore's Cycles view. Check the next calendar date against her
sequence. Refresh again to confirm the connection remains.

## Connect from the future lunar body card

The optional workshop card is a later build. Its daily observations and editable
workshop pattern remain with that card. **Connect moon-centres GOE** sends the
established pattern through the same receiving connection above.

The shared client helper is `connectMoonPattern` in
`client/src/lib/moonPatternClientState.ts`. It accepts the same request, waits
for the atomic save, and publishes the returned record to shared client state.
Existing mounted readers update from that shared state. No card imports another
card's component or keeps its own personal sequence.

**Revise moon-centres GOE** opens the workshop pattern for editing. The last
connected pattern continues supplying GOE until the woman connects the revision.
A failed or conflicting connection leaves that active pattern intact. Do not
send daily observations or workshop drafts to the active-pattern endpoint.

An importing caller that already knows the exact position can supply
`anchorElapsedDays` instead of `dayInCentre`, never both. Day entry converts to
a sample within the named day (day 1 → 0.5; day 2 → 1.5); the underlying 2.5-day
calculation, calendar-day progression and transition presentation are unchanged.

Cycle, Rest/Rising, Home, chat context and the optional agent feed read the shared
pattern. Creative is outside this four-card release; the connection is available
for its later integration, which still needs its own wiring and checks.

## If this fails

- **HTTP 400:** check the real calendar date, current-centre ID, day 1 or 2, and
  all eleven distinct IDs. Do not supply both day and elapsed-position fields.
- **HTTP 409:** another connection has been saved. Read it, review the changes,
  and use its revision only when deliberately replacing it.
- **HTTP 500 after updating code:** check that the new database table exists
  and that the service is using the intended database. Do not reset existing data.
- **Saved but not displayed:** check `enabled`, `effectiveEnabled`, both runtime
  and build-time flags, and that the app was rebuilt and restarted. Dates before
  the identified starting date have no personal-centre reading.
- **Agent feed did not refresh:** the pattern may already be saved. Read it
  before retrying; `X-Agent-Feed-Refreshed: false` does not mean the save failed.

An owner instance persists its connected pattern in the database across visits
and restarts.

To hide readings while retaining the pattern, connect the same pattern with
`enabled: false` and its current revision. Deployment flags can also disable the
feature instance-wide. Existing historical records are not rewritten. Previously
generated Rest practice is not reused after a connection changes; the app does
not automatically purchase a new generation.

The Kundalini moon-centre derivation has its own instrument version. Local use
continues when contribution is not configured or consent is inactive. Under an
active Cyclical grant, GOE contributes the full connected order once and again
only when the owner replaces it. Daily contributed positions carry the relative
window day and order revision; the anchor date stays in the instance. Workshop
observations are not contributed.

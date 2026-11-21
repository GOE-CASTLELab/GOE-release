# HRV source adapters — technical contract

This file is the extension reference for adding a live or imported HRV source to GOE.
Camera PPG, standard BLE R-R, and manual entry ship with the fork. A smartwatch is not a
generic source: Apple Health, Health Connect, and each vendor bridge are separate adapters.

## Runtime boundary

Registry: `client/src/lib/hrv/adapterRegistry.js`

Every adapter must provide:

```js
{
  id: 'lowercase_snake_case',
  label: 'Human label',
  uiKind: 'camera | bluetooth | manual | external',
  capabilities: {
    spot: true | false,
    continuous: true | false,
    dailyImport: true | false,
  },
  isAvailable: () => boolean,
  unavailableReason: () => string,
  capture: async (options) => HrvReading,
}
```

Every successful `capture()` returns GOE's format:

```js
{
  rmssd: 42,                  // required, positive milliseconds
  sdnn: 51,                   // nullable; calculated from accepted intervals
  bpm: 68,                    // nullable
  intervals: [882, 870, 891],// required array; [] when the source cannot supply them
  quality: 94,                // nullable or 0–100
  capturedAt: ISO_TIMESTAMP, // supplied by adapter or added by registry
}
```

The registry writes `source` from the registered adapter id. Vendor payloads never pass
into cards directly. Movement, homescreen, and Creative consume only this shape.

## Movement interpretation contract

- Your Rhythm compares RMSSD with source-specific phase history, or the latest 28 prior readings in transition/postmenopause.
- The first three eligible readings observe; the fourth can classify.
- Movement Read uses readiness and Rest/Rising points.
- SDNN is stored and displayed as context.
- Capture surfaces label RMSSD and SDNN separately.

Example: RMSSD can produce green Your Rhythm while readiness and Rest/Rising produce orange Movement Read.
Drift: combining both into one training colour.

Full numeric policy: [Movement contract](movement-split-contract.md).

## Browser security boundary

Camera and Web Bluetooth require a secure browser context. Tailscale can encrypt traffic
to a raw `http://` tailnet address while the browser still classifies that page as an
insecure origin. A fork therefore needs its own Tailscale Serve HTTPS route before the
browser can grant either adapter access.

- Local app check: `http://127.0.0.1:5000/`
- Private network check: `http://100.x.x.x:5000/`
- Member access with browser hardware permission: `https://owner-machine.example-tailnet.ts.net:8443/`

The setup agent verifies the local app first, preserves existing Serve routes, creates an
unused HTTPS route to `http://127.0.0.1:5000`, and gives the exact URL to the person. The
person chooses Camera or compatible Bluetooth. The agent offers the matching source
self-test. The deployment guide Step 7 owns the commands and verification details.

Primary sources: [Tailscale Serve](https://tailscale.com/docs/reference/tailscale-cli/serve)
and [MDN `getUserMedia()` security](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#security).

## Add an adapter

1. Copy `client/src/lib/hrv/adapters/exampleAdapter.js.template` to a source file.
2. Implement availability and capture against that source's real bridge.
3. Import it in `adapterRegistry.js` and call `registerHrvAdapter(adapter)` once.
4. Run `npm run test:hrv`, `npm run check`, and `npm run build`.
5. Test one real reading through the source selector over HTTPS.
6. Confirm the selected source persists and its baseline does not mix with another source.
7. Add the source-specific setup and permission steps to deployment Step 7.

## Source rules

- Camera frames remain on-device. Store accepted intervals and derived values only.
- A source must identify the metric it supplies. Do not relabel SDNN as RMSSD.
- A BLE source passes only when its Heart Rate Measurement packets contain R-R intervals.
- HealthKit and Health Connect need a native or local bridge; a browser cannot read them
  directly.
- Vendor cloud adapters need the user's own account, OAuth consent, and rate-limit handling.
- `continuous: true` means the adapter actually supports a session stream; a spot-reading
  implementation must declare `false`.
- Switching source selects that source's own baseline. Never combine PPG PRV with electrical
  R-R readings silently.

## Setup self-test

`runHrvAdapterSelfTest(id, options)` runs the selected adapter through the same validation
used by the cards and saves it as the instance's browser default only after a valid reading.
A setup passes when the result contains valid RMSSD, SDNN when the source supplies intervals,
source, capture time, intervals array, and valid quality when supplied.

`HrvSourceSetup.jsx` wraps the same `HrvReader.jsx` selector used by the cards, but persists
the chosen default only after a valid capture completes. Deployment setup therefore tests
the runtime path rather than certifying a separate setup-only path.

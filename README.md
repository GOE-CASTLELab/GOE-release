# Your GOE

How we live and work is changing, and we want to participate in shaping it.

The human question comes first. If an agent can handle our work and a device can hold our data—what to eat, when to sleep, how to move—what do we choose to participate in ourselves?

We call that living creatively. Actively building what our lives become. This potential is in thanks becoming increasingly possible to everyone, not only those that identify as technical or creative.

Owning our data and authoring our lives belong together. The measurements—sleep, readiness, activity, stress and recovery—matter, and so does what they mean within our own experience. Our observations, language and changing understanding need a place in the system. As we learn about ourselves, we should be able to customise the tools living alongside us.

We want more participation in life, with less compulsory attention to technology. GOE can become somewhere you and your agent meet: speaking together, gathering vitals and recording creative endeavours and lived experiences without repeatedly opening an app, returning to look at what is taking shape. Offering an alternative of the 24/7 connected wearable and equally the burden of being consistent in manually presenting a freedom to put devices down.

The excitement is in what these developments make possible together. Wearable sensing, personal agents, data ownership, authorship and monetization are converging. There is an opening for people to retain a say in their experience, their knowledge and the value it generates. Autonomy, sovereignty, wealth and abundance are part of the GOE and CASTLE Lab ambition.

GOE and CASTLE Lab connect the personal possibility to a shared one. Each person can have their own system. Through chosen participation, those separate experiences can also contribute to knowledge, relationships and opportunities that none of us could create alone. DFOS gives that shared work somewhere to gather.

The four-card release is what you can take up now; the larger vision gives direction to what we build next, together.

## Begin here

1. Open [Inside Your GOE](docs/INSIDE_YOUR_GOE.md) for a visual walk through this folder.
2. Keep the **19-step GOE Deployment Guide** beside this folder and follow it from Step 1. The final guide is delivered with this package from `mygoe.app/download`.
3. Use [File Index](docs/FILE_INDEX.md) when you want to find a specific part.

If your agent builds GOE with you, give it this whole folder and the 19-step guide. It can carry the technical load while you supply the choices that make the instance yours.

## The four cards

| Card               | What it brings together                                                   |
| ------------------ | ------------------------------------------------------------------------- |
| **Cyclical**       | Your cycle, moon phase and the Kundalini moon-centre pattern you connect. |
| **Rest & Restore** | Your Rest and Rising check-ins, sleep and changing energy.                |
| **Movement**       | Your HRV readings, movement readiness and movement practices.             |
| **Astrology**      | Your birth chart, current sky, transits, Gene Keys and Human Design.      |

GOE also keeps a private Return Pattern, showing how you return to the app over time.

## The folder at a glance

```text
GOE/
├── client/    What you see and use
├── server/    What saves, reads and prepares your records
├── shared/    The meanings and record shapes both sides use
├── setup/     The connections you choose to add
├── scripts/   Setup, import and proof tools
└── docs/      The map and technical references
```

The files at the top of the folder describe how GOE runs and what software it uses.

## What stays outside this folder

| Your information                       | Where it lives                                                                      |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| Private settings and keys              | Your private `.env` file, created during setup and excluded from the source package |
| Records shown in the cards             | Your PostgreSQL database                                                            |
| Return Pattern records                 | Your PostgreSQL database                                                            |
| Imported health files and stored media | The private storage folder you choose                                               |
| Contribution sequence and timing       | A private state file under your service account                                     |
| Agent context, if connected            | The agent workspace you choose                                                      |

The source package contains an `.env.example` with safe defaults and blank private fields. It contains no owner ID, provider key, chart, health record, conversation or contribution credential.

## Before changing something

- **Images and writing:** the 19-step guide shows the existing paths for personalising images, GOE's reference language and its writing prompts.
- **Records:** use GOE or its setup and import tools. Keep personal records out of the code folder.
- **Code:** keep a copy of the working version, make one defined change and run `npm run lint`, `npm run format:check`, `npm run check` and `npm run build` before using it.
- **Credentials:** enter them only in the private `.env` file. Keep them out of chat, screenshots, logs and committed files.

## Checks carried with the package

- `THIRD_PARTY_NOTICES.md` lists the locked third-party software and licences.
- `LICENSE` and `COMMERCIAL.md` explain GOE's own licensing paths.
- The scripts beginning with `test-` check the parts named in their filenames without using your personal records.

## The longer map

[Inside Your GOE](docs/INSIDE_YOUR_GOE.md) shows how the visible app, saved records, setup tools and optional connections fit together. [File Index](docs/FILE_INDEX.md) is the detailed lookup.

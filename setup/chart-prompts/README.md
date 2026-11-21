# Static chart import

Use this path once during setup to add Gene Keys and Human Design. Astrology uses the
separate birth-details route.

## Source → package

1. Read the person's Gene Keys Hologenetic Profile PDF and Human Design source PDF.
2. Confirm every gate, line, keyword, placement and property against the rendered page.
3. Build one private JSON package with `version: 1` and either or both top-level keys:
   `geneKeys`, `humanDesign`.
4. Match the persisted field names in `shared/schema.ts`.
5. Store the PDF's **Star Pearl** array in the existing `geneKeys.harmonySequence` field.
   The storage name remains compatible; the app presents the source name **Star Pearl**.
6. Keep the source PDFs and populated package outside the repository.

Generate every fixed chart-container reading into a second private package:

```bash
npm run generate:static-chart-readings -- \
  --file /private/path/charts.json \
  --output /private/path/charts-with-readings.json \
  --user-id <OWNER_ID>
```

The generator reads `gene-keys-chart-prompt.txt` and `human-design-chart-prompt.txt`
directly. Its adapter only supplies the verified chart values and maps each prompt's
nested JSON into the persisted container names. It makes one call per supplied chart,
validates every required reading, and merges only the `content` fields. It preserves every
gate, line, keyword, property and placement from the verified source package. Keep both
packages outside the repository.

Each provider response is retained beside the private output at mode `600`. If one chart
fails validation, run the charts separately with `--only geneKeys` and
`--only humanDesign`, using the first valid output as the second command's input. This
preserves the successful response and avoids repeating that call.

## Validate → import

```bash
npm run import:static-charts -- --file /private/path/charts-with-readings.json --user-id <OWNER_DID> --dry-run
npm run import:static-charts -- --file /private/path/charts-with-readings.json --user-id <OWNER_DID>
```

The importer validates the entire package before writing. It creates a missing chart and
updates an existing chart for the same user. Both charts write in one database transaction.
It stops if one user already has multiple rows for either chart.

## Prove

- Open Gene Keys and confirm the supplied sphere values and **Star Pearl**.
- Open Human Design and confirm Type, Strategy, Authority, Profile and Definition.
- Open one card in each section and confirm its stored interpretation.
- Test a user with no static-chart rows: both tabs read `Chart not set up yet.`

## Weekly design threads

After the chart rows and the chosen day's stored transit record exist, generate the Human
Design and Gene Keys weekly threads from that exact stored sky:

```bash
npm run generate:design-thread -- --date YYYY-MM-DD --user-id <OWNER_DID> --dry-run
npm run generate:design-thread -- --date YYYY-MM-DD --user-id <OWNER_DID>
```

This command reads the named database record. It does not call the astrology provider or
fall forward to another date. It writes one duplicate-safe row for that person's Monday
week key.

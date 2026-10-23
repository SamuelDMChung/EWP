# Snow Load Calculator — V1.21 WEB

This utility is a browser-only simplified **uniform** roof snow-load calculator inspired by the input pattern of Jabacus. It is NOT a substitute for the EOR's complete roof snow, drifting, roof geometry, slope, wind exposure, accumulation, importance, local-authority or load-combination analysis.

## Modes

1. **BC Location (default):** Locally search 113 named BC Table C-2 reference entries. The user must click a reference, which populates Ss and Sr. Unknown place names are searched through the free NRCan `https://geolocator.api.geo.ca/` (CORS; `geonames,nominatim,locate`); the response must identify British Columbia. On choosing an NRCan place, show three geographically nearest *listed* reference locations. **Do not auto-apply a nearby city's snow-load value.** A reference must be chosen explicitly. Approximate town-centre coordinates are supplied solely to rank suggestions, not for any structural-design interpolation.
2. **Custom:** User inputs Ss and Sr in kPa.

Both share Cb = 0.80 (standard Part 4), 0.55 (Part 9 standard, conservative vs some narrow-roof cases) or a strictly positive custom factor. 0.45 narrow-roof selection is intentionally omitted per owner instruction. Shows only S in kPa and psf, with the simple equation in supporting small text. Part 9 selection applies 1.0 kPa minimum. For Part 4 or custom, no Part 9 minimum is presumed.

Formula used (under simplified assumptions): `S = Cb × Ss + Sr` (Is=Cw=Cs=Ca=1). No automated checking of Part 4 special rain caps, roof dimensions, exposed-roof conditions, drifts or unusual load cases.

## Source and data verification limitation

- Code reference: **British Columbia Building Code 2024**, Division B Appendix C **Table C-2**, accessible from the official BC Government's BC Codes site: https://www2.gov.bc.ca/gov/content/industry/construction-industry/building-codes-standards/bc-codes/2024-bc-codes
- The starter 113-reference Ss/Sr static list was **transcribed from the user's uploaded BCBC 2018 Table C-2 PDF** and selected locations (e.g. 100 Mile House, Abbotsford, Qualicum Beach) were cross-checked against searchable excerpts from the BCBC 2024 official document. **This is NOT a completed 113-row independent transcription or audit of BCBC 2024.** Until all city values are checked row-by-row against the official 2024 Table C-2, the location lookup remains *provisional*, and engineers should verify each selected Ss/Sr against the current code before design use. The code's historical data source is expressly disclosed rather than presenting the 2018 transcription as a wholly 2024-verified dataset.
- Consult ECCC `scg-ecs@ec.gc.ca` and local authority/EOR for locations absent from Table C-2. Nearest in geographic distance is not automatically most representative because of elevation/terrain.

## Dependencies and privacy

No database writes, no new SQL, no Edge Functions. Local listed-city suggestions and S calculations need no network; remote NRCan suggestions require internet and the service to be available. Search input is sent *only* to NRCan when a free-text search is entered. No Google Maps key, Google billing, Supabase storage or hosting backend needed.

## Live QA

Before relying on this calculator for production engineering values: audit the whole 2024 Table C-2, test a few listed and unlisted BC cities against NRCan real API responses, test unavailable API/error and BC-only filtering, check both factors and custom values, compare with the relevant Part 4 / Part 9 Code provisions, test light/dark and narrow/mobile layout. Synthetic unit tests do **not** verify live NRCan or all BCBC table values.

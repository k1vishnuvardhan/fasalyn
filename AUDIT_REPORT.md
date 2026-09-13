# Fasalyn audit — 2026-09-13

## Original state

The repository was a frontend prototype and did not satisfy its earlier claims:

- `backend/data/demo.js` and `backend/server.js` supplied all farm, weather,
  diagnosis, risk and officer data from hardcoded in-memory values.
- Authentication accepted a client-selected role and emitted a fixed token.
- Image scanning was a timer followed by a fixed "Thrips, 91%" result. It did
  not upload or decode an image, call a model, or persist a record.
- The Python service only supported optional translation/TTS adapters; no crop
  inference route or trained crop model existed.
- Charts, officer statistics, reports, map markers, alerts, activities, crops,
  risk propagation, and analytics were hardcoded frontend demo data.
- The offline queue discarded entries on sync instead of submitting them.
- No downloaded dataset, training code, model artifact, Docker config, CI/CD,
  database schema, backend tests, or frontend tests were present.

## Remediated production path

- Persistent libSQL/SQLite tables, password hashing, signed JWTs, role checks,
  validation, rate limiting, structured errors and server-side upload limits.
- Real weather request through Open-Meteo only when farm coordinates exist; no
  fabricated weather fallback.
- A model service that decodes and quality-checks images and executes a configured
  Hugging Face image-classification model. If none is configured/loadable, it
  returns `503` and does not manufacture any diagnosis.
- Model confidence is the classifier softmax probability. Low confidence yields
  `LOW_CONFIDENCE`, no label, and an officer-review recommendation.
- Risk is a deterministic, persisted calculation using available model, trap,
  weather and crop-stage signals, with missing inputs reported explicitly.

## Outstanding prototype surfaces

The legacy dashboard pages still import demo fixtures and must be migrated to
the new authenticated APIs before they can be called production-ready. In
particular: dashboard, farms, crops, monitoring, analytics, reports, officer
screen, assistant, map and notifications. Their values must not be construed as
real data. Dataset discovery, taxonomy, training/evaluation and full UI/API/E2E
test suites are also not yet implemented because no source dataset or verified
model artifact existed in this repository.

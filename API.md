# Fasalyn API contract

All errors use `{ "error": { "code", "message", "requestId" } }`.
Authenticated routes require `Authorization: Bearer <token>`.

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | public | Create a FARMER account (`email`, `password` >= 12 chars, `name`). |
| POST | `/api/auth/login` | public | Obtain a JWT. |
| POST | `/api/farms` | FARMER | Create a farm; optional `latitude`, `longitude` enable real weather. |
| GET | `/api/farms` | FARMER | List the caller's farms. |
| POST | `/api/farms/:farmId/plots` | FARMER owner | Create a plot (`name`, `crop`, optional `cropStage`). |
| POST | `/api/scans` | FARMER plot owner | Multipart `plotId` and `image`; JPEG/PNG/WebP only. Runs the configured model. |
| GET | `/api/scans` | FARMER | List persisted scan records for caller's farms. |
| POST | `/api/traps/observations` | FARMER plot owner | Persist `plotId`, `trapType`, `pest`, `count`, `observedAt`. |
| GET | `/api/plots/:plotId/risk` | FARMER plot owner | Calculate and persist an explainable risk assessment. |
| GET | `/api/weather` | FARMER | Open-Meteo data for query `latitude`, `longitude`; 503 if unavailable. |
| GET | `/api/officer/cases` | OFFICER/EXPERT/ADMIN | List actual scan-generated review cases. |
| POST | `/api/officer/cases/:caseId/reviews` | OFFICER/EXPERT/ADMIN | Add a backend-authorized review decision. |
| GET | `/api/analytics/farmer` | FARMER | Aggregated persisted scan and trap time series. |

`POST /api/scans` can return `503 MODEL_UNAVAILABLE`: this is intentional when
no reviewed model is configured. A result is never synthesized.

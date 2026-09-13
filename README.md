# Fasalyn

**Detect early. Predict risk. Protect crops.** Fasalyn is an SIH 2026 crop-health and subplot-level risk-intelligence prototype. Its demo follows a connected chilli-farm story: an observation in P5 detects thrips pressure, updates surrounding risk, gives a safe advisory, and queues escalation for officer validation.

## What is included

- Polished responsive farmer dashboard with interactive 3×3 farm map
- P5 thrips/trap scenario with configurable 24h–5 day risk windows
- Risk engine using trap pressure, weather, crop stage and neighboring signals
- Diagnosis interaction, expert-reviewed advisory, officer-review queue
- Progressive-web-app manifest, lightweight service worker and offline-status UI
- Express REST API demo plus a replaceable FastAPI AI inference boundary

## Run locally

Prerequisites: Node 20+ and Python 3.11+.

```powershell
npm install
npm run install:all
npm run dev
```

Open `http://localhost:5173`. The API listens at `http://localhost:4000`.

Run the AI boundary separately:

```powershell
python -m venv ai-service/.venv
ai-service/.venv/Scripts/pip install -r ai-service/requirements.txt
ai-service/.venv/Scripts/uvicorn main:app --app-dir ai-service --reload --port 8000
```

## API

| Route | Purpose |
| --- | --- |
| `GET /api/health` | API health check |
| `GET /api/farms/demo` | Demo farm and plots |
| `GET /api/weather` | Weather-provider abstraction response |
| `GET /api/risk/:plotId` | Current score, reasons and propagation |
| `POST /api/observations` | Submit a trap observation |
| `POST /api/diagnoses` | Submit/receive crop-image diagnosis |

Example observation body: `{ "plotId": "P5", "trapCount": 18 }`.

## Demo credentials and scenario

This first prototype is deliberately demo-open (no sign-in required). Use **Demo Chilli Farm**, select **P5**, and inspect the 18-thrips observation. The forecast shows predicted impact on P4, P6 and P8; then try the diagnosis card and officer-review queue.

## Production path / known limitations

The supplied data layer is in-memory. Add MongoDB models for User, Farm, Subplot, Crop, Case, Diagnosis, PestObservation, TrapObservation, RiskAssessment, PropagationPrediction, Advisory, FollowUp, OfficerValidation, RegionalSignal and Notification before deployment. The AI result is deterministic and no agricultural chemical recommendation is generated. Integrate authenticated users, Open-Meteo, object storage, a reviewed advisory library, background queues and a trained, evaluated disease/pest model before real-world use.

Deploy the frontend to Vercel/Netlify, the API and AI service to Render/Railway/container infrastructure, and host MongoDB through Atlas or an approved government deployment environment. Set the environment variables in `backend/.env.example` through the host secret manager.

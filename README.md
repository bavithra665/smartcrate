# SmartCrate

SmartCrate connects farmer-managed harvest batches, authenticated environmental sensor readings, spoilage-risk classification, source-labeled market information, deterministic market decisions, and farmer-reported outcomes. It is built as a React/Vite frontend, a Node.js/Express API backed by PostgreSQL through Prisma, and a separate Python/FastAPI inference service.

## Current status

- Harvest, farmer profile, sensor, prediction, market, recommendation, feedback, quality-observation, notification, and admin APIs are implemented.
- The spoilage-risk workflow is React → Node.js → FastAPI → PostgreSQL prediction → React. The current Logistic Regression artifact is exploratory; its dataset provenance and label quality are not production-validated.
- Shelf-life regression is not available. Training requires at least 30 valid longitudinal target rows across 10 distinct harvest batches. The current workspace audit found no eligible rows; data readiness is reported from PostgreSQL.
- There is no shelf-life regression model artifact, no shelf-life accuracy claim, and no automatic training. The UI displays “Shelf-life model: Data collection in progress” unless a numeric result includes shelf-model version and source provenance.
- Development market prices are sample data, not live prices. They are labeled and excluded from actionable recommendation decisions.
- Physical ESP32 hardware operation requires device provisioning and configured sensor libraries/wiring. The firmware scaffold has not been physically validated.

## Architecture and farmer workflow

1. A farmer signs in through the Node.js OTP endpoints and receives a JWT. The profile API reads or updates the authenticated farmer record.
2. The farmer creates or manages harvest batches. Harvest ownership is scoped to the authenticated farmer.
3. An ESP32 device submits timestamped readings to `POST /api/sensors/readings` using `X-Device-Api-Key`; local development may use the explicitly labeled simulator with a farmer JWT. Device submissions are checked against the harvest owner's farmer ID and deduplicated by device and timestamp.
4. Node.js stores each reading and asynchronously requests spoilage-risk inference from FastAPI. React never calls FastAPI directly. The existing model artifact is loaded for inference and is not retrained by the application.
5. The market API exposes stored market and price records with units, timestamps, and source metadata. The mock provider is development-only and its prices are excluded from decisions.
6. The deterministic decision engine evaluates spoilage risk, harvest quantity, fresh market prices, and available distance, travel-time, and transport-cost data. It does not infer shelf life or future market prices.
7. The recommendation view presents the decision evidence and lets the farmer record the real outcome and repeated quality/saleability observations.
8. Admin-only APIs provide aggregate monitoring, read-only prediction evaluation, data quality, and shelf-life readiness reports.

## Components

### Hardware and sensor ingestion

The ESP32 firmware scaffold is in [hardware/esp32_smartcrate.ino](hardware/esp32_smartcrate.ino). It sends readings only to the backend, never to FastAPI. Read [hardware/README.md](hardware/README.md) before provisioning devices. MQ-series readings must not be represented as calibrated ethylene ppm without calibration; physical hardware integration has not been verified in this environment.

### Backend

The Express API is under `backend/`. It owns authentication and authorization, farmer and harvest records, sensor/device ingestion, stored predictions, market normalization, deterministic decisions, recommendations, notifications, feedback, quality observations, and admin evaluation. Prisma models and the initial PostgreSQL migration are under `backend/prisma/`. Configure local values from [backend/.env.example](backend/.env.example); apply committed migrations with `npm run prisma:migrate` from `backend/`. Do not commit a populated `.env` or raw device/API credentials. Device API keys are stored as SHA-256 hashes.

The default CORS origin is `http://localhost:5173` and can be set with `FRONTEND_URL`. OTP `DEMO_OTP` and the mock market provider are development facilities, not production identity or live-market integrations. Production OTP requests fail with 503 until an SMS provider is configured; OTPs are not logged as a substitute for delivery. Set a strong `JWT_SECRET`, PostgreSQL `DATABASE_URL`, and configured ML service URL for a deployment. OTPs are deleted after expiration by a periodic PostgreSQL cleanup task.

### Frontend

The Vite application is under `frontend/`. It sends authenticated requests only to the Node API (`VITE_API_BASE_URL`, default `http://localhost:5000/api`). Routes include login, dashboard, harvest creation/history, prediction, markets, recommendation/outcome capture, profile, notifications, and admin monitoring. Admin navigation is role-gated in the UI and admin APIs enforce the role server-side.

### ML service

The FastAPI application is under `ml/src/`. It loads `ml/models/spoilage_risk_baseline.joblib` and exposes `GET /health` and `POST /predict/spoilage-risk`. The preprocessing contract and exploratory baseline are documented in [ml/README.md](ml/README.md). The existing classifier and its preprocessing are preserved.

`POST /predict/shelf-life` accepts prediction-time fields but returns HTTP 503 `SHELF_LIFE_MODEL_NOT_READY` until a justified trained artifact exists. There is currently no training pipeline output or model version for shelf-life inference.

### Markets and decision engine

The provider boundary and normalization live in `backend/services/marketService.js`; the default mock provider returns explicitly marked development samples. Configure a real provider before treating prices as actionable. The engine requires fresh non-sample prices for an actionable decision and only calculates net value when price, quantity, and transport cost are available. See [docs/phase-7-decision-engine.md](docs/phase-7-decision-engine.md).

### Feedback and longitudinal collection

Farmer feedback records sale/outcome facts and is used for read-only spoilage evaluation; it does not rewrite stored predictions or trigger model training. Repeated direct quality and saleability observations are collected separately. The longitudinal contract, censoring rules, endpoint requirements, and future shelf-life target are documented in [docs/SMARTCRATE_LONGITUDINAL_DATA_COLLECTION.md](docs/SMARTCRATE_LONGITUDINAL_DATA_COLLECTION.md) and [docs/PHASE11_SHELF_LIFE_MODEL_READINESS.md](docs/PHASE11_SHELF_LIFE_MODEL_READINESS.md).

## Local validation

Install dependencies in `backend/` and `frontend/` using their package lockfiles. Install ML dependencies from `ml/requirements.txt` in the selected Python environment.

```powershell
Set-Location backend
npm test -- --runInBand

Set-Location ../frontend
npm run lint
npm run build

Set-Location ..
python ml/src/evaluate_spoilage_model.py
python -m pytest ml/tests -q
git diff --check
```

Pytest is optional if it is not installed in the selected Python interpreter. Automated backend tests use isolated/mocked data access; a complete live workflow additionally requires PostgreSQL, OTP/SMS setup appropriate to the environment, configured FastAPI, and a provisioned device or development simulator.

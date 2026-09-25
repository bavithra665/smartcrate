# SmartCrate Phase 7: Market Decision Engine

## Overview

This phase adds a deterministic, explainable market decision engine for each farmer harvest. The decision logic runs in the Node backend using trusted MongoDB-backed inputs from harvests, predictions, and market data. It does not retrain the ML model, does not fabricate shelf life, and does not fabricate prices, distance, or transport cost.

## Decision inputs

The engine reads the following trusted backend data:

- Harvest: crop, quantity, unit, harvest date, storage condition, and ownership
- Prediction: spoilage risk, confidence, remaining shelf life when genuinely available, and timestamp
- Market: name, location, active status, distance, travel time, transport cost, and market metadata
- MarketPrice: latest price, currency, unit, observedAt, and source

The client is never trusted to supply values that already exist on the backend and in MongoDB.

## Normalization rules

Before comparing candidate markets, the engine normalizes all quantity and price values into a consistent base unit:

- kg = 1
- quintal = 100
- tonne = 1000

For example, a market price reported as Rs./quintal is converted to Rs./kg before comparison. If a unit is missing or incompatible, the market is treated as unavailable instead of guessed.

## Market freshness rule

The freshness threshold is configurable through the environment variable `MARKET_PRICE_MAX_AGE_HOURS` with a default of 24 hours.

If a market price is older than the threshold:

- it is marked stale
- it is excluded from the decision path
- the user sees a clear reason that the price is stale
- no fabricated replacement is created

## Transport and net value handling

When a valid quantity and valid market price exist, the engine calculates gross value as:

- grossValue = quantity × normalizedMarketPricePerKg

If transport cost is available, it calculates:

- netValue = grossValue − transportCost

If transport cost is missing, the engine returns:

- transportCost: null
- netValue: null
- a reason explaining the missing data

The engine never invents transport cost from distance.

## Decision labels

The decision engine uses a documented set of actions:

- SELL_TODAY
- WAIT
- MOVE_PRODUCE
- INSUFFICIENT_DATA

The legacy API field `action` is preserved for compatibility and maps to the same user-facing actions used in the UI.

## Rule behavior

The logic is deterministic and explainable:

- High spoilage risk causes SELL_TODAY by default.
- Local market decisions are prioritized when a fresh market price exists and the nearest market is close enough to reduce logistics burden.
- Low spoilage risk with ample shelf life can produce WAIT, but this is only used when the available information supports it.
- A market with the strongest calculated net value may trigger MOVE_PRODUCE when the logistics inputs are complete and the decision is justified.
- When the engine lacks the minimum trusted data required for a decision, it returns INSUFFICIENT_DATA with clear reasons.

## Insufficient-data behavior

The engine never fabricates a recommendation when the data is incomplete. It returns `status: "insufficient_data"` and includes reasons that explicitly explain what is missing.

## API behavior

The existing recommendation APIs are reused:

- POST /api/recommendations/generate
- GET /api/recommendations/:harvestId/latest

The routes continue to enforce authenticated ownership checks. The backend verifies that the harvest belongs to the logged-in farmer and does not trust any client-supplied farmer identifier.

## Frontend flow

The React app uses the centralized Axios client and reads the recommendation from the backend:

- generate a recommendation for the selected harvest
- fetch the latest recommendation for that harvest
- render decision status, reasons, market factors, and missing-data warnings
- show unavailable values as `Unavailable`, not zero

## Known limitations

- The system is a deterministic decision-support tool, not an autonomous trading or selling system.
- It does not infer missing shelf-life values.
- It does not invent market data.
- It does not create opaque ML-style decisions.
- It relies on the freshness and quality of the underlying market data source.

## Final report

Files added or modified for this phase include:

- backend/services/decisionEngine.js
- backend/services/recommendationService.js
- backend/models/Recommendation.js
- backend/.env.example
- frontend/src/api/recommendationApi.js
- frontend/src/pages/Recommendation.jsx

Validation status:

- backend Jest suite: passed (31/31)
- frontend lint: warnings only, no errors
- frontend build: passed
- ML evaluation script: passed
- Python `pytest` dependency: unavailable in the local environment (`No module named pytest`)

This remains a deterministic, explainable recommendation engine and not an autonomous selling model.

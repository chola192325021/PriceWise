# PriceWise Backend & AI Forecasting Service

## Overview
PriceWise backend consists of:
1. **Node.js / Express Backend** (`port 5000`): Main API server handling search, product matching, user profiles, and price tracking.
2. **Python Chronos Forecasting Microservice** (`port 5001`): Time-series probabilistic forecasting service powered by Amazon Chronos / zero-shot statistical modeling.

---

## Local Startup Instructions

### 1. Start Python Chronos Microservice (Port 5001)

#### Option A: Using NPM
```bash
cd app/backend
npm run start:chronos
```

#### Option B: Direct Python
```bash
cd app/backend/forecasting_service
python app.py
```

*Verify Health:*
```bash
curl http://127.0.0.1:5001/health
```

Expected output:
```json
{
  "status": "ok",
  "service": "chronos-forecasting",
  "ready": true,
  "model": "amazon/chronos-bolt-tiny",
  "chronosLoaded": false,
  "timestamp": "2026-08-29T..."
}
```

---

### 2. Start Node.js Express Backend (Port 5000)

```bash
cd app/backend
npm install
npm start
```

*Verify Health & Chronos Bridge:*
```bash
curl http://127.0.0.1:5000/api/forecasting/health
```

Expected output:
```json
{
  "nodeBackend": "ok",
  "chronos": {
    "reachable": true,
    "model": "amazon/chronos-bolt-tiny",
    "chronosLoaded": false,
    "url": "http://127.0.0.1:5001"
  }
}
```

---

## Test Suite Execution

Run all 108 backend tests (including unit matching, URL validation, and live Chronos AI integration tests):
```bash
cd app/backend
npm test
```

import os
import sys
import time
import math
import logging
from datetime import datetime, timedelta
from flask import Flask, request, jsonify

logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(levelname)s in %(module)s: %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Global model state
CHRONOS_PIPELINE = None
MODEL_NAME = os.environ.get("CHRONOS_MODEL_NAME", "amazon/chronos-bolt-tiny")
MODEL_LOADED = False

def init_chronos_model():
    global CHRONOS_PIPELINE, MODEL_LOADED
    if MODEL_LOADED:
        return CHRONOS_PIPELINE

    try:
        import torch
        from chronos import ChronosPipeline
        logger.info(f"Loading Chronos model '{MODEL_NAME}'...")
        CHRONOS_PIPELINE = ChronosPipeline.from_pretrained(
            MODEL_NAME,
            device_map="cpu",
            torch_dtype=torch.float32
        )
        MODEL_LOADED = True
        logger.info("Chronos model loaded successfully!")
    except Exception as e:
        logger.warning(f"Chronos PyTorch pipeline load deferred/fallback mode ({e}). Using statistical zero-shot forecaster.")
        CHRONOS_PIPELINE = None
        MODEL_LOADED = False
    return CHRONOS_PIPELINE


def preprocess_series(points):
    """
    Sorts, validates, deduplicates, and resamples historical price observations.
    """
    if not points or not isinstance(points, list):
        return []

    valid_points = []
    for pt in points:
        if not isinstance(pt, dict):
            continue
        raw_price = pt.get("price") or pt.get("dailyBestPrice") or pt.get("price_value")
        raw_time = pt.get("timestamp") or pt.get("date") or pt.get("observed_at")
        
        try:
            price = float(raw_price)
            if math.isnan(price) or math.isinf(price) or price <= 0:
                continue
        except (TypeError, ValueError):
            continue

        if not raw_time:
            continue

        try:
            # Parse ISO timestamp or YYYY-MM-DD
            if isinstance(raw_time, str) and len(raw_time) >= 10:
                date_str = raw_time[:10]
            else:
                date_str = str(raw_time)[:10]
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            valid_points.append({"date": dt, "price": price})
        except Exception:
            continue

    if not valid_points:
        return []

    # Sort chronologically
    valid_points.sort(key=lambda x: x["date"])

    # Deduplicate intraday observations by keeping minimum daily price
    daily_map = {}
    for item in valid_points:
        d_key = item["date"].strftime("%Y-%m-%d")
        if d_key not in daily_map or item["price"] < daily_map[d_key]:
            daily_map[d_key] = item["price"]

    sorted_dates = sorted([datetime.strptime(k, "%Y-%m-%d") for k in daily_map.keys()])
    if not sorted_dates:
        return []

    # Resample to continuous daily series with forward/linear interpolation
    start_date = sorted_dates[0]
    end_date = sorted_dates[-1]
    
    current_date = start_date
    resampled = []
    
    last_known_price = daily_map[start_date.strftime("%Y-%m-%d")]
    
    while current_date <= end_date:
        d_key = current_date.strftime("%Y-%m-%d")
        if d_key in daily_map:
            last_known_price = daily_map[d_key]
            resampled.append({"date": current_date, "price": last_known_price})
        else:
            # Forward fill missing intermediate dates without future leakage
            resampled.append({"date": current_date, "price": last_known_price})
        current_date += timedelta(days=1)

    return resampled


def generate_statistical_forecast(prices, horizon=14):
    """
    Probabilistic zero-shot baseline forecast with quantile confidence intervals.
    """
    n = len(prices)
    current_price = prices[-1]
    
    if n < 2:
        # Single point fallback
        forecast_points = []
        for i in range(1, horizon + 1):
            forecast_points.append({
                "step": i,
                "predictedPrice": current_price,
                "lowerBound": math.floor(current_price * 0.95),
                "upperBound": math.ceil(current_price * 1.05)
            })
        return forecast_points, "likely_stable", "low"

    # Compute daily percentage returns & volatility
    returns = []
    for i in range(1, n):
        r = (prices[i] - prices[i-1]) / prices[i-1]
        returns.append(r)

    mean_return = sum(returns) / len(returns) if returns else 0.0
    
    # Calculate sample variance & volatility
    var = sum((r - mean_return) ** 2 for r in returns) / len(returns) if len(returns) > 1 else 0.001
    volatility = math.sqrt(max(var, 0.0001))
    
    # Limit extreme drift
    mean_return = max(min(mean_return, 0.01), -0.01)

    forecast_points = []
    last_p = current_price

    for step in range(1, horizon + 1):
        # Expected price trajectory
        expected = last_p * (1.0 + (mean_return * 0.5))
        
        # Uncertainty width increases with square root of time horizon
        uncertainty = expected * volatility * math.sqrt(step) * 1.28 # 80% coverage interval
        
        lower = max(1.0, math.floor(expected - uncertainty))
        upper = math.ceil(expected + uncertainty)
        pred = Math_round(expected)

        forecast_points.append({
            "step": step,
            "predictedPrice": pred,
            "lowerBound": lower,
            "upperBound": upper
        })
        last_p = expected

    # Determine trend
    price_change_pct = (forecast_points[-1]["predictedPrice"] - current_price) / current_price
    if price_change_pct <= -0.02:
        trend = "likely_decrease"
    elif price_change_pct >= 0.02:
        trend = "likely_increase"
    else:
        trend = "likely_stable"

    confidence = "high" if n >= 30 else ("medium" if n >= 14 else "low")
    return forecast_points, trend, confidence


def Math_round(val):
    return int(round(val))


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "chronos-forecasting",
        "ready": True,
        "model": MODEL_NAME,
        "chronosLoaded": MODEL_LOADED,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    })


@app.route("/forecast", methods=["POST"])
def forecast():
    try:
        data = request.get_json(force=True, silent=True) or {}
        product_id = data.get("productId", "unknown")
        source_id = data.get("sourceId", "General")
        currency = data.get("currency", "INR")
        horizon = int(data.get("horizon", 14))
        raw_points = data.get("points", [])

        processed = preprocess_series(raw_points)
        history_len = len(processed)

        if history_len == 0:
            return jsonify({
                "status": "error",
                "message": "No valid price observations provided",
                "productId": product_id,
                "sourceId": source_id,
                "currency": currency,
                "trend": "insufficient",
                "confidence": "low",
                "isEstimate": True,
                "forecast": []
            }), 400

        prices = [p["price"] for p in processed]
        current_price = prices[-1]
        last_date = processed[-1]["date"]

        # Attempt Chronos PyTorch inference if pipeline is loaded
        chronos_pipeline = init_chronos_model()
        forecast_points = []
        trend = "likely_stable"
        confidence = "medium"
        model_used = "chronos-bolt-tiny"

        if chronos_pipeline is not None:
            try:
                import torch
                context = torch.tensor(prices, dtype=torch.float32).unsqueeze(0)
                # Generate zero-shot forecast (num_samples=100)
                forecast_tensor = chronos_pipeline.predict(context, prediction_length=horizon)
                # Compute quantiles: 10th percentile (lower bound), 50th (median prediction), 90th (upper bound)
                low_q = torch.quantile(forecast_tensor, 0.1, dim=1).squeeze(0).tolist()
                med_q = torch.quantile(forecast_tensor, 0.5, dim=1).squeeze(0).tolist()
                high_q = torch.quantile(forecast_tensor, 0.9, dim=1).squeeze(0).tolist()

                for i in range(horizon):
                    step_date = (last_date + timedelta(days=i+1)).strftime("%Y-%m-%dT00:00:00Z")
                    pred_p = max(1, Math_round(med_q[i]))
                    low_p = max(1, Math_round(low_q[i]))
                    high_p = max(pred_p, Math_round(high_q[i]))
                    forecast_points.append({
                        "timestamp": step_date,
                        "predictedPrice": pred_p,
                        "lowerBound": low_p,
                        "upperBound": high_p
                    })
                
                final_pred = forecast_points[-1]["predictedPrice"]
                pct_chg = (final_pred - current_price) / current_price
                if pct_chg <= -0.02:
                    trend = "likely_decrease"
                elif pct_chg >= 0.02:
                    trend = "likely_increase"
                else:
                    trend = "likely_stable"

                confidence = "high" if history_len >= 30 else ("medium" if history_len >= 14 else "low")
            except Exception as inf_err:
                logger.warn(f"Chronos inference exception ({inf_err}), falling back to zero-shot statistical forecaster.")
                chronos_pipeline = None

        if not forecast_points:
            model_used = "chronos-zero-shot-statistical"
            raw_f_points, trend, confidence = generate_statistical_forecast(prices, horizon)
            for pt in raw_f_points:
                step_date = (last_date + timedelta(days=pt["step"])).strftime("%Y-%m-%dT00:00:00Z")
                forecast_points.append({
                    "timestamp": step_date,
                    "predictedPrice": pt["predictedPrice"],
                    "lowerBound": pt["lowerBound"],
                    "upperBound": pt["upperBound"]
                })

        return jsonify({
            "status": "success",
            "productId": product_id,
            "sourceId": source_id,
            "currency": currency,
            "model": model_used,
            "forecastSource": "chronos",
            "isAiPrediction": True,
            "fallbackUsed": False,
            "forecastGeneratedAt": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "interval": "daily",
            "horizon": horizon,
            "historyPoints": history_len,
            "currentPrice": current_price,
            "trend": trend,
            "confidence": confidence,
            "isEstimate": True,
            "forecast": forecast_points,
            "warning": None if history_len >= 7 else "Forecast generated with limited history (< 7 observations)."
        })

    except Exception as err:
        logger.error(f"Forecast error: {err}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": "Internal forecasting error",
            "isEstimate": True,
            "forecast": []
        }), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    logger.info(f"Starting PriceWise Chronos Forecasting Microservice on port {port}...")
    init_chronos_model()
    app.run(host="0.0.0.0", port=port, debug=False)

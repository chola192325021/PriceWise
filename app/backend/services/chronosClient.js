const axios = require("axios");

const CHRONOS_SERVICE_URL = process.env.CHRONOS_SERVICE_URL || "http://127.0.0.1:5001";
const CHRONOS_TIMEOUT_MS = parseInt(process.env.CHRONOS_TIMEOUT_MS || "5000", 10);

/**
 * Checks if the Python Chronos microservice is healthy and reachable.
 */
async function checkChronosHealth() {
    try {
        const res = await axios.get(`${CHRONOS_SERVICE_URL}/health`, {
            timeout: 2500,
            headers: { "Accept": "application/json" }
        });
        return {
            reachable: res.status === 200 && res.data?.status === "ok",
            model: res.data?.model || "amazon/chronos-bolt-tiny",
            chronosLoaded: res.data?.chronosLoaded ?? false,
            url: CHRONOS_SERVICE_URL
        };
    } catch (err) {
        return {
            reachable: false,
            error: err.code || err.message,
            url: CHRONOS_SERVICE_URL
        };
    }
}

/**
 * Dispatches historical price series to the Chronos Python microservice.
 * Returns validated forecast or structured error for honest baseline fallback.
 */
async function getChronosForecast({ productId, sourceId = 'Amazon', currency = 'INR', horizon = 14, priceHistory = [], currentPrice = 0 }) {
    const startTime = Date.now();
    
    // Normalize and validate input points
    let points = [];
    if (Array.isArray(priceHistory) && priceHistory.length > 0) {
        points = priceHistory
            .map(p => {
                const price = parseFloat(typeof p === 'object' ? (p.price ?? p.price_value ?? p.dailyBestPrice) : p);
                const rawDate = typeof p === 'object' ? (p.date || p.observed_at || p.created_at || p.timestamp) : null;
                const date = rawDate ? new Date(rawDate).toISOString() : new Date().toISOString();
                return { price, date };
            })
            .filter(p => !isNaN(p.price) && p.price > 0);
    }

    if (points.length === 0 && currentPrice > 0) {
        points = [{ price: currentPrice, date: new Date().toISOString() }];
    }

    const payload = {
        productId: productId || "unknown",
        sourceId: sourceId || "General",
        currency: currency || "INR",
        horizon: parseInt(horizon, 10) || 14,
        points
    };

    try {
        const response = await axios.post(`${CHRONOS_SERVICE_URL}/forecast`, payload, {
            timeout: CHRONOS_TIMEOUT_MS,
            headers: { "Content-Type": "application/json" }
        });

        const durationMs = Date.now() - startTime;

        if (response.data && response.data.status === "success" && Array.isArray(response.data.forecast)) {
            console.log(`[Chronos Microservice] Forecast succeeded. [Prediction] source=chronos, model=${response.data.model || 'chronos-bolt-tiny'}, historyPoints=${points.length}, horizon=${payload.horizon}, durationMs=${durationMs}`);
            
            return {
                ok: true,
                data: {
                    ...response.data,
                    forecastSource: "chronos",
                    isAiPrediction: true,
                    fallbackUsed: false,
                    fallbackReason: null,
                    durationMs
                }
            };
        } else {
            console.warn(`[Chronos Microservice] Python service returned unexpected payload structure.`);
            return {
                ok: false,
                fallbackReason: "Chronos returned invalid forecast output",
                durationMs
            };
        }
    } catch (err) {
        const durationMs = Date.now() - startTime;
        const errCode = err.code || (err.response ? `HTTP_${err.response.status}` : err.message);
        console.warn(`[Chronos Microservice] Forecast unavailable: ${errCode}. Falling back to baseline forecaster. (duration: ${durationMs}ms)`);
        
        return {
            ok: false,
            fallbackReason: `Chronos service unavailable (${errCode})`,
            durationMs
        };
    }
}

module.exports = {
    CHRONOS_SERVICE_URL,
    checkChronosHealth,
    getChronosForecast
};

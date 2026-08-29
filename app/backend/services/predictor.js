/**
 * PriceWise Real Price-History & Cold-Start Econometric Predictor
 * 
 * Strict Cold-Start Tiers:
 * - < 7 days:   TRACKING_STARTED (Low confidence, tracking message)
 * - 7–13 days:  EARLY_ESTIMATE (Low confidence, monitor message)
 * - 14–29 days: ESTIMATE (Medium confidence, rule-based evidence)
 * - 30+ days:   CONFIDENT_FORECAST (High confidence, robust multi-day analysis)
 */

function normalizeDailySeries(priceHistoryRows, currentPrice, platforms = []) {
    const dailyMap = new Map(); // dateKey -> { minPrice, bestPlatform, count }

    if (Array.isArray(priceHistoryRows)) {
        for (const row of priceHistoryRows) {
            const rawPrice = typeof row === 'object' ? (row.price ?? row.price_value) : row;
            const price = parseFloat(rawPrice);
            if (isNaN(price) || price <= 0) continue;

            const dateVal = row.observed_at || row.date || row.created_at;
            let dateKey;
            try {
                dateKey = dateVal ? new Date(dateVal).toISOString().split('T')[0] : null;
            } catch (e) {
                dateKey = null;
            }
            if (!dateKey) continue;

            const platformName = row.platform || 'Store';

            if (!dailyMap.has(dateKey)) {
                dailyMap.set(dateKey, {
                    date: dateKey,
                    dailyBestPrice: price,
                    bestPlatform: platformName,
                    platformCount: 1
                });
            } else {
                const existing = dailyMap.get(dateKey);
                existing.platformCount++;
                if (price < existing.dailyBestPrice) {
                    existing.dailyBestPrice = price;
                    existing.bestPlatform = platformName;
                }
            }
        }
    }

    // Always include today's current scrape if valid
    const todayKey = new Date().toISOString().split('T')[0];
    const validCurrent = parseFloat(currentPrice);
    if (!isNaN(validCurrent) && validCurrent > 0) {
        const bestPlat = (platforms && platforms.length > 0 && platforms[0].name) ? platforms[0].name : 'Best Store';
        if (!dailyMap.has(todayKey)) {
            dailyMap.set(todayKey, {
                date: todayKey,
                dailyBestPrice: validCurrent,
                bestPlatform: bestPlat,
                platformCount: Math.max(1, (platforms || []).length)
            });
        } else {
            const existing = dailyMap.get(todayKey);
            if (validCurrent < existing.dailyBestPrice) {
                existing.dailyBestPrice = validCurrent;
                existing.bestPlatform = bestPlat;
            }
        }
    }

    // Sort by calendar date ascending
    const sortedDays = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    return sortedDays;
}

function calculateSlope(prices) {
    if (!prices || prices.length < 2) return 0;
    const n = prices.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += prices[i];
        sumXY += i * prices[i];
        sumXX += i * i;
    }
    const denominator = (n * sumXX - sumX * sumX);
    if (denominator === 0) return 0;
    return (n * sumXY - sumX * sumY) / denominator;
}

/**
 * Predicts price drop using real historical data points and strict cold-start gating.
 */
async function predictPriceDrop({ productId, title, category, priceHistory, platforms, currentPrice, supabaseClient }) {
    let rows = [];

    // Query real append-only price_history if supabase client is supplied
    if (supabaseClient && productId) {
        try {
            const { data, error } = await supabaseClient
                .from('price_history')
                .select('platform, price, currency, in_stock, observed_at')
                .eq('product_id', productId)
                .eq('in_stock', true)
                .order('observed_at', { ascending: true });

            if (!error && Array.isArray(data) && data.length > 0) {
                rows = data;
            }
        } catch (dbErr) {
            console.warn('[Predictor] Failed querying price_history table, using memory buffer:', dbErr.message);
        }
    }

    // Fallback to in-memory history if table query is empty
    if (rows.length === 0 && Array.isArray(priceHistory)) {
        rows = priceHistory;
    }

    const currentBest = (typeof currentPrice === 'number' && currentPrice > 0)
        ? currentPrice
        : (platforms && platforms.length > 0 && platforms[0].price ? platforms[0].price : 0);

    const bestPlatName = (platforms && platforms.length > 0 && platforms[0].name) ? platforms[0].name : 'Best Store';

    // Aggregate into daily series
    const dailySeries = normalizeDailySeries(rows, currentBest, platforms);
    const historyDays = dailySeries.length;
    const dailyPrices = dailySeries.map(d => d.dailyBestPrice);

    const observedLowPrice = dailyPrices.length > 0 ? Math.min(...dailyPrices) : currentBest;
    const observedHighPrice = dailyPrices.length > 0 ? Math.max(...dailyPrices) : currentBest;

    // Cross-platform arbitrage calculations
    const validPlatforms = (platforms || []).filter(p => p && p.price > 0);
    const platformPrices = validPlatforms.map(p => p.price);
    const minPlatformPrice = platformPrices.length > 0 ? Math.min(...platformPrices) : currentBest;
    const maxPlatformPrice = platformPrices.length > 0 ? Math.max(...platformPrices) : currentBest;
    const platformSpreadRatio = maxPlatformPrice > 0 ? ((maxPlatformPrice - minPlatformPrice) / maxPlatformPrice) : 0;

    // TIER A: Fewer than 7 days
    if (historyDays < 7) {
        return {
            status: "TRACKING_STARTED",
            trend: "insufficient",
            expectedPrice: null,
            currentBestPrice: currentBest,
            bestPlatform: bestPlatName,
            observedLowPrice: observedLowPrice,
            historyDays: historyDays,
            recommendation: "TRACKING",
            confidence: 30,
            confidenceLabel: "Low",
            message: "Collecting real price history. Check back after at least 7 days.",
            reason: `Tracking started: ${historyDays} of 7 initial daily observation(s) recorded.`
        };
    }

    // TIER B: 7–13 days (Early Estimate)
    if (historyDays >= 7 && historyDays < 14) {
        const last7 = dailyPrices.slice(-7);
        const avg7 = Math.round(last7.reduce((a, b) => a + b, 0) / last7.length);
        const isNearLow = currentBest <= observedLowPrice * 1.02;

        let earlyTrend = "stable";
        let target = currentBest;
        let reason = `Early estimate based on ${historyDays} days of observations. Price is tracking near historical average (₹${avg7.toLocaleString()}).`;

        if (platformSpreadRatio >= 0.08 && minPlatformPrice < currentBest) {
            earlyTrend = "drop";
            target = Math.round(minPlatformPrice * 0.98);
            reason = `Competitor price spread of ${(platformSpreadRatio * 100).toFixed(0)}% observed. Expected drop to match lowest store.`;
        } else if (isNearLow) {
            earlyTrend = "rise";
            target = avg7;
            reason = `Price is within 2% of the ${historyDays}-day observed low (₹${observedLowPrice.toLocaleString()}).`;
        }

        return {
            status: "EARLY_ESTIMATE",
            trend: earlyTrend,
            expectedPrice: target,
            currentBestPrice: currentBest,
            bestPlatform: bestPlatName,
            observedLowPrice: observedLowPrice,
            historyDays: historyDays,
            recommendation: "MONITOR",
            confidence: 50,
            confidenceLabel: "Low",
            message: "Early trend detected. More history is needed for a reliable price-drop forecast.",
            reason: reason
        };
    }

    // TIER C (14–29 days: ESTIMATE) & TIER D (30+ days: CONFIDENT_FORECAST)
    const isConfidentTier = historyDays >= 30;
    const baseConfidence = isConfidentTier ? 85 : 70;
    const status = isConfidentTier ? "CONFIDENT_FORECAST" : "ESTIMATE";
    const confidenceLabel = isConfidentTier ? "High" : "Medium";
    const message = isConfidentTier
        ? "Confident forecast based on 30+ days of price history."
        : "Forecast is based on limited observed price history.";

    const last7Prices = dailyPrices.slice(-7);
    const avg7Price = Math.round(last7Prices.reduce((a, b) => a + b, 0) / last7Prices.length);
    const slope = calculateSlope(last7Prices);

    let recommendation = "MONITOR";
    let trend = "stable";
    let expectedPrice = currentBest;
    let calculatedConfidence = baseConfidence;
    let reason = `Price is holding steady around its 7-day average (₹${avg7Price.toLocaleString()}).`;

    // Rule 1: High competitor price gap (arbitrage pressure)
    if (platformSpreadRatio >= 0.08 && minPlatformPrice < currentBest) {
        trend = "drop";
        recommendation = "WAIT";
        expectedPrice = Math.round(minPlatformPrice * 0.97);
        calculatedConfidence = Math.min(95, baseConfidence + Math.round(platformSpreadRatio * 20));
        reason = `Competitor price gap of ${(platformSpreadRatio * 100).toFixed(0)}% detected. Best available price is ₹${minPlatformPrice.toLocaleString()} on ${bestPlatName}.`;
    }
    // Rule 2: Current price is at or within 2% of All-Time-Low
    else if (currentBest <= observedLowPrice * 1.02) {
        trend = "rise";
        recommendation = "BUY_NOW";
        expectedPrice = Math.round(avg7Price);
        calculatedConfidence = Math.min(92, baseConfidence + 5);
        reason = `All-time low alert: Current price (₹${currentBest.toLocaleString()}) is within 2% of the lowest recorded price (₹${observedLowPrice.toLocaleString()}).`;
    }
    // Rule 3: Current price inflated significantly above 7-day average
    else if (currentBest > avg7Price * 1.05) {
        trend = "drop";
        recommendation = "WAIT";
        expectedPrice = Math.round(avg7Price);
        calculatedConfidence = Math.min(90, baseConfidence + 5);
        reason = `Price is currently inflated ${( ((currentBest - avg7Price) / avg7Price) * 100 ).toFixed(0)}% above its 7-day average of ₹${avg7Price.toLocaleString()}. Wait for correction.`;
    }
    // Rule 4: Consistent downward trend slope
    else if (slope < -20) {
        trend = "drop";
        recommendation = "WAIT";
        expectedPrice = Math.max(observedLowPrice, Math.round(currentBest + (slope * 3)));
        reason = `Active downward price momentum detected across recent observation days.`;
    }
    // Rule 5: Consistent upward trend slope
    else if (slope > 20) {
        trend = "rise";
        recommendation = "BUY_NOW";
        expectedPrice = Math.round(currentBest + (slope * 3));
        reason = `Price is steadily rising. Consider buying before price increases further to ~₹${expectedPrice.toLocaleString()}.`;
    }

    return {
        status,
        trend,
        expectedPrice,
        currentBestPrice: currentBest,
        bestPlatform: bestPlatName,
        observedLowPrice: observedLowPrice,
        historyDays: historyDays,
        recommendation,
        confidence: calculatedConfidence,
        confidenceLabel,
        message,
        reason
    };
}

function generateChronosBaseline(productId, sourceId, priceHistory, currentPrice = 0, horizon = 14, fallbackReason = "Chronos AI service unavailable") {
    const dailySeries = normalizeDailySeries(priceHistory, currentPrice);
    const historyPoints = dailySeries.length;
    const currentP = historyPoints > 0 ? dailySeries[dailySeries.length - 1].dailyBestPrice : (currentPrice || 1000);

    const forecast = [];
    const lastDate = historyPoints > 0 ? new Date(dailySeries[dailySeries.length - 1].date) : new Date();

    const prices = dailySeries.map(d => d.dailyBestPrice);
    let avg = currentP;
    if (prices.length > 0) {
        avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    }

    const drift = currentP < avg ? -0.005 : (currentP > avg ? 0.005 : 0);

    for (let step = 1; step <= horizon; step++) {
        const d = new Date(lastDate);
        d.setDate(d.getDate() + step);
        
        const predicted = Math.max(1, Math.round(currentP * (1 + drift * step)));
        const uncertainty = Math.round(predicted * (0.03 + (0.01 * Math.sqrt(step))));
        
        forecast.push({
            timestamp: d.toISOString().split('T')[0] + 'T00:00:00Z',
            predictedPrice: predicted,
            lowerBound: Math.max(1, predicted - uncertainty),
            upperBound: predicted + uncertainty
        });
    }

    const endPred = forecast[forecast.length - 1].predictedPrice;
    let trend = "likely_stable";
    if (endPred < currentP * 0.98) trend = "likely_decrease";
    else if (endPred > currentP * 1.02) trend = "likely_increase";

    const confidence = historyPoints >= 30 ? "high" : (historyPoints >= 14 ? "medium" : "low");

    return {
        status: "success",
        productId: productId || "unknown",
        sourceId: sourceId || "General",
        currency: "INR",
        model: "chronos-zero-shot-baseline",
        forecastSource: "baseline",
        isAiPrediction: false,
        fallbackUsed: true,
        fallbackReason: fallbackReason,
        forecastGeneratedAt: new Date().toISOString(),
        interval: "daily",
        horizon,
        historyPoints,
        currentPrice: currentP,
        trend,
        confidence,
        isEstimate: true,
        forecast,
        warning: historyPoints < 7 ? "Forecast generated with limited history (< 7 observations)." : null
    };
}

module.exports = {
    predictPriceDrop,
    normalizeDailySeries,
    generateChronosBaseline
};

const assert = require('assert');
const { spawn } = require('child_process');
const path = require('path');
const axios = require('axios');
const chronosClient = require('./services/chronosClient');
const predictor = require('./services/predictor');

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
    console.log("=== PRICEWISE CHRONOS / AI FORECAST INTEGRATION TEST SUITE ===\n");

    // TEST 1: Offline Fallback Handling (Python service not running yet)
    console.log("TEST 1: Testing graceful fallback when Python service is offline...");
    const offlineHealth = await chronosClient.checkChronosHealth();
    console.log("  Offline health check result:", offlineHealth);
    assert.strictEqual(offlineHealth.reachable, false, "Chronos should report unreachable when service is down");

    const offlineForecast = await chronosClient.getChronosForecast({
        productId: 'test_product_1',
        sourceId: 'Amazon',
        currentPrice: 50000,
        priceHistory: [{ price: 50000, date: '2026-08-01' }]
    });
    console.log("  Offline forecast result:", offlineForecast);
    assert.strictEqual(offlineForecast.ok, false, "Should return ok: false when offline");
    assert.strictEqual(typeof offlineForecast.fallbackReason, 'string', "Should provide structured fallbackReason");

    const baseline = predictor.generateChronosBaseline('test_product_1', 'Amazon', [], 50000, 14, offlineForecast.fallbackReason);
    assert.strictEqual(baseline.forecastSource, 'baseline', "Fallback should specify forecastSource=baseline");
    assert.strictEqual(baseline.isAiPrediction, false, "Fallback should specify isAiPrediction=false");
    assert.strictEqual(baseline.fallbackUsed, true, "Fallback should specify fallbackUsed=true");
    console.log("  ✓ TEST 1 PASSED: Graceful baseline fallback verified.\n");

    // TEST 2: Start Python Chronos Microservice
    console.log("TEST 2: Starting Python Chronos Microservice on 127.0.0.1:5001...");
    const pyProcess = spawn('python', ['app.py'], {
        cwd: path.join(__dirname, 'forecasting_service'),
        env: { ...process.env, PORT: '5001' },
        stdio: ['ignore', 'pipe', 'pipe']
    });

    pyProcess.stdout.on('data', d => console.log(`  [Python stdout] ${d.toString().trim()}`));
    pyProcess.stderr.on('data', d => console.log(`  [Python stderr] ${d.toString().trim()}`));

    // Poll until healthy
    let isHealthy = false;
    for (let i = 0; i < 30; i++) {
        await sleep(500);
        const h = await chronosClient.checkChronosHealth();
        if (h.reachable) {
            isHealthy = true;
            break;
        }
    }

    assert.strictEqual(isHealthy, true, "Python Chronos service failed to start or become reachable within 15s");
    console.log("  ✓ TEST 2 PASSED: Python Chronos service is healthy on port 5001.\n");

    // TEST 3: Direct Node -> Python Forecast Call
    console.log("TEST 3: Testing Node -> Python Chronos microservice forecast request...");
    const testPoints = [
        { date: '2026-08-01', price: 65000 },
        { date: '2026-08-02', price: 64500 },
        { date: '2026-08-03', price: 64000 },
        { date: '2026-08-04', price: 63500 },
        { date: '2026-08-05', price: 63000 },
        { date: '2026-08-06', price: 62500 },
        { date: '2026-08-07', price: 62000 }
    ];

    const pyForecastResult = await chronosClient.getChronosForecast({
        productId: 'iphone_15_pro',
        sourceId: 'Amazon',
        currency: 'INR',
        horizon: 14,
        priceHistory: testPoints,
        currentPrice: 62000
    });

    console.log("  Python forecast result received:", {
        ok: pyForecastResult.ok,
        model: pyForecastResult.data?.model,
        forecastSource: pyForecastResult.data?.forecastSource,
        isAiPrediction: pyForecastResult.data?.isAiPrediction,
        fallbackUsed: pyForecastResult.data?.fallbackUsed,
        forecastLength: pyForecastResult.data?.forecast?.length,
        firstPoint: pyForecastResult.data?.forecast?.[0],
        lastPoint: pyForecastResult.data?.forecast?.[pyForecastResult.data?.forecast?.length - 1]
    });

    assert.strictEqual(pyForecastResult.ok, true, "Chronos forecast call should succeed");
    assert.strictEqual(pyForecastResult.data.forecastSource, "chronos", "forecastSource must be 'chronos'");
    assert.strictEqual(pyForecastResult.data.isAiPrediction, true, "isAiPrediction must be true");
    assert.strictEqual(pyForecastResult.data.fallbackUsed, false, "fallbackUsed must be false");
    assert.strictEqual(pyForecastResult.data.forecast.length, 14, "Must return exactly 14 forecast points");
    assert.strictEqual(typeof pyForecastResult.data.forecast[0].predictedPrice, 'number', "Forecast prices must be numeric");
    console.log("  ✓ TEST 3 PASSED: Chronos AI forecast verified.\n");

    // TEST 4: Kill Python Microservice and verify controlled fallback
    console.log("TEST 4: Stopping Python service to verify controlled fallback...");
    pyProcess.kill();
    await sleep(1000);

    const postKillForecast = await chronosClient.getChronosForecast({
        productId: 'iphone_15_pro',
        sourceId: 'Amazon',
        currentPrice: 62000,
        priceHistory: testPoints
    });

    console.log("  Post-kill fallback result:", postKillForecast);
    assert.strictEqual(postKillForecast.ok, false, "Should return ok: false after Python process stopped");
    assert.strictEqual(postKillForecast.fallbackReason.includes('unavailable'), true, "fallbackReason should mention unavailable");

    const fallbackResult = predictor.generateChronosBaseline('iphone_15_pro', 'Amazon', testPoints, 62000, 14, postKillForecast.fallbackReason);
    assert.strictEqual(fallbackResult.forecastSource, 'baseline', "Should report baseline");
    assert.strictEqual(fallbackResult.isAiPrediction, false, "Should not claim AI prediction");
    assert.strictEqual(fallbackResult.fallbackUsed, true, "Should report fallbackUsed=true");
    console.log("  ✓ TEST 4 PASSED: Controlled fallback validated.\n");

    console.log("==================================================");
    console.log("ALL 4 CHRONOS INTEGRATION TESTS PASSED PERFECTLY!");
    console.log("==================================================");
}

runTests().catch(err => {
    console.error("FATAL TEST FAILURE:", err);
    process.exit(1);
});

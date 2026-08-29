const assert = require('assert');
const crypto = require('crypto');
const priceAlertService = require('./services/priceAlertService');
const supabase = require('./supabase');

async function runMockAlertTests() {
    console.log("===============================================================");
    console.log("RUNNING PRICEWISE MOCK PRODUCT TARGET-PRICE ALERT TEST SUITE");
    console.log("===============================================================\n");

    const testUserId = crypto.randomUUID();

    // 1. Mock Product Isolation
    console.log("1. Testing Mock Product Identity & Isolation...");
    const mockProduct = priceAlertService.MOCK_ALERT_PRODUCT;
    assert.strictEqual(mockProduct.id, "mock-pricewise-alert-demo-v1", "Mock product ID must match standard constant");
    assert.strictEqual(mockProduct.source, "pricewise_demo", "Mock source must be pricewise_demo");
    assert.strictEqual(mockProduct.isMock, true, "isMock must be true");
    assert.strictEqual(mockProduct.is_mock, true, "is_mock must be true");
    assert.strictEqual(mockProduct.mockType, "target_price_alert_demo", "mockType must match");
    assert.strictEqual(mockProduct.platforms[0].isMock, true, "Platforms must be flagged isMock");
    assert.strictEqual(mockProduct.platforms[0].comparisonEligible, false, "Must not be eligible for live store comparisons");
    console.log("-> [PASS] Mock Product has strict isolation flags and non-retailer source.\n");

    // 2. Feature Flag Gating
    console.log("2. Testing Feature Flag Gating...");
    process.env.ENABLE_MOCK_PRICE_ALERTS = "false";
    assert.strictEqual(priceAlertService.isMockAlertTestingEnabled(), false);
    const disabledSchedule = priceAlertService.scheduleMockAlertSimulation(testUserId, { productId: mockProduct.id }, 1500, 100);
    assert.strictEqual(disabledSchedule.scheduled, false, "Must not schedule when flag is disabled");

    process.env.ENABLE_MOCK_PRICE_ALERTS = "true";
    assert.strictEqual(priceAlertService.isMockAlertTestingEnabled(), true);
    console.log("-> [PASS] Feature flag correctly controls mock scheduling.\n");

    // 3. Real Product Protection (Never schedule on real product)
    console.log("3. Testing Real Product Protection...");
    const realProductSchedule = priceAlertService.scheduleMockAlertSimulation(testUserId, { productId: "mock_1" }, 60000, 100);
    assert.strictEqual(realProductSchedule.scheduled, false, "Must never schedule simulation for real products");
    console.log("-> [PASS] Real product rejected from simulation scheduler.\n");

    // 4. Timer Cancellation Test
    console.log("4. Testing Mock Timer Cancellation...");
    const cancelTestUserId = crypto.randomUUID();
    const cancelAlert = priceAlertService.standardizeAlertRecord({
        productId: mockProduct.id,
        targetPrice: 1500,
        isActive: true
    }, cancelTestUserId, mockProduct);

    priceAlertService.scheduleMockAlertSimulation(cancelTestUserId, cancelAlert, 1500, 300);
    const cancelled = priceAlertService.cancelMockAlertSimulation(cancelTestUserId, mockProduct.id);
    assert.strictEqual(cancelled, true, "Must return true when cancelling active timer");
    await new Promise(r => setTimeout(r, 400));
    const cancelNotifs = priceAlertService.getUserNotifications(cancelTestUserId);
    assert.strictEqual(cancelNotifs.length, 0, "No notifications should be generated when timer is cancelled");
    console.log("-> [PASS] Timer successfully cancelled before expiration without firing.\n");

    // 5. Target Price Drop Simulation & Shared Evaluator Integration
    console.log("5. Testing 10-Second Simulation Engine & Shared Alert Evaluator...");
    const simUserId = crypto.randomUUID();
    const simAlert = priceAlertService.standardizeAlertRecord({
        productId: mockProduct.id,
        targetPrice: 1500,
        isActive: true,
        notificationStatus: 'MONITORING'
    }, simUserId, mockProduct);

    // Seed test user with the mock alert
    const { error: insertErr } = await supabase.from('users').insert([{
        id: simUserId,
        name: 'Demo Tester',
        email: `${simUserId}@example.com`,
        password: '$2a$10$defaultpasswordhashplaceholderforalertuser',
        alerts: [simAlert]
    }]);
    if (insertErr) {
        throw new Error("Failed to insert test user: " + insertErr.message);
    }

    // Schedule simulation (1000ms for automated test verification)
    const scheduleResult = priceAlertService.scheduleMockAlertSimulation(simUserId, simAlert, 1500, 1000);
    assert.strictEqual(scheduleResult.scheduled, true);

    // Verify no notifications immediately
    const immediateNotifs = priceAlertService.getUserNotifications(simUserId);
    assert.strictEqual(immediateNotifs.length, 0, "No notifications before simulation timer expires");

    // Wait for simulation timer to fire
    await new Promise(r => setTimeout(r, 1600));

    // Verify in-app notification created
    const postSimNotifs = priceAlertService.getUserNotifications(simUserId);
    assert.strictEqual(postSimNotifs.length, 1, "Exactly one in-app notification must be created");
    const notif = postSimNotifs[0];
    assert.strictEqual(notif.isMock, true, "Notification must have isMock = true");
    assert.strictEqual(notif.type, "mock_price_drop", "Notification type must be mock_price_drop");
    assert.strictEqual(notif.title, "Demo price alert triggered", "Must have clear demo title");
    assert.strictEqual(notif.mockLabel, "MOCK / SIMULATED ALERT", "Must have MOCK / SIMULATED ALERT label");
    assert.strictEqual(notif.targetPrice, 1500);
    assert.strictEqual(notif.currentPrice, 1425, "Simulated price must be 5% below target (1500 * 0.95 = 1425)");
    assert.ok(notif.currentPrice <= notif.targetPrice, "Simulated price must meet currentPrice <= targetPrice");

    // Verify user alert record in database was updated to SENT
    const { data: updatedUser } = await supabase.from('users').select('*').eq('id', simUserId).single();
    const updatedAlert = updatedUser.alerts.find(a => String(a.productId || a.product_id) === mockProduct.id);
    assert.strictEqual(updatedAlert.notification_status, 'SENT', "Alert status in DB must be updated to SENT");
    assert.strictEqual(updatedAlert.last_observed_price, 1425);
    assert.strictEqual(updatedAlert.is_mock, true);

    console.log("-> [PASS] Simulation timer fired, dropped price to ₹1,425, invoked shared evaluator, created labelled demo notification, and persisted SENT state.\n");

    // 6. Deduplication on Repeated Triggers
    console.log("6. Testing Deduplication on Mock Product...");
    const dupEval = await priceAlertService.evaluatePriceAlert(updatedAlert, 1425, updatedUser, { isMock: true });
    assert.strictEqual(dupEval.triggered, false, "Must skip duplicate notification when already notified for same dip");
    assert.strictEqual(dupEval.skippedDuplicate, true);
    console.log("-> [PASS] Duplicate notifications strictly avoided.\n");

    // 7. Cleanup
    await supabase.from('users').delete().eq('id', simUserId);
    await supabase.from('users').delete().eq('id', cancelTestUserId);

    console.log("===============================================================");
    console.log("ALL MOCK PRODUCT ALERT TESTS PASSED SUCCESSFULLY! (7/7)");
    console.log("===============================================================\n");
}

runMockAlertTests().catch(err => {
    console.error("Test failure:", err);
    process.exit(1);
});

const assert = require('assert');
const priceAlertService = require('./services/priceAlertService');

async function runTests() {
    console.log("===============================================================");
    console.log("RUNNING PRICEWISE TARGET-PRICE ALERT NOTIFICATION SYSTEM TESTS");
    console.log("===============================================================\n");

    let testsPassed = 0;
    let totalTests = 0;

    function test(name, fn) {
        totalTests++;
        try {
            fn();
            console.log(`[PASS] ${name}`);
            testsPassed++;
        } catch (e) {
            console.error(`[FAIL] ${name}:`, e.message);
            throw e;
        }
    }

    async function asyncTest(name, fn) {
        totalTests++;
        try {
            await fn();
            console.log(`[PASS] ${name}`);
            testsPassed++;
        } catch (e) {
            console.error(`[FAIL] ${name}:`, e.message);
            throw e;
        }
    }

    // -------------------------------------------------------------
    // Test 1: Price Parsing & Normalization
    // -------------------------------------------------------------
    test("Price Normalizer handles numbers, currency strings, and commas", () => {
        assert.strictEqual(priceAlertService.normalizeNumericPrice(1000), 1000);
        assert.strictEqual(priceAlertService.normalizeNumericPrice("₹1,299"), 1299);
        assert.strictEqual(priceAlertService.normalizeNumericPrice("₹ 65,499.50"), 65499.50);
        assert.strictEqual(priceAlertService.normalizeNumericPrice("Rs. 999"), 999);
        assert.strictEqual(priceAlertService.normalizeNumericPrice("$49.99"), 49.99);
        assert.strictEqual(priceAlertService.normalizeNumericPrice(""), null);
        assert.strictEqual(priceAlertService.normalizeNumericPrice(null), null);
        assert.strictEqual(priceAlertService.normalizeNumericPrice(undefined), null);
        assert.strictEqual(priceAlertService.normalizeNumericPrice(-50), null);
    });

    // -------------------------------------------------------------
    // Test 2: Standardizing Alert Record
    // -------------------------------------------------------------
    test("Standardize Alert Record ensures complete schema with numeric prices", () => {
        const raw = {
            productId: "prod_123",
            targetPrice: "₹1,500"
        };
        const standardized = priceAlertService.standardizeAlertRecord(raw, "user_abc", { title: "Test Product" });

        assert.strictEqual(standardized.user_id, "user_abc");
        assert.strictEqual(standardized.product_id, "prod_123");
        assert.strictEqual(standardized.target_price, 1500);
        assert.strictEqual(standardized.currency, "INR");
        assert.strictEqual(standardized.is_active, true);
        assert.strictEqual(standardized.notification_status, "MONITORING");
        assert.ok(standardized.created_at);
        assert.strictEqual(standardized.last_notified_price, null);
    });

    // -------------------------------------------------------------
    // Test 3: Scenario 1 - Alert Created, Price Above Target
    // -------------------------------------------------------------
    await asyncTest("Scenario 1: Current Price (1000) > Target Price (900) -> Status MONITORING, No Notification", async () => {
        const alert = priceAlertService.standardizeAlertRecord({
            productId: "mock_s1",
            targetPrice: 900
        }, "user_test");

        const result = await priceAlertService.evaluatePriceAlert(alert, 1000, { email: "test@example.com", name: "Tester" });

        assert.strictEqual(result.triggered, false);
        assert.strictEqual(result.alert.notification_status, "MONITORING");
        assert.strictEqual(result.alert.last_observed_price, 1000);
        assert.strictEqual(result.alert.notification_sent_at, null);
    });

    // -------------------------------------------------------------
    // Test 4: Scenario 2 - Price Remains Above Target
    // -------------------------------------------------------------
    await asyncTest("Scenario 2: New Price (950) > Target Price (900) -> Status MONITORING, No Notification", async () => {
        const alert = priceAlertService.standardizeAlertRecord({
            productId: "mock_s2",
            targetPrice: 900,
            notificationStatus: "MONITORING"
        }, "user_test");

        const result = await priceAlertService.evaluatePriceAlert(alert, 950, { email: "test@example.com", name: "Tester" });

        assert.strictEqual(result.triggered, false);
        assert.strictEqual(result.alert.notification_status, "MONITORING");
        assert.strictEqual(result.alert.last_observed_price, 950);
        assert.strictEqual(result.alert.notification_sent_at, null);
    });

    // -------------------------------------------------------------
    // Test 5: Scenario 3 - Price Reaches Target Price
    // -------------------------------------------------------------
    let activeAlertForFlow = null;
    await asyncTest("Scenario 3: Price Reaches Target (900 <= 900) -> Triggers Notification, Status SENT", async () => {
        const alert = priceAlertService.standardizeAlertRecord({
            productId: "mock_s3",
            targetPrice: 900,
            productTitle: "Test Wireless Earbuds",
            notificationStatus: "MONITORING"
        }, "user_test_flow");

        const result = await priceAlertService.evaluatePriceAlert(alert, 900, { email: "shopper@example.com", name: "Alice" }, {
            platformName: "Amazon",
            productUrl: "https://amazon.in/dp/test"
        });

        assert.strictEqual(result.triggered, true);
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.alert.notification_status, "SENT");
        assert.strictEqual(result.alert.last_notified_price, 900);
        assert.ok(result.alert.triggered_at);
        assert.ok(result.alert.notification_sent_at);
        assert.ok(result.notification, "In-app notification created");
        assert.strictEqual(result.notification.currentPrice, 900);
        assert.strictEqual(result.notification.targetPrice, 900);

        activeAlertForFlow = result.alert;
    });

    // -------------------------------------------------------------
    // Test 6: Scenario 4 - Price Drops Further Below Target (No Duplicate Spam)
    // -------------------------------------------------------------
    await asyncTest("Scenario 4: Price Drops to 850 (<= 900) while already SENT -> Skips duplicate notification", async () => {
        assert.ok(activeAlertForFlow, "Prior alert must exist");

        const result = await priceAlertService.evaluatePriceAlert(activeAlertForFlow, 850, { email: "shopper@example.com", name: "Alice" });

        assert.strictEqual(result.triggered, false);
        assert.strictEqual(result.skippedDuplicate, true);
        assert.strictEqual(result.alert.notification_status, "SENT");
        assert.strictEqual(result.alert.last_notified_price, 900); // Retains original dip notification price
        assert.strictEqual(result.alert.last_observed_price, 850);

        activeAlertForFlow = result.alert;
    });

    // -------------------------------------------------------------
    // Test 7: Scenario 5 - Repeated Cron Job Run (No Duplicate Notification)
    // -------------------------------------------------------------
    await asyncTest("Scenario 5: Repeated Evaluation at 850 -> No Duplicate notification sent", async () => {
        const result = await priceAlertService.evaluatePriceAlert(activeAlertForFlow, 850, { email: "shopper@example.com", name: "Alice" });

        assert.strictEqual(result.triggered, false);
        assert.strictEqual(result.skippedDuplicate, true);
        assert.strictEqual(result.alert.notification_status, "SENT");
    });

    // -------------------------------------------------------------
    // Test 8: Scenario 6 - Price Rebounds Above Target and Later Drops Again
    // -------------------------------------------------------------
    await asyncTest("Scenario 6: Price Rebounds to 950, then drops to 880 -> Successfully re-triggers new notification", async () => {
        // Price rises back above target
        const reboundResult = await priceAlertService.evaluatePriceAlert(activeAlertForFlow, 950, { email: "shopper@example.com" });
        assert.strictEqual(reboundResult.triggered, false);
        assert.strictEqual(reboundResult.alert.rebounded_above_target, true);

        // Price drops below target again
        const reDropResult = await priceAlertService.evaluatePriceAlert(reboundResult.alert, 880, { email: "shopper@example.com", name: "Alice" }, {
            platformName: "Flipkart"
        });

        assert.strictEqual(reDropResult.triggered, true);
        assert.strictEqual(reDropResult.success, true);
        assert.strictEqual(reDropResult.alert.notification_status, "SENT");
        assert.strictEqual(reDropResult.alert.last_notified_price, 880);
    });

    // -------------------------------------------------------------
    // Test 9: Scenario 7 - Safe Failure Handling
    // -------------------------------------------------------------
    await asyncTest("Scenario 7: Inactive alert or invalid prices handled safely without throwing", async () => {
        const inactiveAlert = priceAlertService.standardizeAlertRecord({
            productId: "mock_inactive",
            targetPrice: 1000,
            isActive: false
        }, "user_inactive");

        const result = await priceAlertService.evaluatePriceAlert(inactiveAlert, 800);
        assert.strictEqual(result.triggered, false);
        assert.strictEqual(result.reason, "Alert inactive");

        const invalidAlert = priceAlertService.standardizeAlertRecord({
            productId: "mock_invalid",
            targetPrice: "invalid_price"
        }, "user_invalid");

        const invalidResult = await priceAlertService.evaluatePriceAlert(invalidAlert, 500);
        assert.strictEqual(invalidResult.triggered, false);
        assert.strictEqual(invalidResult.reason, "Invalid numeric price data");
    });

    // -------------------------------------------------------------
    // Test 10: In-App Notifications Fetch & Mark Read
    // -------------------------------------------------------------
    test("In-App Notification Management: Fetch & Mark Read", () => {
        const notif = priceAlertService.createInAppNotification({
            userId: "user_notif_test",
            productId: "prod_sample",
            alertId: "alert_sample",
            productTitle: "Noise Cancelling Headphones",
            currentPrice: 4999,
            targetPrice: 5500,
            platformName: "Amazon"
        });

        assert.ok(notif.id);
        assert.strictEqual(notif.isRead, false);

        const fetched = priceAlertService.getUserNotifications("user_notif_test");
        assert.ok(fetched.length >= 1);
        const targetNotif = fetched.find(n => n.id === notif.id);
        assert.ok(targetNotif);
        assert.strictEqual(targetNotif.currentPrice, 4999);

        // Mark as read
        priceAlertService.markNotificationAsRead("user_notif_test", notif.id);
        const afterRead = priceAlertService.getUserNotifications("user_notif_test");
        const readItem = afterRead.find(n => n.id === notif.id);
        assert.strictEqual(readItem.isRead, true);
    });

    console.log(`\n===============================================================`);
    console.log(`TEST SUMMARY: ALL ${testsPassed}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log(`===============================================================\n`);
}

runTests().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});

const assert = require('assert');
const http = require('http');
const app = require('./server');

// Simple helper to make HTTP requests
function request(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, raw: body });
                }
            });
        });
        req.on('error', reject);
        if (data) {
            req.write(typeof data === 'string' ? data : JSON.stringify(data));
        }
        req.end();
    });
}

async function runE2ETests() {
    console.log("===============================================================");
    console.log("STARTING SERVER AND RUNNING END-TO-END HTTP API INTEGRATION TESTS");
    console.log("===============================================================\n");

    const TEST_PORT = 5055;
    const server = app.listen(TEST_PORT);
    await new Promise(r => setTimeout(r, 400));

    try {
        const crypto = require('crypto');
        const testUserId = crypto.randomUUID();
        const testProductId = "mock_1"; // iPhone 15 in staticMocks / DB (price ~ 69999)

        console.log(`[E2E] Testing with user: ${testUserId}, product: ${testProductId}`);

        // 1. Create Alert with Target Price ₹65,000 (Current is ~69,999 -> Above Target)
        console.log("\n1. Testing POST /user/alerts/set (targetPrice: 65000)...");
        const setRes1 = await request({
            hostname: '127.0.0.1',
            port: TEST_PORT,
            path: '/user/alerts/set',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            userId: testUserId,
            productId: testProductId,
            targetPrice: 65000
        });

        assert.strictEqual(setRes1.status, 200);
        assert.strictEqual(setRes1.data.status, 'success');
        assert.strictEqual(setRes1.data.alert.notificationStatus, 'MONITORING');
        assert.strictEqual(setRes1.data.alert.targetPrice, 65000);
        console.log("-> Alert successfully created in MONITORING state.");

        // 2. Fetch User Alerts
        console.log("\n2. Testing GET /user/alerts...");
        const getRes = await request({
            hostname: '127.0.0.1',
            port: TEST_PORT,
            path: `/user/alerts?userId=${testUserId}`,
            method: 'GET'
        });

        assert.strictEqual(getRes.status, 200);
        assert.strictEqual(getRes.data.status, 'success');
        assert.ok(getRes.data.data.length >= 1);
        const alertItem = getRes.data.data.find(a => a.productId === testProductId);
        assert.ok(alertItem, "Alert item found");
        assert.strictEqual(alertItem.targetPrice, 65000);
        assert.strictEqual(alertItem.notificationStatus, 'MONITORING');
        console.log("-> Alerts fetched with accurate standardized schema.");

        // 3. Update target price to ₹72,000 (Current ~69,999 -> At or Below Target!)
        console.log("\n3. Testing POST /user/alerts/set (targetPrice: 72000, triggering alert!)...");
        const setRes2 = await request({
            hostname: '127.0.0.1',
            port: TEST_PORT,
            path: '/user/alerts/set',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            userId: testUserId,
            productId: testProductId,
            targetPrice: 72000
        });

        assert.strictEqual(setRes2.status, 200);
        assert.strictEqual(setRes2.data.status, 'success');
        assert.strictEqual(setRes2.data.alert.notificationStatus, 'SENT');
        assert.ok(setRes2.data.alert.triggeredAt);
        assert.ok(setRes2.data.alert.notificationSentAt);
        console.log("-> Alert evaluated and immediately triggered! Status updated to SENT.");

        // 4. Verify In-App Notification was generated and stored
        console.log("\n4. Testing GET /user/notifications...");
        const notifRes = await request({
            hostname: '127.0.0.1',
            port: TEST_PORT,
            path: `/user/notifications?userId=${testUserId}`,
            method: 'GET'
        });

        assert.strictEqual(notifRes.status, 200);
        assert.strictEqual(notifRes.data.status, 'success');
        assert.ok(notifRes.data.data.length >= 1, "At least 1 in-app notification exists");
        const notif = notifRes.data.data[0];
        assert.strictEqual(notif.userId, testUserId);
        assert.strictEqual(notif.productId, testProductId);
        assert.strictEqual(notif.isRead, false);
        console.log(`-> In-App Notification confirmed: "${notif.title} - ${notif.message}"`);

        // 5. Mark Notification as Read
        console.log("\n5. Testing POST /user/notifications/mark-read...");
        const markReadRes = await request({
            hostname: '127.0.0.1',
            port: TEST_PORT,
            path: '/user/notifications/mark-read',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            userId: testUserId,
            notificationId: notif.id
        });

        assert.strictEqual(markReadRes.status, 200);

        const afterReadRes = await request({
            hostname: '127.0.0.1',
            port: TEST_PORT,
            path: `/user/notifications?userId=${testUserId}`,
            method: 'GET'
        });
        assert.strictEqual(afterReadRes.data.data[0].isRead, true);
        console.log("-> Notification successfully marked as read.");

        // 6. Test Pause / Resume Alert Toggle
        console.log("\n6. Testing POST /user/alerts/toggle (pausing alert)...");
        const toggleRes = await request({
            hostname: '127.0.0.1',
            port: TEST_PORT,
            path: '/user/alerts/toggle',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            userId: testUserId,
            productId: testProductId,
            isActive: false
        });

        assert.strictEqual(toggleRes.status, 200);
        const toggledAlert = toggleRes.data.user.alerts.find(a => a.productId === testProductId);
        assert.strictEqual(toggledAlert.isActive, false);
        console.log("-> Alert successfully toggled to paused/inactive state.");

        // 7. Test Remove Alert
        console.log("\n7. Testing POST /user/alerts/remove...");
        const removeRes = await request({
            hostname: '127.0.0.1',
            port: TEST_PORT,
            path: '/user/alerts/remove',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            userId: testUserId,
            productId: testProductId
        });

        assert.strictEqual(removeRes.status, 200);
        const remainingAlerts = removeRes.data.user.alerts.filter(a => a.productId === testProductId);
        assert.strictEqual(remainingAlerts.length, 0);
        console.log("-> Alert successfully removed from user profile.");

        console.log("\n===============================================================");
        console.log("END-TO-END HTTP API INTEGRATION TESTS COMPLETED SUCCESSFULLY!");
        console.log("===============================================================\n");
    } finally {
        server.close();
    }
}

runE2ETests().catch(err => {
    console.error("E2E test error:", err);
    process.exit(1);
});

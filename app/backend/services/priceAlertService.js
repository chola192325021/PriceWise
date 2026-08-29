const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const supabase = require('../supabase');

// Notifications storage file for persisted in-app notifications
const NOTIFICATIONS_FILE = path.join(__dirname, '..', 'data', 'notifications.json');

// Mock Demo Product definition
const MOCK_ALERT_PRODUCT = {
    _id: "mock-pricewise-alert-demo-v1",
    id: "mock-pricewise-alert-demo-v1",
    source: "pricewise_demo",
    sourceProductId: "mock-pricewise-alert-demo-v1",
    title: "PriceWise Demo Wireless Headphones",
    brand: "PriceWise Demo",
    category: "Demo & Testing",
    price: 1999,
    currency: "INR",
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60",
    productUrl: "",
    isMock: true,
    is_mock: true,
    mockType: "target_price_alert_demo",
    description: "Demo product with simulated price drop for testing target-price alerts.",
    platforms: [
        {
            name: "PriceWise Demo Store",
            price: 1999,
            url: "",
            isSmartDeal: true,
            comparisonEligible: false,
            isMock: true
        }
    ],
    aiPrediction: {
        trend: "drop",
        expectedPrice: 1499,
        recommendation: "Demo alert simulation active.",
        confidence: 100
    }
};

/**
 * Returns true if mock alert testing is enabled (enabled by default in dev/test unless explicitly set to 'false').
 */
function isMockAlertTestingEnabled() {
    if (process.env.ENABLE_MOCK_PRICE_ALERTS === 'false') return false;
    return process.env.ENABLE_MOCK_PRICE_ALERTS === 'true' || process.env.NODE_ENV !== 'production';
}

// In-memory registry of scheduled mock alert timers
const mockTimers = new Map();

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    try {
        fs.mkdirSync(dataDir, { recursive: true });
    } catch (e) {
        console.warn("[PriceAlertService] Could not create data directory:", e.message);
    }
}

// In-memory cache of in-app notifications
let notificationsCache = [];
function loadNotifications() {
    try {
        if (fs.existsSync(NOTIFICATIONS_FILE)) {
            const raw = fs.readFileSync(NOTIFICATIONS_FILE, 'utf8');
            notificationsCache = JSON.parse(raw);
        } else {
            notificationsCache = [];
        }
    } catch (e) {
        console.warn("[PriceAlertService] Could not read notifications file, using memory:", e.message);
        notificationsCache = [];
    }
}
loadNotifications();

function persistNotifications() {
    try {
        fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(notificationsCache, null, 2), 'utf8');
    } catch (e) {
        console.warn("[PriceAlertService] Could not write notifications file:", e.message);
    }
}

/**
 * Normalizes any price representation (string with ₹, $, commas, or number) to a positive finite Number.
 * Returns null if invalid or NaN.
 */
function normalizeNumericPrice(price) {
    if (price === null || price === undefined || price === '') return null;
    if (typeof price === 'number') {
        return Number.isFinite(price) && price >= 0 ? price : null;
    }
    if (typeof price === 'string') {
        // Strip known currency prefixes / words and punctuation attached to them
        let cleaned = price.replace(/(?:rs\.?|inr|usd|eur|\$|₹)/gi, ' ').trim();
        // Remove thousands commas
        cleaned = cleaned.replace(/,/g, '');
        // Match standard decimal or integer number
        const match = cleaned.match(/\d+(?:\.\d+)?/);
        if (match) {
            const parsed = parseFloat(match[0]);
            return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
        }
    }
    return null;
}

/**
 * Standardizes an alert record to match the required schema across backend, database, and frontends.
 */
function standardizeAlertRecord(rawAlert = {}, userId = '', product = null) {
    const rawTarget = rawAlert.targetPrice ?? rawAlert.target_price ?? 0;
    const targetPrice = normalizeNumericPrice(rawTarget) || 0;
    const alertId = rawAlert.id || rawAlert._id || `alert_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`;
    const effectiveUserId = userId || rawAlert.userId || rawAlert.user_id || 'anonymous';
    const effectiveProductId = String(rawAlert.productId || rawAlert.product_id || product?.id || product?._id || '');

    const rawObserved = rawAlert.lastObservedPrice ?? rawAlert.last_observed_price;
    const lastObservedPrice = rawObserved !== undefined && rawObserved !== null ? normalizeNumericPrice(rawObserved) : null;

    const rawNotified = rawAlert.lastNotifiedPrice ?? rawAlert.last_notified_price;
    const lastNotifiedPrice = rawNotified !== undefined && rawNotified !== null ? normalizeNumericPrice(rawNotified) : null;

    const isActive = rawAlert.isActive !== undefined ? Boolean(rawAlert.isActive) : (rawAlert.is_active !== undefined ? Boolean(rawAlert.is_active) : true);
    const isMock = Boolean(rawAlert.isMock || rawAlert.is_mock || effectiveProductId === MOCK_ALERT_PRODUCT.id || product?.isMock || product?.is_mock);
    const mockType = isMock ? (rawAlert.mockType || rawAlert.mock_type || product?.mockType || "target_price_alert_demo") : null;

    return {
        id: alertId,
        _id: alertId,
        user_id: effectiveUserId,
        userId: effectiveUserId,
        product_id: effectiveProductId,
        productId: effectiveProductId,
        source: isMock ? 'pricewise_demo' : (rawAlert.source || 'all'),
        product_title: rawAlert.productTitle || rawAlert.product_title || product?.title || (isMock ? MOCK_ALERT_PRODUCT.title : 'Tracked Product'),
        productTitle: rawAlert.productTitle || rawAlert.product_title || product?.title || (isMock ? MOCK_ALERT_PRODUCT.title : 'Tracked Product'),
        product_url: rawAlert.productUrl || rawAlert.product_url || product?.platforms?.[0]?.url || '',
        productUrl: rawAlert.productUrl || rawAlert.product_url || product?.platforms?.[0]?.url || '',
        target_price: targetPrice,
        targetPrice: targetPrice,
        currency: rawAlert.currency || 'INR',
        is_active: isActive,
        isActive: isActive,
        is_mock: isMock,
        isMock: isMock,
        mock_type: mockType,
        mockType: mockType,
        created_at: rawAlert.createdAt || rawAlert.created_at || new Date().toISOString(),
        createdAt: rawAlert.createdAt || rawAlert.created_at || new Date().toISOString(),
        last_checked_at: rawAlert.lastCheckedAt || rawAlert.last_checked_at || null,
        lastCheckedAt: rawAlert.lastCheckedAt || rawAlert.last_checked_at || null,
        last_observed_price: lastObservedPrice,
        lastObservedPrice: lastObservedPrice,
        triggered_at: rawAlert.triggeredAt || rawAlert.triggered_at || null,
        triggeredAt: rawAlert.triggeredAt || rawAlert.triggered_at || null,
        notification_sent_at: rawAlert.notificationSentAt || rawAlert.notification_sent_at || null,
        notificationSentAt: rawAlert.notificationSentAt || rawAlert.notification_sent_at || null,
        notification_status: rawAlert.notificationStatus || rawAlert.notification_status || 'MONITORING',
        notificationStatus: rawAlert.notificationStatus || rawAlert.notification_status || 'MONITORING',
        last_notified_price: lastNotifiedPrice,
        lastNotifiedPrice: lastNotifiedPrice,
        rebounded_above_target: rawAlert.rebounded_above_target ?? false
    };
}

/**
 * Sends an email notification using Nodemailer.
 * Reuses environment configuration with graceful mock mode fallback.
 */
async function sendPriceDropEmail({ toEmail, userName, productTitle, currentPrice, targetPrice, currency = 'INR', platformName = 'Online Store', productUrl = '', isMock: isMockOption = false }) {
    if (!toEmail) {
        return { success: false, reason: "No recipient email provided" };
    }

    const userEmail = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    const isMock = Boolean(isMockOption || !userEmail || !pass || userEmail.includes("example.com") || pass.trim() === "mock_mode_active" || toEmail.includes("example.com"));

    const symbol = currency === 'INR' ? '₹' : (currency || '₹');
    const subject = `${isMockOption ? '[DEMO ALERT] ' : ''}🔥 Price Drop Alert: ${productTitle} reached ${symbol}${currentPrice.toLocaleString()}`;

    if (isMock) {
        console.log(`\n======================================================`);
        console.log(`[MOCK EMAIL] ${isMockOption ? 'DEMO ' : ''}Price Drop Alert to: ${toEmail}`);
        console.log(`Product: ${productTitle}`);
        console.log(`Current Price: ${symbol}${currentPrice} (Target: ${symbol}${targetPrice})`);
        console.log(`Store: ${platformName} | URL: ${productUrl || 'N/A'}`);
        console.log(`======================================================\n`);
        return { success: true, isMock: true, message: "Email logged in mock mode" };
    }

    try {
        const cleanPass = pass.replace(/\s+/g, '');
        const host = process.env.SMTP_HOST || 'smtp.gmail.com';
        const port = parseInt(process.env.SMTP_PORT || '587');
        const senderAddress = process.env.EMAIL_FROM || `"PriceWise Alerts" <${userEmail}>`;

        const transporter = nodemailer.createTransport({
            host: host,
            port: port,
            secure: port === 465,
            family: 4,
            auth: {
                user: userEmail,
                pass: cleanPass
            },
            connectionTimeout: 8000,
            greetingTimeout: 8000,
            socketTimeout: 8000,
            tls: {
                rejectUnauthorized: false
            }
        });

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
            .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
            .badge { display: inline-block; background: #dcfce7; color: #166534; padding: 6px 14px; border-radius: 9999px; font-weight: 700; font-size: 13px; text-transform: uppercase; }
            .title { font-size: 22px; font-weight: 800; color: #0f172a; margin: 16px 0 8px 0; line-height: 1.3; }
            .price-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 24px 0; }
            .current-price { font-size: 32px; font-weight: 900; color: #15803d; }
            .target-price { font-size: 14px; color: #64748b; margin-top: 4px; }
            .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 700; font-size: 15px; margin-top: 12px; }
            .footer { font-size: 12px; color: #94a3b8; margin-top: 32px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; }
          </style>
        </head>
        <body>
          <div class="card">
            <span class="badge">Target Price Reached!</span>
            <h1 class="title">${productTitle}</h1>
            <p style="color: #475569; font-size: 15px;">Great news, ${userName || 'Shopper'}! The price for this product on <strong>${platformName}</strong> has dropped to or below your target price.</p>
            
            <div class="price-box">
              <div class="current-price">${symbol}${currentPrice.toLocaleString()}</div>
              <div class="target-price">Your Target: <strong>${symbol}${targetPrice.toLocaleString()}</strong> (You saved ${symbol}${(targetPrice - currentPrice).toLocaleString()}!)</div>
            </div>

            ${productUrl ? `<a href="${productUrl}" class="btn" target="_blank">View Deal on ${platformName} &rarr;</a>` : ''}

            <div class="footer">
              <p>You received this email because you set a price alert on PriceWise.</p>
              <p>&copy; ${new Date().getFullYear()} PriceWise AI. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
        `;

        await transporter.sendMail({
            from: senderAddress,
            to: toEmail,
            subject: subject,
            text: `Target Price Reached!\n\n${productTitle} is now ${symbol}${currentPrice} on ${platformName}, which is below your target of ${symbol}${targetPrice}.\n\nView Deal: ${productUrl || 'Check PriceWise App'}`,
            html: htmlContent
        });

        return { success: true, isMock: false };
    } catch (err) {
        console.error("[PriceAlertService] Email sending failed:", err.message);
        return { success: false, reason: err.message };
    }
}

/**
 * Creates and stores an in-app notification record.
 */
function createInAppNotification({ userId, productId, alertId, productTitle, currentPrice, targetPrice, currency = 'INR', platformName = 'Store', productUrl = '', imageUrl = '', isMock = false, mockType = null }) {
    const symbol = currency === 'INR' ? '₹' : (currency || '₹');
    const isDemo = isMock || String(productId) === MOCK_ALERT_PRODUCT.id;
    const notification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        userId: String(userId),
        type: isDemo ? "mock_price_drop" : "price_drop",
        title: isDemo ? "Demo price alert triggered" : "Target Price Reached!",
        message: `${productTitle} is now ${symbol}${currentPrice.toLocaleString()}, ${isDemo ? 'below your target' : 'reaching your target'} of ${symbol}${targetPrice.toLocaleString()}${platformName && !isDemo ? ` on ${platformName}` : ''}.`,
        productId: String(productId),
        alertId: String(alertId),
        currentPrice: Number(currentPrice),
        targetPrice: Number(targetPrice),
        currency: currency,
        platformName: isDemo ? "PriceWise Demo" : platformName,
        productUrl: productUrl,
        imageUrl: imageUrl || (isDemo ? MOCK_ALERT_PRODUCT.imageUrl : ''),
        isMock: isDemo,
        mockType: isDemo ? (mockType || "target_price_alert_demo") : null,
        mockLabel: isDemo ? "MOCK / SIMULATED ALERT" : null,
        isRead: false,
        createdAt: new Date().toISOString()
    };

    // Remove duplicates if existing unread notification for exact same alert and price
    notificationsCache = notificationsCache.filter(n => !(n.userId === String(userId) && n.alertId === String(alertId) && n.currentPrice === Number(currentPrice)));
    notificationsCache.unshift(notification);

    // Limit cache size per user to 50 items
    persistNotifications();
    return notification;
}

/**
 * Retrieves all in-app notifications for a user.
 */
function getUserNotifications(userId) {
    if (!userId) return [];
    loadNotifications();
    return notificationsCache.filter(n => n.userId === String(userId));
}

/**
 * Marks one or all in-app notifications as read for a user.
 */
function markNotificationAsRead(userId, notificationId = null) {
    if (!userId) return false;
    loadNotifications();
    let updated = false;

    notificationsCache = notificationsCache.map(n => {
        if (n.userId === String(userId)) {
            if (!notificationId || n.id === notificationId) {
                updated = true;
                return { ...n, isRead: true };
            }
        }
        return n;
    });

    if (updated) {
        persistNotifications();
    }
    return updated;
}

/**
 * Evaluates a single alert against an observed numeric price.
 * 
 * Rules:
 * - targetPrice and observedPrice must be valid finite numbers.
 * - alert.is_active must be true.
 * - Condition: observedPrice <= targetPrice.
 * - Deduplication:
 *     - If price remains <= targetPrice and has already been notified (notification_status === 'SENT'), do NOT re-notify.
 *     - If price rises above targetPrice, mark rebounded_above_target = true so future dips trigger again.
 *     - If targetPrice was changed by user, alert triggers again on next meeting.
 */
async function evaluatePriceAlert(rawAlert, rawCurrentPrice, user = null, options = {}) {
    const alert = standardizeAlertRecord(rawAlert, user?.id);
    const targetPrice = Number(alert.target_price);
    const observedPrice = normalizeNumericPrice(rawCurrentPrice);
    const nowIso = new Date().toISOString();

    alert.last_checked_at = nowIso;
    alert.lastCheckedAt = nowIso;
    alert.last_observed_price = observedPrice;
    alert.lastObservedPrice = observedPrice;

    if (!Number.isFinite(targetPrice) || targetPrice <= 0 || !Number.isFinite(observedPrice) || observedPrice <= 0) {
        return {
            triggered: false,
            reason: "Invalid numeric price data",
            alert
        };
    }

    if (!alert.is_active) {
        return {
            triggered: false,
            reason: "Alert inactive",
            alert
        };
    }

    // Check if price is above target
    if (observedPrice > targetPrice) {
        // Price is currently above target
        alert.rebounded_above_target = true;
        if (alert.notification_status !== 'SENT') {
            alert.notification_status = 'MONITORING';
            alert.notificationStatus = 'MONITORING';
        }
        return {
            triggered: false,
            reason: `Target not reached (Current: ${observedPrice} > Target: ${targetPrice})`,
            alert
        };
    }

    // Condition met: observedPrice <= targetPrice
    // Deduplication check:
    const alreadySent = alert.notification_status === 'SENT';
    const samePriceDip = alert.last_notified_price !== null && !alert.rebounded_above_target && !options.force;

    if (alreadySent && samePriceDip) {
        return {
            triggered: false,
            reason: `Already notified for current price dip (Current: ${observedPrice} <= Target: ${targetPrice})`,
            alert,
            skippedDuplicate: true
        };
    }

    // Need to trigger notification
    alert.triggered_at = nowIso;
    alert.triggeredAt = nowIso;
    alert.rebounded_above_target = false;

    // Build notification payload
    const platformName = options.platformName || 'Retailer';
    const productUrl = options.productUrl || alert.product_url || '';
    const imageUrl = options.imageUrl || '';
    const productTitle = alert.product_title || 'Tracked Product';

    // 1. Create in-app notification
    let inAppNotif = null;
    const isDemoAlert = Boolean(options.isMock || alert.is_mock || alert.product_id === MOCK_ALERT_PRODUCT.id);
    try {
        inAppNotif = createInAppNotification({
            userId: alert.user_id,
            productId: alert.product_id,
            alertId: alert.id,
            productTitle: productTitle,
            currentPrice: observedPrice,
            targetPrice: targetPrice,
            currency: alert.currency || 'INR',
            platformName: platformName,
            productUrl: productUrl,
            imageUrl: imageUrl,
            isMock: isDemoAlert,
            mockType: options.mockType || alert.mock_type
        });
    } catch (inAppErr) {
        console.error("[PriceAlertService] In-app notification creation error:", inAppErr.message);
    }

    // 2. Send email notification if user email exists
    let emailResult = { success: true };
    const recipientEmail = options.email || user?.email;
    if (recipientEmail) {
        emailResult = await sendPriceDropEmail({
            toEmail: recipientEmail,
            userName: user?.name || 'Shopper',
            productTitle: productTitle,
            currentPrice: observedPrice,
            targetPrice: targetPrice,
            currency: alert.currency || 'INR',
            platformName: platformName,
            productUrl: productUrl,
            isMock: isDemoAlert
        });
    }

    if (emailResult.success) {
        alert.notification_status = 'SENT';
        alert.notificationStatus = 'SENT';
        alert.notification_sent_at = nowIso;
        alert.notificationSentAt = nowIso;
        alert.last_notified_price = observedPrice;
        alert.lastNotifiedPrice = observedPrice;

        return {
            triggered: true,
            success: true,
            alert,
            notification: inAppNotif,
            email: emailResult
        };
    } else {
        alert.notification_status = 'FAILED';
        alert.notificationStatus = 'FAILED';
        return {
            triggered: true,
            success: false,
            reason: emailResult.reason || "Delivery failed",
            alert,
            notification: inAppNotif
        };
    }
}

/**
 * Evaluates all user alerts for a specific product when its price updates.
 * Updates the user's alerts in Supabase.
 */
async function evaluateAllAlertsForProduct(productId, currentPrice, platformData = {}) {
    if (!productId || currentPrice === null || currentPrice === undefined) return { evaluated: 0, triggered: 0 };
    const numericPrice = normalizeNumericPrice(currentPrice);
    if (!numericPrice) return { evaluated: 0, triggered: 0 };

    let evaluatedCount = 0;
    let triggeredCount = 0;

    try {
        // Query all users who have alerts
        const { data: users, error } = await supabase.from('users').select('*');
        if (error || !Array.isArray(users)) return { evaluated: 0, triggered: 0 };

        for (const user of users) {
            const rawAlerts = user.alerts || [];
            if (!Array.isArray(rawAlerts) || rawAlerts.length === 0) continue;

            let userModified = false;
            const updatedAlerts = [];

            for (const alert of rawAlerts) {
                if (String(alert.productId || alert.product_id) === String(productId)) {
                    evaluatedCount++;
                    const result = await evaluatePriceAlert(alert, numericPrice, user, {
                        platformName: platformData.name || platformData.platform || 'Online Store',
                        productUrl: platformData.url || '',
                        imageUrl: platformData.imageUrl || '',
                        email: user.email
                    });

                    updatedAlerts.push(result.alert);
                    if (result.triggered && result.success) {
                        triggeredCount++;
                    }
                    userModified = true;
                } else {
                    updatedAlerts.push(alert);
                }
            }

            if (userModified) {
                try {
                    await supabase.from('users').update({ alerts: updatedAlerts }).eq('id', user.id);
                } catch (updateErr) {
                    console.error(`[PriceAlertService] Failed to save updated alerts for user ${user.id}:`, updateErr.message);
                }
            }
        }
    } catch (err) {
        console.error("[PriceAlertService] evaluateAllAlertsForProduct error:", err.message);
    }

    return { evaluated: evaluatedCount, triggered: triggeredCount };
}

/**
 * Scheduled reconciliation job: iterates all active alerts across all users, fetches current product price, and evaluates.
 */
async function evaluateAllSystemAlerts() {
    console.log("[PriceAlertService] Running scheduled price alert evaluation...");
    let totalEvaluated = 0;
    let totalTriggered = 0;

    try {
        const { data: users, error: userError } = await supabase.from('users').select('*');
        if (userError || !Array.isArray(users)) {
            console.warn("[PriceAlertService] Could not fetch users for alert evaluation:", userError?.message);
            return { evaluated: 0, triggered: 0 };
        }

        const { data: products } = await supabase.from('products').select('*');
        const productMap = new Map();
        if (Array.isArray(products)) {
            products.forEach(p => productMap.set(String(p.id), p));
        }

        for (const user of users) {
            const rawAlerts = user.alerts || [];
            if (!Array.isArray(rawAlerts) || rawAlerts.length === 0) continue;

            let userModified = false;
            const updatedAlerts = [];

            for (const rawAlert of rawAlerts) {
                totalEvaluated++;
                const pid = String(rawAlert.productId || rawAlert.product_id);
                const product = productMap.get(pid);

                // Find lowest current price for product
                let lowestPrice = null;
                let platformName = 'Online Store';
                let productUrl = '';
                let imageUrl = product?.image_url || '';

                if (product && Array.isArray(product.platforms)) {
                    const validPlatforms = product.platforms.filter(p => normalizeNumericPrice(p.price) > 0);
                    if (validPlatforms.length > 0) {
                        const best = validPlatforms.reduce((min, p) => p.price < min.price ? p : min, validPlatforms[0]);
                        lowestPrice = best.price;
                        platformName = best.name;
                        productUrl = best.url;
                    }
                }

                if (lowestPrice !== null) {
                    const evalResult = await evaluatePriceAlert(rawAlert, lowestPrice, user, {
                        platformName,
                        productUrl,
                        imageUrl,
                        email: user.email
                    });
                    updatedAlerts.push(evalResult.alert);
                    if (evalResult.triggered && evalResult.success) {
                        totalTriggered++;
                    }
                    userModified = true;
                } else {
                    updatedAlerts.push(standardizeAlertRecord(rawAlert, user.id, product));
                }
            }

            if (userModified) {
                await supabase.from('users').update({ alerts: updatedAlerts }).eq('id', user.id);
            }
        }
    } catch (globalErr) {
        console.error("[PriceAlertService] Error during evaluateAllSystemAlerts:", globalErr.message);
    }

    console.log(`[PriceAlertService] Scheduled evaluation complete. Evaluated: ${totalEvaluated}, Triggered: ${totalTriggered}`);
    return { evaluated: totalEvaluated, triggered: totalTriggered };
}

/**
 * Cancels pending mock simulation timers for a user/product.
 */
function cancelMockAlertSimulation(userId, productIdOrAlertId = null) {
    if (!userId) return false;
    let cancelled = false;
    for (const [key, timerObj] of mockTimers.entries()) {
        const matchesUser = String(timerObj.userId) === String(userId);
        const matchesProduct = productIdOrAlertId ? (
            String(timerObj.productId) === String(productIdOrAlertId) ||
            String(timerObj.alertId) === String(productIdOrAlertId) ||
            String(productIdOrAlertId) === MOCK_ALERT_PRODUCT.id
        ) : true;
        if (matchesUser && matchesProduct) {
            clearTimeout(timerObj.timeoutId);
            mockTimers.delete(key);
            cancelled = true;
            console.log(`[Mock Price Alert] Cancelled active simulation timer: ${key}`);
        }
    }
    return cancelled;
}

/**
 * Schedules server-side 10-second price drop simulation for mock product.
 * Gated strictly by isMockAlertTestingEnabled() and MOCK_ALERT_PRODUCT.id.
 */
function scheduleMockAlertSimulation(userId, rawAlert, targetPrice, durationMs = 10000) {
    if (!isMockAlertTestingEnabled()) {
        return { scheduled: false, reason: "Mock alert testing feature flag disabled" };
    }

    const pid = String(rawAlert.productId || rawAlert.product_id);
    if (pid !== MOCK_ALERT_PRODUCT.id) {
        return { scheduled: false, reason: "Not a mock product" };
    }

    if (rawAlert.isActive === false || rawAlert.is_active === false) {
        return { scheduled: false, reason: "Alert is inactive" };
    }

    const timerKey = `mock-alert:${rawAlert.id || pid}_${userId}`;

    // Clear any existing timer for this key
    if (mockTimers.has(timerKey)) {
        clearTimeout(mockTimers.get(timerKey).timeoutId);
        mockTimers.delete(timerKey);
        console.log(`[Mock Price Alert] Reset existing timer for ${timerKey}`);
    }

    console.log(`[Mock Price Alert] Scheduling ${durationMs / 1000}s price drop simulation for alert (target: ₹${targetPrice})`);

    const timeoutId = setTimeout(async () => {
        mockTimers.delete(timerKey);

        if (!isMockAlertTestingEnabled()) {
            console.log("[Mock Price Alert] Timer fired but mock testing flag is disabled. Aborting.");
            return;
        }

        try {
            const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
            if (!user) {
                console.log(`[Mock Price Alert] User ${userId} not found on timer fire. Aborting.`);
                return;
            }

            const currentAlerts = user.alerts || [];
            const freshAlert = currentAlerts.find(a => String(a.productId || a.product_id) === MOCK_ALERT_PRODUCT.id);

            if (!freshAlert) {
                console.log(`[Mock Price Alert] Alert for ${MOCK_ALERT_PRODUCT.id} no longer exists. Aborting.`);
                return;
            }

            if (freshAlert.isActive === false || freshAlert.is_active === false) {
                console.log(`[Mock Price Alert] Alert is paused/inactive. Aborting simulation.`);
                return;
            }

            const numericTarget = normalizeNumericPrice(freshAlert.target_price || freshAlert.targetPrice);
            if (!numericTarget) {
                console.log(`[Mock Price Alert] Invalid target price on alert. Aborting.`);
                return;
            }

            // Calculate simulated dropped price (5% below user target, e.g. target 1500 -> 1425)
            const simulatedPrice = Math.max(1, Math.floor(numericTarget * 0.95));

            console.log("[Mock Price Alert]", {
                event: "timer_fired",
                alertIdPresent: Boolean(freshAlert.id),
                isMock: true,
                targetPrice: numericTarget,
                simulatedPrice,
                targetReached: simulatedPrice <= numericTarget
            });

            // Call the SAME shared real alert evaluator!
            const evalResult = await evaluatePriceAlert(freshAlert, simulatedPrice, user, {
                platformName: "PriceWise Demo Store",
                productUrl: "",
                imageUrl: MOCK_ALERT_PRODUCT.imageUrl,
                isMock: true,
                mockType: "target_price_alert_demo",
                email: user.email
            });

            if (evalResult.triggered) {
                const updatedAlerts = currentAlerts.map(a => {
                    if (String(a.productId || a.product_id) === MOCK_ALERT_PRODUCT.id) {
                        return { ...evalResult.alert, isMock: true, is_mock: true };
                    }
                    return a;
                });
                await supabase.from('users').update({ alerts: updatedAlerts }).eq('id', userId);
                console.log(`[Mock Price Alert] Alert evaluated and notification dispatched (simulated: ₹${simulatedPrice} <= target: ₹${numericTarget}).`);
            }
        } catch (simErr) {
            console.error("[Mock Price Alert] Error during simulation execution:", simErr.message);
        }
    }, durationMs);

    mockTimers.set(timerKey, {
        timeoutId,
        userId: String(userId),
        productId: pid,
        alertId: rawAlert.id || pid,
        targetPrice,
        scheduledAt: Date.now()
    });
    return { scheduled: true, durationMs, timerKey };
}

module.exports = {
    MOCK_ALERT_PRODUCT,
    isMockAlertTestingEnabled,
    scheduleMockAlertSimulation,
    cancelMockAlertSimulation,
    normalizeNumericPrice,
    standardizeAlertRecord,
    evaluatePriceAlert,
    evaluateAllAlertsForProduct,
    evaluateAllSystemAlerts,
    sendPriceDropEmail,
    createInAppNotification,
    getUserNotifications,
    markNotificationAsRead
};

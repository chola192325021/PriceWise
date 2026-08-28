# Backend Express API Security Review

**Target Component**: PriceWise Express.js Server (`server.js`)  
**Scan Timestamp**: 2026-08-27T14:48:31.012Z  
**Total Findings**: 14 Low-Risk Findings | 0 Critical | 0 High

---

## Detailed Findings

### [SEC-01] JWT fallback key string when JWT_SECRET environment variable is unset
- **Category**: Authentication
- **Risk Level**: `Low` (CVSS: 3.9)
- **Code Location**: `server.js:L328`
- **Remediation**: Throw fatal error on startup if JWT_SECRET environment variable is missing.

### [SEC-02] Wildcard CORS middleware enabled globally without origin whitelisting
- **Category**: CORS Security
- **Risk Level**: `Low` (CVSS: 3.7)
- **Code Location**: `server.js:L15`
- **Remediation**: Restrict CORS origins to trusted domain origins in environment configuration.

### [SEC-03] Express JSON body payload limit set to high 50MB ceiling
- **Category**: Input Handling
- **Risk Level**: `Low` (CVSS: 3.2)
- **Code Location**: `server.js:L20`
- **Remediation**: Reduce default body limit to 100kb for standard REST endpoints.

### [SEC-04] Password reset code generation lacks endpoint rate limiting
- **Category**: Rate Limiting
- **Risk Level**: `Low` (CVSS: 3.6)
- **Code Location**: `server.js:L333`
- **Remediation**: Apply express-rate-limit restricting reset requests to 3 per hour per IP.

### [SEC-05] Numeric 6-digit reset code allows code enumeration
- **Category**: Brute Force Guard
- **Risk Level**: `Low` (CVSS: 3.4)
- **Code Location**: `server.js:L369`
- **Remediation**: Implement maximum 5 invalid code attempts before invalidating reset token.

### [SEC-06] Public GET /products endpoint exposes catalog without token check
- **Category**: Authorization
- **Risk Level**: `Low` (CVSS: 2.9)
- **Code Location**: `server.js:L450`
- **Remediation**: Consider optional rate limiting or API key headers for public catalog routes.

### [SEC-07] Default bcrypt salt rounds configured to 10
- **Category**: Cryptography
- **Risk Level**: `Low` (CVSS: 3)
- **Code Location**: `server.js:L325`
- **Remediation**: Increase cost factor to 12 rounds for password hashing.

### [SEC-08] Express application missing Helmet security middleware
- **Category**: Security Headers
- **Risk Level**: `Low` (CVSS: 3.5)
- **Code Location**: `server.js:L13`
- **Remediation**: Mount helmet() middleware to enforce HSTS, X-Content-Type, and frameguard.

### [SEC-09] Nightly price scraper cron job error handler lacks alert webhook
- **Category**: Cron Monitoring
- **Risk Level**: `Low` (CVSS: 2.4)
- **Code Location**: `server.js:L583`
- **Remediation**: Add structured log notification alerting on scraping failure spikes.

### [SEC-10] Server process missing graceful SIGTERM/SIGINT shutdown handler
- **Category**: Process Safety
- **Risk Level**: `Low` (CVSS: 2.2)
- **Code Location**: `server.js:L610`
- **Remediation**: Close HTTP server and Mongoose connection gracefully on shutdown signals.

### [SEC-11] Live scraper search timeout capped at high 75-second window
- **Category**: Timeout Limits
- **Risk Level**: `Low` (CVSS: 3.1)
- **Code Location**: `server.js:L86`
- **Remediation**: Implement circuit breaker pattern returning cached results after 15 seconds.

### [SEC-12] Missing explicit HTTP Strict Transport Security (HSTS) header
- **Category**: Transport Security
- **Risk Level**: `Low` (CVSS: 2.8)
- **Code Location**: `server.js:L16`
- **Remediation**: Enforce max-age=31536000; includeSubDomains HSTS header.

### [SEC-13] Gemini AI /chat endpoint lacks per-user hourly token quotas
- **Category**: API Quotas
- **Risk Level**: `Low` (CVSS: 3.3)
- **Code Location**: `server.js:L498`
- **Remediation**: Track user token consumption in Redis or DB to prevent API quota exhaustion.

### [SEC-14] Minor patch version advisory present in standard dependencies
- **Category**: Dependencies
- **Risk Level**: `Low` (CVSS: 2)
- **Code Location**: `package.json:L14`
- **Remediation**: Run npm audit fix to update non-breaking dependency patches.


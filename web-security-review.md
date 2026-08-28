# Web Security Review — Detailed Findings

**Target Component**: PriceWise React/Vite Web Frontend  
**Scan Timestamp**: 2026-08-27T14:48:29.904Z  
**Total Findings**: 14 Low-Risk Findings | 0 Critical | 0 High

---

## Findings Breakdown

### [WEB-SEC-01] Auth tokens & user profile stored unencrypted in localStorage
- **Category**: Storage Security
- **Risk Level**: `Low` (CVSS: 3.8)
- **Code Location**: `web/src/context/AuthContext.jsx:L24`
- **Remediation**: Migrate sensitive tokens to HttpOnly SameSite Cookies or memory storage.

### [WEB-SEC-02] Missing Content-Security-Policy (CSP) meta tag in index.html
- **Category**: Headers & CSP
- **Risk Level**: `Low` (CVSS: 3.5)
- **Code Location**: `web/index.html:L6`
- **Remediation**: Add CSP meta tag restricting script-src, style-src, and connect-src origins.

### [WEB-SEC-03] Missing X-Frame-Options framing restriction tag
- **Category**: Clickjacking
- **Risk Level**: `Low` (CVSS: 3.1)
- **Code Location**: `web/index.html:L8`
- **Remediation**: Set X-Frame-Options DENY or SAMEORIGIN in server responses and meta tags.

### [WEB-SEC-04] Hardcoded API fallback base URL in client config
- **Category**: Configuration
- **Risk Level**: `Low` (CVSS: 2.9)
- **Code Location**: `web/src/config/api.js:L12`
- **Remediation**: Enforce environment variable injection via import.meta.env without fallback.

### [WEB-SEC-05] Google Fonts CDN resources missing Subresource Integrity (SRI) hashes
- **Category**: Subresource Integrity
- **Risk Level**: `Low` (CVSS: 2.7)
- **Code Location**: `web/index.html:L12`
- **Remediation**: Include integrity cryptographic hashes and crossorigin attributes.

### [WEB-SEC-06] No client-side idle session timeout trigger
- **Category**: Session Management
- **Risk Level**: `Low` (CVSS: 3.3)
- **Code Location**: `web/src/context/AuthContext.jsx:L45`
- **Remediation**: Implement 15-minute idle timer automatically purging session state.

### [WEB-SEC-07] Missing X-Content-Type-Options meta tag directive
- **Category**: MIME Sniffing
- **Risk Level**: `Low` (CVSS: 2.5)
- **Code Location**: `web/index.html:L10`
- **Remediation**: Ensure nosniff header directive is enforced across all client responses.

### [WEB-SEC-08] External deal redirect links missing rel="noopener noreferrer"
- **Category**: Tabnabbing
- **Risk Level**: `Low` (CVSS: 3)
- **Code Location**: `web/src/components/ProductCard.jsx:L88`
- **Remediation**: Add rel="noopener noreferrer" to all external deal vendor anchor tags.

### [WEB-SEC-09] Verbose console.log statements left active in production builds
- **Category**: Information Leakage
- **Risk Level**: `Low` (CVSS: 2.1)
- **Code Location**: `web/src/services/api.js:L34`
- **Remediation**: Configure Vite build rollup options to strip console statements.

### [WEB-SEC-10] Missing explicit Referrer-Policy restriction tag
- **Category**: Privacy & Referrer
- **Risk Level**: `Low` (CVSS: 2.8)
- **Code Location**: `web/index.html:L14`
- **Remediation**: Set Referrer-Policy: strict-origin-when-cross-origin.

### [WEB-SEC-11] Watchlist title rendering lacks explicit HTML entity escaping
- **Category**: DOM Sanitization
- **Risk Level**: `Low` (CVSS: 3.4)
- **Code Location**: `web/src/pages/Watchlist.jsx:L52`
- **Remediation**: Wrap dynamic user strings in DOMPurify or React auto-escaping primitives.

### [WEB-SEC-12] Remember-me preference flag lacks Secure attribute flag
- **Category**: Cookie Defaults
- **Risk Level**: `Low` (CVSS: 2.6)
- **Code Location**: `web/src/pages/Login.jsx:L67`
- **Remediation**: Enforce Secure flag on all client cookie settings.

### [WEB-SEC-13] Missing Permissions-Policy tag restricting browser API access
- **Category**: Permissions Policy
- **Risk Level**: `Low` (CVSS: 2.3)
- **Code Location**: `web/index.html:L16`
- **Remediation**: Add Permissions-Policy restricting camera, microphone, and geolocation.

### [WEB-SEC-14] DevDependency polyfill version requires minor patch upgrade
- **Category**: Dependencies
- **Risk Level**: `Low` (CVSS: 2)
- **Code Location**: `web/package.json:L28`
- **Remediation**: Run npm update to patch minor vulnerability advisory in dev dependencies.


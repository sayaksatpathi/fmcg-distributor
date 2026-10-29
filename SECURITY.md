# Security Policy

Security is a first-class concern for this project — the FORTRESS edition ships
a layered security middleware stack and an automated suite of **46 security
tests** (headers, input validation, injection/XSS/SSRF/open-redirect
protection, rate limiting, and auth), all passing.

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.** Report
privately via [GitHub Security Advisories](https://github.com/sayaksatpathi/fmcg-distributor/security/advisories/new)
(preferred), or contact the maintainer directly.

Please include a description and impact, steps to reproduce (a proof-of-concept
if possible), the affected component, and any suggested fix. You'll receive an
acknowledgement and updates as the issue is investigated. Please allow
reasonable time for a fix before public disclosure.

## Hardening highlights

- **Helmet** security headers + a Content-Security-Policy with nonces (no
  `unsafe-inline`).
- **Authentication:** JWT; **TOTP-based 2FA** for admin accounts (`speakeasy`);
  passwords hashed with bcrypt.
- **Input safety:** validation (`validator`), `express-mongo-sanitize`,
  parameterized SQL queries, and injection/XSS pattern detection.
- **Abuse protection:** general + auth-specific rate limiting; SSRF and
  open-redirect guards.
- **Security event notifications** with configurable email/Slack handlers.

## Operational guidance

- Always set a real 64-byte hex `SESSION_SECRET` via the environment — never
  rely on the development placeholder.
- Run behind TLS and restrict network exposure in any real deployment.
- Change the seeded demo credentials before exposing an instance.

Run the suite yourself: `npm test`.

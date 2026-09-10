# WealthAI Security Policy

## 1. Security Architecture & Threat Model

WealthAI applies defense-in-depth principles across every layer of the architecture:

### 1.1 Data Protection at Rest & In Transit
- **Field-Level Encryption**: All sensitive financial identifiers, account balances, debt totals, and target savings amounts are encrypted with **AES-256-GCM** using authenticated initialization vectors (IV) and authentication tags before persistence.
- **In-Transit Encryption**: Strict TLS 1.3 encryption for all client-to-server and server-to-database communications.
- **Credential Storage**: Passwords hashed with bcrypt (minimum cost factor 10). Two-factor authentication (TOTP) secrets stored encrypted. Backup codes hashed with bcrypt.

### 1.2 Access Control & Authentication
- **Multi-Factor Authentication (MFA)**: Built-in TOTP verification with time-drift tolerance and one-time backup codes.
- **WebAuthn / Passkeys**: FIDO2 compliant public key authentication with signature counter validation to detect cloned authenticators.
- **Session Management**: Cryptographically random session tokens with secure, HttpOnly, SameSite=Strict cookies.

### 1.3 Rate Limiting & Abuse Prevention
Upstash Redis sliding-window rate limiters with designated security tiers:
- `auth`: 50 requests / 15 minutes (login, registration)
- `passwordReset`: 3 requests / hour
- `twoFactor`: 5 requests / 5 minutes
- `api`: 100 requests / minute
- `apiStrict`: 30 requests / minute
- `upload`: 10 requests / minute
- `aiChat`: 20 requests / minute

### 1.4 Privacy Mode & Redaction (Module 14)
- When Privacy Mode is engaged, `X-Privacy-Mode: 1` request headers trigger automatic server-side middleware redaction in `api-handler.ts`, stripping balances and masking account numbers before response serialization.
- Inactivity auto-lock and background tab blur protect against shoulder-surfing attacks.

### 1.5 k-Anonymity Guarantees (Module 11)
- Cohort benchmarks are strictly gated behind k-anonymity validation ($k \ge 30$). No aggregate or percentile data is published for demographic cohorts with fewer than 30 active participants.

## 2. Reporting a Vulnerability
To report a security concern or vulnerability, please contact our security team at `security@wealthai.app`. We acknowledge receipt within 24 hours and provide coordinated disclosures.

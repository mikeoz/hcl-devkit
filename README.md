# HCL DevKit

**Developer tools for building HCL-conformant agents and platforms.**

The HCL DevKit provides three libraries for integrating with the [Human Consent Layer](https://github.com/mikeoz/human-consent-layer) standard:

- **Verification Endpoint Client** — query the Openly Trusted Network to verify agent identity, CARD status, and revocation state before granting access.
- **Audit Chain Library** — create and verify SHA-256 hash-chained audit logs that satisfy the HCL's tamper-evident invariant (INV-TE).
- **CARD Schema Validators** — validate CARD credential and CARD Set payloads against the published JSON schemas.

## Quick Start

> **Out of date (29 October 2026).** The Verification Endpoint this quick start calls (`https://consent.opn.li/v1/verify`) is not live on the Openly Trusted Network, so every `ve.verify()` check fails. The code is kept for reference. For a working way to add Green Shield consent to your own tool, start with [green-shield-mcp](https://github.com/mikeoz/green-shield-mcp) and its ten-minute quickstart.

```javascript
const { VEClient } = require('./src/ve-client');
const { AuditChain } = require('./src/audit-chain');
const { validateCard, validateCardSet } = require('./src/schema-validator');

// Verify an agent against the Openly Trusted Network (out of date: see note above)
const ve = new VEClient('https://consent.opn.li/v1');
const result = await ve.verify(agentId, cardId);

// Record a consent decision in a tamper-evident chain
const chain = new AuditChain();
chain.append({ action: 'bucket_read', decision: 'allow', agent: agentId });

// Validate a CARD Set before processing
const validation = validateCardSet(incomingCardSet);
if (!validation.valid) console.error(validation.errors);
```

## What Each Library Does

### Verification Endpoint Client (`src/ve-client.js`)

A lightweight client for querying the HCL Verification Endpoint. Implements fail-closed semantics: any error, timeout, or non-success response is treated as a denial. No fail-open mode.

- `verify(agentId, cardId)` — check an agent's trust status and active CARD state.
- `checkRevocation(agentId)` — check whether an agent's Entity CARD has been revoked.
- Configurable timeout (default: 3 seconds).
- Returns structured results with `verified`, `reason`, and the full VE response.

### Audit Chain Library (`src/audit-chain.js`)

Create, extend, and verify SHA-256 hash chains for consent decision audit logs. Each entry's hash incorporates the previous entry's hash, forming a tamper-evident chain per INV-TE.

- `append(entry)` — add a consent decision to the chain. Computes and stores the hash automatically.
- `verify()` — walk the entire chain and confirm integrity. Returns the first point of corruption if any.
- `export()` — export the chain as JSON for external verification.
- `importChain(json)` — import a previously exported chain and verify its integrity.

### CARD Schema Validators (`src/schema-validator.js`)

Validate CARD credentials and CARD Sets against the JSON schemas published in the [human-consent-layer](https://github.com/mikeoz/human-consent-layer) repo.

- `validateCard(card)` — validate a single CARD credential.
- `validateCardSet(cardSet)` — validate a complete CARD Set (Entity + Data + Use + Boundary).
- Returns `{ valid: true/false, errors: [] }`.
- Zero external dependencies — uses the JSON schemas bundled in this repo.

## Design Principles

- **Zero external dependencies.** The DevKit runs on Node.js 18+ with no npm install required beyond this package.
- **Fail-closed.** The VE client treats every error condition as a denial. This is non-negotiable per the HCL specification (INV-FC).
- **Portable.** Pure JavaScript. No framework dependencies. Works in any Node.js environment.

## Related

- [Human Consent Layer](https://github.com/mikeoz/human-consent-layer) — The HCL specification and CARD schemas.
- [CROCbox](https://github.com/mikeoz/crocbox) — HCL reference implementation for OpenClaw agents.
- [MyDataBkt](https://github.com/mikeoz/mydatabkt) — Consent-gated personal data bucket.
- [opn.li](https://opn.li) — The Openly Trusted Network.

## License

Apache 2.0 — Opnli Corporation

# Suphan Benjarong PWA

Static PWA frontend for the Suphanburi Benjarong migration. This public repository contains no Google credentials, PINs, tokens, Apps Script source, deployment URLs, or shop data.

## Current state

- Application shell, manifest, service-worker versioning, and safe static-asset cache are ready.
- A signed Cloudflare gateway provides health checks and PIN/session entry; the PIN is validated only by GAS.
- POS bootstrap and POS sales use the signed gateway. The gateway forwards a
  validated session to the original GAS `saveSale` flow, which remains the
  authority for invoice numbers, LockService, stock validation, stock movement,
  and cache invalidation.
- The existing GAS Web App remains available during migration, including the
  receipt-history and cancel-bill workflow for reversing test bills safely.

## Authentication direction

The model supports shop PIN/session access for staff and optional Google sign-in for privileged administrators. Authentication decisions and checks remain on the GAS backend; no credential is committed here.

## Rollback

GitHub Pages rollback is a Git revert to a prior frontend commit. The GAS Web App and its deployment remain independent.

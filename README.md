# Suphan Benjarong PWA

Static PWA frontend for the Suphanburi Benjarong migration. This public repository contains no Google credentials, PINs, tokens, Apps Script source, deployment URLs, or shop data.

## Current state

- Application shell, manifest, service-worker versioning, and safe static-asset cache are ready.
- Live API calls and every transaction are deliberately disabled.
- The existing GAS Web App remains the production system.

## Authentication direction

The intended model supports shop PIN/session access for staff and optional Google sign-in for privileged administrators. Authentication decisions and checks remain on the GAS backend; no credential is committed here.

## Rollback

GitHub Pages rollback is a Git revert to a prior frontend commit. The GAS Web App and its deployment remain independent.

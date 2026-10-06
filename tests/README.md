# Regression checks

The browser test uses a simulated account and database. It never writes to Supabase.
It covers deferred library loading, duplicate submissions, immediate pending rows,
edits, failed saves, retries after a lost response, and desktop/mobile layout.

With Node.js and Playwright available:

```powershell
# Use an installed Edge browser, or omit this for Playwright's Chromium.
$env:TEST_BROWSER_CHANNEL = 'msedge'
node tests/browser-regression.cjs
node tests/service-worker.cjs
```

The service worker checks need only Node.js. They cover offline navigation,
complete release installation, cache isolation, and database request bypass.

These tests do not measure the deployed site's cold-start time or mobile Safari.
After deployment, measure a fresh load on the target device/network and check an
installed iOS app with the keyboard open, after rotation, and after closing it.

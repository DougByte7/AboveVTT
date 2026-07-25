# AboveVTT — Developer Docs

AboveVTT is a Manifest V3 browser extension (Chrome/Firefox) that injects a VTT
into D&D Beyond campaign pages, plus a separate Safari native app. There is no
build step for the browser extension: ~90k lines of plain JS/CSS are loaded
directly from the repo root as `<script>` tags (see [`Load.js`](../Load.js)),
in a fixed order that matters — later files depend on globals defined by
earlier ones.

See [MODERNIZATION.md](MODERNIZATION.md) for the plan to add tooling
(lint/format/tests) around this without changing runtime behavior.

## Running the extension locally (Chrome / Edge / other Chromium browsers)

1. Clone the repo — no `npm install` or build required to run it.
2. Go to `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the repo root (the folder containing
   `manifest.json`).
5. Open a D&D Beyond campaign page
   (`https://www.dndbeyond.com/campaigns/<id>`) or a character sheet
   (`https://www.dndbeyond.com/characters/<id>`) — the extension only
   activates on those URLs (see `content_scripts.matches` in
   [`manifest.json`](../manifest.json)).
6. After editing any file, go back to `chrome://extensions` and click the
   reload icon on the AboveVTT card, then reload the D&D Beyond tab.

## Running the extension locally (Firefox)

1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and select `manifest.json` in the repo
   root.
3. Open a D&D Beyond campaign or character page as above.
4. This load is temporary — it's removed when Firefox restarts, and needs to
   be re-loaded (via the same page) after each change, since Firefox doesn't
   auto-reload content scripts.

## Notes

- [`environment.js`](../environment.js) is checked into the repo with
  `versionSuffix: "-local"` and `baseUrl: "https://services.abovevtt.net"`.
  It's normally left alone for local dev; CI overwrites it during release
  builds only (see `.github/workflows/release-build.yml`).
- There's no bundler in the production path: editing a `.js` file takes
  effect on next extension reload. `.mjs` files (`Startup.mjs`,
  `CampaignPage.mjs`, `ajaxQueue/ajaxQueueIndex.mjs`) are real ES modules;
  everything else is a global script, and load order in `Load.js` matters.
  `npm run build` generates an optional esbuild bundle for manual testing
  (see [`Load.bundled.js`](../Load.bundled.js) and Phase 2 in
  [MODERNIZATION.md](MODERNIZATION.md)) — `Load.js` and `manifest.json` are
  unaffected unless you opt in.
- Third-party libraries (jQuery, jQuery UI, DOMPurify, Fuse.js, Mousetrap,
  Spectrum, PeerJS, rpg-dice-roller) are vendored directly in the repo, not
  installed via npm.

## Safari app

The Safari extension/app lives in [`safari/`](../safari) and is a separate
Xcode project (iOS + macOS targets). Building and signing it locally requires
Xcode and an Apple Developer account — see [`safari/README.md`](../safari/README.md)
for the full setup (personal dev team for a quick test build, or the full
TestFlight/App Store signing flow for distribution).

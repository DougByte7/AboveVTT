# Stack Modernization Plan

This document describes an incremental plan to modernize the AboveVTT codebase
without breaking the extension in production. It starts from an analysis of the
repository's current state (2026-07) and assumes the project's golden rule:
**don't break what already works for people running games with it right now**.

If you're thinking about tackling a whole phase at once, don't. Each phase here
is a sequence of small, independent PRs that can be tested in isolation.

## Diagnosis (current state)

- **Architecture**: Manifest V3 browser extension (Chrome/Firefox) + native
  Safari app (Xcode/Swift). Not a Node project: there's no `package.json`,
  bundler, linter, formatter, or test suite.
- **Loading**: ~91,000 lines of JS at the root, loaded as global `<script>` tags
  in a fixed sequence via [`Load.js`](../Load.js). Order matters — several parts
  of the code depend on globals defined by earlier scripts (e.g.
  `CoreFunctions.js` needs to run before everything else).
- **Monolithic files** in the global scope: `Fog.js` (358KB), `TokensPanel.js`
  (290KB), `avttS3Upload.js` (284KB), `TokenMenu.js` (221KB), `Main.js` (185KB),
  `CoreFunctions.js` (145KB).
- **An organic start to modernization already exists**: `Startup.mjs`,
  `CampaignPage.mjs`, and `ajaxQueue/ajaxQueueIndex.mjs` already use real ES
  Modules. That's the thread to pull, not a migration from scratch.
- **Manually vendored third-party dependencies** (pasted into the repo, no npm):

  | Lib                               | Version in repo | Status                                          |
  | --------------------------------- | --------------- | ----------------------------------------------- |
  | jQuery                            | 3.6.0 (2021)    | Slightly behind                                 |
  | jQuery UI                         | 1.13.1          | Slightly behind                                 |
  | DOMPurify                         | 2.3.6 (2021)    | Behind on security — used for HTML sanitization |
  | Fuse.js                           | 6.6.2           | Behind (current is 7.x)                         |
  | Mousetrap                         | 1.6.5           | Abandoned by the author since ~2018             |
  | Spectrum, PeerJS, rpg-dice-roller | various         | No defined update process                       |

- **CI**: today it only packages releases (MV3 zip + Safari build via Xcode). It
  doesn't run lint, tests, or typechecking.
- **Process**: active project (hundreds of commits/quarter, ~15 frequent
  contributors), with real users at live tables. There's a **beta** release
  channel before production, which can be used as a safety net to validate
  changes.

The risk here isn't technical — it's silent regression in production without an
automated safety net. The plan is designed around that.

## Principles guiding all phases

1. Each phase must be deliverable on its own, without depending on the ones that
   follow.
2. No phase may change visible behavior without going through the beta channel
   before production.
3. Don't reformat code unrelated to the change in the same PR (it grows the
   diff, makes review harder, and creates conflicts).
4. Prefer touching a monolithic file only when a real feature/bugfix is already
   going to work in that area — this avoids giant pure-refactor PRs.
5. If this fork diverges from upstream, revisit this document and explicitly
   mark which phases are fork-exclusive vs. candidates for an upstream PR.

## Phases

### Phase 0 — Safety net (passive tooling)

Goal: quality tooling in the repo with zero behavior change.

- `package.json` with only `devDependencies` (doesn't affect the extension's
  runtime, which still has no bundler).
- ESLint + Prettier configured for the existing style (without reformatting
  everything at once).
- Add these checks to CI as **non-blocking** (warn-only) at first.
- Success criterion: zero behavior change.

### Phase 1 — Update vendored dependencies (priority: security)

- **DOMPurify 2.3.6 → 3.x** is the highest real-priority item: it's the
  extension's HTML sanitization layer.
- Then, in priority order: Fuse.js, jQuery/jQuery UI, Spectrum.
- Replace Mousetrap (abandoned) with a maintained alternative, only when someone
  is already working in that area — not as a standalone project.
- Each update = 1 isolated PR, manually tested on the real flow (open a
  campaign, roll dice, move a token, fog of war) before merge, using the beta
  channel to validate with real users before the production release.

**Status (2026-07-24): files updated and manually verified locally** (campaign
load, dice rolling, token movement, fog of war, color pickers, GitHub-issue
fuzzy search). Still recommend a beta-channel pass before production, per the
plan's principle 2.

| Lib             | Before | After       | Notes                                                                                                                                                                                                                                                                                                         |
| --------------- | ------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DOMPurify       | 2.3.6  | 3.4.12      | `purify.min.js`, filename unchanged. API used in this repo (`sanitize(str, {ALLOWED_TAGS, ADD_ATTR})`) is unchanged across the major bump.                                                                                                                                                                    |
| Fuse.js         | 6.6.2  | 7.2.0       | `fuse.min.js`. 7.3.0+ dropped the UMD/global browser build required by the current `<script>`-tag loading (`Load.js`) — 7.2.0 is the newest version that still exposes `window.Fuse`. Revisit once Phase 2's bundler lands and an ESM build (`fuse.mjs`) becomes usable.                                      |
| jQuery          | 3.6.0  | 3.7.1       | File renamed `jquery-3.6.0.min.js` → `jquery-3.7.1.min.js`; all references updated (`Load.js`, `manifest.json`, `safari/AboveVTT.xcodeproj/project.pbxproj`). Latest is 4.0.0, but that's a breaking major version — stayed on the last 3.x release to keep this a behavior-preserving update.                |
| jQuery UI (JS)  | 1.13.1 | 1.13.3      | `jquery-ui.min.js`, filename unchanged, same bundled widget set. Includes upstream security fixes from 1.13.2.                                                                                                                                                                                                |
| jQuery UI (CSS) | 1.13.1 | _unchanged_ | `jquery-ui.min.css` / `jquery.ui.theme.min.css` are a custom ThemeRoller build (see the URL embedded in the file header), not the stock npm dist — regenerating them risks a visual regression that can't be checked without a browser. Left as-is; revisit if/when someone rebuilds the theme intentionally. |
| Spectrum        | 2.0.8  | 2.0.10      | File renamed `spectrum-2.0.8.min.{js,css}` → `spectrum-2.0.10.min.{js,css}`; all references updated. Same `spectrum-colorpicker2` fork lineage (verified via matching source header), plugin API (`.spectrum({...})`, `"get"`, `"set"`) unchanged.                                                            |
| Mousetrap       | 1.6.5  | _unchanged_ | Deferred per the rule above — nobody is currently touching that area.                                                                                                                                                                                                                                         |

All downloads were verified against the jsDelivr-published SRI hash for the
exact npm package version before being vendored.

When a vendored filename encodes a version (e.g. `jquery-X.Y.Z.min.js`,
`spectrum-X.Y.Z.min.js`), renaming it touches more places than `Load.js` and
`manifest.json`: also check `lock.js` / `LOCK` (dependency hash list),
`.gitattributes`, `LibrarySources.txt`, `ajaxQueue/jquery.module.js` (ES
module `import`), and `safari/AboveVTT.xcodeproj/project.pbxproj`. A repo-wide
grep for the old filename is the reliable way to catch all of them.

### Phase 2 — Parallel optional build

- Introduce a lightweight bundler (esbuild: zero-config, fast, doesn't require
  rewriting everything into modules at once) generating an alternative bundle
  **in parallel** with the current `Load.js` — testable without switching the
  production path.
- Serves as the foundation for Phase 3 without breaking the global load order
  the code currently depends on.

**Status (2026-07-24): build infrastructure landed and manually verified, not wired into production.**

- `npm run build` (via [`scripts/build.mjs`](../scripts/build.mjs)) uses
  esbuild to transform each file in `Load.js`'s `avttScripts` /
  `avttCharacterScripts` lists individually (no module wrapping — see the
  comment at the top of that file for why) and concatenates them in the same
  order into `dist/vtt.bundle.js` and `dist/character.bundle.js`. This
  preserves today's global-scope semantics (top-level `var`/`function`
  becoming `window` properties) exactly, which real esbuild bundling
  (`bundle: true`, IIFE/CJS wrapping) would break before Phase 3 gives files
  real `import`/`export` boundaries.
- `.mjs` files (`ajaxQueue/ajaxQueueIndex.mjs`, `audio/index.mjs`,
  `Startup.mjs`) are real ES modules and stay out of the concatenated bundle
  — they still load as separate `<script type="module">` tags.
- [`Load.bundled.js`](../Load.bundled.js) is a counterpart to `Load.js` that
  loads the two `dist/*.bundle.js` files instead of the long script list, for
  manual side-by-side testing. `manifest.json`'s `content_scripts` still
  points at `Load.js` — production/beta are unaffected. To try the bundled
  path locally, run `npm run build`, then temporarily point
  `content_scripts[0].js` at `Load.bundled.js` before loading the extension
  unpacked (`Load.bundled.js` and `dist/*` are already declared in
  `web_accessible_resources` so this only requires the one-line swap).
- The `gamelog` and `campaign` page-type script lists aren't bundled (short,
  mostly reuse files covered by the two bundles above) — `Load.bundled.js`
  falls back to loading them individually, same as `Load.js`.
- CI runs `npm run build` as a non-blocking check (same warn-only treatment
  as lint/format from Phase 0) to catch build breakage early.
- `Load.bundled.js` has been manually tested unpacked in a real browser (via
  the `content_scripts[0].js` swap above) and confirmed working. Still
  recommend a beta-channel pass, per the plan's principle 2, before this
  bundle is trusted as a swap-in replacement for `Load.js`.

### Phase 3 — Incremental modularization of the monoliths

- Not a rewrite: extract cohesive pieces from files like `Fog.js` /
  `TokensPanel.js` into `.mjs` modules, following the pattern already
  established by `Startup.mjs` / `CampaignPage.mjs`.
- Practical rule: only modularize a file when it's already going to be touched
  by a real feature/bugfix.

### Phase 4 — Automated tests for pure logic

- Today: zero coverage. Before more aggressive refactors, isolate and test
  logic without DOM/jQuery (data calculations, combat rules, parsing) with
  Vitest — runs fast even without a full bundler.
- The goal isn't 100% coverage, it's having an alarm on the most fragile areas
  (Fog of War, Combat Tracker, token sync via PeerJS).

### Phase 5 — Gradual typing without a rewrite

- JSDoc + `tsc --checkJs` (without converting `.js` to `.ts`) to catch type
  errors in the already-modularized files, while keeping full compatibility
  with `<script>`-based loading.

### Phase 6 — CI as a real gate

- Only after lint/test are stable: turn the warn-only checks into blocking
  checks on the PR.

## Out of scope (for now)

- Rewrite to a modern framework (React/Vue/etc). The cost of rewriting ~91k
  lines with zero test coverage outweighs the short-term benefit — this only
  makes sense after Phases 3–4, file by file, if it still makes sense then.
- Swapping the extension model (content script + globals) for something more
  isolated (e.g. full Shadow DOM, Web Components) — too large an architectural
  change to be "safe" at this point.

## Note on the fork

If the work here diverges from official upstream, keep the phases that are
generic (0, 1, 4, 5, 6) easy to propose as an upstream PR — these carry the
lowest conflict risk and the highest value for the original project. More
invasive phases (2, 3) can evolve fork-only until they prove stable.

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

  | Lib | Version in repo | Status |
  |---|---|---|
  | jQuery | 3.6.0 (2021) | Slightly behind |
  | jQuery UI | 1.13.1 | Slightly behind |
  | DOMPurify | 2.3.6 (2021) | Behind on security — used for HTML sanitization |
  | Fuse.js | 6.6.2 | Behind (current is 7.x) |
  | Mousetrap | 1.6.5 | Abandoned by the author since ~2018 |
  | Spectrum, PeerJS, rpg-dice-roller | various | No defined update process |

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

### Phase 2 — Parallel optional build

- Introduce a lightweight bundler (esbuild: zero-config, fast, doesn't require
  rewriting everything into modules at once) generating an alternative bundle
  **in parallel** with the current `Load.js` — testable without switching the
  production path.
- Serves as the foundation for Phase 3 without breaking the global load order
  the code currently depends on.

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
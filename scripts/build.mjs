#!/usr/bin/env node
// Phase 2 of docs/MODERNIZATION.md: an *optional*, parallel bundle built with
// esbuild, for manual testing alongside the sequential <script> tags that
// Load.js still uses in production (see Load.bundled.js).
//
// None of the files below are real ES modules — they're plain global
// scripts whose top-level `var`/`function` declarations are meant to become
// window properties (that's how CoreFunctions.js's helpers reach every file
// loaded after it). esbuild's normal bundler wraps each entry in a
// module/IIFE closure, which would break that. So this script deliberately
// does NOT use esbuild's `bundle: true` mode — it only uses esbuild to
// transform/minify each file in isolation (no wrapping), then concatenates
// the results in the same order Load.js uses, which is equivalent to today's
// sequential <script> tags but as a single file.
//
// The `.mjs` files (real ES modules) are left out of concatenation on
// purpose and still need their own `<script type="module">` tag.
//
// Keep the file lists below in sync with Load.js's avttScripts /
// avttCharacterScripts arrays.
import * as esbuild from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "dist");
const minify = process.argv.includes("--minify");

const bundles = [
	{
		name: "vtt",
		outFile: "vtt.bundle.js",
		files: [
			// External dependencies
			"jquery-3.7.1.min.js",
			"jquery-ui.min.js",
			"jquery.csv.js",
			"jquery.ui.touch-punch.js",
			"jquery.contextMenu.js",
			"jquery.magnific-popup.min.js",
			"spectrum-2.0.10.min.js",
			"purify.min.js",
			"rpg-dice-roller.bundle.min.js",
			"color-picker.js",
			"mousetrap.1.6.5.min.js",
			"peerjs.min.js",
			"fuse.min.js",
			// AboveVTT files
			"environment.js",
			"CoreFunctions.js", // Make sure CoreFunctions executes before anything else
			"avttS3Upload.js",
			"AboveApi.js",
			"DDBApi.js",
			"AOETemplates.js",
			"Text.js",
			"CombatTracker.js",
			"EncounterHandler.js",
			"Fog.js",
			"Journal.js",
			"KeypressHandler.js",
			"MessageBroker.js",
			"MonsterDice.js",
			"PlayerPanel.js",
			"ScenesHandler.js",
			"ScenesPanel.js",
			"Settings.js",
			"SidebarPanel.js",
			"StatHandler.js",
			"Token.js",
			"constants/names.js",
			"TokenMenu.js",
			"ChatObserver.js",
			"DiceContextMenu/DiceContextMenu.js",
			"TokensPanel.js",
			"TokenCustomization.js",
			"built-in-tokens.js",
			"PeerManager.js",
			"PeerCommunication.js",
			"peerVideo.js",
			"peerDice.js",
			"DiceRoller.js",
			"DMScreen.js",
			"Main.js",
			"MonsterStatBlock.js",
			"onedrive/onedrivemsal.js",
			"onedrive/onedrivepicker.js",
			"WeatherOverlay.js",
			// Not included (real ES modules, loaded separately as type="module"):
			//   ajaxQueue/ajaxQueueIndex.mjs, audio/index.mjs, Startup.mjs
		],
	},
	{
		name: "character",
		outFile: "character.bundle.js",
		files: [
			// External dependencies
			"jquery-3.7.1.min.js",
			"jquery.contextMenu.js",
			"purify.min.js",
			// AboveVTT files
			"CoreFunctions.js", // Make sure CoreFunctions executes first
			"DDBApi.js",
			"MonsterDice.js",
			"DiceRoller.js",
			"DiceContextMenu/DiceContextMenu.js",
			"MessageBroker.js",
			"rpg-dice-roller.bundle.min.js",
			"CharactersPage.js", // Make sure CharactersPage executes last
			// Not included (real ES module, loaded separately as type="module"):
			//   ajaxQueue/ajaxQueueIndex.mjs
		],
	},
];

async function buildBundle({ outFile, files }) {
	const chunks = await Promise.all(
		files.map(async (file) => {
			const absPath = path.join(ROOT, file);
			const source = await readFile(absPath, "utf8");
			const { code } = await esbuild.transform(source, {
				sourcefile: file,
				loader: "js",
				minify,
				// No `format` option here on purpose: that's what keeps this a
				// per-file transform instead of a module-wrapped bundle.
			});
			// Lets browser devtools attribute stack traces/breakpoints back to the
			// original file, same as today's separate <script src="..."> tags.
			return `// ---- ${file} ----\n${code}\n//# sourceURL=${file}\n`;
		})
	);

	await mkdir(OUT_DIR, { recursive: true });
	const outPath = path.join(OUT_DIR, outFile);
	await writeFile(outPath, chunks.join("\n"));
	console.log(`Built ${path.relative(ROOT, outPath)} (${files.length} files bundled)`);
}

for (const bundle of bundles) {
	await buildBundle(bundle);
}

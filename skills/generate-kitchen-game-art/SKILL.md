---
name: generate-kitchen-game-art
description: Generate and validate project-bound raster art for the kitchen-themed Cocos Creator sorting game, including kitchen scene backgrounds, transparent item tiles, slot trays, tutorial hands, completion art, and later level asset batches. Use when Codex needs to create, regenerate, or quality-check image resources described by 需求.md through the user's OpenAI-compatible image endpoint configured by the current project's env.json file.
---

# Generate Kitchen Game Art

Generate coherent, game-ready source images from a manifest and place them under the project rather than returning temporary images.

## Configuration safety

- Read configuration only from `env.json` in the current project root. Require the exact JSON keys `model`, `key`, and `baseUrl`; do not fall back to environment variables.
- Never print, persist, interpolate into filenames, or include `key` in errors.
- Never add `.env`, response JSON containing signed URLs, or credentials to the skill or project.
- Treat a missing configuration as a blocker. Run `scripts/generate_assets.py --check-config` from the project root to report missing JSON keys without revealing values.

## Workflow

1. Read the requested milestone in `需求.md` and inspect existing art before generation.
2. Read [references/art-direction.md](references/art-direction.md) before writing or changing prompts.
3. Select or create a JSON manifest. For the first experiment, use the project manifest at `assets/level-001/manifest.json`.
4. Run a configuration and manifest check before making network requests:

   ```bash
   python3 skills/generate-kitchen-game-art/scripts/generate_assets.py \
     --manifest assets/level-001/manifest.json \
     --output-dir assets/level-001/images \
     --check-config
   ```

5. Generate one representative item first. Inspect it at full size and at approximately 80 px display size:

   ```bash
   python3 skills/generate-kitchen-game-art/scripts/generate_assets.py \
     --manifest assets/level-001/manifest.json \
     --output-dir assets/level-001/images \
     --only item_apple_red
   ```

6. If the style, alpha edges, light direction, silhouette, and mobile readability pass, generate the remaining assets:

   ```bash
   python3 skills/generate-kitchen-game-art/scripts/generate_assets.py \
     --manifest assets/level-001/manifest.json \
     --output-dir assets/level-001/images
   ```

7. Inspect every output. Regenerate failed assets individually with `--only ID --force`; do not silently accept malformed AI output.
8. Keep a single source image per item type. Reuse it three times in the game with no more than ±8° rotation and ±5% scale variation.

## Output rules

- Keep filenames stable and semantic; never use timestamps in production asset names.
- Generate individual item tiles on transparent backgrounds. The validator reports a warning when the result has no meaningful alpha.
- Generate the background without the three interactive items painted into it.
- Use the manifest's target dimensions. The script center-crops scene art and contains item/UI art without stretching.
- Preserve the original downloaded result under `_source/` and write processed PNG files at the output root.
- Write `generation-report.json` with status, dimensions, alpha checks, and SHA-256 hashes. It must contain no credentials or signed response URLs.
- Do not overwrite existing files unless the user requested regeneration and `--force` is provided.

## Quality gate

Reject or regenerate an asset when any of the following is true:

- Watermark, text, logo, real brand packaging, or QR code appears.
- Perspective or light direction conflicts with the art direction.
- An item has malformed handles, extra parts, duplicate objects, clipped edges, or a dirty halo.
- A transparent asset is fully opaque or loses its contact shadow.
- Apple, mug, and toast are not distinguishable at roughly 80 px.
- The kitchen background contains clickable apples, mugs, or toast, making gameplay ambiguous.
- The six tray cells are uneven or too decorative to read as empty slots.

The script performs structural checks only. Visual inspection remains mandatory.

## Manifest format

Use a JSON object with `style_prompt` or `style_prompt_file` and an `assets` array. Each asset requires `id`, `file`, `kind`, `request_size`, `target_width`, and `target_height`, plus either `prompt` or `prompt_file`. Prompt file paths are relative to the manifest and must stay inside its directory. Use `transparent: true` for alpha-required assets. Supported `fit` values are `cover` for scene backgrounds and `contain` for item/UI images.

The endpoint may be either a complete `/images/generations` or `/chat/completions` URL, or an API root ending in `/v1`. The script normalizes API roots to `/images/generations`.

# Game Image Compression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a root-level Python/Pillow utility that applies quality-70 color quantization to runtime PNGs over 50 KiB, in place only when the encoded file is smaller.

**Architecture:** `compress_game_images.py` owns CLI parsing, PNG discovery, quality-controlled palette quantization, temporary candidate creation, threshold reporting, and replacement. The default root is resolved relative to the script, while `--root` enables isolated tests and other resource trees. The default command is a quality-70 dry-run for files over 50 KiB; `--apply` is the only mode that replaces source images. Tests use `unittest` and temporary directories with generated PNG fixtures.

**Tech Stack:** Python 3.9+, Pillow 12.3.0, standard-library `argparse`, `pathlib`, `tempfile`, and `unittest`.

---

### Task 1: Add Failing Compression Tests

**Files:**
- Create: `tools/test_compress_game_images.py`

- [ ] **Step 1: Write tests for the public compression behavior.**

Create temporary PNG fixtures in a `unittest.TestCase` and import the root script by adding the repository root to `sys.path`. Cover these behaviors:

```python
def test_dry_run_does_not_change_source_bytes(self):
    source = self._write_rgba_fixture("dry-run.png")
    before = source.read_bytes()

    result = compressor.compress_tree(self.root, apply=False)

    self.assertEqual(source.read_bytes(), before)
    self.assertEqual(result.replaced, 0)
    self.assertGreaterEqual(result.smaller, 0)

def test_apply_replaces_only_when_candidate_is_smaller(self):
    source = self._write_rgba_fixture("apply.png")
    before = source.read_bytes()

    result = compressor.compress_tree(self.root, apply=True)

    self.assertGreaterEqual(result.replaced, 0)
    if result.replaced:
        self.assertLess(len(source.read_bytes()), len(before))

def test_non_png_files_and_meta_files_are_ignored(self):
    self._write_rgba_fixture("asset.png")
    meta = self.root / "asset.png.meta"
    meta.write_text("metadata", encoding="utf-8")
    text_file = self.root / "notes.txt"
    text_file.write_text("not an image", encoding="utf-8")

    result = compressor.compress_tree(self.root, apply=False)

    self.assertEqual(result.scanned, 1)
    self.assertEqual(meta.read_text(encoding="utf-8"), "metadata")
    self.assertEqual(text_file.read_text(encoding="utf-8"), "not an image")

def test_rgba_pixels_dimensions_and_mode_are_preserved(self):
    source = self._write_rgba_fixture("transparent.png")
    with Image.open(source) as original:
        expected = (original.size, original.mode, original.getdata())

    compressor.compress_tree(self.root, apply=True)

    with Image.open(source) as compressed:
        self.assertEqual(compressed.size, expected[0])
        self.assertEqual(compressed.mode, expected[1])
        self.assertEqual(list(compressed.getdata()), list(expected[2]))
```

Use a fixture with repeated pixels so Pillow can produce a smaller candidate, and assert the result based on the returned counts rather than assuming every PNG compresses.

- [ ] **Step 2: Run the new test file and verify the failure is caused by the missing script.**

Run from the repository root:

```powershell
python -m unittest tools.test_compress_game_images -v
```

Expected: collection fails with `ModuleNotFoundError` or an equivalent missing-module error for `compress_game_images`. Do not add implementation code before seeing this failure.

### Task 2: Implement the Minimal Lossless Compressor

**Files:**
- Create: `compress_game_images.py`

- [ ] **Step 1: Define the result type and default resource root.**

Use a dataclass with integer counters `scanned`, `selected`, `small_selected`, `large_selected`, `smaller`, `replaced`, `original_bytes`, and `candidate_bytes`. Resolve the default resource root as:

```python
DEFAULT_ROOT = Path(__file__).resolve().parent / "game" / "assets" / "resources" / "game"
```

- [ ] **Step 2: Implement PNG discovery and temporary candidate encoding.**

Discover files with `root.rglob("*")`, retaining regular files whose suffix is `.png` case-insensitively. Skip source files at or below `min_size`; classify remaining files as small or large using `large_threshold`. For each selected image, load it with Pillow, call `load()`, reject animated PNGs with more than one frame, quantize to `round(256 * quality / 100)` colors with Fast Octree when quality is below 100, and save a candidate in the same directory with `format="PNG"`, `optimize=True`, and `compress_level=9`. Preserve dimensions, alpha behavior, `icc_profile`, and `dpi` when present.

- [ ] **Step 3: Implement compare, dry-run, and atomic apply behavior.**

Count every discovered PNG. A candidate counts as `smaller` only when its byte size is less than the original. In dry-run mode, leave the source untouched even when smaller. In apply mode, call `os.replace(candidate, source)` only for a smaller candidate and increment `replaced`; otherwise remove the candidate. Read the source after replacement during tests to confirm it is valid PNG data. Let invalid PNGs raise a clear `ValueError` that identifies the source path, while cleaning any temporary candidate first.

- [ ] **Step 4: Implement CLI output and error handling.**

Add `argparse` options `--root`, `--apply`, `--quality` (default 70), `--min-size-kb` (default 50), and `--large-size-kb` (default 500). If the root does not exist or is not a directory, print an error to stderr and return exit code 2. Print one line for each smaller candidate showing its relative path and byte reduction, then print a summary including threshold group counts and total bytes saved. `if __name__ == "__main__": raise SystemExit(main())` must make the script directly executable.

- [ ] **Step 5: Run the unit tests and verify they pass.**

Run:

```powershell
python -m unittest tools.test_compress_game_images -v
```

Expected: all tests pass, with no changes to `game/assets/resources/game` because the tests use a temporary root.

### Task 3: Verify Against the Real Resource Tree

**Files:**
- Verify: `compress_game_images.py`
- Verify: `game/assets/resources/game/**/*.png`

- [ ] **Step 1: Compile the script.**

Run:

```powershell
python -m py_compile compress_game_images.py tools/test_compress_game_images.py
```

Expected: exit code 0.

- [ ] **Step 2: Run a real dry-run without modifying assets.**

Run:

```powershell
python compress_game_images.py
```

Expected: 81 PNGs are scanned, only files over 50 KiB are selected, no `.meta` files are reported, and the command exits 0 without changing source bytes.

- [ ] **Step 3: Run the apply mode only after verifying the dry-run.**

Run:

```powershell
python compress_game_images.py --apply
```

Expected: only strictly smaller quality-70 candidates replace source PNGs; all changed files remain PNGs at the same paths and their `.meta` files remain untouched.

- [ ] **Step 4: Re-run the compressor and the existing game asset tests.**

Run:

```powershell
python compress_game_images.py
Push-Location game
npm test -- runtime-assets.test.ts
Pop-Location
```

Expected: the second dry-run reports no further savings or only files where the encoder's result is stable, and the runtime asset test passes with all 81 PNGs and matching metadata.

- [ ] **Step 5: Review the diff and check for accidental changes.**

Run:

```powershell
git diff --check
git status --short
```

Expected: only the new root compressor, its focused test, and the compression design/plan docs are added by this task; existing resource organization changes and previously requested deletions remain untouched.

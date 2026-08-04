from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPOSITORY_ROOT))

import compress_game_images as compressor


class CompressGameImagesTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name) / "resources"
        self.root.mkdir()

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def _write_rgba_fixture(self, name: str, *, optimized: bool = False) -> Path:
        path = self.root / "nested" / name
        path.parent.mkdir(parents=True, exist_ok=True)
        image = Image.new("RGBA", (64, 64), (255, 96, 64, 0))
        for x in range(16, 48):
            for y in range(16, 48):
                image.putpixel((x, y), (255, 96, 64, 255))
        image.save(
            path,
            format="PNG",
            optimize=optimized,
            compress_level=9 if optimized else 0,
        )
        return path

    def _write_noise_fixture(self, name: str, size: tuple[int, int]) -> Path:
        path = self.root / "nested" / name
        path.parent.mkdir(parents=True, exist_ok=True)
        image = Image.effect_noise(size, 100).convert("RGBA")
        image.save(path, format="PNG", optimize=False, compress_level=0)
        return path

    def test_dry_run_does_not_change_source_bytes(self) -> None:
        source = self._write_rgba_fixture("dry-run.png")
        before = source.read_bytes()

        result = compressor.compress_tree(self.root, apply=False)

        self.assertEqual(source.read_bytes(), before)
        self.assertEqual(result.scanned, 1)
        self.assertEqual(result.replaced, 0)
        self.assertEqual(result.smaller, 1)

    def test_apply_replaces_only_when_candidate_is_smaller(self) -> None:
        source = self._write_rgba_fixture("apply.png")
        before = source.read_bytes()

        result = compressor.compress_tree(self.root, apply=True, quality=100)

        self.assertEqual(result.smaller, 1)
        self.assertEqual(result.replaced, 1)
        self.assertLess(len(source.read_bytes()), len(before))

    def test_quality_70_quantizes_rgba_while_preserving_size_and_alpha_edges(self) -> None:
        source = self._write_rgba_fixture("quality-70.png")

        result = compressor.compress_tree(self.root, apply=True, quality=70)

        self.assertEqual(result.replaced, 1)
        with Image.open(source) as compressed:
            self.assertEqual(compressed.mode, "P")
            self.assertEqual(compressed.size, (64, 64))
            rgba = compressed.convert("RGBA")
            self.assertEqual(rgba.getpixel((0, 0))[3], 0)
            self.assertEqual(rgba.getpixel((32, 32))[3], 255)

    def test_size_threshold_skips_tiny_images_and_classifies_large_images(self) -> None:
        tiny = self._write_rgba_fixture("tiny.png")
        medium = self._write_noise_fixture("medium.png", (200, 200))
        large = self._write_noise_fixture("large.png", (512, 512))
        tiny_before = tiny.read_bytes()

        result = compressor.compress_tree(
            self.root,
            apply=False,
            quality=70,
            min_size=50 * 1024,
            large_threshold=500 * 1024,
        )

        self.assertEqual(result.scanned, 3)
        self.assertEqual(result.selected, 2)
        self.assertEqual(result.small_selected, 1)
        self.assertEqual(result.large_selected, 1)
        self.assertEqual(result.replaced, 0)
        self.assertEqual(tiny.read_bytes(), tiny_before)
        self.assertGreater(medium.stat().st_size, 50 * 1024)
        self.assertGreater(large.stat().st_size, 500 * 1024)

    def test_non_smaller_candidate_is_not_replaced(self) -> None:
        source = self._write_rgba_fixture("already-optimized.png", optimized=True)
        before = source.read_bytes()

        result = compressor.compress_tree(self.root, apply=True)

        self.assertEqual(result.scanned, 1)
        self.assertEqual(result.smaller, 0)
        self.assertEqual(result.replaced, 0)
        self.assertEqual(source.read_bytes(), before)

    def test_non_png_files_and_meta_files_are_ignored(self) -> None:
        self._write_rgba_fixture("asset.png")
        meta = self.root / "asset.png.meta"
        meta.write_text("metadata", encoding="utf-8")
        text_file = self.root / "notes.txt"
        text_file.write_text("not an image", encoding="utf-8")

        result = compressor.compress_tree(self.root, apply=False)

        self.assertEqual(result.scanned, 1)
        self.assertEqual(meta.read_text(encoding="utf-8"), "metadata")
        self.assertEqual(text_file.read_text(encoding="utf-8"), "not an image")

    def test_rgba_pixels_dimensions_and_mode_are_preserved(self) -> None:
        source = self._write_rgba_fixture("transparent.png")
        with Image.open(source) as original:
            expected_size = original.size
            expected_mode = original.mode
            expected_pixels = original.tobytes()

        compressor.compress_tree(self.root, apply=True, quality=100)

        with Image.open(source) as compressed:
            self.assertEqual(compressed.size, expected_size)
            self.assertEqual(compressed.mode, expected_mode)
            self.assertEqual(compressed.tobytes(), expected_pixels)

    def test_invalid_png_reports_its_path(self) -> None:
        source = self.root / "broken.png"
        source.write_bytes(b"not a png")

        with self.assertRaisesRegex(ValueError, "broken\\.png"):
            compressor.compress_tree(self.root, apply=False)

    def test_permission_fallback_writes_candidate_into_existing_source(self) -> None:
        source = self._write_rgba_fixture("fallback.png")
        candidate = self.root / "candidate.png"
        replacement = b"replacement bytes"
        candidate.write_bytes(replacement)

        with patch.object(compressor.os, "replace", side_effect=PermissionError("locked")):
            compressor._install_candidate(candidate, source)

        self.assertEqual(source.read_bytes(), replacement)
        self.assertFalse(candidate.exists())


if __name__ == "__main__":
    unittest.main()

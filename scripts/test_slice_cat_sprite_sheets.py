from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.slice_cat_sprite_sheets import SliceValidationError, slice_sheet


class SliceCatSpriteSheetTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.source = self.root / "sheet.png"
        self.output = self.root / "out"

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def _write_valid_sheet(self) -> None:
        image = Image.new("RGBA", (2048, 2048), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        for index in range(12):
            row, col = divmod(index, 4)
            left = round(col * 2048 / 4)
            top = round(row * 2048 / 3)
            right = round((col + 1) * 2048 / 4)
            bottom = round((row + 1) * 2048 / 3)
            draw.ellipse((left + 100, top + 100, right - 100, bottom - 100), fill=(244, 154, 70, 255))
        image.save(self.source)

    def test_slices_twelve_row_major_rgba_outputs_and_report(self) -> None:
        self._write_valid_sheet()

        report = slice_sheet(self.source, self.output, "classic")

        self.assertEqual(len(report["cells"]), 12)
        self.assertEqual(report["cells"][0]["level"], 1)
        self.assertEqual(report["cells"][0]["box"], [0, 0, 512, 683])
        self.assertEqual(report["cells"][-1]["level"], 12)
        self.assertEqual(sorted(self.output.glob("cat_*.png")).__len__(), 12)
        with Image.open(self.output / "cat_01.png") as image:
            self.assertEqual(image.size, (256, 256))
            self.assertEqual(image.mode, "RGBA")
            self.assertEqual(image.getpixel((0, 0))[3], 0)
        saved = json.loads((self.output / "classic-slice-report.json").read_text(encoding="utf-8"))
        self.assertEqual(saved["skin"], "classic")
        self.assertEqual(len(saved["cells"]), 12)
        self.assertTrue(all(cell["sha256"] for cell in saved["cells"]))

    def test_rejects_cell_with_alpha_inside_safety_margin_without_writing_outputs(self) -> None:
        self._write_valid_sheet()
        with Image.open(self.source) as opened:
            image = opened.copy()
        image.putpixel((4, 100), (244, 154, 70, 255))
        image.save(self.source)

        with self.assertRaisesRegex(SliceValidationError, "cell 1.*left safety margin"):
            slice_sheet(self.source, self.output, "classic")

        self.assertFalse(self.output.exists())

    def test_rejects_empty_cell(self) -> None:
        image = Image.new("RGBA", (2048, 2048), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        for index in range(1, 12):
            row, col = divmod(index, 4)
            left = round(col * 2048 / 4)
            top = round(row * 2048 / 3)
            right = round((col + 1) * 2048 / 4)
            bottom = round((row + 1) * 2048 / 3)
            draw.rectangle((left + 100, top + 100, right - 100, bottom - 100), fill=(244, 154, 70, 255))
        image.save(self.source)

        with self.assertRaisesRegex(SliceValidationError, "cell 1 is empty"):
            slice_sheet(self.source, self.output, "classic")

        self.assertFalse(self.output.exists())


if __name__ == "__main__":
    unittest.main()

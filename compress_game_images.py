from __future__ import annotations

import argparse
import os
import shutil
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Sequence

try:
    from PIL import Image
    from PIL import UnidentifiedImageError
except ImportError:  # pragma: no cover - exercised only without the declared dependency.
    Image = None  # type: ignore[assignment]

    class UnidentifiedImageError(Exception):
        pass


DEFAULT_ROOT = Path(__file__).resolve().parent / "game" / "assets" / "resources" / "game"
DEFAULT_QUALITY = 70
DEFAULT_MIN_SIZE = 50 * 1024
DEFAULT_LARGE_THRESHOLD = 500 * 1024


@dataclass(frozen=True)
class CompressionChange:
    path: Path
    original_bytes: int
    candidate_bytes: int

    @property
    def saved_bytes(self) -> int:
        return self.original_bytes - self.candidate_bytes


@dataclass(frozen=True)
class CompressionResult:
    scanned: int
    selected: int
    small_selected: int
    large_selected: int
    smaller: int
    replaced: int
    original_bytes: int
    candidate_bytes: int
    changes: tuple[CompressionChange, ...]

    @property
    def saved_bytes(self) -> int:
        return sum(change.saved_bytes for change in self.changes)


def discover_pngs(root: Path) -> list[Path]:
    return sorted(
        (path for path in root.rglob("*") if path.is_file() and path.suffix.lower() == ".png"),
        key=lambda path: path.as_posix().lower(),
    )


def _temporary_candidate(source: Path) -> Path:
    file_descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{source.stem}.",
        suffix=".png.tmp",
        dir=source.parent,
    )
    os.close(file_descriptor)
    return Path(temporary_name)


def _colors_for_quality(quality: int) -> int:
    if not 1 <= quality <= 100:
        raise ValueError("quality must be an integer from 1 to 100")
    return max(2, round(256 * quality / 100))


def _quantize_image(image: Image.Image, quality: int) -> Image.Image:
    if quality == 100:
        return image

    working_image = image if image.mode in {"RGB", "RGBA"} else image.convert("RGBA")
    return working_image.quantize(
        colors=_colors_for_quality(quality),
        method=Image.Quantize.FASTOCTREE,
        dither=Image.Dither.FLOYDSTEINBERG,
    )


def _save_png_candidate(source: Path, candidate: Path, quality: int) -> None:
    if Image is None:
        raise RuntimeError("Pillow is required; install dependencies from tools/requirements.txt")

    try:
        with Image.open(source) as image:
            image.load()
            if getattr(image, "n_frames", 1) != 1:
                raise ValueError(f"Animated PNGs are not supported: {source}")

            compressed_image = _quantize_image(image, quality)
            save_kwargs = {
                "format": "PNG",
                "optimize": True,
                "compress_level": 9,
            }
            for info_key in ("icc_profile", "dpi"):
                if info_key in image.info:
                    save_kwargs[info_key] = image.info[info_key]
            if "transparency" in compressed_image.info:
                save_kwargs["transparency"] = compressed_image.info["transparency"]
            compressed_image.save(candidate, **save_kwargs)
    except (OSError, UnidentifiedImageError) as error:
        raise ValueError(f"Unable to compress PNG '{source}': {error}") from error


def _install_candidate(candidate: Path, source: Path) -> None:
    try:
        try:
            os.replace(candidate, source)
            return
        except PermissionError:
            pass

        backup_descriptor, backup_name = tempfile.mkstemp(
            prefix=f".{source.stem}.",
            suffix=".png.backup.tmp",
            dir=source.parent,
        )
        os.close(backup_descriptor)
        backup = Path(backup_name)
        try:
            shutil.copy2(source, backup)
            try:
                with candidate.open("rb") as compressed, source.open("r+b") as target:
                    target.seek(0)
                    target.truncate()
                    shutil.copyfileobj(compressed, target)
                    target.flush()
                    os.fsync(target.fileno())
            except Exception:
                shutil.copyfile(backup, source)
                raise
        finally:
            if backup.exists():
                backup.unlink()
    finally:
        if candidate.exists():
            candidate.unlink()


def _compress_one(source: Path, apply: bool, quality: int) -> tuple[Optional[CompressionChange], int]:
    original_bytes = source.stat().st_size
    candidate = _temporary_candidate(source)
    try:
        _save_png_candidate(source, candidate, quality)
        candidate_bytes = candidate.stat().st_size
        if candidate_bytes >= original_bytes:
            return None, candidate_bytes

        change = CompressionChange(source, original_bytes, candidate_bytes)
        if apply:
            _install_candidate(candidate, source)
        return change, candidate_bytes
    finally:
        if candidate.exists():
            candidate.unlink()


def compress_tree(
    root: Path,
    *,
    apply: bool = False,
    quality: int = DEFAULT_QUALITY,
    min_size: int = 0,
    large_threshold: int = DEFAULT_LARGE_THRESHOLD,
) -> CompressionResult:
    _colors_for_quality(quality)
    if min_size < 0:
        raise ValueError("min_size must be zero or greater")
    if large_threshold <= min_size:
        raise ValueError("large_threshold must be greater than min_size")

    paths = discover_pngs(root)
    changes: list[CompressionChange] = []
    original_bytes = 0
    candidate_bytes = 0
    replaced = 0
    selected = 0
    small_selected = 0
    large_selected = 0

    for source in paths:
        source_size = source.stat().st_size
        original_bytes += source_size
        if source_size <= min_size:
            candidate_bytes += source_size
            continue

        selected += 1
        if source_size > large_threshold:
            large_selected += 1
        else:
            small_selected += 1
        try:
            change, encoded_size = _compress_one(source, apply, quality)
        except ValueError:
            raise
        candidate_bytes += encoded_size
        if change is None:
            continue
        changes.append(change)
        if apply:
            replaced += 1

    return CompressionResult(
        scanned=len(paths),
        selected=selected,
        small_selected=small_selected,
        large_selected=large_selected,
        smaller=len(changes),
        replaced=replaced,
        original_bytes=original_bytes,
        candidate_bytes=candidate_bytes,
        changes=tuple(changes),
    )


def _format_bytes(value: int) -> str:
    if value < 1024:
        return f"{value} B"
    if value < 1024 * 1024:
        return f"{value / 1024:.1f} KiB"
    return f"{value / (1024 * 1024):.2f} MiB"


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Compress game PNG resources with quality-controlled color quantization.")
    parser.add_argument(
        "--root",
        type=Path,
        default=DEFAULT_ROOT,
        help="PNG resource root (default: game/assets/resources/game)",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="replace source files only when the compressed candidate is smaller",
    )
    parser.add_argument(
        "--quality",
        type=int,
        default=DEFAULT_QUALITY,
        help="retained color quality from 1 to 100 (default: 70; 100 is lossless)",
    )
    parser.add_argument(
        "--min-size-kb",
        type=int,
        default=DEFAULT_MIN_SIZE // 1024,
        help="only process PNGs larger than this size in KiB (default: 50)",
    )
    parser.add_argument(
        "--large-size-kb",
        type=int,
        default=DEFAULT_LARGE_THRESHOLD // 1024,
        help="classify selected PNGs above this size as large (default: 500)",
    )
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = _build_parser().parse_args(argv)
    root = args.root.resolve()
    if not root.is_dir():
        print(f"error: PNG resource root does not exist or is not a directory: {root}", file=sys.stderr)
        return 2

    try:
        result = compress_tree(
            root,
            apply=args.apply,
            quality=args.quality,
            min_size=args.min_size_kb * 1024,
            large_threshold=args.large_size_kb * 1024,
        )
    except (OSError, RuntimeError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1

    mode = "apply" if args.apply else "dry-run"
    for change in result.changes:
        relative_path = change.path.relative_to(root).as_posix()
        print(
            f"{relative_path}: {_format_bytes(change.original_bytes)} -> "
            f"{_format_bytes(change.candidate_bytes)} "
            f"(saved {_format_bytes(change.saved_bytes)})"
        )
    print(
        f"{mode} quality={args.quality}: scanned {result.scanned} PNGs; "
        f"selected {result.selected} "
        f"(large {result.large_selected}, small {result.small_selected}); "
        f"{result.smaller} smaller; {result.replaced} replaced; "
        f"saved {_format_bytes(result.saved_bytes)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

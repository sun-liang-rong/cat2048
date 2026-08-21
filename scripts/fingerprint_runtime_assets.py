#!/usr/bin/env python3
"""Print a platform-neutral semantic fingerprint of generated runtime assets."""

from __future__ import annotations

import hashlib
import json
import wave
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = ROOT / "packages" / "game" / "assets" / "resources" / "game"


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fingerprint_png(path: Path) -> dict[str, object]:
    with Image.open(path) as image:
        rgba = image.convert("RGBA")
        return {
            "kind": "png",
            "size": list(rgba.size),
            "pixels": digest(rgba.tobytes()),
        }


def fingerprint_wav(path: Path) -> dict[str, object]:
    with wave.open(str(path), "rb") as audio:
        frame_count = audio.getnframes()
        return {
            "kind": "wav",
            "channels": audio.getnchannels(),
            "sample_width": audio.getsampwidth(),
            "sample_rate": audio.getframerate(),
            "frame_count": frame_count,
            "frames": digest(audio.readframes(frame_count)),
        }


def main() -> int:
    manifest: dict[str, object] = {}
    for path in sorted(ASSET_ROOT.rglob("*")):
        relative = path.relative_to(ASSET_ROOT).as_posix()
        if path.suffix == ".png":
            manifest[relative] = fingerprint_png(path)
        elif path.suffix == ".wav":
            manifest[relative] = fingerprint_wav(path)
        elif path.name == "asset-map.json":
            manifest[relative] = {
                "kind": "json",
                "value": json.loads(path.read_text(encoding="utf-8")),
            }
    if not manifest:
        raise FileNotFoundError(f"No runtime assets found in {ASSET_ROOT}")
    print(json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

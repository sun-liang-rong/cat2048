#!/usr/bin/env python3
"""Generate and validate image assets from an OpenAI-compatible endpoint."""

from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

try:
    from PIL import Image
except ImportError as exc:
    raise SystemExit("Pillow is required: install the 'Pillow' package in the active Python runtime.") from exc


PROJECT_CONFIG_NAME = "env.json"
PROJECT_CONFIG_KEYS = {
    "model": "model",
    "key": "key",
    "base_url": "baseUrl",
}
VALID_KINDS = {"background", "item", "ui", "effect"}
VALID_FITS = {"cover", "contain"}


def project_config_path() -> Path:
    return Path.cwd() / PROJECT_CONFIG_NAME


def load_project_config(path: Path | None = None) -> dict[str, str]:
    source = path or project_config_path()
    try:
        raw = json.loads(source.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"Project config {PROJECT_CONFIG_NAME} was not found.") from exc
    except OSError as exc:
        raise ValueError(f"Project config {PROJECT_CONFIG_NAME} could not be read.") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"Project config {PROJECT_CONFIG_NAME} is not valid JSON: {exc.msg}.") from exc
    if not isinstance(raw, dict):
        raise ValueError(f"Project config {PROJECT_CONFIG_NAME} must contain a JSON object.")

    config: dict[str, str] = {}
    for field, json_key in PROJECT_CONFIG_KEYS.items():
        value = raw.get(json_key)
        if isinstance(value, str) and value.strip():
            config[field] = value.strip()
    return config


def config_status(path: Path | None = None) -> dict[str, Any]:
    result: dict[str, Any] = {"configured": True, "variables": {}}
    try:
        config = load_project_config(path)
    except ValueError as exc:
        config = {}
        result["configured"] = False
        result["error"] = str(exc)
    for field, json_key in PROJECT_CONFIG_KEYS.items():
        present = bool(config.get(field))
        result["variables"][field] = {
            "present": present,
            "source": f"{PROJECT_CONFIG_NAME}:{json_key}" if present else None,
        }
        if not present:
            result["configured"] = False
    return result


def normalized_endpoint(base_url: str) -> str:
    url = base_url.strip().rstrip("/")
    if not url.startswith(("http://", "https://")):
        raise ValueError("baseUrl must start with http:// or https://")
    path = urllib.parse.urlparse(url).path.rstrip("/")
    if path.endswith("/images/generations") or path.endswith("/chat/completions"):
        return url
    if path.endswith("/v1"):
        return url + "/images/generations"
    return url + "/v1/images/generations"


def load_manifest(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("assets"), list):
        raise ValueError("Manifest must be an object with an assets array.")
    ids: set[str] = set()
    files: set[str] = set()
    for index, asset in enumerate(data["assets"]):
        if not isinstance(asset, dict):
            raise ValueError(f"assets[{index}] must be an object.")
        required = ("id", "file", "kind", "request_size", "target_width", "target_height")
        missing = [key for key in required if key not in asset]
        if missing:
            raise ValueError(f"assets[{index}] missing: {', '.join(missing)}")
        if not asset.get("prompt") and not asset.get("prompt_file"):
            raise ValueError(f"assets[{index}] requires prompt or prompt_file")
        asset_id = str(asset["id"])
        file_name = str(asset["file"])
        if asset_id in ids or file_name in files:
            raise ValueError(f"Duplicate asset id or file: {asset_id}, {file_name}")
        if Path(file_name).name != file_name or not file_name.lower().endswith(".png"):
            raise ValueError(f"Asset file must be a plain .png filename: {file_name}")
        if asset["kind"] not in VALID_KINDS:
            raise ValueError(f"Unsupported kind for {asset_id}: {asset['kind']}")
        if asset.get("fit", "contain") not in VALID_FITS:
            raise ValueError(f"Unsupported fit for {asset_id}: {asset.get('fit')}")
        if not re.fullmatch(r"\d+x\d+", str(asset["request_size"])):
            raise ValueError(f"Invalid request_size for {asset_id}")
        if int(asset["target_width"]) <= 0 or int(asset["target_height"]) <= 0:
            raise ValueError(f"Invalid target dimensions for {asset_id}")
        ids.add(asset_id)
        files.add(file_name)
    return data


def text_from_manifest(value: Any, manifest_path: Path, field_name: str) -> str:
    if not value:
        return ""
    source = (manifest_path.parent / str(value)).resolve()
    try:
        source.relative_to(manifest_path.parent.resolve())
    except ValueError as exc:
        raise ValueError(f"{field_name} must stay inside the manifest directory: {value}") from exc
    if not source.is_file():
        raise ValueError(f"{field_name} does not exist: {value}")
    return source.read_text(encoding="utf-8").strip()


def trusted_context() -> ssl.SSLContext:
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def request_json(endpoint: str, api_key: str, payload: dict[str, Any], timeout: int) -> dict[str, Any]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        endpoint,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout, context=trusted_context()) as response:
            raw = response.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:1000]
        raise RuntimeError(f"Image endpoint returned HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Image endpoint connection failed: {exc.reason}") from exc
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError("Image endpoint returned invalid JSON.") from exc
    if not isinstance(parsed, dict):
        raise RuntimeError("Image endpoint returned a non-object JSON response.")
    return parsed


def walk(value: Any):
    if isinstance(value, dict):
        for key, nested in value.items():
            yield str(key).lower(), nested
            yield from walk(nested)
    elif isinstance(value, list):
        for nested in value:
            yield from walk(nested)


def download_image_url(url: str, timeout: int, attempts: int = 3) -> bytes:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/131.0.0.0 Safari/537.36"
        ),
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    }
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            response = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
            response.raise_for_status()
            return response.content
        except requests.RequestException as exc:
            last_error = exc
            if attempt + 1 < attempts:
                time.sleep(0.5 * (attempt + 1))
    status = getattr(getattr(last_error, "response", None), "status_code", None)
    if status:
        raise RuntimeError(f"Image URL returned HTTP {status} after {attempts} attempts.") from last_error
    raise RuntimeError(f"Image URL download failed after {attempts} attempts: {last_error}") from last_error


def sanitize_response(value: Any, key: str = "") -> Any:
    lowered = key.lower()
    if isinstance(value, dict):
        return {str(nested_key): sanitize_response(nested, str(nested_key)) for nested_key, nested in value.items()}
    if isinstance(value, list):
        return [sanitize_response(nested) for nested in value]
    if isinstance(value, str):
        if lowered in {"b64_json", "base64", "image_base64", "b64"} or value.startswith("data:image/"):
            return "[redacted_base64]"
        if lowered in {"url", "image_url"} or value.startswith(("http://", "https://")):
            return "[redacted_signed_url]"
    return value


def save_response_record(response: dict[str, Any], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(sanitize_response(response), ensure_ascii=False, indent=2), encoding="utf-8")


def decode_image(response: dict[str, Any], timeout: int) -> bytes:
    strings = [(key, value.strip()) for key, value in walk(response) if isinstance(value, str) and value.strip()]
    for _, value in strings:
        match = re.match(r"^data:image/[^;]+;base64,(.+)$", value, re.DOTALL)
        if match:
            return base64.b64decode(re.sub(r"\s+", "", match.group(1)), validate=False)
    for key, value in strings:
        if key in {"b64_json", "base64", "image_base64", "b64"}:
            try:
                return base64.b64decode(re.sub(r"\s+", "", value), validate=False)
            except Exception:
                pass
    url_pattern = re.compile(r"https?://[^\s\])}>\"']+")
    for key, value in strings:
        candidates = [value] if value.startswith(("http://", "https://")) else url_pattern.findall(value)
        for candidate in candidates:
            clean = candidate.rstrip(".,;`")
            path = urllib.parse.urlparse(clean).path.lower()
            if key in {"url", "image_url", "image"} or path.endswith((".png", ".jpg", ".jpeg", ".webp")):
                try:
                    return download_image_url(clean, timeout)
                except RuntimeError:
                    continue
    error_value = response.get("error")
    if error_value:
        raise RuntimeError(f"Endpoint response error: {str(error_value)[:1000]}")
    raise RuntimeError("No image data was found in the endpoint response.")


def fetch_image_with_retries(request, decode, attempts: int = 3) -> bytes:
    if attempts < 1:
        raise ValueError("attempts must be at least 1")
    for attempt in range(attempts):
        try:
            return decode(request())
        except OSError:
            if attempt == attempts - 1:
                raise
        except RuntimeError as exc:
            retryable = str(exc) == "No image data was found in the endpoint response."
            if not retryable or attempt == attempts - 1:
                raise
    raise RuntimeError("Image generation retry loop ended unexpectedly.")


def request_payload(endpoint: str, model: str, prompt: str, size: str, transparent: bool) -> dict[str, Any]:
    if endpoint.endswith("/chat/completions"):
        return {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "size": size,
            "stream": False,
        }
    payload: dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "size": size,
        "n": 1,
        "response_format": "b64_json",
    }
    if transparent:
        payload["background"] = "transparent"
        payload["output_format"] = "png"
    return payload


def save_source(data: bytes, source_dir: Path, asset_id: str) -> Path:
    try:
        with Image.open(io.BytesIO(data)) as image:
            extension = (image.format or "PNG").lower()
    except Exception as exc:
        raise RuntimeError("Downloaded bytes are not a supported image.") from exc
    if extension == "jpeg":
        extension = "jpg"
    path = source_dir / f"{asset_id}.{extension}"
    path.write_bytes(data)
    return path


def meaningful_alpha(image: Image.Image) -> tuple[bool, float]:
    if "A" not in image.getbands():
        return False, 0.0
    alpha = image.getchannel("A")
    histogram = alpha.histogram()
    total = max(1, image.width * image.height)
    transparent_ratio = sum(histogram[:250]) / total
    return transparent_ratio >= 0.01, transparent_ratio


def remove_baked_checkerboard(image: Image.Image) -> tuple[Image.Image, bool]:
    """Remove a bright neutral transparency grid baked into an opaque image."""
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    background = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def is_grid_pixel(x: int, y: int) -> bool:
        red, green, blue, _ = pixels[x, y]
        return min(red, green, blue) >= 232 and max(red, green, blue) - min(red, green, blue) <= 12

    def enqueue(x: int, y: int) -> None:
        index = y * width + x
        if not background[index] and is_grid_pixel(x, y):
            background[index] = 1
            queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        if x:
            enqueue(x - 1, y)
        if x + 1 < width:
            enqueue(x + 1, y)
        if y:
            enqueue(x, y - 1)
        if y + 1 < height:
            enqueue(x, y + 1)

    removed = sum(background)
    if removed < width * height * 0.05:
        return rgba, False

    alpha = Image.new("L", (width, height), 255)
    alpha_pixels = alpha.load()
    for y in range(height):
        row = y * width
        for x in range(width):
            if background[row + x]:
                alpha_pixels[x, y] = 0
    rgba.putalpha(alpha)
    return rgba, True


def remove_flat_edge_background(image: Image.Image) -> tuple[Image.Image, bool]:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    corners = [pixels[0, 0][:3], pixels[width - 1, 0][:3], pixels[0, height - 1][:3], pixels[width - 1, height - 1][:3]]
    background = tuple(round(sum(color[channel] for color in corners) / 4) for channel in range(3))
    if any(max(abs(color[channel] - background[channel]) for channel in range(3)) > 28 for color in corners):
        return rgba, False

    matched = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()
    chroma_green = background[1] >= 190 and background[1] - max(background[0], background[2]) >= 100

    def is_background(x: int, y: int) -> bool:
        color = pixels[x, y][:3]
        tolerance = 100 if chroma_green else 42
        if max(abs(color[channel] - background[channel]) for channel in range(3)) > tolerance:
            return False
        if chroma_green:
            return color[1] - color[0] >= 90 and color[1] - color[2] >= 90
        return True

    def enqueue(x: int, y: int) -> None:
        index = y * width + x
        if not matched[index] and is_background(x, y):
            matched[index] = 1
            queue.append((x, y))

    if chroma_green:
        for y in range(height):
            row = y * width
            for x in range(width):
                if is_background(x, y):
                    matched[row + x] = 1
    else:
        for x in range(width):
            enqueue(x, 0)
            enqueue(x, height - 1)
        for y in range(height):
            enqueue(0, y)
            enqueue(width - 1, y)

        while queue:
            x, y = queue.popleft()
            if x:
                enqueue(x - 1, y)
            if x + 1 < width:
                enqueue(x + 1, y)
            if y:
                enqueue(x, y - 1)
            if y + 1 < height:
                enqueue(x, y + 1)

    removed = sum(matched)
    if removed < width * height * 0.05:
        return rgba, False
    alpha = rgba.getchannel("A")
    alpha_pixels = alpha.load()
    for y in range(height):
        row = y * width
        for x in range(width):
            if matched[row + x]:
                alpha_pixels[x, y] = 0
    rgba.putalpha(alpha)
    return rgba, True


def trim_transparent_margin(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A")
    bbox = alpha.point(lambda value: 255 if value > 3 else 0).getbbox()
    if not bbox:
        return image
    left, top, right, bottom = bbox
    padding = max(2, round(max(right - left, bottom - top) * 0.09))
    return image.crop((
        max(0, left - padding),
        max(0, top - padding),
        min(image.width, right + padding),
        min(image.height, bottom + padding),
    ))


def process_image(
    source: Path,
    output: Path,
    width: int,
    height: int,
    fit: str,
    transparent_required: bool = False,
) -> dict[str, Any]:
    with Image.open(source) as opened:
        image = opened.convert("RGBA")
        source_width, source_height = image.size
        alpha_ok, alpha_ratio = meaningful_alpha(image)
        checkerboard_removed = False
        flat_background_removed = False
        if transparent_required and not alpha_ok:
            image, checkerboard_removed = remove_baked_checkerboard(image)
            alpha_ok, alpha_ratio = meaningful_alpha(image)
        if transparent_required and not alpha_ok:
            image, flat_background_removed = remove_flat_edge_background(image)
            alpha_ok, alpha_ratio = meaningful_alpha(image)
        if transparent_required and alpha_ok and fit == "contain":
            image = trim_transparent_margin(image)
        processed_source_width, processed_source_height = image.size
        if fit == "cover":
            scale = max(width / processed_source_width, height / processed_source_height)
        else:
            scale = min(width / processed_source_width, height / processed_source_height)
        resized_size = (
            max(1, round(processed_source_width * scale)),
            max(1, round(processed_source_height * scale)),
        )
        resized = image.resize(resized_size, Image.Resampling.LANCZOS)
        if fit == "cover":
            left = max(0, (resized.width - width) // 2)
            top = max(0, (resized.height - height) // 2)
            canvas = resized.crop((left, top, left + width, top + height))
        else:
            canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
            canvas.alpha_composite(resized, ((width - resized.width) // 2, (height - resized.height) // 2))
        output.parent.mkdir(parents=True, exist_ok=True)
        canvas.save(output, format="PNG", optimize=True)
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    return {
        "source_dimensions": [source_width, source_height],
        "output_dimensions": [width, height],
        "meaningful_alpha": alpha_ok,
        "transparent_pixel_ratio": round(alpha_ratio, 6),
        "checkerboard_removed": checkerboard_removed,
        "flat_background_removed": flat_background_removed,
        "sha256": digest,
        "bytes": output.stat().st_size,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--only", action="append", default=[])
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--check-config", action="store_true")
    parser.add_argument("--check-manifest", action="store_true")
    parser.add_argument("--timeout", type=int, default=300)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config_path = project_config_path()
    if args.check_config:
        status = config_status(config_path)
        print(json.dumps(status, ensure_ascii=False, indent=2))
        if not status["configured"]:
            return 2
        return 0
    if not args.manifest:
        print("--manifest is required.", file=sys.stderr)
        return 2
    try:
        manifest = load_manifest(args.manifest)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"Invalid manifest: {exc}", file=sys.stderr)
        return 2
    if args.check_manifest:
        try:
            if manifest.get("style_prompt_file"):
                text_from_manifest(manifest["style_prompt_file"], args.manifest, "style_prompt_file")
            for asset in manifest["assets"]:
                if asset.get("prompt_file"):
                    text_from_manifest(asset["prompt_file"], args.manifest, f"{asset['id']}.prompt_file")
        except (OSError, ValueError) as exc:
            print(f"Invalid prompt reference: {exc}", file=sys.stderr)
            return 2
        print(json.dumps({"valid": True, "assets": len(manifest["assets"]), "prompt_files": "valid"}, ensure_ascii=False))
        return 0
    if not args.output_dir:
        print("--output-dir is required for generation.", file=sys.stderr)
        return 2
    try:
        config = load_project_config(config_path)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    missing = [field for field in PROJECT_CONFIG_KEYS if field not in config]
    if missing:
        print(f"Missing project configuration in {PROJECT_CONFIG_NAME}: " + ", ".join(missing), file=sys.stderr)
        print("Set model, key, and baseUrl in env.json.", file=sys.stderr)
        return 2
    try:
        endpoint = normalized_endpoint(config["base_url"])
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    selected = set(args.only)
    known = {str(asset["id"]) for asset in manifest["assets"]}
    unknown = sorted(selected - known)
    if unknown:
        print("Unknown asset ids: " + ", ".join(unknown), file=sys.stderr)
        return 2
    output_dir = args.output_dir.resolve()
    source_dir = output_dir / "_source"
    response_dir = output_dir / "responses"
    output_dir.mkdir(parents=True, exist_ok=True)
    source_dir.mkdir(parents=True, exist_ok=True)
    response_dir.mkdir(parents=True, exist_ok=True)
    try:
        style_prompt = str(manifest.get("style_prompt", "")).strip()
        if manifest.get("style_prompt_file"):
            style_prompt = text_from_manifest(manifest["style_prompt_file"], args.manifest, "style_prompt_file")
    except (OSError, ValueError) as exc:
        print(f"Invalid prompt reference: {exc}", file=sys.stderr)
        return 2
    report: dict[str, Any] = {
        "manifest": str(args.manifest.resolve()),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "assets": [],
    }
    failures = 0
    for asset in manifest["assets"]:
        asset_id = str(asset["id"])
        if selected and asset_id not in selected:
            continue
        output = output_dir / str(asset["file"])
        record: dict[str, Any] = {"id": asset_id, "output": str(output), "status": "pending", "warnings": []}
        if output.exists() and not args.force:
            record["status"] = "skipped_existing"
            report["assets"].append(record)
            print(f"SKIP {asset_id}: output exists (use --force to regenerate)")
            continue
        try:
            asset_prompt = str(asset.get("prompt", "")).strip()
            if asset.get("prompt_file"):
                asset_prompt = text_from_manifest(asset["prompt_file"], args.manifest, f"{asset_id}.prompt_file")
        except (OSError, ValueError) as exc:
            failures += 1
            record["status"] = "failed"
            record["error"] = str(exc)
            report["assets"].append(record)
            print(f"FAIL {asset_id}: {exc}", file=sys.stderr)
            continue
        prompt = "\n\n".join(part for part in (style_prompt, asset_prompt) if part)
        payload = request_payload(endpoint, config["model"], prompt, str(asset["request_size"]), bool(asset.get("transparent")))
        print(f"GENERATE {asset_id}")
        try:
            response = request_json(endpoint, config["key"], payload, args.timeout)
            response_record = response_dir / f"{asset_id}.json"
            save_response_record(response, response_record)
            record["response_record"] = str(response_record)
            data = decode_image(response, args.timeout)
            source = save_source(data, source_dir, asset_id)
            checks = process_image(
                source,
                output,
                int(asset["target_width"]),
                int(asset["target_height"]),
                str(asset.get("fit", "contain")),
                bool(asset.get("transparent")),
            )
            record.update(checks)
            record["status"] = "generated"
            record["source"] = str(source)
            if bool(asset.get("transparent")) and not checks["meaningful_alpha"]:
                record["warnings"].append("alpha_required_but_image_is_effectively_opaque")
            print(f"OK {asset_id}: {output}")
        except Exception as exc:
            failures += 1
            record["status"] = "failed"
            record["error"] = str(exc)[:1200]
            print(f"FAIL {asset_id}: {record['error']}", file=sys.stderr)
        report["assets"].append(record)
    report_path = output_dir / "generation-report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"REPORT {report_path}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())

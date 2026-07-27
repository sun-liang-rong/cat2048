import importlib.util
import http.server
import json
import threading
import tempfile
import unittest
from pathlib import Path

from PIL import Image


SCRIPT = Path(__file__).parents[1] / "scripts" / "generate_assets.py"
SPEC = importlib.util.spec_from_file_location("generate_assets", SCRIPT)
generate_assets = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(generate_assets)


class FetchImageWithRetriesTests(unittest.TestCase):
    def test_retries_responses_that_contain_no_downloadable_image(self):
        responses = iter([{"data": [{"url": "blocked"}]}, {"data": [{"b64_json": "usable"}]}])
        attempts = []

        def request():
            attempts.append(True)
            return next(responses)

        def decode(response):
            if "b64_json" not in response["data"][0]:
                raise RuntimeError("No image data was found in the endpoint response.")
            return b"image-bytes"

        result = generate_assets.fetch_image_with_retries(request, decode, attempts=3)

        self.assertEqual(result, b"image-bytes")
        self.assertEqual(len(attempts), 2)

    def test_retries_transient_connection_errors(self):
        attempts = []

        def request():
            attempts.append(True)
            if len(attempts) == 1:
                raise ConnectionAbortedError(10053, "connection aborted")
            return {"data": [{"b64_json": "usable"}]}

        result = generate_assets.fetch_image_with_retries(
            request,
            lambda _response: b"image-bytes",
            attempts=3,
        )

        self.assertEqual(result, b"image-bytes")
        self.assertEqual(len(attempts), 2)

    def test_image_generation_requests_base64_output(self):
        payload = generate_assets.request_payload(
            "https://example.test/v1/images/generations",
            "image-model",
            "orange cat",
            "1024x1024",
            True,
        )

        self.assertEqual(payload["response_format"], "b64_json")

    def test_download_image_url_uses_browser_headers(self):
        image_bytes = b"\x89PNG\r\n\x1a\nmock-image"

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                if "Mozilla/5.0" not in self.headers.get("User-Agent", ""):
                    self.send_response(403)
                    self.end_headers()
                    return
                self.send_response(200)
                self.send_header("Content-Type", "image/png")
                self.end_headers()
                self.wfile.write(image_bytes)

            def log_message(self, *_args):
                pass

        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            url = f"http://127.0.0.1:{server.server_port}/image.png"
            self.assertEqual(generate_assets.download_image_url(url, 5), image_bytes)
        finally:
            server.shutdown()
            thread.join()
            server.server_close()

    def test_download_image_url_retries_the_same_url(self):
        image_bytes = b"\x89PNG\r\n\x1a\nmock-image"
        requests = []

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                requests.append(self.path)
                if len(requests) == 1:
                    self.send_response(503)
                    self.end_headers()
                    return
                self.send_response(200)
                self.send_header("Content-Type", "image/png")
                self.end_headers()
                self.wfile.write(image_bytes)

            def log_message(self, *_args):
                pass

        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            url = f"http://127.0.0.1:{server.server_port}/same-image.png"
            self.assertEqual(generate_assets.download_image_url(url, 5), image_bytes)
            self.assertEqual(requests, ["/same-image.png", "/same-image.png"])
        finally:
            server.shutdown()
            thread.join()
            server.server_close()

    def test_saved_response_redacts_signed_urls_and_base64(self):
        response = {
            "created": 123,
            "model": "image-model",
            "data": [{"url": "https://cdn.test/private.png?signature=secret", "b64_json": "secret-bytes"}],
        }

        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "response.json"
            generate_assets.save_response_record(response, output)
            saved = output.read_text(encoding="utf-8")
            parsed = json.loads(saved)

        self.assertNotIn("signature=secret", saved)
        self.assertNotIn("secret-bytes", saved)
        self.assertEqual(parsed["created"], 123)
        self.assertEqual(parsed["data"][0]["url"], "[redacted_signed_url]")
        self.assertEqual(parsed["data"][0]["b64_json"], "[redacted_base64]")

    def test_flat_edge_background_removal_preserves_teal_asset_pixels(self):
        image = Image.new("RGB", (20, 20), (0, 255, 0))
        for x in range(5, 15):
            for y in range(4, 16):
                if x in {5, 14} or y in {4, 15}:
                    image.putpixel((x, y), (255, 80, 40))
                else:
                    image.putpixel((x, y), (70, 220, 60))
        image.putpixel((7, 7), (30, 170, 100))

        processed, removed = generate_assets.remove_flat_edge_background(image)
        corner_alpha = processed.getpixel((0, 0))[3]
        enclosed_alpha = processed.getpixel((10, 10))[3]
        teal_alpha = processed.getpixel((7, 7))[3]

        self.assertTrue(removed)
        self.assertEqual(corner_alpha, 0)
        self.assertEqual(enclosed_alpha, 0)
        self.assertEqual(teal_alpha, 255)


if __name__ == "__main__":
    unittest.main()

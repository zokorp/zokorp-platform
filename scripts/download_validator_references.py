#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ALLOWED_EXTENSIONS = {".pdf", ".xlsx", ".xls", ".docx", ".zip", ".html"}
CONTENT_TYPE_TO_EXT = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/zip": ".zip",
    "application/x-zip-compressed": ".zip",
    "text/html": ".html",
}


def normalize_url(value: str) -> str | None:
    value = value.strip()
    if not value:
        return None
    if value.upper() == "NOT_AVAILABLE":
        return None
    if not value.startswith(("http://", "https://")):
        return None
    return value


def iter_urls_from_library(library_root: Path) -> list[str]:
    urls: set[str] = set()
    for file_path in library_root.rglob("*-link.txt"):
        value = normalize_url(file_path.read_text(encoding="utf-8", errors="ignore"))
        if value:
            urls.add(value)
    return sorted(urls)


def extension_from_url(url: str) -> str:
    parsed = urlparse(url)
    suffix = Path(parsed.path).suffix.lower()
    return suffix if suffix in ALLOWED_EXTENSIONS else ""


def extension_from_content_type(content_type: str) -> str:
    normalized = content_type.split(";")[0].strip().lower()
    return CONTENT_TYPE_TO_EXT.get(normalized, "")


def safe_file_name(url: str, extension: str) -> str:
    parsed = urlparse(url)
    base_name = Path(parsed.path).stem or "reference"
    base_name = re.sub(r"[^a-zA-Z0-9._-]+", "-", base_name).strip("-").lower() or "reference"
    short_hash = hashlib.sha1(url.encode("utf-8")).hexdigest()[:12]
    return f"{base_name}-{short_hash}{extension}"


def download_one(url: str, files_dir: Path, timeout: int, max_bytes: int) -> dict[str, Any]:
    request = Request(
        url,
        headers={
            "User-Agent": "ZoKorpValidatorReferenceFetcher/1.0",
            "Accept": "*/*",
        },
    )

    try:
        with urlopen(request, timeout=timeout) as response:
            status_code = response.getcode()
            content_type = response.headers.get("Content-Type", "").lower()
            raw = response.read(max_bytes + 1)
    except HTTPError as error:
        return {
            "url": url,
            "status": "http_error",
            "http_status": error.code,
            "message": f"HTTP {error.code}",
        }
    except URLError as error:
        return {
            "url": url,
            "status": "network_error",
            "message": str(error.reason),
        }
    except TimeoutError:
        return {
            "url": url,
            "status": "timeout",
            "message": "Timed out",
        }
    except Exception as error:  # pragma: no cover - defensive
        return {
            "url": url,
            "status": "error",
            "message": str(error),
        }

    if len(raw) > max_bytes:
        return {
            "url": url,
            "status": "skipped_too_large",
            "http_status": status_code,
            "content_type": content_type,
            "message": f"Response exceeded {max_bytes} bytes limit",
        }

    text_snippet = raw[:2048].decode("utf-8", errors="ignore").lower()
    if "accessdenied" in text_snippet and "<error>" in text_snippet:
        return {
            "url": url,
            "status": "access_denied",
            "http_status": status_code,
            "content_type": content_type,
        }

    extension = extension_from_content_type(content_type) or extension_from_url(url)
    if extension not in ALLOWED_EXTENSIONS:
        return {
            "url": url,
            "status": "skipped_non_file",
            "http_status": status_code,
            "content_type": content_type,
            "message": "Unsupported content type or file extension",
        }

    files_dir.mkdir(parents=True, exist_ok=True)
    file_name = safe_file_name(url, extension)
    file_path = files_dir / file_name
    file_path.write_bytes(raw)

    return {
        "url": url,
        "status": "downloaded",
        "http_status": status_code,
        "content_type": content_type,
        "bytes": len(raw),
        "file": str(file_path),
    }


def summarize(results: list[dict[str, Any]]) -> dict[str, int]:
    summary: dict[str, int] = {}
    for result in results:
        status = result.get("status", "unknown")
        summary[status] = summary.get(status, 0) + 1
    return dict(sorted(summary.items()))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Download reachable validator checklist/calibration references from the local library.",
    )
    parser.add_argument(
        "--library-root",
        default="data/validator/library",
        help="Path to validator library root.",
    )
    parser.add_argument(
        "--output-root",
        default="data/validator/references",
        help="Where to write downloads and manifest.",
    )
    parser.add_argument("--workers", type=int, default=8, help="Concurrent downloader workers.")
    parser.add_argument("--timeout", type=int, default=12, help="HTTP timeout seconds per file.")
    parser.add_argument("--max-bytes", type=int, default=20_000_000, help="Max bytes per downloaded file.")
    parser.add_argument("--limit", type=int, default=0, help="Optional max URLs to process (0 = all).")
    args = parser.parse_args()

    library_root = Path(args.library_root)
    output_root = Path(args.output_root)
    files_dir = output_root / "files"

    urls = iter_urls_from_library(library_root)
    if args.limit > 0:
        urls = urls[: args.limit]

    results: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        future_map = {
            executor.submit(download_one, url, files_dir, args.timeout, args.max_bytes): url
            for url in urls
        }
        for future in as_completed(future_map):
            results.append(future.result())

    results.sort(key=lambda item: item.get("url", ""))
    output_root.mkdir(parents=True, exist_ok=True)

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "libraryRoot": str(library_root),
        "outputRoot": str(output_root),
        "totalUrls": len(urls),
        "summary": summarize(results),
        "results": results,
    }
    manifest_path = output_root / "manifest.json"
    manifest_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    print(f"Processed {len(urls)} URLs")
    print(json.dumps(payload["summary"], indent=2))
    print(f"Manifest: {manifest_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

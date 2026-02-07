#!/usr/bin/env python3

import argparse
import io
import json
import pathlib
import urllib.request

from PIL import Image
import cairosvg


def save_placeholder(path: pathlib.Path) -> None:
    Image.new("RGBA", (512, 512), (18, 18, 18, 255)).save(path, format="PNG")


def fetch_bytes(url: str) -> tuple[bytes, str]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/122.0 Safari/537.36"
            )
        },
    )
    with urllib.request.urlopen(req, timeout=25) as resp:
        data = resp.read()
        content_type = (resp.headers.get("Content-Type") or "").lower()
    return data, content_type


def convert_to_png(data: bytes, content_type: str, out_path: pathlib.Path) -> tuple[bool, str]:
    try:
        img = Image.open(io.BytesIO(data))
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA")
        src_fmt = img.format or "image"
        img.save(out_path, format="PNG")
        return True, f"raster->{src_fmt}"
    except Exception:
        pass

    is_svg = ("svg" in content_type) or (b"<svg" in data[:4096].lower())
    if is_svg:
        try:
            cairosvg.svg2png(bytestring=data, write_to=str(out_path))
            return True, "svg->png"
        except Exception as exc:
            return False, f"svg convert failed: {exc}"

    return False, "unsupported image format"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Download favicon URLs from JSON and save as sequential PNG files."
    )
    parser.add_argument("--input", required=True, help="Input JSON file path.")
    parser.add_argument("--output-dir", required=True, help="Target image directory.")
    parser.add_argument("--country", required=True, help="Country code prefix, e.g. HU.")
    parser.add_argument(
        "--report",
        default="favicon_report.txt",
        help="Report file path (default: favicon_report.txt).",
    )
    args = parser.parse_args()

    input_path = pathlib.Path(args.input)
    out_dir = pathlib.Path(args.output_dir)
    report_path = pathlib.Path(args.report)
    country = args.country.upper()

    out_dir.mkdir(parents=True, exist_ok=True)

    with input_path.open("r", encoding="utf-8") as f:
        items = json.load(f)

    report_rows = []
    for idx, obj in enumerate(items, start=1):
        out_name = f"{country}_{idx:03d}.png"
        out_path = out_dir / out_name
        url = (obj.get("favicon") or "").strip()

        if not url or url.lower() == "null":
            save_placeholder(out_path)
            report_rows.append((idx, out_name, "placeholder", "missing favicon url"))
            continue

        try:
            data, content_type = fetch_bytes(url)
        except Exception as exc:
            save_placeholder(out_path)
            report_rows.append((idx, out_name, "placeholder", f"download failed: {exc}"))
            continue

        ok, message = convert_to_png(data, content_type, out_path)
        if ok:
            report_rows.append((idx, out_name, "ok", message))
        else:
            save_placeholder(out_path)
            report_rows.append((idx, out_name, "placeholder", message))

    with report_path.open("w", encoding="utf-8") as f:
        for idx, name, status, message in report_rows:
            f.write(f"{idx:03d} {name} {status} {message}\n")

    ok_count = sum(1 for _, _, status, _ in report_rows if status == "ok")
    placeholder_count = sum(1 for _, _, status, _ in report_rows if status == "placeholder")
    print(f"total={len(report_rows)} ok={ok_count} placeholder={placeholder_count}")
    print(f"report={report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

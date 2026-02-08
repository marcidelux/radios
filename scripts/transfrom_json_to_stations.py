#!/usr/bin/env python3

import argparse
import json
import re
from pathlib import Path


def split_tags(raw_tags: str) -> list[str]:
    raw_tags = (raw_tags or "").strip()
    if not raw_tags:
        return []

    if "," in raw_tags:
        parts = [p.strip() for p in raw_tags.split(",")]
    else:
        parts = [p.strip() for p in raw_tags.split()]

    return [p for p in parts if p]


def normalize_tag(tag: str) -> str:
    tag = re.sub(r"\s+", " ", tag.strip().lower())
    if tag == "local news":
        tag = "news"
    if tag == "local radio":
        return ""

    # Remove standalone 'radio' from any tag value.
    tag = re.sub(r"\bradio\b", "", tag).strip()
    tag = re.sub(r"\s+", " ", tag).strip()
    return tag


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Transform source station JSON into stations format with sequential IDs."
    )
    parser.add_argument("--input", required=True, help="Input JSON path.")
    parser.add_argument("--output", required=True, help="Output JSON path.")
    parser.add_argument(
        "--tags-output",
        required=True,
        help="Path for unique global tags JSON file.",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    tags_output_path = Path(args.tags_output)

    with input_path.open("r", encoding="utf-8") as f:
        source = json.load(f)

    transformed = []
    all_tags = set()

    for i, item in enumerate(source, start=1):
        country = (item.get("countrycode") or "").strip().upper()
        station_id = f"{country}_{i:03d}"

        station_tags = []
        seen = set()
        for raw_tag in split_tags(item.get("tags", "")):
            tag = normalize_tag(raw_tag)
            if not tag or tag in seen:
                continue
            seen.add(tag)
            station_tags.append(tag)
            all_tags.add(tag)

        transformed.append(
            {
                "id": station_id,
                "name": item.get("name", ""),
                "country": country,
                "tags": station_tags,
                "image": f"pics/{country}/{station_id}.png",
                "stream": item.get("url", ""),
                "favicon": item.get("favicon", ""),
            }
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    tags_output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", encoding="utf-8") as f:
        json.dump(transformed, f, ensure_ascii=False, indent=2)

    with tags_output_path.open("w", encoding="utf-8") as f:
        json.dump(sorted(all_tags), f, ensure_ascii=False, indent=2)

    print(f"input={input_path} total={len(source)}")
    print(f"output={output_path}")
    print(f"tags_output={tags_output_path} unique_tags={len(all_tags)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

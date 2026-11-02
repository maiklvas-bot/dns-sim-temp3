#!/usr/bin/env python3
"""Read-only lexical comparison. A clean report does NOT verify meaning."""
from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path
import re
import sys
from typing import Any

NUMBER = re.compile(r"(?<!\w)[+−-]?(?:\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)(?:[.,]\d+)?(?!\w)")
UNIT = re.compile(r"%|₽|€|\$|(?<!\w)(?:п\.\s*п\.|м[²³]|кг|шт\.?|SKU|руб\.?|тыс\.?|млн|млрд)(?!\w)", re.I)
URL = re.compile(r"https?://[^\s<>\]\[(){}]+")
CITATION = re.compile(r"[^\n]*?|:contentReference\[oaicite:\d+\]|\[\^[^\]\n]+\]")
INLINE = re.compile(r"(?<!`)(`+)(?!`)([^\n]*?)(?<!`)\1(?!`)")
FENCE = re.compile(r"^ {0,3}(`{3,}|~{3,})(.*)$")


def block_parts(text: str) -> tuple[list[str], list[str], str]:
    """Extract common fenced blocks and pipe tables; not a full Markdown parser."""
    code: list[str] = []
    tables: list[str] = []
    prose: list[str] = []
    active: list[str] = []
    table: list[str] = []
    marker = ""
    width = 0
    for line in text.splitlines(keepends=True):
        stripped = line.rstrip("\r\n")
        if active:
            active.append(line)
            if re.fullmatch(r" {0,3}" + re.escape(marker) + "{" + str(width) + r",}[ \t]*", stripped):
                code.append("".join(active))
                active = []
            continue
        found = FENCE.match(stripped)
        if found:
            if table:
                tables.append("".join(table)); table = []
            marker, width = found[1][0], len(found[1])
            active = [line]
        elif stripped.lstrip().startswith("|"):
            table.append(line)
        else:
            if table:
                tables.append("".join(table)); table = []
            prose.append(line)
    if active:
        code.append("".join(active))
    if table:
        tables.append("".join(table))
    return code, tables, "".join(prose)


def extract(text: str) -> dict[str, list[str]]:
    code, tables, prose = block_parts(text)
    return {
        "numbers": [re.sub(r"[ \u00a0\u202f]", "", m[0]).replace("−", "-") for m in NUMBER.finditer(text)],
        "units": [re.sub(r"\s+", "", m[0]).lower() for m in UNIT.finditer(text)],
        "urls": [m[0].rstrip(".,;:!?") for m in URL.finditer(text)],
        "citations": [m[0] for m in CITATION.finditer(text)],
        "fenced_code": code,
        "inline_code": [m[0] for m in INLINE.finditer(prose)],
        "markdown_tables": tables,
    }


def delta(before: list[str], after: list[str]) -> dict[str, dict[str, int]]:
    a, b = Counter(before), Counter(after)
    return {"removed": dict(a - b), "added": dict(b - a)}


def compare(before: str, after: str, locks: list[str] | None = None) -> dict[str, Any]:
    """Flag lexical changes, including repeats; never return semantic success."""
    locks = locks or []
    if any(not isinstance(x, str) or not x for x in locks):
        raise ValueError("Each lock must be a nonempty string.")
    if len(set(locks)) != len(locks):
        raise ValueError("Duplicate locks are not allowed.")
    missing = [s for s in locks if s not in before]
    if missing:
        raise ValueError("Lock absent from original: " + repr(missing))
    a, b = extract(before), extract(after)
    differences = {}
    for category in a:
        d = delta(a[category], b[category])
        if d["removed"] or d["added"]:
            differences[category] = d
    locked = {s: {"before": before.count(s), "after": after.count(s)}
              for s in locks if before.count(s) != after.count(s)}
    if locked:
        differences["locked_fragments"] = locked
    return {
        "status": "review_required" if differences else "no_lexical_changes_detected",
        "semantic_equivalence_verified": False,
        "differences": differences,
        "warning": "Lexical comparison only. Review meaning, scope, negation, roles, dates and source attribution manually.",
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("before", type=Path, help="Original UTF-8 plain text")
    parser.add_argument("after", type=Path, help="Edited UTF-8 plain text")
    parser.add_argument("--locks", type=Path, help="JSON array of exact protected strings")
    args = parser.parse_args(argv)
    try:
        locks: list[str] = []
        if args.locks:
            locks = json.loads(args.locks.read_text(encoding="utf-8-sig"))
            if not isinstance(locks, list):
                raise ValueError("Locks file must contain a JSON array.")
        report = compare(args.before.read_text(encoding="utf-8-sig"),
                         args.after.read_text(encoding="utf-8-sig"), locks)
    except (OSError, UnicodeError, ValueError) as exc:
        print(json.dumps({"status": "input_error", "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 1 if report["differences"] else 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    raise SystemExit(main())

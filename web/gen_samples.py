"""Turn the sample CSV files into web/samples.js for the demo page."""

import csv
import json
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parent.parent

SAMPLES = [
    {
        "id": "sales",
        "title": "Sales dashboard",
        "note": "Three sheets. The summary spills a sorted list of regions, then SUMIFS and XLOOKUP across sheets. Change a sale's units and watch only the affected cells recalculate.",
        "sheets": [
            ("summary", root / "fixtures/summary.csv"),
            ("sales", root / "fixtures/sales.csv"),
            ("targets", root / "fixtures/targets.csv"),
        ],
        "select": ["summary", 1, 1],
    },
    {
        "id": "finance",
        "title": "Loan and project IRR",
        "note": "PMT, NPV and IRR give the same answers as Excel. Try a different rate.",
        "sheets": [
            ("loan", root / "fixtures/loan.csv"),
            ("project", root / "web/samples/project.csv"),
        ],
        "select": ["loan", 1, 2],
    },
    {
        "id": "arrays",
        "title": "Dynamic arrays and cycles",
        "note": "SORT, FILTER, UNIQUE and a lifted IF spill into the cells below. Block a spill, or break the loop in B16:B17.",
        "sheets": [("arrays", root / "web/samples/arrays.csv")],
        "select": ["arrays", 0, 1],
    },
    {
        "id": "errors",
        "title": "Every kind of error",
        "note": "What sutra check reports: division by zero, a failed lookup, a circular reference, an unknown function, a formula that does not parse, a blocked spill.",
        "sheets": [("broken", root / "fixtures/broken.csv")],
        "select": ["broken", 1, 1],
    },
    {
        "id": "blank",
        "title": "Blank sheet",
        "note": "Start from scratch. Formulas begin with =.",
        "sheets": [("Sheet1", None)],
        "select": ["Sheet1", 0, 0],
    },
]


def cells(path):
    if path is None:
        return []
    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.reader(f))
    return [[c, r, text] for r, row in enumerate(rows) for c, text in enumerate(row) if text != ""]


out = []
for sample in SAMPLES:
    out.append(
        {
            "id": sample["id"],
            "title": sample["title"],
            "note": sample["note"],
            "select": sample["select"],
            "sheets": [{"name": name, "cells": cells(path)} for name, path in sample["sheets"]],
        }
    )

target = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root / "web/samples.js"
target.write_text("export const samples = " + json.dumps(out, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")
print(f"wrote {target}")

#!/usr/bin/env python3
"""Lyric measures by the billed lead artist's race/ethnicity, per decade.

Reads the per-song label in live/yearend-song-index.csv (`race_ethnicity`,
`race_confidence`) and the card v3 read (live/reads/full-v3/cards.csv), and
writes live/race-ethnicity-breakdown.json.

The raw labels come in many spellings ("Black / Creole", "Latina", "mixed
(African American and white American)"); GROUP_RULES folds them into nine
groups. Every raw label and the group it went to is written out, so the
folding can be audited.

Two views, because the confidence field is not uniform across groups (about
850 of ~2,060 Black labels are `low`, largely inferred from genre wording):
  all_labels        every labeled song
  high_confidence   only labels marked `high`
A difference that shows in one view only is about the labels, not the music.

Unknown stays its own group and is never folded into any other. Groups are
about the billed lead artist, not every performer. Counts are songs; cells
below MIN_N carry reliable=false. No causal claim is supported here.
"""

from __future__ import annotations

import csv
import json
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import build_decade_genre_breakdown as B  # noqa: E402

INDEX = os.path.join(ROOT, "live", "yearend-song-index.csv")
OUT = os.path.join(ROOT, "live", "race-ethnicity-breakdown.json")

GROUPS = ["black", "white", "hispanic_latino", "asian", "mena", "indigenous",
          "multiracial", "other", "unknown"]
GROUP_LABEL = {
    "black": "Black", "white": "White", "hispanic_latino": "Hispanic / Latino",
    "asian": "Asian", "mena": "Middle Eastern / North African",
    "indigenous": "Indigenous", "multiracial": "Multiracial",
    "other": "Other or unspecified", "unknown": "Unknown",
}

# First matching rule wins; tested on the lowercased first "|" token.
GROUP_RULES = [
    ("multiracial", ("multiracial", "mixed", "colombian and mixed")),
    ("black", ("black", "african american", "african-", "afro-", "jamaican")),
    ("hispanic_latino", ("hispanic", "latin", "latino", "latina")),
    ("asian", ("asian", "korean", "filipino", "chinese", "japanese", "indian")),
    ("mena", ("arab", "lebanese", "middle east", "middle_eastern", "armenian")),
    ("indigenous", ("indigenous", "native")),
    ("white", ("white", "greek", "galician", "dutch", "jewish", "italian", "english", "irish")),
    ("other", ("other", "poc")),
    ("unknown", ("unknown",)),
]


def group_of(raw: str) -> str:
    top = (raw or "unknown").split("|")[0].strip().lower()
    if not top:
        return "unknown"
    for group, needles in GROUP_RULES:
        if any(top.startswith(n) or n in top for n in needles):
            return group
    return "other"


def build() -> dict:
    index = {r["recording_id"]: r for r in csv.DictReader(open(INDEX, encoding="utf-8"))}
    rows = list(csv.DictReader(open(B.CARDS, encoding="utf-8")))
    excluded = B.load_exclusions()
    rows = [r for r in rows if r["song_id"] not in excluded]
    measures = [k for keys in B.DEBATES.values() for k in keys]

    raw_to_group = {}
    for r in rows:
        meta = index.get(r["song_id"], {})
        raw = meta.get("race_ethnicity", "") or "unknown"
        g = group_of(raw)
        raw_to_group[raw.split("|")[0]] = g
        r["_group"] = g
        r["_conf"] = meta.get("race_confidence", "") or ""

    def view(pred):
        sel = [r for r in rows if pred(r)]
        out = {"n_songs": len(sel), "by_group": {}, "by_group_decade": {}, "by_group_genre_any": {}}
        by_g, by_gd, by_gg = defaultdict(list), defaultdict(list), defaultdict(list)
        for r in sel:
            by_g[r["_group"]].append(r)
            by_gd[(r["_group"], r["decade"])].append(r)
            fams = set(x for x in r["genre_families"].split("|") if x)
            key = "hip_hop+rnb_soul" if fams & {"hip_hop", "rnb_soul"} else "other_genres"
            by_gg[(r["_group"], key)].append(r)
        for g, rs in by_g.items():
            out["by_group"][g] = {"n_songs": len(rs), "reliable": len(rs) >= B.MIN_N,
                                  "measures": B.cell_stats(rs, measures)}
        for (g, d), rs in sorted(by_gd.items()):
            out["by_group_decade"]["%s|%s" % (g, d)] = {"group": g, "decade": d, "n_songs": len(rs),
                                                       "reliable": len(rs) >= B.MIN_N,
                                                       "measures": B.cell_stats(rs, measures)}
        for (g, k), rs in sorted(by_gg.items()):
            out["by_group_genre_any"]["%s|%s" % (g, k)] = {"group": g, "genres": k, "n_songs": len(rs),
                                                          "reliable": len(rs) >= B.MIN_N,
                                                          "measures": B.cell_stats(rs, measures)}
        return out

    confidence = Counter((r["_group"], r["_conf"] or "none") for r in rows)
    return {
        "schema": "race-ethnicity-breakdown/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "live/yearend-song-index.csv (race_ethnicity, race_confidence) x live/reads/full-v3/cards.csv",
        "unit": "Year-End song, grouped by its billed lead artist",
        "n_songs": len(rows),
        "min_n": B.MIN_N,
        "decades": B.DECADES,
        "groups": GROUPS,
        "group_labels": GROUP_LABEL,
        "raw_label_to_group": dict(sorted(raw_to_group.items())),
        "confidence_by_group": {"%s|%s" % k: v for k, v in sorted(confidence.items())},
        "method_notes": [
            "Groups describe the billed lead artist only, not every performer on the record.",
            "Raw labels were folded into nine groups by GROUP_RULES in scripts/build_race_ethnicity_breakdown.py; raw_label_to_group lists every fold.",
            "Confidence is not uniform: many Black and multiracial labels are `low`, often inferred from genre wording, so race and genre are entangled. high_confidence repeats every cut on `high` labels only.",
            "by_group_genre_any splits each group into rap-or-R&B songs and everything else, so a race gap can be read inside genre.",
            "Unknown is its own group and is never folded into any other.",
            "Cells below min_n carry reliable=false and must not be drawn. No causal claim is supported by any cell.",
        ],
        "all_labels": view(lambda r: True),
        "high_confidence": view(lambda r: r["_conf"] == "high"),
    }


def main() -> None:
    res = build()
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(res, fh, indent=1, sort_keys=True, ensure_ascii=False)
        fh.write("\n")
    a = res["all_labels"]["by_group"]
    print("wrote", OUT)
    print({g: a[g]["n_songs"] for g in res["groups"] if g in a})


if __name__ == "__main__":
    main()

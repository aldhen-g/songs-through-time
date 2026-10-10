#!/usr/bin/env python3
"""Normalize the reader's free-text `drugs.substances` into a countable vocabulary.

The full read recorded substances as free text. Across 6,197 cards that is
187 distinct atomic labels for roughly 20 actual substances: `lean`,
`codeine`, `codeine_lean`, `codeine syrup`, `lean/codeine` and `actavis
promethazine cough syrup` are one thing; `crack`, `crack cocaine` and
`crack_cocaine` are another; `unspecified`, `unspecified drug`,
`unspecified_drugs` and `unnamed pills` are a fourth spelling of "something,
unnamed". Order variants (`cannabis|alcohol` vs `alcohol|cannabis`) split the
count again.

So the fine-grained substance detail the reader captured is real but not
countable. This maps it onto a controlled vocabulary and emits per-substance
and per-class counts by decade -- which is what MISSION.md debate 3 ("when
did prescription opioids, pharmaceuticals, and hard drugs enter Billboard
lyrics compared to alcohol and cannabis") actually asks for.

Two things this does that the four lexical buckets cannot:

  - separates MDMA from methamphetamine. The `drugs_party` lexical bucket
    holds molly, meth, LSD, ketamine and shrooms together, which cannot
    answer a question posed as "party drugs versus hard drugs".
  - separates crack from powder cocaine, and prescription opioids from
    heroin.

Labels that are not drugs (`water`, `soft drink`, `protein pills`, `incense`,
`love potion`, `poison`) are mapped to `non_drug` and excluded from every
drug total rather than silently counted.

No lyric text is read: this works from cards.csv alone.

Usage: python3 scripts/normalize_substances.py
"""

from __future__ import annotations

import csv
import json
import os
import re
import sys
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARDS = os.path.join(ROOT, "live", "reads", "full-v3", "cards.csv")
OUT_JSON = os.path.join(ROOT, "live", "substances-by-decade.json")
OUT_MAP = os.path.join(ROOT, "live", "substance-label-map.csv")

DECADES = ["1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"]

# Ordered rules: first match wins. Each is (pattern, canonical, class).
# Patterns are matched against the lowercased, underscore-flattened label.
RULES = [
    # --- opioids: lean / codeine complex first, it is the most fragmented ---
    (r"lean|codeine|promethazine|actavis|wockhardt|purple drank", "lean_codeine", "opioid"),
    (r"robitussin|cough syrup", "otc_cough_syrup", "opioid"),
    (r"fentanyl", "fentanyl", "opioid"),
    (r"heroin", "heroin", "opioid"),
    (r"morphine", "morphine", "opioid"),
    (r"percocet|percs|oxycodone|oxycontin|roxicodone|lortab|pain pills", "rx_opioid", "opioid"),
    (r"opioid|opiate", "rx_opioid", "opioid"),
    # --- sedatives / benzos ---
    (r"xanax|alprazolam|valium|ambien|sleeping pill", "benzo_sedative", "sedative"),
    # --- stimulants ---
    (r"adderall|amphetamine|speed\b|stimulant", "rx_stimulant", "stimulant"),
    (r"\bmeth\b|methamphetamine|bath salts", "methamphetamine", "stimulant"),
    # --- cocaine ---
    (r"crack", "crack_cocaine", "cocaine"),
    (r"cocaine|coke\b", "cocaine", "cocaine"),
    # --- empathogens / psychedelics / dissociatives ---
    (r"mdma|molly|ecstasy|tusi", "mdma", "empathogen"),
    (r"lsd|acid\b|psilocybin|shroom|mushroom|psychedelic|dmt", "psychedelic", "psychedelic"),
    (r"pcp|ketamine", "dissociative", "dissociative"),
    (r"nitrous|inhalant", "inhalant", "inhalant"),
    # --- cannabis ---
    (r"cannabis|marijuana|weed|hashish|hash\b|cbd", "cannabis", "cannabis"),
    # --- tobacco / caffeine ---
    (r"tobacco|nicotine|hookah|cigar", "tobacco", "tobacco"),
    (r"caffeine|coffee|\btea\b|energy drink", "caffeine", "caffeine"),
    # --- alcohol: named types, then brands, then generic ---
    (r"champagne|cristal|moet|dom perignon|clicquot|moscato|rose|prosecco", "champagne", "alcohol"),
    (r"cognac|hennessy|remy|r.my|courvoisier|grand marnier", "cognac", "alcohol"),
    (r"whiskey|whisky|bourbon|scotch|rye\b", "whiskey", "alcohol"),
    (r"tequila|patron|patr.n", "tequila", "alcohol"),
    (r"vodka|ciroc|c.roc|grey goose|belvedere|absolut", "vodka", "alcohol"),
    (r"\brum\b|bacardi|malibu", "rum", "alcohol"),
    (r"\bgin\b", "gin", "alcohol"),
    (r"beer|lager|cider|malt liquor|hard seltzer|high noon|brew", "beer", "alcohol"),
    (r"wine|port\b|sangria", "wine", "alcohol"),
    (r"moonshine", "moonshine", "alcohol"),
    (r"schnapps|amaretto|brandy|alize|aliz|hypnotiq|nuvo|liqueur|"
     r"pina colada|spirits|liquor|shots|cocktail|rum and coke", "other_alcohol", "alcohol"),
    (r"alcohol|drunk|booze", "alcohol_unspecified", "alcohol"),
    # --- things that are not drugs ---
    (r"^water$|soft drink|protein pill|viagra|incense|love potion|"
     r"^poison$|fictional|aphrodisiac|^herbs$|medina", "non_drug", "non_drug"),
    # --- prescription, unnamed ---
    (r"prescription|medication|medicine|prozac|pill", "rx_unspecified", "unspecified"),
    # --- catch-all unspecified ---
    (r"unspecified|unnamed|unclear|other|smoke|inject|overdose|potion|intoxicant",
     "unspecified", "unspecified"),
]


def normalize(label: str):
    """Map one free-text label to (canonical, class). Unmatched -> (label, 'unmapped')."""
    s = label.strip().lower()
    s = s.replace("_", " ")
    s = re.sub(r"\(.*?\)", " ", s)          # drop parentheticals
    s = re.sub(r"[^a-z0-9/ ]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    if not s:
        return None, None
    for pattern, canon, klass in RULES:
        if re.search(pattern, s):
            return canon, klass
    return s, "unmapped"


def main():
    with open(CARDS, encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    # Same songs as every other figure: drop mismatched lyrics and the lean
    # exclusions (near-instrumentals, instrumental records).
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import build_decade_genre_breakdown as _B  # noqa: PLC0415
    excluded = _B.load_exclusions()
    rows = [r for r in rows if r["song_id"] not in excluded]

    raw = Counter()
    mapping = {}
    # per decade: set of song_ids per canonical / per class (a song counts once)
    by_dec_sub = defaultdict(lambda: defaultdict(set))
    by_dec_cls = defaultdict(lambda: defaultdict(set))
    dec_n = Counter()
    # The same counts inside hip-hop (any song carrying the hip_hop family tag).
    hh_sub = defaultdict(lambda: defaultdict(set))
    hh_cls = defaultdict(lambda: defaultdict(set))
    hh_n = Counter()
    unmapped = Counter()

    for r in rows:
        dec = r["decade"]
        dec_n[dec] += 1
        is_hh = "hip_hop" in (r.get("genre_families") or "").split("|")
        if is_hh:
            hh_n[dec] += 1
        seen_sub, seen_cls = set(), set()
        for label in (r["drugs.substances"] or "").split("|"):
            label = label.strip()
            if not label:
                continue
            raw[label.lower()] += 1
            canon, klass = normalize(label)
            if canon is None:
                continue
            mapping[label.lower()] = (canon, klass)
            if klass == "unmapped":
                unmapped[label.lower()] += 1
            if klass == "non_drug":
                continue
            seen_sub.add(canon)
            seen_cls.add(klass)
        for c in seen_sub:
            by_dec_sub[dec][c].add(r["song_id"])
        for c in seen_cls:
            by_dec_cls[dec][c].add(r["song_id"])
        if is_hh:
            for c in seen_sub:
                hh_sub[dec][c].add(r["song_id"])
            for c in seen_cls:
                hh_cls[dec][c].add(r["song_id"])

    out = {
        "schema": "substances-by-decade/v1",
        "source": "live/reads/full-v3/cards.csv, field drugs.substances",
        "note": (
            "The reader recorded substances as free text; this is a normalized "
            "view, not a re-read. A song counts once per substance and once per "
            "class. Labels that are not drugs are mapped to non_drug and "
            "excluded. Counts are songs, not mentions."
        ),
        "raw_label_count": len(raw),
        "normalized_substance_count": len({v[0] for v in mapping.values()
                                           if v[1] != "non_drug"}),
        "unmapped_labels": dict(unmapped),
        "decades": DECADES,
        "n_songs_by_decade": {d: dec_n[d] for d in DECADES if d in dec_n},
        "by_decade_substance": {
            d: {k: len(v) for k, v in sorted(by_dec_sub[d].items())}
            for d in DECADES if d in by_dec_sub
        },
        "by_decade_class": {
            d: {k: len(v) for k, v in sorted(by_dec_cls[d].items())}
            for d in DECADES if d in by_dec_cls
        },
        "hip_hop": {
            "note": "Songs carrying the hip_hop genre-family tag (tags overlap: a hip_hop|pop song is in).",
            "n_songs_by_decade": {d: hh_n[d] for d in DECADES if d in hh_n},
            "by_decade_substance": {
                d: {k: len(v) for k, v in sorted(hh_sub[d].items())}
                for d in DECADES if d in hh_sub
            },
            "by_decade_class": {
                d: {k: len(v) for k, v in sorted(hh_cls[d].items())}
                for d in DECADES if d in hh_cls
            },
        },
    }
    with open(OUT_JSON, "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=1, sort_keys=True)
        fh.write("\n")

    with open(OUT_MAP, "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["raw_label", "n", "canonical", "class"])
        for label, n in raw.most_common():
            canon, klass = mapping.get(label, ("", ""))
            w.writerow([label, n, canon, klass])

    print("raw labels: %d  ->  normalized substances: %d"
          % (out["raw_label_count"], out["normalized_substance_count"]))
    if unmapped:
        print("UNMAPPED (%d labels): %s"
              % (len(unmapped), ", ".join(sorted(unmapped)[:12])))
    else:
        print("unmapped: none")
    print("")
    classes = sorted({k for d in out["by_decade_class"].values() for k in d})
    print("%-14s %s" % ("class", " ".join("%7s" % d for d in DECADES)))
    for c in classes:
        cells = []
        for d in DECADES:
            n = out["by_decade_class"].get(d, {}).get(c, 0)
            tot = dec_n.get(d, 0)
            cells.append("%6.1f%%" % (100 * n / tot) if tot else "     --")
        print("%-14s %s" % (c, " ".join("%7s" % x for x in cells)))
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""How often each drug is named: songs and mentions, by decade and in hip-hop.

The reader decided which substances a song names (cards.csv, drugs.substances,
normalized by normalize_substances.py). This adds frequency: inside those
songs, how many times the drug's words occur in the lyric. Street words are
ambiguous out of context ("lean on me", "bars", "snow"), so a mention only
counts in a song the reader already tagged with that drug. That keeps the
word count honest and ties it to a per-song reading.

A reader-tagged song can show zero mentions when it uses slang this list
does not carry; `songs_with_mentions` says how many did.

Reads the hash-locked lyric bodies read-only and writes counts only: no lyric
text, no titles, no per-song rows.

Usage: python3 scripts/drug_mentions.py
"""

from __future__ import annotations

import csv
import json
import os
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import lexical_measures as LM  # noqa: E402
import normalize_substances as NS  # noqa: E402
import build_decade_genre_breakdown as B  # noqa: E402

OUT = os.path.join(NS.ROOT, "live", "drug-mentions.json")

# drug key -> (canonical substance labels that gate it, words/phrases counted)
DRUGS = {
    "weed": ({"cannabis"}, ["weed", "marijuana", "blunt", "blunts", "joint", "joints", "kush", "ganja", "reefer",
                             "zaza", "za", "backwoods", "backwood", "spliff", "spliffs", "chronic", "mary jane", "pot",
                             "herb", "dro", "loud", "gas", "cookies", "runtz", "indica", "sativa", "thc", "dab", "dabs",
                             "wax", "shatter", "roll up", "rolling up", "rollin' up", "purple haze", "smoke", "smokin", "smokin'",
                             "smoking", "tree", "trees", "pack", "packs", "gelato", "stoned", "high"]),
    "lean": ({"lean_codeine"}, ["lean", "drank", "codeine", "wock", "wockhardt", "actavis", "promethazine", "sizzurp",
                                "syrup", "double cup", "styrofoam", "pour up", "tris", "purple drank", "hi tech", "mud"]),
    "coke": ({"cocaine", "crack_cocaine"}, ["coke", "cocaine", "crack", "blow", "yayo", "yay", "snow", "white lines",
                                            "brick", "bricks", "kilo", "kilos", "powder", "8 ball", "eight ball",
                                            "the white", "white girl", "nose candy", "rock", "rocks"]),
    "pills": ({"rx_unspecified"}, ["pill", "pills", "prescription", "prescriptions"]),
    "molly": ({"mdma"}, ["molly", "mollies", "ecstasy", "mdma", "thizz", "e pill", "e pills", "x pill", "x pills",
                         "beans", "bean"]),
    "percs": ({"rx_opioid", "morphine", "fentanyl"}, ["perc", "percs", "percocet", "percocets", "perky", "perkies",
                                                     "perk", "perks", "oxy", "oxys", "oxycontin", "oxycodone",
                                                     "hydrocodone", "vicodin", "lortab", "roxy", "roxies",
                                                     "fentanyl", "fent", "morphine", "opioid", "opioids", "opiates"]),
    "addy": ({"rx_stimulant"}, ["addy", "addies", "adderall", "adderalls", "vyvanse", "ritalin"]),
    "xans": ({"benzo_sedative"}, ["xan", "xans", "xanny", "xannies", "xanax", "xanaxes", "bars", "bar", "benzo",
                                  "benzos", "valium", "klonopin", "zanny", "zannies"]),
    "heroin": ({"heroin"}, ["heroin", "smack", "needle", "needles", "syringe", "dope", "junkie", "china white",
                            "black tar", "shoot up", "shooting up"]),
}


def phrases(words):
    return sorted({tuple(LM.tokenize(w)) for w in words if LM.tokenize(w)}, key=len, reverse=True)


def count(tokens, pats):
    """Non-overlapping, longest-first phrase matches."""
    n, i, hits = len(tokens), 0, 0
    first = defaultdict(list)
    for p in pats:
        first[p[0]].append(p)
    while i < n:
        step = 1
        for p in first.get(tokens[i], ()):
            if tuple(tokens[i:i + len(p)]) == p:
                hits += 1
                step = len(p)
                break
        i += step
    return hits


def main():
    with open(NS.CARDS, encoding="utf-8") as fh:
        cards = {r["song_id"]: r for r in csv.DictReader(fh)}
    excluded = B.load_exclusions()
    with open(LM.MANIFEST, encoding="utf-8") as fh:
        manifest = {r["recording_id"]: r for r in csv.DictReader(fh)}
    pats = {k: phrases(v[1]) for k, v in DRUGS.items()}

    cell = lambda: {"songs": 0, "mentions": 0, "songs_with_mentions": 0, "max_in_one_song": 0}
    out_all = defaultdict(lambda: defaultdict(cell))
    out_hh = defaultdict(lambda: defaultdict(cell))
    n_all, n_hh = defaultdict(int), defaultdict(int)

    for sid, r in cards.items():
        if sid in excluded:
            continue
        dec, hh = r["decade"], "hip_hop" in (r.get("genre_families") or "").split("|")
        n_all[dec] += 1
        if hh:
            n_hh[dec] += 1
        tagged = set()
        for label in (r["drugs.substances"] or "").split("|"):
            canon, klass = NS.normalize(label) if label.strip() else (None, None)
            if canon and klass != "non_drug":
                tagged.add(canon)
        keys = [k for k, (gate, _) in DRUGS.items() if gate & tagged]
        if not keys:
            continue
        m = manifest.get(sid)
        body = LM.CORPUS / (m.get("release_body_path") or "") if m else None
        if not body or not body.is_file():
            print("missing body:", sid, file=sys.stderr)
            continue
        tokens = LM.tokenize(body.read_text(encoding="utf-8"))
        for k in keys:
            c = count(tokens, pats[k])
            for tgt in ([out_all[dec]] + ([out_hh[dec]] if hh else [])):
                x = tgt[k]
                x["songs"] += 1
                x["mentions"] += c
                x["songs_with_mentions"] += 1 if c else 0
                x["max_in_one_song"] = max(x["max_in_one_song"], c)

    decs = NS.DECADES
    res = {
        "schema": "drug-mentions/v1",
        "source": "cards.csv drugs.substances (reader) gating a word count over the hash-locked lyric bodies",
        "note": ("songs = songs the reader tagged with the drug. mentions = times the drug's words occur in those "
                 "songs (a word only counts in a song already tagged with that drug). No lyric text is stored."),
        "terms": {k: v[1] for k, v in DRUGS.items()},
        "decades": decs,
        "all": {"n_songs_by_decade": {d: n_all[d] for d in decs},
                "by_decade": {d: dict(out_all[d]) for d in decs if d in out_all}},
        "hip_hop": {"n_songs_by_decade": {d: n_hh[d] for d in decs if n_hh[d]},
                    "by_decade": {d: dict(out_hh[d]) for d in decs if d in out_hh}},
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(res, fh, indent=1, sort_keys=True)
        fh.write("\n")
    for scope in ("all", "hip_hop"):
        print(scope)
        for k in DRUGS:
            row = []
            for d in decs:
                x = res[scope]["by_decade"].get(d, {}).get(k)
                row.append("%3d/%-4d" % (x["songs"], x["mentions"]) if x else "   -    ")
            print("  %-7s %s" % (k, " ".join(row)))
    return 0


if __name__ == "__main__":
    sys.exit(main())

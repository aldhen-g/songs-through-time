#!/usr/bin/env python3
"""Example songs for the Kids page, with the model's own one-line reading.

The Kids page shows a handful of named songs under each headline figure so a
reader sees what a percentage is made of. This builds that list for the
`kca_kidz_bop` group (Kids' Choice Awards + Kidz Bop) on three measures:

    sex_graphic_or_explicit   drugs_use_or_sale   violence_beyond_mention

What a candidate carries: song_id, title, artist, year (chart metadata), which
of the two lists picked it, whether it was read as a Year-End hit or from the
kids-side read, the rung it sat on, and `reading` -- the card's own
sex.why / drugs.why / violence.why line.

LYRIC TEXT: only one field, and only by hand. `quote` is copied verbatim from
`config/kids-quotes.json`, which the owner fills in himself (see
`PUBLICATION-BOUNDARY.md`, 2026-09-22). This script never reads a lyric body;
it merges whatever the owner typed, capped at 2 lines / 200 characters, and
pairs it with `evidence_lines`, the line numbers the card's own section cites.
Nothing else here may carry lyric text.

NO OTHER LYRIC TEXT. The card writers sometimes quote a phrase from the song
inside their `why` line, so every reading is filtered: any straight or curly
quotation mark, any apostrophe not inside a word, or a "lyric:" lead-in and
the candidate is dropped rather than cleaned. Readings over 220 characters are
dropped too. What survives is the reader describing a song in its own words.

Ordering (the page shows the first four per measure): the `PINNED` ids below
first, in order, then graphic before explicit (and enacted before threatened,
sale before use), then songs the Kids' Choice Awards picked -- children voted
for those -- then Year-End hits before side songs, then newest first.

    python3 scripts/build_kids_examples.py
"""

import csv
import json
import os
import re
import sys
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import build_decade_genre_breakdown as bdg  # noqa: E402
import build_kids_full_catalogue as kfc  # noqa: E402

YEAREND_DIR = os.path.join(ROOT, "live", "reads", "full-v3")
SIDE_DIR = kfc.SIDE_DIR
OUT_JSON = os.path.join(ROOT, "live", "kids-examples.json")
QUOTES_JSON = os.path.join(ROOT, "config", "kids-quotes.json")

GROUP = kfc.KCA_KIDZ_BOP
GROUP_LISTS = kfc.KCA_KIDZ_BOP_LISTS

MAX_PER_MEASURE = 12
MAX_READING_CHARS = 220

# The owner's hand-entered excerpts, and the only lyric text on the site.
MAX_QUOTE_CHARS = 200
MAX_QUOTE_LINES = 2

# The lead may reorder any measure by putting song_ids here, best first.
PINNED = {
    # Lead's picks 2026-09-22: readings with no line-number references first.
    "sex_graphic_or_explicit": [
        "R16f37aa81e721d02",  # Barbie World
        "R243e0b4b29db0aa4",  # Paint the Town Red
        "R1f5828c253d411da",  # Sweetest Pie
        "Rf65c5c8b41db5a1f",  # Take My Breath
    ],
    "drugs_use_or_sale": [
        "R357b121e53113b02",  # Messy
        "R627c0ef2057276b6",  # Sicko Mode
    ],
    "violence_beyond_mention": [
        "Rd3ac013b7dde984c",  # Toosie Slide
        "Rddb07e8dd4d42db3",  # Squabble Up
    ],
}

# measure -> (card section, rung field, rungs best-first)
MEASURES = {
    "sex_graphic_or_explicit": ("sex", "level", ["graphic", "explicit"]),
    "drugs_use_or_sale": ("drugs", "presence", ["sale_described", "use_described"]),
    "violence_beyond_mention": ("violence", "presence", ["enacted", "threatened"]),
}

# What the page prints for a rung.
RUNG_LABEL = {
    "graphic": "graphic",
    "explicit": "explicit",
    "sale_described": "sale",
    "use_described": "use",
    "enacted": "enacted",
    "threatened": "threatened",
}

# The locked exhibit from notes/kids-public-ear-pass.md. A NOMINEE, not a
# winner: the note settles that and the page must not upgrade it.
EXHIBIT = {
    "title": "Can't Feel My Face",
    "artist": "The Weeknd",
    "year": 2015,
    "award_year": 2016,
    "award": "Kids' Choice Awards Favorite Song",
    "status": "nominee",
    "source_note": "notes/kids-public-ear-pass.md",
}

# "lyric:" / "lyrics :" and friends -- a reading that is about to quote.
LYRIC_LEAD = re.compile(r"lyric[s]?\s*:", re.I)
WORD_APOSTROPHE = re.compile(r"(?<=\w)['’](?=\w)")


def reading_is_clean(text):
    """A reading may describe the song; it may not carry its words.

    Straight and curly double quotes, any apostrophe that is not inside a word
    (so `don't` passes and `'burn it down'` does not), and a "lyric:" lead-in
    all mean the writer was about to quote. Length caps the rest.
    """
    if not text or not text.strip():
        return False, "empty"
    if len(text) > MAX_READING_CHARS:
        return False, "over %d characters" % MAX_READING_CHARS
    if LYRIC_LEAD.search(text):
        return False, "quotes a lyric"
    for ch in ('"', "“", "”", "‘", "«", "»"):
        if ch in text:
            return False, "quotation mark"
    stripped = WORD_APOSTROPHE.sub("", text)
    if "'" in stripped or "’" in stripped:
        return False, "quotation mark"
    return True, None


def load_quotes():
    """song_id -> {"quote": str, "lines": str} from config/kids-quotes.json.

    The owner types these by hand. Anything over the caps is refused rather
    than trimmed, so a too-long paste is visible instead of silently cut.
    """
    if not os.path.isfile(QUOTES_JSON):
        return {}, []
    with open(QUOTES_JSON, encoding="utf-8") as fh:
        raw = json.load(fh)
    out, refused = {}, []
    for song_id, entry in raw.items():
        if song_id.startswith("_") or not isinstance(entry, dict):
            continue
        quote = (entry.get("quote") or "").strip()
        lines = str(entry.get("lines") or "").strip()
        if quote:
            if len(quote) > MAX_QUOTE_CHARS:
                refused.append((song_id, "over %d characters" % MAX_QUOTE_CHARS))
                quote = ""
            elif len(quote.splitlines()) > MAX_QUOTE_LINES:
                refused.append((song_id, "over %d lines" % MAX_QUOTE_LINES))
                quote = ""
        out[song_id] = {"quote": quote, "lines": lines}
    return out, refused


def evidence_lines(card, section):
    """The line numbers this card's section cites. Numbers only, never text."""
    out = []
    for item in ((card or {}).get(section, {}) or {}).get("evidence") or []:
        line = item.get("line") if isinstance(item, dict) else item
        if isinstance(line, bool):
            continue
        if isinstance(line, int):
            out.append(line)
        elif isinstance(line, str) and line.strip().isdigit():
            out.append(int(line.strip()))
    return sorted(set(out))


def load_cards_csv(path):
    if not os.path.isfile(path):
        return {}
    with open(path, newline="", encoding="utf-8") as fh:
        return {r["song_id"]: r for r in csv.DictReader(fh)}


def load_card_json(directory, song_id):
    path = os.path.join(directory, song_id + ".json")
    if not os.path.isfile(path):
        return None
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def year_of(row):
    return kfc.row_year(row)


def collect(measure, yearend_rows, membership, side_rows, side_lists, quotes):
    """Every group song that meets `measure`, with its reading, plus drops."""
    section, field, rungs = MEASURES[measure]
    kept, dropped = [], []
    pools = (
        ("yearend", yearend_rows, membership, YEAREND_DIR),
        ("side", side_rows, side_lists, SIDE_DIR),
    )
    for source, rows, lists_by_id, directory in pools:
        for song_id, row in sorted(rows.items()):
            lists = lists_by_id.get(song_id, set()) & set(GROUP_LISTS)
            if not lists:
                continue
            rung = (row.get("%s.%s" % (section, field)) or "").strip()
            if rung not in rungs:
                continue
            card = load_card_json(directory, song_id)
            reading = ((card or {}).get(section, {}).get("why") or "").strip()
            ok, why_not = reading_is_clean(reading)
            quote = quotes.get(song_id) or {}
            entry = {
                "song_id": song_id,
                "evidence_lines": evidence_lines(card, section),
                "quote": quote.get("quote", ""),
                "quote_lines": quote.get("lines", "") if quote.get("quote") else "",
                "title": row.get("title", ""),
                "artist": row.get("artist", ""),
                "year": year_of(row),
                "lists": sorted(lists),
                "source": source,
                "level": RUNG_LABEL.get(rung, rung),
            }
            if not ok:
                dropped.append(dict(entry, dropped_because=why_not))
                continue
            entry["reading"] = reading
            kept.append(entry)

    pinned = PINNED.get(measure, [])

    def sort_key(e):
        rung_rank = rungs.index(
            {v: k for k, v in RUNG_LABEL.items()}.get(e["level"], e["level"]))
        return (
            pinned.index(e["song_id"]) if e["song_id"] in pinned else len(pinned),
            rung_rank,
            0 if "kca" in e["lists"] else 1,
            0 if e["source"] == "yearend" else 1,
            -(e["year"] or 0),
            e["title"].lower(),
        )

    kept.sort(key=sort_key)
    return kept[:MAX_PER_MEASURE], len(kept), dropped


def build_exhibit(yearend_rows):
    """The locked KCA nominee, with its drugs reading only if it passes."""
    match = None
    for song_id, row in yearend_rows.items():
        if (row.get("title", "").strip().lower() == EXHIBIT["title"].lower()
                and EXHIBIT["artist"].lower() in row.get("artist", "").lower()):
            match = (song_id, row)
            break
    out = dict(EXHIBIT)
    if match is None:
        out["song_id"] = None
        out["reading"] = None
        out["reading_withheld"] = "song not found in the Year-End cards"
        return out
    song_id, _row = match
    card = load_card_json(YEAREND_DIR, song_id)
    reading = ((card or {}).get("drugs", {}).get("why") or "").strip()
    ok, why_not = reading_is_clean(reading)
    out["song_id"] = song_id
    out["reading"] = reading if ok else None
    if not ok:
        out["reading_withheld"] = why_not
    return out


def build():
    ye_rows_list, membership = kfc.load_yearend()
    yearend_rows = {r["song_id"]: r for r in ye_rows_list}
    planned, side_cards = kfc.load_side()
    side_lists = {sid: kfc.split_lists(row.get("kids_lists"))
                  for sid, row in planned.items()}
    for sid, row in side_cards.items():
        # title/artist/year live on the manifest row for side songs too, but
        # the exported card row is the one the measures were taken from.
        for key in ("title", "artist", "year"):
            if not (row.get(key) or "").strip():
                row[key] = planned.get(sid, {}).get(key, "")

    quotes, refused = load_quotes()

    measures = {}
    for key in MEASURES:
        kept, total, dropped = collect(
            key, yearend_rows, membership, side_cards, side_lists, quotes)
        measures[key] = {
            "label": bdg.MEASURES[key][0],
            "candidates": kept,
            "n_candidates_kept": len(kept),
            "n_candidates_available": total,
            "n_dropped_for_quotation_or_length": len(dropped),
            "dropped": dropped,
        }

    return {
        "schema": "kids-examples/v1",
        "quotes_source": "config/kids-quotes.json",
        "quotes_refused": [{"song_id": sid, "because": why} for sid, why in refused],
        "max_quote_chars": MAX_QUOTE_CHARS,
        "max_quote_lines": MAX_QUOTE_LINES,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "group": GROUP,
        "group_lists": GROUP_LISTS,
        "max_per_measure": MAX_PER_MEASURE,
        "max_reading_chars": MAX_READING_CHARS,
        "pinned": PINNED,
        "sources": {
            "yearend_cards": "live/reads/full-v3/<song_id>.json",
            "side_cards": "live/reads/kids-side-v1/<song_id>.json",
            "membership": "as scripts/build_kids_full_catalogue.py",
        },
        "measures": measures,
        "exhibit": build_exhibit(yearend_rows),
        "rules": [
            "No lyric text. A reading carrying a quotation mark, an "
            "apostrophe outside a word, or a lyric: lead-in is dropped whole.",
            "Readings over %d characters are dropped." % MAX_READING_CHARS,
            "Title, artist and year are chart metadata, not lyrics.",
            "Order: pinned, then graphic/enacted/sale before the rung below, "
            "then Kids' Choice Awards picks, then Year-End hits, then newest.",
            "A quote is the owner's own hand-entered excerpt from "
            "config/kids-quotes.json, at most %d lines / %d characters, with "
            "evidence_lines the card's own cited line numbers." % (
                MAX_QUOTE_LINES, MAX_QUOTE_CHARS),
            "The exhibit is a 2016 Kids' Choice Awards Favorite Song NOMINEE, "
            "not a winner.",
        ],
    }


def main():
    res = build()
    with open(OUT_JSON, "w", encoding="utf-8") as fh:
        json.dump(res, fh, indent=1, sort_keys=True)
        fh.write("\n")
    print("wrote %s" % OUT_JSON)
    for key, block in sorted(res["measures"].items()):
        print("  %-24s %2d kept of %2d, %2d dropped" % (
            key, block["n_candidates_kept"], block["n_candidates_available"],
            block["n_dropped_for_quotation_or_length"]))
    n_pinned, empty = 0, []
    for measure, ids in sorted(PINNED.items()):
        by_id = {e["song_id"]: e
                 for e in res["measures"][measure]["candidates"]}
        for sid in ids:
            n_pinned += 1
            entry = by_id.get(sid, {})
            if not entry.get("quote"):
                empty.append((measure, sid, entry))
    if empty:
        print("  pinned songs still without a quote (%d of %d):"
              % (len(empty), n_pinned))
        for measure, sid, entry in empty:
            print("    %s  %s -- %s [%s] (lines %s)" % (
                sid, entry.get("title", "?"), entry.get("artist", "?"),
                MEASURES[measure][0],
                ", ".join(str(n) for n in entry.get("evidence_lines", [])) or "none"))
    else:
        print("  every pinned song has a quote")
    for item in res["quotes_refused"]:
        print("  REFUSED quote for %s: %s" % (item["song_id"], item["because"]))
    ex = res["exhibit"]
    print("  exhibit %s (%s): reading %s" % (
        ex["title"], ex["status"],
        "kept" if ex.get("reading") else "withheld (%s)" % ex.get("reading_withheld")))
    return 0


if __name__ == "__main__":
    sys.exit(main())

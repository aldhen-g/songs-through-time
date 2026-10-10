#!/usr/bin/env python3
"""Kids lists measured on their full catalogue, not just their Year-End half.

The kids figures in live/decade-genre-breakdown.json (`kids_crossover`) cover
only the kids-list songs that were ALSO Year-End hits. The kids-side read
(live/reads/kids-side-v1/) cards the kids-list songs that never charted
Year-End. This script reports each list three ways:

  A  yearend  the existing Year-End-only figure (reproduced exactly: the
              measures, the exclusions and the kids join are imported from
              scripts/build_decade_genre_breakdown.py, not re-derived)
  B  side     kids-side cards only
  C  full     A union B

and the shift C - A in percentage points. Each group also carries a
`vs_chart` block: its Year-End hits from 2010 on against every Year-End song
from 2010 on, so a kids figure can be read against the chart it was picked
from.

Side cards never enter a Year-End denominator: this script only reads the
breakdown's inputs and writes its own two files.

Groups: kca, kidz-bop, radio-disney, the pair `kca_kidz_bop` (the two lists
the site leads with) and their three-way union `kids_union`. Teen Choice
is a teen award and is reported on its own as `teen-choice`, never inside the
union (same rule as TEEN_LISTS in the breakdown).

Side songs without a valid card yet are counted as `unread` and left out of
every denominator; the note says how many the read is still waiting for.

Run after `python3 scripts/read_run.py --corpus kids-side export`:

    python3 scripts/build_kids_full_catalogue.py
"""

import csv
import json
import os
import sys
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import build_decade_genre_breakdown as bdg  # noqa: E402

SIDE_DIR = os.path.join(ROOT, "live", "reads", "kids-side-v1")
SIDE_MANIFEST = os.path.join(SIDE_DIR, "manifest.csv")
SIDE_CARDS = os.path.join(SIDE_DIR, "cards.csv")
BODIES_MANIFEST = os.path.join(ROOT, "side", "kids-side-bodies-v1", "manifest.csv")
BREAKDOWN_JSON = bdg.OUT_JSON
OUT_JSON = os.path.join(ROOT, "live", "kids-full-catalogue.json")
OUT_NOTE = os.path.join(ROOT, "notes", "kids-full-catalogue.md")

KIDS_LISTS = ["kca", "kidz-bop", "radio-disney"]
TEEN_LIST = "teen-choice"
UNION = "kids_union"
# The pair the site leads with: the two lists that still exist and that
# children either voted for (KCA) or were sold (Kidz Bop). Radio Disney was
# adult-programmed and mostly off the pop chart, so it is reported but not
# led with; it stays in `kids_union` so the older notes stay valid.
KCA_KIDZ_BOP = "kca_kidz_bop"
KCA_KIDZ_BOP_LISTS = ["kca", "kidz-bop"]
GROUPS = KIDS_LISTS + [KCA_KIDZ_BOP, UNION, TEEN_LIST]

# The vs-chart block compares a group against the whole Year-End chart of the
# same era. Both kids lists start in 2010 (KCA music 2014, Kidz Bop 2010), so
# 2010 is the first year in which the comparison is fair.
VS_FROM_YEAR = 2010
assert TEEN_LIST in bdg.TEEN_LISTS and not set(KIDS_LISTS) & bdg.TEEN_LISTS

# The composite measures the consistency check validated, plus the
# breakdown's profanity measure. Definitions come from bdg.MEASURES.
# The fuzzy middle rungs (suggestive, violence mentioned, drugs mentioned)
# are deliberately not headline figures.
HEADLINE = [
    "sex_graphic",
    "sex_graphic_or_explicit",
    "violence_beyond_mention",
    "drugs_use_or_sale",
    "profanity_strong",
]
# Measures read from a lexical column: a side song with that column blank is
# unmeasured on it (the breakdown's _num would read blank as 0).
LEXICAL_COLUMN = {"profanity_strong": "profanity_strong_count"}

MIN_N = bdg.MIN_N


def read_csv(path):
    if not os.path.isfile(path):
        return []
    with open(path, newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def split_lists(value, sep="|"):
    return {x.strip() for x in (value or "").split(sep) if x.strip()}


def members(lists, group):
    """Is a song with these kids lists in the group?"""
    if group == UNION:
        return bool(lists & set(KIDS_LISTS))
    if group == KCA_KIDZ_BOP:
        return bool(lists & set(KCA_KIDZ_BOP_LISTS))
    return group in lists


# --- Year-End half --------------------------------------------------------

def load_yearend(cards_path=None):
    """(rows, membership) exactly as the breakdown builds them.

    rows: Year-End card rows minus live/read-exclusions.csv.
    membership: song_id -> set of kids lists, from the breakdown's join.
    """
    rows = read_csv(cards_path or bdg.CARDS)
    excluded = bdg.load_exclusions()
    rows = [r for r in rows if r["song_id"] not in excluded]
    corpus_ids = {r["song_id"] for r in rows}
    _ids, per_list = bdg.load_kids_ids()
    membership = {}
    for name, ids in per_list.items():
        for sid in ids & corpus_ids:
            membership.setdefault(sid, set()).add(name)
    return rows, membership


# --- Side half ------------------------------------------------------------

def load_side(manifest_path=SIDE_MANIFEST, cards_path=SIDE_CARDS):
    """(planned, cards): the planned side songs and the exported side cards.

    planned: song_id -> manifest row (kids_lists, year, ...).
    cards: song_id -> cards.csv row, only for planned songs.
    """
    planned = {r["song_id"]: r for r in read_csv(manifest_path)}
    cards = {r["song_id"]: r for r in read_csv(cards_path) if r["song_id"] in planned}
    return planned, cards


def count_card_files(side_dir=SIDE_DIR):
    if not os.path.isdir(side_dir):
        return 0
    return sum(1 for f in os.listdir(side_dir)
               if f.startswith("KS") and f.endswith(".json"))


def load_out_of_scope(path=BODIES_MANIFEST):
    """Kids-queue rows with no measurable body, per list.

    Status kidz_bop_original (Kidz Bop's own songs) and unmatched are out of
    scope; any other non-ok status is a row never fetched.
    Returns list of (status, set_of_lists).
    """
    out = []
    for r in read_csv(path):
        status = (r.get("status") or "").strip()
        if status == "ok":
            continue
        out.append((status or "blank", split_lists(r.get("wanted_by"), ";")))
    return out


# --- Measuring ------------------------------------------------------------

def measure(rows, lexical_blank_is_missing=False):
    """{key: {n, hits, share, unmeasured}} over rows, with bdg predicates."""
    out = {}
    for key in HEADLINE:
        _, pred = bdg.MEASURES[key]
        use = rows
        unmeasured = 0
        col = LEXICAL_COLUMN.get(key)
        if lexical_blank_is_missing and col:
            use = [r for r in rows if (r.get(col) or "").strip() != ""]
            unmeasured = len(rows) - len(use)
        hits = sum(1 for r in use if pred(r))
        out[key] = {
            "n": len(use),
            "hits": hits,
            "share": round(hits / len(use), 4) if use else None,
            "unmeasured": unmeasured,
        }
    return out


def cell(rows, lexical_blank_is_missing=False, **extra):
    c = {"n_songs": len(rows), "reliable": len(rows) >= MIN_N}
    c.update(extra)
    c["measures"] = measure(rows, lexical_blank_is_missing)
    return c


def shift_pp(full, ye):
    if full is None or ye is None:
        return None
    return round(100 * (full - ye), 1)


def row_year(row):
    try:
        return int((row.get("year") or "").strip()[:4])
    except (ValueError, TypeError):
        return None


def vs_chart(group_rows, all_rows, from_year=VS_FROM_YEAR):
    """The group's Year-End hits from `from_year` on, against every Year-End
    song from `from_year` on, on the headline measures.

    Year-End only on both sides: the side songs never charted, so they have no
    counterpart in the chart denominator and would not be a like-for-like
    comparison.
    """
    gr = [r for r in group_rows if (row_year(r) or 0) >= from_year]
    ch = [r for r in all_rows if (row_year(r) or 0) >= from_year]
    return {
        "from_year": from_year,
        "basis": "yearend_only",
        "group": {"n_songs": len(gr), "reliable": len(gr) >= MIN_N,
                  "measures": measure(gr)},
        "chart": {"n_songs": len(ch), "reliable": len(ch) >= MIN_N,
                  "measures": measure(ch)},
    }


def build(yearend=None, side=None, out_of_scope=None, card_files=None):
    ye_rows, ye_members = yearend if yearend is not None else load_yearend()
    planned, side_cards = side if side is not None else load_side()
    oos = out_of_scope if out_of_scope is not None else load_out_of_scope()
    if card_files is None:
        card_files = count_card_files()

    unread_total = len(planned) - len(side_cards)
    lists = {}
    coverage = {}
    for g in GROUPS:
        ye = [r for r in ye_rows if members(ye_members.get(r["song_id"], set()), g)]
        side_ids = [sid for sid, row in planned.items()
                    if members(split_lists(row.get("kids_lists")), g)]
        sd = [side_cards[sid] for sid in side_ids if sid in side_cards]
        unread = len(side_ids) - len(sd)
        # A full row carries the lexical blank rule only for its side half.
        ye_c = cell(ye)
        sd_c = cell(sd, True, n_planned=len(side_ids), n_unread=unread)
        full_m = {}
        for key in HEADLINE:
            a, b = ye_c["measures"][key], sd_c["measures"][key]
            n = a["n"] + b["n"]
            hits = a["hits"] + b["hits"]
            full_m[key] = {
                "n": n,
                "hits": hits,
                "share": round(hits / n, 4) if n else None,
                "unmeasured": b["unmeasured"],
            }
        full_c = {
            "n_songs": len(ye) + len(sd),
            "reliable": len(ye) + len(sd) >= MIN_N,
            "complete": unread == 0,
            "measures": full_m,
        }
        vs = vs_chart(ye, ye_rows)
        shifts = {k: shift_pp(full_m[k]["share"], ye_c["measures"][k]["share"])
                  for k in HEADLINE}
        lists[g] = {
            "is_teen": g == TEEN_LIST,
            "yearend": ye_c,
            "side": sd_c,
            "full": full_c,
            "vs_chart": vs,
            "shift_pp": shifts,
        }
        oos_g = [s for s, ls in oos if members(ls, g)]
        cov = {
            "yearend": len(ye),
            "side_planned": len(side_ids),
            "side_read": len(sd),
            "side_unread": unread,
            "out_of_scope_kidz_bop_original": oos_g.count("kidz_bop_original"),
            "out_of_scope_unmatched": oos_g.count("unmatched"),
            "out_of_scope_never_fetched": sum(
                1 for s in oos_g if s not in ("kidz_bop_original", "unmatched")),
        }
        cov["out_of_scope"] = len(oos_g)
        cov["total"] = cov["yearend"] + cov["side_planned"] + cov["out_of_scope"]
        cov["measured_share_of_total"] = (
            round((cov["yearend"] + cov["side_read"]) / cov["total"], 4)
            if cov["total"] else None)
        coverage[g] = cov

    no_year = sorted(sid for sid, r in planned.items() if not (r.get("year") or "").strip())
    measures_meta = {}
    for k in HEADLINE:
        m = {"label": bdg.MEASURES[k][0],
             "source": "lexical_scan" if k in bdg.LEX_CATEGORY else "card_v3_read"}
        if k in LEXICAL_COLUMN:
            m["lexical_column"] = LEXICAL_COLUMN[k]
        measures_meta[k] = m

    return {
        "schema": "kids-full-catalogue/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sources": {
            "yearend_cards": "live/reads/full-v3/cards.csv",
            "yearend_exclusions": "live/read-exclusions.csv",
            "yearend_membership": "notes/kids-charts-join-*-year-end.md "
                                  "(parsed by scripts/audit_kids_joins.py, "
                                  "via build_decade_genre_breakdown.load_kids_ids)",
            "side_cards": "live/reads/kids-side-v1/cards.csv",
            "side_membership": "live/reads/kids-side-v1/manifest.csv kids_lists",
            "out_of_scope": "side/kids-side-bodies-v1/manifest.csv status",
        },
        "groups": GROUPS,
        "kids_lists": KIDS_LISTS,
        "kca_kidz_bop_lists": KCA_KIDZ_BOP_LISTS,
        "vs_chart_from_year": VS_FROM_YEAR,
        "teen_list": TEEN_LIST,
        "headline_measures": HEADLINE,
        "measures": measures_meta,
        "min_n": MIN_N,
        "read_progress": {
            "side_planned": len(planned),
            "side_read": len(side_cards),
            "side_unread": unread_total,
            "side_card_files_on_disk": card_files,
            "cards_csv_stale": card_files > len(side_cards),
            "complete": unread_total == 0,
        },
        "side_songs_without_year": len(no_year),
        "lists": lists,
        "coverage": coverage,
        "method_notes": [
            "yearend reproduces the Year-End-only kids figures: same cards, "
            "same exclusions, same join tables, same measure predicates "
            "(imported from scripts/build_decade_genre_breakdown.py).",
            "side counts only kids-side songs with a valid card in the "
            "exported cards.csv. Planned songs without one are `n_unread` and "
            "are in no denominator.",
            "full is yearend plus side, songs counted once (a side song is by "
            "construction not a Year-End song). shift_pp = 100 x (full share "
            "- yearend share).",
            "A side song with a blank lexical column is `unmeasured` on the "
            "profanity measure and left out of its denominator.",
            "kids_union is kca, kidz-bop and radio-disney. kca_kidz_bop is "
            "kca and kidz-bop only. teen-choice is a teen award, reported "
            "alone and never inside either union.",
            "vs_chart compares the group's Year-End hits from %d on against "
            "every Year-End song from %d on, on the same measures. Year-End "
            "only on both sides." % (VS_FROM_YEAR, VS_FROM_YEAR),
            "Cells below min_n carry reliable=false.",
            "Side cards never enter live/decade-genre-breakdown.json.",
        ],
    }


def check_against_breakdown(res, breakdown_path=BREAKDOWN_JSON):
    """Year-End n's must equal the breakdown's kids_crossover counts."""
    if not os.path.isfile(breakdown_path):
        return None
    with open(breakdown_path, encoding="utf-8") as fh:
        kc = json.load(fh)["kids_crossover"]
    problems = []
    for name, n in kc["per_list"].items():
        got = res["lists"].get(name, {}).get("yearend", {}).get("n_songs")
        if got != n:
            problems.append("%s: %s vs breakdown %s" % (name, got, n))
    if res["lists"][UNION]["yearend"]["n_songs"] != kc["kids_lists_only"]:
        problems.append("kids_union: %s vs kids_lists_only %s" % (
            res["lists"][UNION]["yearend"]["n_songs"], kc["kids_lists_only"]))
    return problems


# --- Note -----------------------------------------------------------------

LABELS = {
    "kca": "Kids' Choice Awards (KCA)",
    "kidz-bop": "Kidz Bop",
    "radio-disney": "Radio Disney",
    KCA_KIDZ_BOP: "Kids\u2019 Choice Awards + Kidz Bop",
    UNION: "All three kids lists (union)",
    TEEN_LIST: "Teen Choice (teen award, kept separate)",
}


def _pct(m):
    return "--" if m["share"] is None else "%.1f%%" % (100 * m["share"])


def _pp(v):
    return "--" if v is None else "%+.1f" % v


def write_note(res):
    L = []
    A = L.append
    rp = res["read_progress"]
    A("# Kids lists on their full catalogue")
    A("")
    A("Generated %s by `scripts/build_kids_full_catalogue.py`. Feed: "
      "`live/kids-full-catalogue.json`." % res["generated_at"][:10])
    A("")
    A("The kids figures in `notes/decade-genre-breakdown.md` count only the "
      "kids-list songs that were also Year-End hits. This adds the kids-list "
      "songs that never charted Year-End (the kids-side read) and shows how "
      "much each figure moves.")
    A("")
    if rp["complete"]:
        A("**Read status:** all %d side songs are read." % rp["side_planned"])
    else:
        A("**Read status: PARTIAL.** %d of %d side songs have cards; still "
          "waiting for %d. Every side and full figure below is provisional "
          "until the read finishes." % (rp["side_read"], rp["side_planned"],
                                        rp["side_unread"]))
    if rp["cards_csv_stale"]:
        A("")
        A("`cards.csv` is behind the card files on disk (%d files, %d "
          "exported): re-run `python3 scripts/read_run.py --corpus kids-side "
          "export`, then this script." % (rp["side_card_files_on_disk"],
                                          rp["side_read"]))
    A("")
    A("Columns: **Year-End** = the existing figure (kids-list songs that were "
      "Year-End hits); **Side** = kids-list songs that never charted "
      "Year-End; **Full** = both; **Shift** = Full minus Year-End, in "
      "percentage points. n is the songs in each denominator.")
    A("")
    for g in res["groups"]:
        c = res["lists"][g]
        A("## %s" % LABELS.get(g, g))
        A("")
        if c["side"]["n_unread"]:
            A("%d side songs on this list not read yet." % c["side"]["n_unread"])
            A("")
        A("| Measure | Year-End | Side | Full | Shift (pp) | n Year-End | n Side | n Full |")
        A("|---|---:|---:|---:|---:|---:|---:|---:|")
        for k in res["headline_measures"]:
            y, s, f = (c[h]["measures"][k] for h in ("yearend", "side", "full"))
            A("| %s | %s | %s | %s | %s | %d | %d | %d |" % (
                res["measures"][k]["label"], _pct(y), _pct(s), _pct(f),
                _pp(c["shift_pp"][k]), y["n"], s["n"], f["n"]))
        vs = c["vs_chart"]
        A("Against the whole chart, %d onward (Year-End songs only on both "
          "sides):" % vs["from_year"])
        A("")
        A("| Measure | This list | Every Year-End song | n list | n chart |")
        A("|---|---:|---:|---:|---:|")
        for k in res["headline_measures"]:
            g_m = vs["group"]["measures"][k]
            c_m = vs["chart"]["measures"][k]
            A("| %s | %s | %s | %d | %d |" % (
                res["measures"][k]["label"], _pct(g_m), _pct(c_m),
                g_m["n"], c_m["n"]))
        A("")
        flags = [h for h in ("yearend", "side") if not c[h]["reliable"]]
        if flags:
            A("")
            A("Below n=%d (not reliable): %s." % (res["min_n"], ", ".join(flags)))
        A("")
    A("## Coverage")
    A("")
    A("Songs each list selected, by where their lyric was measured. Out of "
      "scope = Kidz Bop originals, unmatched, or never fetched.")
    A("")
    A("| List | Year-End | Side read | Side unread | Out of scope | Total | Measured |")
    A("|---|---:|---:|---:|---:|---:|---:|")
    for g in res["groups"]:
        v = res["coverage"][g]
        A("| %s | %d | %d | %d | %d | %d | %s |" % (
            g, v["yearend"], v["side_read"], v["side_unread"], v["out_of_scope"],
            v["total"],
            "--" if v["measured_share_of_total"] is None
            else "%.0f%%" % (100 * v["measured_share_of_total"])))
    A("")
    A("Lists overlap (a song can be on several), so rows do not sum.")
    A("")
    u = res["coverage"][UNION]
    A("## Caveats")
    A("")
    A("1. **Not what children heard.** Kidz Bop re-records songs with "
      "rewritten lyrics. The lyric measured here is always the adult "
      "original, so these figures describe what the lists selected from "
      "mainstream pop, not what children heard on the Kidz Bop record.")
    A("2. **Unmeasured songs.** %d Kidz Bop originals (no adult recording) "
      "and %d unmatched song are not measured%s." % (
          u["out_of_scope_kidz_bop_original"], u["out_of_scope_unmatched"],
          "" if not u["out_of_scope_never_fetched"] else
          "; %d more were never fetched" % u["out_of_scope_never_fetched"]))
    A("3. **Different lyric sources.** Side cards use the same card v3 and "
      "the same reader settings as the Year-End cards, but side lyrics come "
      "from lrclib, Genius and lyrics.ovh and are not hash-locked in "
      "`FROZEN.md`.")
    A("4. **Side years are approximate.** A side song's year and decade is "
      "the earliest year any kids list picked it; %d side songs have no "
      "year. This table does not cut by year." % res["side_songs_without_year"])
    A("5. **Teen Choice is a teen award** and is never inside the kids union.")
    A("6. **Profanity is a vocabulary count** from the lexical scan, not a "
      "reading; the other four measures are card v3 readings.")
    A("7. **Side cards never enter a Year-End denominator.** "
      "`live/decade-genre-breakdown.json` is unchanged by this script.")
    A("")
    return "\n".join(L)


def main():
    res = build()
    problems = check_against_breakdown(res)
    if problems:
        print("Year-End half does not reproduce the breakdown:", file=sys.stderr)
        for p in problems:
            print("  " + p, file=sys.stderr)
        return 1
    res["yearend_reproduces_breakdown"] = problems == []
    with open(OUT_JSON, "w", encoding="utf-8") as fh:
        json.dump(res, fh, indent=1, sort_keys=True)
        fh.write("\n")
    with open(OUT_NOTE, "w", encoding="utf-8") as fh:
        fh.write(write_note(res))
    rp = res["read_progress"]
    print("wrote %s" % OUT_JSON)
    print("wrote %s" % OUT_NOTE)
    print("side read %d/%d, waiting for %d%s" % (
        rp["side_read"], rp["side_planned"], rp["side_unread"],
        " (cards.csv stale: re-run export)" if rp["cards_csv_stale"] else ""))
    for g in res["groups"]:
        v = res["coverage"][g]
        print("  %-13s yearend %4d  side %3d (unread %3d)  out-of-scope %2d" % (
            g, v["yearend"], v["side_planned"], v["side_unread"], v["out_of_scope"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())

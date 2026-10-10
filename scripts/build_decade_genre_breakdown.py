#!/usr/bin/env python3
"""Decade x genre breakdown of the card v3 full read.

Builds the five MISSION debates (violence, sex, drugs, money, kids crossover)
cut by decade and genre family, from live/reads/full-v3/cards.csv.

No model calls: pure aggregation over the completed read.

Two rules this script enforces, both from the method notes:

1. Genre is MULTI-LABEL (notes/genre-family-map-v2-methods-2026-09-09.md).
   A song belongs to every family its catalog listings support, so genre
   cells do not sum to the decade total. Denominators are therefore always
   per-cell (songs in that decade AND that family), never the decade N.

2. We never print a genre MIX share. The map is an external-catalog
   candidate: it cannot say what fraction of a decade "was rap". Genre is
   used only as a FILTER -- prevalence of a lyric measure *within* the
   genre-filtered subset. `mix_share` is deliberately absent from output.
"""

import csv
import json
import math
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARDS = os.path.join(ROOT, "live", "reads", "full-v3", "cards.csv")
KIDS_NOTES = os.path.join(ROOT, "notes")
LEAN_EXCLUSIONS = os.path.join(ROOT, "live", "lean-exclusions.csv")
EXCLUSIONS = os.path.join(ROOT, "live", "read-exclusions.csv")
AMBIGUITY = os.path.join(ROOT, "live", "lexicon-ambiguity-audit.json")
AGREEMENT = os.path.join(ROOT, "live", "reads", "consistency-v2", "agreement.json")
TOPICS_CARDS = os.path.join(ROOT, "live", "reads", "topics-t1", "cards.csv")
TOPICS_AGREEMENT = os.path.join(ROOT, "live", "reads", "topics-pilot", "blind", "agreement.json")
OUT_JSON = os.path.join(ROOT, "live", "decade-genre-breakdown.json")
OUT_NOTE = os.path.join(ROOT, "notes", "decade-genre-breakdown.md")

# Cells with fewer than this many songs are computed but flagged unreliable
# and must not be charted as a trend point.
MIN_N = 30

DECADES = ["1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"]

# Five-year periods alongside decades. Decades hide when a trend actually
# turned: on the sex ladder the explicit and suggestive lines cross inside the
# 1990s, which a decade cut cannot show. The corpus runs 1960-2025, so the
# final period holds 2025 alone -- it is emitted with complete=false and must
# not be drawn as a trend point beside four full periods.
PERIOD_YEARS = 5
PERIOD_LAST_COMPLETE = 2024


def period_of(year):
    """1987 -> '1985-89'. Uses an en dash, matching the notes' house style."""
    start = (int(year) // PERIOD_YEARS) * PERIOD_YEARS
    return "%d\u2013%02d" % (start, (start + PERIOD_YEARS - 1) % 100)


def period_is_complete(label):
    start = int(label.split("\u2013")[0])
    return start + PERIOD_YEARS - 1 <= PERIOD_LAST_COMPLETE


def _has_substance(row, needles):
    """Card-recorded substances, matched on the normalized label text.

    The card field is free text (187 distinct labels), so this matches on
    substring against the whole pipe-joined value. scripts/normalize_substances.py
    holds the canonical mapping; this only needs presence.
    """
    blob = (row.get("drugs.substances") or "").lower()
    return any(n in blob for n in needles)


def _num(row, key):
    """Lexical columns are numeric but may be blank."""
    v = row.get(key, "")
    if v in ("", None):
        return 0.0
    try:
        return float(v)
    except ValueError:
        return 0.0


# --- Measures -------------------------------------------------------------
# Each measure is a predicate over a card row. Card-v3 fields carry the
# meaning; lexical counts are vocabulary only and are marked (lex).

MEASURES = {
    # 1. Violence & Killing
    "violence_beyond_mention": (
        "Violence threatened or enacted (not just mentioned)",
        lambda r: r["violence.presence"] in ("threatened", "enacted"),
    ),
    "violence_enacted": (
        "Violence enacted in the song",
        lambda r: r["violence.presence"] == "enacted",
    ),
    "violence_celebrated": (
        "Violence present and framed as celebrated",
        lambda r: r["violence.presence"] in ("threatened", "enacted")
        and r["violence.framing"] == "celebrated",
    ),
    "violence_target_partner_or_woman": (
        "Violence targeting a partner or woman",
        lambda r: r["violence.target"] == "partner_or_woman",
    ),
    "weapon_named": (
        "Weapon named (card evidence tag)",
        lambda r: "weapon" in (r.get("violence_evidence_tags") or ""),
    ),
    # 2. Explicit Sex vs Innuendo
    "sex_graphic_or_explicit": (
        "Sex described graphically or explicitly",
        lambda r: r["sex.level"] in ("graphic", "explicit"),
    ),
    "sex_graphic": (
        "Sex described graphically",
        lambda r: r["sex.level"] == "graphic",
    ),
    "sex_suggestive": (
        "Sex suggestive -- innuendo, not blunt",
        lambda r: r["sex.level"] == "suggestive",
    ),
    "sex_romantic_or_none": (
        "Romantic or no sexual content",
        lambda r: r["sex.level"] in ("romantic", "none"),
    ),
    "sex_objectifying": (
        "Speaker stance objectifying",
        lambda r: r["sex.speaker_stance"] == "objectifying",
    ),
    "sex_in_chorus": (
        "Sexual content reaches the chorus",
        lambda r: r["sex.in_chorus"].strip().lower() in ("true", "yes", "1"),
    ),
    # 3. Drugs & Substances
    "drugs_use_or_sale": (
        "Drug use or sale described (not just mentioned)",
        lambda r: r["drugs.presence"] in ("use_described", "sale_described"),
    ),
    "drugs_use": (
        "Drug use described (not selling)",
        lambda r: r["drugs.presence"] == "use_described",
    ),
    "drugs_sale": (
        "Selling drugs described",
        lambda r: r["drugs.presence"] == "sale_described",
    ),
    "drugs_glorified": (
        "Drugs present and framed as glorified",
        lambda r: r["drugs.presence"] != "none" and r["drugs.framing"] == "glorified",
    ),
    "drugs_opioids_pills": (
        "Opioids or pills named (card)",
        lambda r: _has_substance(r, ('lean', 'codeine', 'promethazine', 'heroin', 'morphine', 'percocet', 'oxy', 'fentanyl', 'opioid', 'opiate', 'xanax', 'valium', 'pill')),
    ),
    "drugs_cocaine": (
        "Cocaine or crack named (card)",
        lambda r: _has_substance(r, ('cocaine', 'crack', 'coke')),
    ),
    "drugs_cannabis": (
        "Cannabis named (card)",
        lambda r: _has_substance(r, ('cannabis', 'marijuana', 'weed', 'hashish', 'hash')),
    ),
    "alcohol": (
        "Alcohol named (card)",
        lambda r: _has_substance(r, ('alcohol', 'champagne', 'cognac', 'whiskey', 'whisky', 'wine', 'beer', 'vodka', 'tequila', 'rum', 'gin', 'moonshine', 'liquor', 'bourbon', 'scotch')),
    ),
    # 4. Money & Flex
    "money_central": (
        "Money is a central subject",
        lambda r: r["money.level"] == "central",
    ),
    "money_flex": (
        "Money stance is flex",
        lambda r: r["money.stance"] == "flex",
    ),
    "money_struggle_or_critique": (
        "Money stance is struggle or refusal/critique",
        lambda r: r["money.stance"] in ("struggle", "refusal_critique"),
    ),
    "brands_named": (
        "Brand names used to flex",
        lambda r: r["money.brand_purpose"] == "flex",
    ),
    # Cross-cutting
    "profanity_strong": (
        "Strong profanity present (lex)",
        lambda r: _num(r, "profanity_strong_count") > 0,
    ),
    "mental_health_described": (
        "Mental health described or central",
        lambda r: r["mental_health.presence"] in ("described", "central"),
    ),
    "mental_depression": (
        "Depression or sadness described (mental health kind)",
        lambda r: r["mental_health.presence"] in ("described", "central") and "sadness_depression" in r["mental_health.kinds"],
    ),
    "mental_anxiety": (
        "Anxiety or paranoia described (mental health kind)",
        lambda r: r["mental_health.presence"] in ("described", "central") and "anxiety_paranoia" in r["mental_health.kinds"],
    ),
    "mental_self_harm": (
        "Self-harm or suicide described (mental health kind)",
        lambda r: r["mental_health.presence"] in ("described", "central") and "self_harm_suicide" in r["mental_health.kinds"],
    ),
    "mental_substance_coping": (
        "Using substances to cope described (mental health kind)",
        lambda r: r["mental_health.presence"] in ("described", "central") and "substance_coping" in r["mental_health.kinds"],
    ),
    "politics_protest": (
        "Political protest content",
        lambda r: r["politics.presence"] == "protest",
    ),
}

# Which lexical category each (lex) measure reads, so the ambiguity audit can
# be attached to it. Card-v3 measures are absent here: they come from reading,
# not matching, and carry no lexicon ambiguity.
# Only measures that STILL read the lexical scan. Everything else was moved
# onto card fields after the lexical categories were scored against their card
# equivalents and none reached an F1 above 0.69 (religion 0.47, politics 0.35,
# sex-work 0.31). The lexicon keeps the measures the card has no field for --
# profanity, slurs, brands, the country checklist -- and stops standing in for
# the ones it does.
LEX_CATEGORY = {
    "profanity_strong": "profanity-strong",
}


def load_ambiguity():
    """share_at_risk per lexical category: the upper bound on inflation.

    See scripts/lexicon_ambiguity_audit.py. A category with no ambiguous-tagged
    entries is absent from the audit and scores 0.
    """
    if not os.path.isfile(AMBIGUITY):
        return {}
    with open(AMBIGUITY, encoding="utf-8") as fh:
        audit = json.load(fh)
    return {c["category"]: c for c in audit.get("categories", [])}


DEBATES = {
    "violence": [
        "violence_beyond_mention",
        "violence_enacted",
        "violence_celebrated",
        "violence_target_partner_or_woman",
        "weapon_named",
    ],
    "sex": [
        "sex_graphic_or_explicit",
        "sex_graphic",
        "sex_suggestive",
        "sex_romantic_or_none",
        "sex_objectifying",
        "sex_in_chorus",
    ],
    "drugs": [
        "drugs_use_or_sale",
        "drugs_use",
        "drugs_sale",
        "drugs_glorified",
        "drugs_opioids_pills",
        "drugs_cocaine",
        "drugs_cannabis",
        "alcohol",
    ],
    "money": [
        "money_central",
        "money_flex",
        "money_struggle_or_critique",
        "brands_named",
    ],
    "cross_cutting": [
        "profanity_strong",
        "mental_health_described",
        "mental_depression",
        "mental_anxiety",
        "mental_self_harm",
        "mental_substance_coping",
        "politics_protest",
    ],
}


# Teen Choice is a TEEN award, not a children's list, and it runs 2010-2019
# only. It is kept separate so a "kids" figure is not quietly a teen figure.
TEEN_LISTS = {"teen-choice"}


def load_kids_ids():
    """Year-End ids per kids list, parsed from the join TABLES.

    Grepping these notes for recording_ids is wrong and was the bug here
    before: roughly 100 of the ids in them sit in collision and explanation
    tables — the ids the join deliberately rejected ("Martin Solveig Hello is
    not Adele"). Counting those returns 719 instead of 617 and invents a kids
    history back to 1960, when exactly one joined song predates 2009.

    scripts/audit_kids_joins.py owns the table parser; this reuses it so the
    two can never drift apart.
    """
    sys.path.insert(0, os.path.join(ROOT, "scripts"))
    import audit_kids_joins as aud

    per_list = {}
    for name in aud.LISTS:
        path = os.path.join(KIDS_NOTES, "kids-charts-join-%s-year-end.md" % name)
        if not os.path.isfile(path):
            continue
        per_list[name] = {r["rid"] for r in aud.parse(path)}
    ids = set().union(*per_list.values()) if per_list else set()
    return ids, per_list


def cell_stats(rows, measure_keys):
    """Prevalence of each measure within one cell of songs."""
    n = len(rows)
    out = {}
    for key in measure_keys:
        _, pred = MEASURES[key]
        hits = sum(1 for r in rows if pred(r))
        out[key] = {
            "n": hits,
            "share": round(hits / n, 4) if n else None,
        }
        if key in RARE_MIN_N:
            out[key]["reliable"] = n >= RARE_MIN_N[key]
    return out


# --- Topics add-on card (config/read-card-topics.md) -----------------------
# Joined from live/reads/topics-t1/cards.csv (scripts/topics_cards.py export)
# only when it covers the whole kept corpus: a half-read add-on would put
# unread songs in the denominator as zeros. Until then nothing here is used
# and the feed is unchanged.

TOPICS_MIN_COVERAGE = 0.99

_ACT = ("present", "central")

TOPIC_MEASURES = {
    "cheating_act": (
        "Cheating happens or is proposed (topics card)",
        lambda r: r["cheating.presence"] in _ACT,
    ),
    "cheating_central": (
        "The song is about cheating (topics card)",
        lambda r: r["cheating.presence"] == "central",
    ),
    "cheating_speaker_as_other": (
        "Speaker is the other man/woman -- 'taking someone's girl' (topics card)",
        lambda r: r["cheating.presence"] in _ACT
        and "speaker_as_other" in r["cheating.who"].split("|"),
    ),
    "cheating_approving": (
        "Cheating celebrated or romanticized (topics card)",
        lambda r: r["cheating.presence"] in _ACT
        and r["cheating.stance"] in ("celebrated", "romanticized"),
    ),
    "casual_sex": (
        "Hook-up / no-strings sex invited or described (topics card)",
        lambda r: r["relationship.casual_sex"] in ("invited", "described"),
    ),
    "marriage_literal": (
        "Marriage, proposal or divorce in the song (topics card)",
        lambda r: r["relationship.marriage"] in ("married", "wants_to_marry", "divorce"),
    ),
    "breakup": (
        "Breakup happened or looming (topics card)",
        lambda r: r["relationship.breakup"] in ("happened", "looming"),
    ),
    "jealousy": (
        "Romantic jealousy (topics card)",
        lambda r: r["relationship.jealousy"] != "none",
    ),
    "police_any": (
        "Police appear at all (topics card)",
        lambda r: r["police.presence"] != "none",
    ),
    "police_encounter_or_force": (
        "A run-in with police, or police force, happens (topics card)",
        lambda r: r["police.presence"] in ("encounter", "force"),
    ),
    "anti_police": (
        "Hostile to or critical of police (topics card)",
        lambda r: r["police.stance"] in ("hostile", "critical"),
    ),
    "anti_authority": (
        "Defiant or hostile to authority (topics card)",
        lambda r: r["authority.stance"] in ("defiant", "hostile"),
    ),
    "crime_described": (
        "A crime is committed, planned or punished in the song (topics card)",
        lambda r: r["crime.presence"] == "described",
    ),
    "crime_nonviolent_described": (
        "Non-violent crime described: theft, dealing, fraud... (topics card)",
        lambda r: r["crime.presence"] == "described"
        and any(k and k != "violent" for k in r["crime.kinds"].split("|")),
    ),
    "crime_approving": (
        "Crime described and glorified or justified (topics card)",
        lambda r: r["crime.presence"] == "described"
        and r["crime.framing"] in ("glorified", "justified"),
    ),
}

TOPIC_DEBATES = {
    "relationships": [
        "cheating_act", "cheating_central", "cheating_speaker_as_other",
        "cheating_approving", "casual_sex", "marriage_literal", "breakup",
        "jealousy",
    ],
    "police_crime": [
        "police_any", "police_encounter_or_force", "anti_police",
        "anti_authority", "crime_described", "crime_nonviolent_described",
        "crime_approving",
    ],
}

# Rare measures need more songs per cell than MIN_N before a share means
# anything: a cell is reliable for such a measure only when it would expect
# at least RARE_EXPECTED_HITS hits at the corpus rate. Filled per build.
RARE_EXPECTED_HITS = 5
RARE_MIN_N = {}


def attach_topics(rows):
    """Join topics-card fields onto the kept rows. True when attached."""
    if not os.path.isfile(TOPICS_CARDS):
        return False
    with open(TOPICS_CARDS, encoding="utf-8") as fh:
        topics = {r["song_id"]: r for r in csv.DictReader(fh)}
    covered = sum(1 for r in rows if r["song_id"] in topics)
    if not rows or covered / len(rows) < TOPICS_MIN_COVERAGE:
        print("topics card covers %d/%d songs; not attached" % (covered, len(rows)))
        return False
    rows[:] = [r for r in rows if r["song_id"] in topics]
    for r in rows:
        t = topics[r["song_id"]]
        for key, value in t.items():
            if "." in key:
                r[key] = value
    MEASURES.update(TOPIC_MEASURES)
    DEBATES.update(TOPIC_DEBATES)
    for key, (_, pred) in TOPIC_MEASURES.items():
        share = sum(1 for r in rows if pred(r)) / len(rows)
        RARE_MIN_N[key] = max(MIN_N, math.ceil(RARE_EXPECTED_HITS / share)) if share else None
    return True


def load_exclusions():
    """Songs whose stored lyric body is not the song the metadata names.

    Verified one by one; see live/text-defect-verdicts.csv. Their cards code a
    different recording's words, so they are dropped from every measure rather
    than left to contribute a verdict about the wrong song.
    """
    out = {}
    if os.path.isfile(EXCLUSIONS):
        with open(EXCLUSIONS, encoding="utf-8") as fh:
            out.update({r["song_id"]: r for r in csv.DictReader(fh)})
    # Lean denominators: songs whose lyric cannot say anything the measures
    # ask about (near-instrumentals), or is not what charted. Reviewed one by
    # one from the reader's notes; see live/lean-exclusions.csv.
    if os.path.isfile(LEAN_EXCLUSIONS):
        with open(LEAN_EXCLUSIONS, encoding="utf-8") as fh:
            for r in csv.DictReader(fh):
                out.setdefault(r["song_id"], dict(r, actual_song=""))
    return out


def load_agreement():
    """Blind re-read agreement per composite measure, where one was measured.

    See scripts/consistency_check.py. Bounds noise, not bias.
    """
    if not os.path.isfile(AGREEMENT):
        return {}
    with open(AGREEMENT, encoding="utf-8") as fh:
        return json.load(fh).get("by_composite_measure", {})


def load_topics_agreement():
    """Blind re-read agreement per topics measure (pilot), keyed like HITS in
    scripts/topics_cards.py; positive agreement because the measures are rare."""
    if not os.path.isfile(TOPICS_AGREEMENT):
        return {}
    with open(TOPICS_AGREEMENT, encoding="utf-8") as fh:
        hits = json.load(fh).get("hits", {})
    alias = {"cheating_speaker_as_other": "speaker_as_other"}
    return {k: hits.get(alias.get(k, k)) for k in TOPIC_MEASURES if hits.get(alias.get(k, k))}


def _measure_meta(key, debate, ambiguity, agreement):
    """Measure metadata, with the lexicon ambiguity ceiling where one applies."""
    meta = {"label": MEASURES[key][0], "debate": debate}
    if key in TOPIC_MEASURES:
        meta["source"] = "topics_card_read"
        meta["min_n"] = RARE_MIN_N.get(key)
        agr = load_topics_agreement().get(key)
        if agr:
            meta["reread_agreement"] = agr["positive_agreement"]
            meta["reread_kappa"] = agr["kappa"]
            meta["reread_agreement_n"] = agr["either"]
        return meta
    agr = agreement.get(key)
    if agr:
        meta["reread_agreement"] = agr["rate"]
        meta["reread_agreement_n"] = agr["n"]
    cat = LEX_CATEGORY.get(key)
    if not cat:
        meta["source"] = "card_v3_read"
        return meta
    meta["source"] = "lexical_scan"
    meta["lexical_category"] = cat
    row = ambiguity.get(cat)
    if row:
        meta["ambiguity_share_at_risk"] = row["share_at_risk"]
        meta["ambiguity_note"] = (
            "%.0f%% of the songs this category hits rest entirely on terms the "
            "lexicon itself marks ambiguous. Upper bound on inflation, not an "
            "error rate." % (100 * row["share_at_risk"])
        )
    else:
        meta["ambiguity_share_at_risk"] = 0.0
    return meta


def build():
    with open(CARDS, encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))

    ambiguity = load_ambiguity()
    agreement = load_agreement()
    excluded = load_exclusions()
    dropped = [r for r in rows if r["song_id"] in excluded]
    rows = [r for r in rows if r["song_id"] not in excluded]
    topics_attached = attach_topics(rows)

    corpus_ids = {r["song_id"] for r in rows}
    kids_ids, kids_per_list = load_kids_ids()
    kids_in_corpus = kids_ids & corpus_ids

    all_measures = [k for keys in DEBATES.values() for k in keys]

    # Index songs by decade and by (decade, genre family).
    by_decade = defaultdict(list)
    by_cell = defaultdict(list)
    by_genre = defaultdict(list)
    by_period = defaultdict(list)
    by_period_genre = defaultdict(list)
    genre_seen = Counter()

    for r in rows:
        dec = r["decade"]
        by_decade[dec].append(r)
        per = period_of(r["year"])
        by_period[per].append(r)
        for g in [x for x in r["genre_families"].split("|") if x]:
            by_period_genre[(per, g)].append(r)
        fams = [g for g in r["genre_families"].split("|") if g]
        for g in fams:
            by_cell[(dec, g)].append(r)
            by_genre[g].append(r)
            genre_seen[g] += 1

    genres = sorted(genre_seen)

    result = {
        "schema": "decade-genre-breakdown/v1",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "live/reads/full-v3/cards.csv (card v3 full read, 6,197 songs)",
        "topics_source": ("live/reads/topics-t1/cards.csv (topics add-on card t1)"
                          if topics_attached else None),
        "n_songs": len(rows),
        "n_excluded": len(dropped),
        "excluded": [
            {"song_id": r["song_id"], "title": r["title"], "artist": r["artist"],
             "decade": r["decade"],
             "exclusion": excluded[r["song_id"]].get("exclusion", "wrong_body"),
             "actual_song": excluded[r["song_id"]].get("actual_song", "")}
            for r in sorted(dropped, key=lambda x: (x["decade"], x["title"]))
        ],
        "min_n": MIN_N,
        "method_notes": [
            "Genre families are multi-label: a song is counted in every family "
            "its catalog listings support, so genre cells do not sum to the "
            "decade total.",
            "Every share is WITHIN its cell: hits divided by the songs in that "
            "decade-and-genre, never divided by the decade total.",
            "No genre mix share is reported. The genre map is an external "
            "catalog candidate and cannot say what fraction of a decade 'was' "
            "any genre.",
            "Cells below min_n are emitted with reliable=false and must not be "
            "charted as a trend point.",
            "Five-year periods are emitted alongside decades. The corpus runs "
            "1960-2025, so the final period holds 2025 alone and carries "
            "complete=false; it must not be drawn beside four full periods.",
            "Measures tagged (lex) are vocabulary counts from the lexical scan, "
            "not context-aware readings.",
            "Where a measure was re-read blind, `reread_agreement` gives the "
            "rate two independent readings agreed on it. That bounds reader "
            "noise, not bias: a reader can be consistent and consistently "
            "wrong.",
            "Measures read from the lexical scan carry "
            "`ambiguity_share_at_risk`: the share of hit songs whose hit rests "
            "entirely on terms the lexicon marks ambiguous. Treat a measure "
            "above roughly 0.25 as directional only.",
            "`by_decade_without_genre` holds, per decade, every song NOT "
            "tagged with the family (a hip_hop|pop song is out of the "
            "hip_hop complement). It is the 'genre off' view.",
            "`kids_picked_by_year` (2010 on): every chart song of the year, and "
            "the ones the Kids' Choice Awards or Kidz Bop picked (Teen Choice and "
            "Radio Disney are not counted).",
            "`by_period5*` are five-year steps for charts; the last step is "
            "2020-25 (six years), so 2025 is never drawn alone.",
            "`by_year` holds single years (about 100 songs each): texture for "
            "a heatmap, too noisy to quote alone.",
            "`by_decade_genre_any` counts a song once if it carries any "
            "family in the set (hip_hop+rnb_soul = rap or R&B).",
            "Near-instrumentals and instrumental records stored with a sung "
            "version's lyric are left out too (live/lean-exclusions.csv): a "
            "song that cannot say anything should not sit in a denominator.",
            "Songs whose stored lyric body was verified to belong to a "
            "different recording are excluded entirely; see `excluded` and "
            "live/read-exclusions.csv.",
        ],
        "measures": {
            k: _measure_meta(k, d, ambiguity, agreement)
            for d, keys in DEBATES.items()
            for k in keys
        },
        "debates": DEBATES,
        "decades": DECADES,
        "genres": genres,
        "corpus": {
            "n_songs": len(rows),
            "measures": cell_stats(rows, all_measures),
        },
        "periods": [],
        "by_period": {},
        "by_period_genre": {},
        "by_decade": {},
        "by_genre": {},
        "by_decade_genre": {},
        "by_decade_without_genre": {},
        "by_decade_genre_any": {},
        "by_year": {},
        "kids_picked_by_year": {},
        "periods5": [],
        "by_period5": {},
        "by_period5_genre": {},
        "by_period5_without_genre": {},
        "by_period5_genre_any": {},
        "kids_crossover": {},
    }

    for dec in DECADES:
        drows = by_decade.get(dec, [])
        if not drows:
            continue
        result["by_decade"][dec] = {
            "n_songs": len(drows),
            "reliable": len(drows) >= MIN_N,
            "measures": cell_stats(drows, all_measures),
        }

    periods = sorted(by_period)
    result["periods"] = [
        {"label": p, "complete": period_is_complete(p), "n_songs": len(by_period[p])}
        for p in periods
    ]
    for p in periods:
        result["by_period"][p] = {
            "n_songs": len(by_period[p]),
            "complete": period_is_complete(p),
            "reliable": len(by_period[p]) >= MIN_N,
            "measures": cell_stats(by_period[p], all_measures),
        }
    for (p, g), prows in sorted(by_period_genre.items()):
        result["by_period_genre"]["%s|%s" % (p, g)] = {
            "period": p,
            "genre": g,
            "n_songs": len(prows),
            "complete": period_is_complete(p),
            "reliable": len(prows) >= MIN_N,
            "measures": cell_stats(prows, all_measures),
        }

    for g in genres:
        grows = by_genre[g]
        result["by_genre"][g] = {
            "n_songs": len(grows),
            "reliable": len(grows) >= MIN_N,
            "measures": cell_stats(grows, all_measures),
        }

    for dec in DECADES:
        for g in genres:
            crows = by_cell.get((dec, g), [])
            if not crows:
                continue
            result["by_decade_genre"]["%s|%s" % (dec, g)] = {
                "decade": dec,
                "genre": g,
                "n_songs": len(crows),
                "reliable": len(crows) >= MIN_N,
                "measures": cell_stats(crows, all_measures),
            }

    # The complement: every song in the decade NOT tagged with the family.
    # This is what "rap off" means -- a song tagged hip_hop|pop is removed,
    # because it carries the hip_hop tag at all.
    for dec in DECADES:
        drows = by_decade.get(dec, [])
        for g in genres:
            orows = [r for r in drows
                     if g not in [x for x in r["genre_families"].split("|") if x]]
            if not orows:
                continue
            result["by_decade_without_genre"]["%s|%s" % (dec, g)] = {
                "decade": dec,
                "without_genre": g,
                "n_songs": len(orows),
                "reliable": len(orows) >= MIN_N,
                "measures": cell_stats(orows, all_measures),
            }

    # Year by year: about 100 songs a year, so single years are noisy; they
    # are for the heatmap's texture, never quoted as a trend on their own.
    by_year = defaultdict(list)
    for r in rows:
        by_year[str(r["year"])[:4]].append(r)
    for y in sorted(by_year):
        yrows = by_year[y]
        result["by_year"][y] = {
            "n_songs": len(yrows),
            "reliable": len(yrows) >= MIN_N,
            "measures": cell_stats(yrows, all_measures),
        }

    # Chart songs the two kids lists picked (Kids' Choice Awards or Kidz Bop),
    # year by year from 2010, when both lists' coverage begins. Every chart
    # song of the year is the denominator; the picked ones are the subset.
    idx_flags = {}
    with open(os.path.join(ROOT, "live", "yearend-song-index.csv"), encoding="utf-8") as fh:
        for x in csv.DictReader(fh):
            idx_flags[x["recording_id"]] = (x.get("kca") == "1") or (x.get("kidzbop") == "1")
    for y in sorted(by_year):
        if int(y) < 2010:
            continue
        yrows = by_year[y]
        picked = [r for r in yrows if idx_flags.get(r["song_id"])]
        result["kids_picked_by_year"][y] = {
            "n_songs": len(yrows),
            "n_picked": len(picked),
            "measures": cell_stats(yrows, all_measures),
            "measures_picked": cell_stats(picked, all_measures) if picked else {},
        }

    # Five-year steps for the charts. 2025 alone would be a lone, noisy point,
    # so it folds into the last step, labelled "2020–25" (six years), just as
    # the 2020s decade runs 2020-2025.
    def p5(y):
        y = int(str(y)[:4])
        start = min(2020, y - y % 5)
        return "%d–%s" % (start, "25" if start == 2020 else str(start + 4)[2:])
    p5_rows = defaultdict(list)
    for r in rows:
        p5_rows[p5(r["year"])].append(r)
    labels = sorted(p5_rows)
    result["periods5"] = [{"label": l, "n_songs": len(p5_rows[l]), "years": 6 if l.startswith("2020") else 5} for l in labels]
    for l in labels:
        prs = p5_rows[l]
        result["by_period5"][l] = {"n_songs": len(prs), "reliable": len(prs) >= MIN_N,
                                   "measures": cell_stats(prs, all_measures)}
        for g in genres:
            inside = [r for r in prs if g in [x for x in r["genre_families"].split("|") if x]]
            outside = [r for r in prs if g not in [x for x in r["genre_families"].split("|") if x]]
            if inside:
                result["by_period5_genre"]["%s|%s" % (l, g)] = {"n_songs": len(inside), "reliable": len(inside) >= MIN_N,
                                                                 "measures": cell_stats(inside, all_measures)}
            if outside:
                result["by_period5_without_genre"]["%s|%s" % (l, g)] = {"n_songs": len(outside), "reliable": len(outside) >= MIN_N,
                                                                        "measures": cell_stats(outside, all_measures)}
        anyrows = [r for r in prs if {"hip_hop", "rnb_soul"} & set(x for x in r["genre_families"].split("|") if x)]
        result["by_period5_genre_any"]["%s|hip_hop+rnb_soul" % l] = {"n_songs": len(anyrows), "reliable": len(anyrows) >= MIN_N,
                                                                     "measures": cell_stats(anyrows, all_measures)}

    # Either-tag cuts: a song counts once if it carries ANY family in the set
    # (a hip_hop|rnb_soul song is counted once, not twice).
    for label, fams in (("hip_hop+rnb_soul", {"hip_hop", "rnb_soul"}),):
        for dec in DECADES:
            drows = by_decade.get(dec, [])
            arows = [r for r in drows
                     if fams & set(x for x in r["genre_families"].split("|") if x)]
            result["by_decade_genre_any"]["%s|%s" % (dec, label)] = {
                "decade": dec,
                "any_of": sorted(fams),
                "n_songs": len(arows),
                "reliable": len(arows) >= MIN_N,
                "measures": cell_stats(arows, all_measures),
            }

    # Kids crossover: same measures, restricted to songs that also charted
    # on a youth list, cut by decade.
    krows = [r for r in rows if r["song_id"] in kids_in_corpus]
    kids_only = set().union(*[v for k, v in kids_per_list.items()
                              if k not in TEEN_LISTS]) if kids_per_list else set()
    teen_only = set().union(*[v for k, v in kids_per_list.items()
                              if k in TEEN_LISTS]) if kids_per_list else set()
    result["kids_crossover"] = {
        "ids_in_join_notes": len(kids_ids),
        "ids_matched_to_corpus": len(kids_in_corpus),
        "per_list": {k: len(v & corpus_ids) for k, v in sorted(kids_per_list.items())},
        "kids_lists_only": len(kids_only & corpus_ids),
        "teen_lists_only": len(teen_only & corpus_ids),
        "n_songs": len(krows),
        "constraints": [
            "NOT what children heard. Kidz Bop re-records its songs with "
            "rewritten lyrics, and it supplies most of this union, so the "
            "lyric measured here is the ORIGINAL adult recording. Read this "
            "as what was SELECTED for a kids audience, never as exposure.",
            "Teen Choice is a teen award, not a children's list, and runs "
            "2010-2019 only. kids_lists_only excludes it.",
            "Coverage is effectively 2009-2025: exactly one joined song "
            "predates 2009. No long-run trend is available here.",
            "The four lists have different selection mechanisms and give "
            "different answers — kids voting (KCA) select more explicit songs "
            "than adults package (Radio Disney). Do not merge them silently.",
        ],
        "note": "Youth-chart crossover is title-level and list-era bound, so "
                "pre-2010 decades carry almost no crossover songs. Compare "
                "each decade's crossover songs against that same decade's "
                "corpus, never against the whole corpus.",
        "overall": {
            "n_songs": len(krows),
            "reliable": len(krows) >= MIN_N,
            "measures": cell_stats(krows, all_measures),
        },
        "by_decade": {},
    }
    for dec in DECADES:
        kd = [r for r in krows if r["decade"] == dec]
        if not kd:
            continue
        base = by_decade.get(dec, [])
        result["kids_crossover"]["by_decade"][dec] = {
            "n_songs": len(kd),
            "reliable": len(kd) >= MIN_N,
            "decade_n_songs": len(base),
            "measures": cell_stats(kd, all_measures),
            "decade_baseline": cell_stats(base, all_measures),
        }

    return result


def pct(cell, key):
    m = cell["measures"].get(key)
    if not m or m["share"] is None:
        return "--"
    return "%.1f%%" % (100 * m["share"])


def write_note(res):
    L = []
    A = L.append
    A("# Decade x genre breakdown — card v3 full read")
    A("")
    A("Generated %s from `%s`." % (res["generated_at"][:10], res["source"]))
    A("Feed: `live/decade-genre-breakdown.json`. Builder: "
      "`scripts/build_decade_genre_breakdown.py`.")
    A("")
    A("## How to read this")
    A("")
    for n in res["method_notes"]:
        A("- %s" % n)
    A("")
    A("Cells with n < %d are in the feed but flagged `reliable: false`; they "
      "are omitted from the tables below." % res["min_n"])
    A("")

    # Headline contrasts: computed, not narrated. First-to-last decade change
    # for the corpus, and the spread across genres in the latest decade.
    A("## Headline contrasts (computed)")
    A("")
    A("First decade with data vs. 2020s, corpus-wide; then the highest and "
      "lowest genre in the 2020s among reliable cells. Genre is a filter "
      "here, never a claim about what a decade was made of.")
    A("")
    A("| Measure | 1960s | 2020s | Change | 2020s highest genre | 2020s lowest genre |")
    A("|---|---:|---:|---:|---|---|")
    for debate, keys in res["debates"].items():
        for k in keys:
            first = res["by_decade"].get("1960s")
            last = res["by_decade"].get("2020s")
            if not first or not last:
                continue
            f = first["measures"][k]["share"]
            l = last["measures"][k]["share"]
            delta = "%+.1f pp" % (100 * (l - f)) if None not in (f, l) else "--"
            ranked = []
            for g in res["genres"]:
                c = res["by_decade_genre"].get("2020s|%s" % g)
                if c and c["reliable"]:
                    ranked.append((c["measures"][k]["share"], g))
            ranked.sort()
            hi = "%s %.1f%%" % (ranked[-1][1], 100 * ranked[-1][0]) if ranked else "--"
            lo = "%s %.1f%%" % (ranked[0][1], 100 * ranked[0][0]) if ranked else "--"
            A("| %s | %s | %s | %s | %s | %s |" % (
                res["measures"][k]["label"], pct(first, k), pct(last, k),
                delta, hi, lo))
    A("")

    A("## Corpus totals (all %s songs)" % format(res["n_songs"], ","))
    A("")
    A("| Measure | Share |")
    A("|---|---:|")
    for d, keys in res["debates"].items():
        for k in keys:
            A("| %s | %s |" % (res["measures"][k]["label"], pct(res["corpus"], k)))
    A("")

    for debate, keys in res["debates"].items():
        A("## %s — by decade" % debate.replace("_", " ").title())
        A("")
        A("| Measure | %s |" % " | ".join(res["decades"]))
        A("|---|%s|" % "|".join(["---:"] * len(res["decades"])))
        for k in keys:
            cells = []
            for dec in res["decades"]:
                c = res["by_decade"].get(dec)
                cells.append(pct(c, k) if c else "--")
            A("| %s | %s |" % (res["measures"][k]["label"], " | ".join(cells)))
        A("")

        A("### %s — by decade x genre" % debate.replace("_", " ").title())
        A("")
        for k in keys:
            A("**%s**" % res["measures"][k]["label"])
            A("")
            A("| Genre | %s |" % " | ".join(res["decades"]))
            A("|---|%s|" % "|".join(["---:"] * len(res["decades"])))
            for g in res["genres"]:
                gc = res["by_genre"].get(g)
                if not gc or not gc["reliable"]:
                    continue
                cells = []
                for dec in res["decades"]:
                    c = res["by_decade_genre"].get("%s|%s" % (dec, g))
                    cells.append(pct(c, k) if c and c["reliable"] else "--")
                if all(x == "--" for x in cells):
                    continue
                A("| %s (n=%s) | %s |" % (g, format(gc["n_songs"], ","),
                                          " | ".join(cells)))
            A("")

    kc = res["kids_crossover"]
    A("## Kids crossover")
    A("")
    A("%s Year-End ids appear in the four youth-chart join notes; %s match the "
      "read corpus." % (format(kc["ids_in_join_notes"], ","),
                        format(kc["ids_matched_to_corpus"], ",")))
    A("")
    A("Per list (matched to corpus): %s."
      % ", ".join("%s %s" % (k, format(v, ","))
                  for k, v in kc["per_list"].items()))
    A("")
    A("**Count resolved (2026-09-22).** The union is %s, parsed from the join "
      "tables. `FROZEN.md`'s 609 is 607 `yes` rows plus the 2 the Kidz Bop "
      "note records patching; the remaining fuzzy/alias joins postdate the "
      "freeze. An earlier pass here reported 719 by grepping the notes for "
      "recording_ids, which also swept up the ids the join REJECTED in its "
      "collision tables — that number was wrong and is corrected."
      % format(kc["ids_matched_to_corpus"], ","))
    A("")
    A("**This is not what children heard.** Kidz Bop re-records with rewritten "
      "lyrics and supplies most of the union, so the lyric measured is the "
      "original adult recording. Read every figure below as what was "
      "*selected* for a kids audience.")
    A("")
    A("%s" % kc["note"])
    A("")
    A("| Decade | Crossover n | Measure | Crossover | Decade baseline |")
    A("|---|---:|---|---:|---:|")
    for dec in res["decades"]:
        c = kc["by_decade"].get(dec)
        if not c or not c["reliable"]:
            continue
        for k in ("sex_graphic_or_explicit", "violence_beyond_mention",
                  "drugs_use_or_sale", "money_flex", "profanity_strong"):
            base = {"measures": c["decade_baseline"]}
            A("| %s | %s | %s | %s | %s |" % (
                dec, format(c["n_songs"], ","), res["measures"][k]["label"],
                pct(c, k), pct(base, k)))
    A("")

    A("## Cell sizes (decade x genre)")
    A("")
    A("Songs per cell. Multi-label, so rows do not sum to the decade total.")
    A("")
    A("| Genre | %s |" % " | ".join(res["decades"]))
    A("|---|%s|" % "|".join(["---:"] * len(res["decades"])))
    for g in res["genres"]:
        cells = []
        for dec in res["decades"]:
            c = res["by_decade_genre"].get("%s|%s" % (dec, g))
            if not c:
                cells.append("0")
            elif c["reliable"]:
                cells.append(format(c["n_songs"], ","))
            else:
                cells.append("%s*" % c["n_songs"])
        A("| %s | %s |" % (g, " | ".join(cells)))
    A("")
    A("`*` = below n=%d, not charted." % res["min_n"])
    A("")
    return "\n".join(L)


def main():
    res = build()
    with open(OUT_JSON, "w", encoding="utf-8") as fh:
        json.dump(res, fh, indent=1, sort_keys=True)
        fh.write("\n")
    with open(OUT_NOTE, "w", encoding="utf-8") as fh:
        fh.write(write_note(res))
    print("wrote %s" % OUT_JSON)
    print("wrote %s" % OUT_NOTE)
    print("cells: %d  genres: %d  kids matched: %d"
          % (len(res["by_decade_genre"]), len(res["genres"]),
             res["kids_crossover"]["ids_matched_to_corpus"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Body / booty lines: "shake that ass", "twerk", "make it clap", "drop it low".

A phrase count with no model calls. Precision comes from method, in two tiers:

- clear phrases count wherever they appear: twerk, booty, "make it clap",
  and any shake/clap/bounce/pop/throw + that/your + ass/booty/butt/cheeks;
- loose phrases ("drop it", "back it up", "bounce", "throw it back",
  "work it", "shake it", "wine", "grind", "pop it", "get low"...) count only
  when ALL of these hold:
    1. a body or dance word sits within WINDOW tokens ("drop it low",
       "back it up on me", "bounce that ass");
    2. no giveaway word is near it ("back it up" + truck, "drop it" + beat);
       rules in config/body-phrases/blocked-by.txt, stoplist-context format;
    3. it falls on a line the reader flagged as sexual (card v3
       sex.evidence), or on a line whose words are identical to a flagged
       line (the same chorus line, repeated: the reader flags one instance);
    4. the reader rated the song suggestive or stronger, or objectifying.

Giveaway blocks apply to both tiers, on top of the global
config/lexicon/stoplist-idioms.txt and stoplist-context.txt.

Line numbers in sex.evidence are 1-based over the lyric file split on "\\n",
blank lines and section markers included (config/read-card.md). Checked on
all 9,080 flagged lines: at the stated number none is blank and sex-lexicon
words peak (16%); one line either side, 13-15% are blank and 2-3% carry a
sex word.

Reads the hash-locked bodies read-only and writes counts only (no lyric text,
no titles) to live/body-phrases.json. The precision sample goes to
live/private/body-phrase-sample.csv (gitignored): song, line number and the
matched phrase from the list below, never the lyric. Mark each row's
`verdict` right/wrong, re-run, and the feed records the precision.

Usage: python3 scripts/body_phrases.py [--new-sample]
"""

from __future__ import annotations

import csv
import json
import os
import random
import sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_decade_genre_breakdown as B  # noqa: E402
import lexical_measures as LM  # noqa: E402
import normalize_substances as NS  # noqa: E402

ROOT = NS.ROOT
CARDS_DIR = os.path.join(ROOT, "live", "reads", "full-v3")
BLOCKS = os.path.join(ROOT, "config", "body-phrases", "blocked-by.txt")
OUT = os.path.join(ROOT, "live", "body-phrases.json")
SAMPLE = os.path.join(ROOT, "live", "private", "body-phrase-sample.csv")
DECADES = NS.DECADES
WINDOW = 5
SAMPLE_PER_TIER = 15
SEED = 20260924
SONG_GATE_LEVELS = {"suggestive", "explicit", "graphic"}

# Body and dance words that make a loose phrase about the body.
BODY_WORDS = frozenset("""
ass azz booty bootie butt butts bum rump behind backside cheeks cakes
hips hip waist thighs thigh body bodies curves thick thicc thang
dance dancin dancing dancer dancefloor floor low ground pole stripper strippers
twerk twerkin twerking jiggle jigglin wiggle wigglin wobble clap clappin clapping bend knees
""".split())
# ... or right after the phrase: "back it up on me".
AFTER = {("on", "me"), ("on", "him"), ("on", "em"), ("on", "you"), ("on", "it"), ("on", "that")}

BUTT = ["ass", "azz", "booty", "butt", "bum", "rump", "behind", "backside", "cheeks", "thang",
        "tailfeather", "tail feather", "moneymaker", "money maker"]
DET = ["that", "your", "ya", "yo", "her", "my", "dat", "them", "those"]
# "shake that little ass", "shake that healthy butt"
ADJ = ["", "little ", "lil ", "big ", "fat ", "phat ", "sexy ", "healthy ", "round ", "juicy ", "thick "]
# "make that ass bounce": noun first, then the motion
MOTION = ["bounce", "bouncin", "bouncing", "clap", "clappin", "clapping", "jiggle", "jigglin", "wobble",
          "wobblin", "shake", "shakin", "shaking", "twerk", "twerkin", "drop", "pop", "poppin"]


def _combos(verbs, dets=DET, nouns=BUTT, tail=""):
    return ["%s %s %s%s%s" % (v, d, a, n, tail) for v in verbs for d in dets for a in ADJ for n in nouns]


# group -> (clear phrases, loose phrases)
GROUPS = {
    "twerk": (["twerk", "twerks", "twerked", "twerkin", "twerking", "twerker", "twerkers"], []),
    "booty words": (["%s %s %s" % (d, n, m) for d in ("that", "dat", "your", "ya", "her")
                     for n in ("ass", "azz", "butt", "cheeks", "rump") for m in MOTION]
                    + ["booty", "bootylicious", "badonkadonk", "badunkadunk", "junk in the trunk",
                     "junk in her trunk", "junk in your trunk", "big butt", "big butts", "apple bottom",
                     "apple bottoms", "culo", "ass so fat", "ass fat", "ass is fat", "ass so big",
                     "phat ass", "ass clap", "booty clap", "cheeks clap"], []),
    "shake it": (_combos(["shake", "shakin", "shaking", "shakes"])
                 + ["shake your bon bon"],
                 ["shake it", "shakin it", "shaking it", "shake that", "shakin that", "shaking that",
                  "shake your", "shake ya", "shake yo"]),
    "make it clap": (["make it clap", "makin it clap", "making it clap", "make that clap",
                      "make it clap", "make that ass clap", "make your ass clap", "make that booty clap"]
                     + _combos(["clap", "clappin", "clapping"]),
                     ["clap it", "clap that", "clap it up"]),
    "back it up": (_combos(["back"], tail=" up") + ["back that thang up", "back dat thang up"],
                   ["back it up", "backin it up", "backing it up", "back that up", "back it on"]),
    "throw it back": (_combos(["throw", "throwin", "throwing"], dets=["that", "dat"], tail=" back")
                      + _combos(["throw", "throwin", "throwing"], dets=["that", "dat"]),
                      ["throw it back", "throwin it back", "throwing it back", "threw it back",
                       "throw that back"]),
    "drop it low": (_combos(["drop", "droppin", "dropping"], dets=["that", "dat"]),
                    ["drop it", "droppin it", "dropping it", "drop that", "drop down",
                     "get low", "gettin low", "getting low", "go low"]),
    "bounce": (_combos(["bounce", "bouncin", "bouncing"]),
               ["bounce", "bouncin", "bouncing", "bounces"]),
    "work it": (_combos(["work", "workin", "working"], dets=["that", "dat"]),
                ["work it", "workin it", "working it", "werk it", "work that", "workin that", "working that"]),
    "wine / grind / pop": (_combos(["pop", "poppin", "popping", "wiggle", "wobble", "jiggle", "grind",
                                    "grindin", "wine", "whine"], dets=["that", "dat", "your", "ya"])
                           + ["wine your waist", "whine your waist", "wine up your waist",
                              "bend that ass over", "bend it over"],
                           ["wine", "winin", "whine", "whinin", "grind", "grindin", "grinding", "grind on",
                            "pop it", "poppin it", "popping it", "pop that", "poppin that",
                            "bend over", "wobble", "wiggle", "jiggle", "gyrate", "gyrating"]),
}
TIERS = ("clear", "loose")


def build_index():
    """phrase tokens -> (group, tier); longest phrases first, clear wins ties."""
    idx = {}
    for tier_i, tier in enumerate(TIERS):
        for group, lists in GROUPS.items():
            for p in lists[tier_i]:
                toks = tuple(LM.tokenize(p))
                if toks and toks not in idx:
                    idx[toks] = (group, tier)
    return idx


INDEX = build_index()
MAX_LEN = max(len(k) for k in INDEX)


class _Rules:
    """Just enough of a Lexicon for LM.context_blocked_positions."""

    def __init__(self, rules):
        self.context_rules = rules


def load_rules(lex=None):
    """(giveaway blocks, body-word needs) as lexical_measures ContextRules."""
    blocks = LM._read_context_rules(LM.Path(BLOCKS))
    if lex is not None:
        blocks = blocks + list(lex.context_rules)
    needs = [LM.ContextRule("near", " ".join(k), k, WINDOW, BODY_WORDS, "body/dance word near")
             for k, (_, tier) in INDEX.items() if tier == "loose"]
    return _Rules(blocks), _Rules(needs)


def line_tokens(lines):
    """Flat token stream plus each token's 1-based line number."""
    toks, where = [], []
    for n, line in enumerate(lines, 1):
        t = LM.tokenize(line)
        toks.extend(t)
        where.extend([n] * len(t))
    return toks, where


def flagged_lines(lines, evidence_lines):
    """Reader-flagged lines, plus every line with identical words to one."""
    keys = {tuple(LM.tokenize(lines[n - 1])) for n in evidence_lines if 0 < n <= len(lines)}
    keys.discard(())
    return {n for n, line in enumerate(lines, 1) if tuple(LM.tokenize(line)) in keys}


def match_song(lines, evidence_lines, song_gate, blocks, needs, lex=None):
    """Counted matches and the loose-tier funnel for one song.

    Returns (matches, funnel): matches is a list of (line, phrase, group,
    tier); funnel counts loose candidates surviving each gate in turn.
    """
    toks, where = line_tokens(lines)
    blocked = LM.context_blocked_positions(toks, blocks)
    if lex is not None:
        blocked |= LM.blocked_positions(toks, lex)
    supported = LM.context_blocked_positions(toks, needs)
    flagged = flagged_lines(lines, evidence_lines)
    funnel = Counter()
    out = []
    n, i = len(toks), 0
    while i < n:
        hit = None
        for size in range(min(MAX_LEN, n - i), 0, -1):
            key = tuple(toks[i:i + size])
            if key in INDEX:
                hit = key
                break
        if not hit:
            i += 1
            continue
        group, tier = INDEX[hit]
        end = i + len(hit)
        ok = not any(j in blocked for j in range(i, end))
        if tier == "loose":
            funnel["candidates"] += 1
            after = tuple(toks[end:end + 2]) in AFTER
            ok_ctx = i in supported or after
            funnel["body_word_near"] += ok_ctx
            ok = ok and ok_ctx
            funnel["not_blocked"] += ok
            ok = ok and where[i] in flagged
            funnel["on_flagged_line"] += ok
            ok = ok and song_gate
            funnel["song_gate"] += ok
        if ok:
            out.append((where[i], " ".join(hit), group, tier))
        i = end
    return out, funnel


def song_gate(card):
    sex = card.get("sex") or {}
    return sex.get("level") in SONG_GATE_LEVELS or sex.get("speaker_stance") == "objectifying"


def evidence_lines(card):
    return [e["line"] for e in ((card.get("sex") or {}).get("evidence") or [])
            if isinstance(e.get("line"), int)]


class Scope:
    def __init__(self):
        self.n = Counter()
        self.songs = Counter()
        self.mentions = Counter()
        self.top = Counter()
        self.tier_songs = defaultdict(Counter)
        self.tier_mentions = defaultdict(Counter)
        self.g_songs = defaultdict(Counter)
        self.g_mentions = defaultdict(Counter)
        self.g_tier = defaultdict(Counter)

    def add(self, dec, matches):
        self.n[dec] += 1
        if not matches:
            return
        self.songs[dec] += 1
        self.mentions[dec] += len(matches)
        self.top[dec] = max(self.top[dec], len(matches))
        for tier in {m[3] for m in matches}:
            self.tier_songs[dec][tier] += 1
        for group in {m[2] for m in matches}:
            self.g_songs[dec][group] += 1
        for _, _, group, tier in matches:
            self.tier_mentions[dec][tier] += 1
            self.g_mentions[dec][group] += 1
            self.g_tier[dec][group + "." + tier] += 1

    def dump(self):
        out = {}
        for d in DECADES:
            if not self.n[d]:
                continue
            out[d] = {
                "n_songs": self.n[d],
                "songs_with_match": self.songs[d],
                "mentions": self.mentions[d],
                "max_in_one_song": self.top[d],
                "tiers": {t: {"songs": self.tier_songs[d][t], "mentions": self.tier_mentions[d][t]}
                          for t in TIERS},
                "groups": {g: {"songs": self.g_songs[d][g], "mentions": self.g_mentions[d][g],
                               "clear_mentions": self.g_tier[d][g + ".clear"],
                               "loose_mentions": self.g_tier[d][g + ".loose"]}
                           for g in GROUPS if self.g_songs[d][g]},
            }
        return out


def write_sample(per_song, index):
    """One random counted match per sampled song, SAMPLE_PER_TIER per tier."""
    rng = random.Random(SEED)
    rows = []
    for tier in TIERS:
        songs = sorted(sid for sid, ms in per_song.items() if any(m[3] == tier for m in ms))
        for sid in rng.sample(songs, min(SAMPLE_PER_TIER, len(songs))):
            line, phrase, group, _ = rng.choice([m for m in per_song[sid] if m[3] == tier])
            meta = index.get(sid, {})
            rows.append({"song_id": sid, "title": meta.get("title", ""),
                         "artist": meta.get("credited_artist", ""), "year": meta.get("first_chart_year", ""),
                         "line": line, "phrase": phrase, "group": group, "tier": tier,
                         "verdict": "", "note": ""})
    rng.shuffle(rows)
    os.makedirs(os.path.dirname(SAMPLE), exist_ok=True)
    with open(SAMPLE, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    return len(rows)


RIGHT = {"right", "r", "y", "yes", "1", "true", "ok", "correct"}
WRONG = {"wrong", "w", "n", "no", "0", "false", "incorrect"}


def score_sample(per_song, tier_mentions):
    """Precision from the owner's marks, or None while unmarked."""
    if not os.path.isfile(SAMPLE):
        return None
    with open(SAMPLE, encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    counted = {(sid, m[0], m[1]) for sid, ms in per_song.items() for m in ms}
    stale = sum((r["song_id"], int(r["line"]), r["phrase"]) not in counted for r in rows)
    by = defaultdict(Counter)
    for r in rows:
        v = (r.get("verdict") or "").strip().lower()
        by[r["tier"]]["right" if v in RIGHT else "wrong" if v in WRONG else "unmarked"] += 1
    marked = sum(c["right"] + c["wrong"] for c in by.values())
    res = {"sample_size": len(rows), "marked": marked, "stale_rows": stale,
           "design": "%d songs per tier drawn at random (seed %d), one counted match each; "
                     "the owner opened each song and marked the match right or wrong" % (SAMPLE_PER_TIER, SEED),
           "by_tier": {}}
    if not marked:
        res["precision"] = None
        return res
    for t, c in by.items():
        k = c["right"] + c["wrong"]
        res["by_tier"][t] = {"right": c["right"], "wrong": c["wrong"], "unmarked": c["unmarked"],
                             "precision": round(c["right"] / k, 3) if k else None}
    # Mention-weighted: each tier's precision weighted by its share of mentions.
    total = sum(tier_mentions.values())
    tiers = [t for t in TIERS if res["by_tier"].get(t, {}).get("precision") is not None]
    if total and len(tiers) == len(TIERS):
        res["precision"] = round(sum(res["by_tier"][t]["precision"] * tier_mentions[t] for t in TIERS) / total, 3)
    else:
        right = sum(c["right"] for c in by.values())
        res["precision"] = round(right / marked, 3)
    return res


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    with open(NS.CARDS, encoding="utf-8") as fh:
        rows = {r["song_id"]: r for r in csv.DictReader(fh)}
    with open(LM.INDEX_CSV, encoding="utf-8") as fh:
        index = {r["recording_id"]: r for r in csv.DictReader(fh)}
    excluded = B.load_exclusions()
    with open(LM.MANIFEST, encoding="utf-8") as fh:
        manifest = {r["recording_id"]: r for r in csv.DictReader(fh)}
    lex = LM.Lexicon.load(LM.LEXICON_DIR)
    blocks, needs = load_rules(lex)

    scopes = {"all": Scope(), "hip_hop": Scope()}
    funnel = Counter()
    per_song = {}
    missing = 0
    for sid, r in rows.items():
        if sid in excluded:
            continue
        m = manifest.get(sid)
        body = LM.CORPUS / (m.get("release_body_path") or "") if m else None
        cpath = os.path.join(CARDS_DIR, sid + ".json")
        if not body or not body.is_file() or not os.path.isfile(cpath):
            missing += 1
            continue
        with open(cpath, encoding="utf-8") as fh:
            card = json.load(fh)
        lines = body.read_text(encoding="utf-8").split("\n")
        matches, f = match_song(lines, evidence_lines(card), song_gate(card), blocks, needs, lex)
        funnel.update(f)
        if matches:
            per_song[sid] = matches
        dec = r["decade"]
        hh = "hip_hop" in (r.get("genre_families") or "").split("|")
        scopes["all"].add(dec, matches)
        if hh:
            scopes["hip_hop"].add(dec, matches)

    if "--new-sample" in argv or not os.path.isfile(SAMPLE):
        print("sample:", write_sample(per_song, index), "rows ->", os.path.relpath(SAMPLE, ROOT))
    tier_mentions = Counter(m[3] for ms in per_song.values() for m in ms)

    res = {
        "schema": "body-phrases/v1",
        "source": ("phrase count over the hash-locked lyric bodies, loose phrases gated by body/dance words "
                   "nearby, giveaway words (config/body-phrases/blocked-by.txt) and card v3 sex.evidence lines"),
        "note": ("Counts only, no lyric text. clear phrases count wherever they appear (giveaway blocks "
                 "still apply); loose phrases count only with a body/dance word within %d tokens, no "
                 "giveaway word near, on a line the reader flagged as sexual (or the same line repeated), "
                 "in a song rated suggestive or stronger or objectifying. mentions = every counted "
                 "occurrence, chorus repeats included. Loose counts are a floor: the reader flags "
                 "evidence lines, not every line." % WINDOW),
        "method": {"window": WINDOW, "song_gate_levels": sorted(SONG_GATE_LEVELS),
                   "song_gate_stance": "objectifying", "body_words": sorted(BODY_WORDS),
                   "line_numbering": "1-based over the file split on newlines; blank lines and section "
                                     "markers count (verified on 9,080 flagged lines)"},
        "groups": {g: {"clear": lists[0], "loose": lists[1]} for g, lists in GROUPS.items()},
        "loose_funnel": dict(funnel),
        "songs_missing_body_or_card": missing,
        "decades": DECADES,
        "all": scopes["all"].dump(),
        "hip_hop": scopes["hip_hop"].dump(),
        "precision": score_sample(per_song, tier_mentions),
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(res, fh, indent=1, sort_keys=True)
        fh.write("\n")

    print("loose funnel:", dict(funnel))
    for scope in ("all", "hip_hop"):
        print(scope, "  songs-with-match/n  mentions (clear+loose)")
        for d, x in res[scope].items():
            print("  %s %4d/%-5d %5d (%d+%d) max %d" % (
                d, x["songs_with_match"], x["n_songs"], x["mentions"], x["tiers"]["clear"]["mentions"],
                x["tiers"]["loose"]["mentions"], x["max_in_one_song"]))
    p = res["precision"]
    print("precision:", "unmarked" if not p or p.get("precision") is None else p["precision"])
    return 0


if __name__ == "__main__":
    sys.exit(main())

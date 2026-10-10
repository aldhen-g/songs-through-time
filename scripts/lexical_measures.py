#!/usr/bin/env python3
"""Lexical measurement pipeline over the sealed 6,197-song Year-End corpus.

Pure standard library, deterministic, single pass. No API calls, no model
calls. This is the FAST SCAN layer: it measures vocabulary, not meaning.
A word being present is not a claim about what the song is about.

Inputs
  examples/.../full-corpus-coding-release-v5/working-manifest.csv
  examples/.../full-corpus-coding-release-v5/working-lyrics/<id>.txt
  live/yearend-song-index.csv          title / artist / decade
  live/yearend-song-year.csv           chart years
  methodology/overlays/v5-genre-identity-overlay-v1/genre-listings.csv
  config/lexicon/*.txt                 one category per file

Outputs
  live/lexical-measures.csv
  live/lexical-hits.jsonl
  live/lexical-summary.json
  live/lexical-README.md   (written by hand; not regenerated here)

Usage
  python3 scripts/lexical_measures.py            # whole corpus
  python3 scripts/lexical_measures.py --song R0123...   # one song, to stdout
  python3 scripts/lexical_measures.py --corpus kids-side
      the kids-side songs (scripts/read_run.py kids_side_songs) ->
      live/reads/kids-side-v1/lexical-{measures.csv,hits.jsonl,summary.json};
      the hits jsonl is gitignored like live/lexical-hits.jsonl.

Lyric bodies never leave the corpus directory. The only text this script
emits is the matched term plus at most CONTEXT_CHARS characters of
surrounding context, per category, for the FIRST occurrence only.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
import zlib
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORPUS = (
    ROOT
    / "examples/lyric-fresh-harvest-2026-08-20/production-ready-v3"
    / "full-corpus-coding-release-v5"
)
MANIFEST = CORPUS / "working-manifest.csv"
INDEX_CSV = ROOT / "live/yearend-song-index.csv"
YEAR_CSV = ROOT / "live/yearend-song-year.csv"
LEXICON_DIR = ROOT / "config/lexicon"
GENRE_LISTINGS = (
    ROOT / "methodology/overlays/v5-genre-identity-overlay-v1/genre-listings.csv"
)
GENRE_INDEX = (
    ROOT / "methodology/overlays/v5-genre-identity-overlay-v1/genre-listings-index.csv"
)

OUT_CSV = ROOT / "live/lexical-measures.csv"
OUT_JSONL = ROOT / "live/lexical-hits.jsonl"
OUT_SUMMARY = ROOT / "live/lexical-summary.json"

STOPLIST_CATEGORY = "stoplist-idioms"
CONTEXT_STOPLIST_CATEGORY = "stoplist-context"
NWORD_TAG_PREFIX = "nword"
CONTEXT_CHARS = 40
SLANG_CANDIDATE_N = 15
VOCAB_WINDOW = 1000
SPEC_RANK = {"recording": 1, "release": 2, "album": 3}
DECADES = ("1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s")

# Words counted for the pronoun rates. Tokenizer keeps apostrophes inside
# words, so "i'm" is one token.
SELF_REF = frozenset(
    {"i", "me", "my", "mine", "myself", "i'm", "im", "i'll", "i've", "i'd"}
)
SECOND_PERSON = frozenset(
    {"you", "your", "yours", "yourself", "you're", "youre", "you'll", "you've", "u"}
)
WE_WORDS = frozenset({"we", "us", "our", "ours", "ourselves", "we're", "we'll", "we've"})
SHE_WORDS = frozenset({"she", "her", "hers", "herself", "she's", "shes", "she'll"})
HE_WORDS = frozenset({"he", "him", "his", "himself", "he's", "hes", "he'll"})
# will / gonna / 'll. The tokenizer keeps "i'll" as one token, so the
# contracted future is caught by the "'ll" suffix test, not by this set.
FUTURE_WORDS = frozenset({"will", "gonna", "gunna", "gon", "gon'", "imma", "i'ma"})

# Separators that mark a second billed act in the credited-artist string.
_FEATURE_SPLIT_RE = re.compile(
    r"\bfeaturing\b|\bfeat\.?|\bft\.?|&|\bwith\b|,", re.IGNORECASE
)
# A crude proper-noun test: Titlecase only. ALL-CAPS ad-libs ("YEAH") and
# single letters ("I") are deliberately excluded.
_LINE_TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z']*")

# Small built-in stopword list used ONLY for the slang-candidate heuristic.
# It is not used in any measure that lands in the CSV.
COMMON_ENGLISH = frozenset(
    """
a about above after again against all almost alone along already also always am
an and another any anybody anymore anyone anything are aren't around as ask at
away baby back bad be became because become been before began behind being best
better between big both boy boys bring but by call called came can can't cannot
cause 'cause cos coz come comes coming could couldn't cry cut day days dear did
didn't die different do does doesn't doin doing don don't done down each early
either else end enough even ever every everybody everyone everything eye eyes
face fact fall far feel feeling feels feet felt few find fine first for found
from front full gave get gets getting gettin girl girls give given go goes goin
going gone gonna good got gotta great had half hand hands happen happy hard has
hasn't have haven't having he he's head hear heard held help her here here's
hers herself hey high him himself his hit hold home hope hour how however i i'd
i'll i'm i've if in inside instead into is isn't it it's its itself just keep
kept kind knew know known knows la lay left less let let's life light like
little live lived living ll long look looked looking lose lost lot love low
made make makes making man many may maybe me mean means men might mind mine
minute miss more morning most mother move much music must my myself na name
near need needs never new next night no nobody none nor not nothing now number
of off oh ok okay old on once one only onto open or other others our ours out
over own part people perhaps person place play playing please put ran rather
read ready real really right room run running said same saw say saying says
school second see seem seen set shall she she's should shouldn't show side sing
since sir sit small so some somebody someone something sometimes song soon
sorry sound stand start started state stay still stop story street such sure
take taken takes talk talking tell ten than that that's the their theirs them
themselves then there there's these they they'll they're they've thing things
think this those though thought three through throw till time times to today
together told tomorrow tonight too took top toward town try trying turn turned
two under until up upon us use used very wait walk walked walking wanna want
wanted wants was wasn't watch water way we we'll we're week well went were
weren't what what's whatever when where whether which while white who whole
whom whose why will with within without woman women won't word words work
world would wouldn't ya yeah year years yes yet you you'd you'll you're you've
your yours yourself
"""
    .split()
) | frozenset(
    # second tier: still ordinary English / song-filler, kept separate so the
    # heuristic's two halves stay readable.
    """
    able above afraid again ago alive alright answer anyway arms around baby's
    bed believe belong better beyond blue body born boy's break bring brought
    burn call'd care carry catch caught chance change check chorus city clean
    close cold color country crazy cross crowd cry'n dance dancing dark dead
    deep door dream dreams dress drive drop dry ear earth easy eat everyday
    everywhere fast fear fight fill fire floor fly follow forever free friend
    friends game gave gold gotten green ground grow hair hall hand's hang hate
    heart heaven held hell hide hold'n hole hot house hurt inside intro jump
    keeps kid kids kiss knees knock land late laugh lead learn leave leaving
    lie lies listen lonely lord lose losing loud made magic matter mine's mouth
    moon nice nothin' o'clock ocean once outro pain party pay phone pick piece
    play'n power pretty promise pull queen quiet race rain raise reach reason
    remember repeat rest ride rise river road rock roll round sad save scream
    seas seek send shake shame share shine shoes shot shout sick sight sign
    silence sky sleep slow smile smoke snow soft sold soul sound's speak spend
    stars step stick stone stranger strong summer sun sunshine sweet swing take's
    tears teeth thank thanks throw'n touch train travel tree trip true truth
    understand verse voice wake walk'n wall war watch'n wave wear wet wild win
    wind window wine wings winter wish woke wonder wrong young
    """.split()
)

_TOKEN_RE = re.compile(r"[a-z0-9]+(?:'[a-z0-9]+)*")
# Provider-added structure labels such as "[Chorus]" or "[Verse 2]". A few
# hundred bodies carry them; they inflate word_count and line_count slightly.
_SECTION_MARKER_RE = re.compile(
    r"^\s*[\[(](chorus|verse|hook|bridge|intro|outro|refrain|pre.?chorus)",
    re.IGNORECASE | re.MULTILINE,
)
_APOS = str.maketrans({"’": "'", "ʼ": "'", "´": "'", "`": "'"})


# --------------------------------------------------------------------------
# tokenization
# --------------------------------------------------------------------------


def tokenize(text: str) -> list[str]:
    """Lowercase, strip punctuation, keep apostrophes INSIDE words."""
    return _TOKEN_RE.findall(text.translate(_APOS).lower())


def tokenize_spans(text: str) -> tuple[list[str], list[tuple[int, int]]]:
    """Same as tokenize(), but also return each token's (start, end) offset
    in the original text so a hit can quote a short context window."""
    lowered = text.translate(_APOS).lower()
    tokens: list[str] = []
    spans: list[tuple[int, int]] = []
    for match in _TOKEN_RE.finditer(lowered):
        tokens.append(match.group(0))
        spans.append((match.start(), match.end()))
    return tokens, spans


# --------------------------------------------------------------------------
# lexicon loading
# --------------------------------------------------------------------------


class ContextRule:
    """One line of `stoplist-context.txt`.

    Two kinds, both of which suppress a term *in context* rather than
    everywhere:

    `near`   block the term when any trigger word appears within `window`
             tokens on either side ("ride" next to a car noun).
    `repeat` block the term when the very next or previous token is the same
             token ("wop wop wop" is onomatopoeia, not the ethnic slur).
    """

    __slots__ = ("kind", "term", "tokens", "window", "triggers", "note")

    def __init__(
        self,
        kind: str,
        term: str,
        tokens: tuple[str, ...],
        window: int,
        triggers: frozenset,
        note: str,
    ) -> None:
        self.kind = kind
        self.term = term
        self.tokens = tokens
        self.window = window
        self.triggers = triggers
        self.note = note


class Lexicon:
    """Phrase index over every category file in config/lexicon/."""

    def __init__(self) -> None:
        # tokens tuple -> list of (category, surface term, tag or "")
        self.index: dict[tuple[str, ...], list[tuple[str, str, str]]] = {}
        self.stop_index: dict[tuple[str, ...], str] = {}
        # Same keys as stop_index: None = block every category, otherwise the
        # set of categories this phrase blocks for (an `|only:` tag).
        self.stop_scope: dict[tuple[str, ...], frozenset | None] = {}
        self.context_rules: list[ContextRule] = []
        self.categories: list[str] = []
        self.entry_counts: dict[str, int] = {}
        self.max_len = 1
        self.stop_max_len = 1
        self.nword_terms: set[str] = set()

    @classmethod
    def load(cls, directory: Path) -> "Lexicon":
        lex = cls()
        for path in sorted(directory.glob("*.txt")):
            category = path.stem
            if category == CONTEXT_STOPLIST_CATEGORY:
                lex.context_rules = _read_context_rules(path)
                lex.entry_counts[category] = len(lex.context_rules)
                continue
            entries = _read_entries(path)
            if category == STOPLIST_CATEGORY:
                for term, tag in entries:
                    toks = tuple(tokenize(term))
                    if not toks:
                        continue
                    scope = None
                    if tag.startswith("only:"):
                        scope = frozenset(
                            part.strip()
                            for part in tag[len("only:") :].split(",")
                            if part.strip()
                        )
                    lex.stop_index[toks] = term
                    lex.stop_scope[toks] = scope
                    lex.stop_max_len = max(lex.stop_max_len, len(toks))
                lex.entry_counts[category] = len(entries)
                continue
            lex.categories.append(category)
            lex.entry_counts[category] = len(entries)
            for term, tag in entries:
                toks = tuple(tokenize(term))
                if not toks:
                    continue
                lex.index.setdefault(toks, []).append((category, term, tag))
                lex.max_len = max(lex.max_len, len(toks))
                if tag.split(":")[0] == NWORD_TAG_PREFIX:
                    lex.nword_terms.add(term)
        if not lex.categories:
            raise SystemExit("no lexicon categories found in %s" % directory)
        return lex


def _read_entries(path: Path) -> list[tuple[str, str]]:
    """Parse one lexicon file: `entry` or `entry|tag`, `#` comments, blanks."""
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "|" in line:
            term, tag = line.split("|", 1)
        else:
            term, tag = line, ""
        term = term.strip().lower()
        tag = tag.strip()
        if not term or term in seen:
            continue
        seen.add(term)
        out.append((term, tag))
    return out


def _read_context_rules(path: Path) -> list[ContextRule]:
    """Parse `stoplist-context.txt`.

        term => near <window> => trigger, trigger, ...   # note
        term => repeat                                   # note

    Any malformed line raises, so a typo cannot silently disable a rule.
    """
    rules: list[ContextRule] = []
    for lineno, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        parts = [p.strip() for p in line.split("=>")]
        term = parts[0].lower()
        toks = tuple(tokenize(term))
        if not toks or len(parts) < 2:
            raise SystemExit("%s:%d: cannot parse context rule: %s" % (path, lineno, raw))
        spec = parts[1].lower().split()
        note = raw.split("#", 1)[1].strip() if "#" in raw else ""
        if spec[:1] == ["repeat"]:
            rules.append(ContextRule("repeat", term, toks, 0, frozenset(), note))
            continue
        if spec[:1] == ["near"] and len(spec) == 2 and len(parts) == 3:
            triggers = frozenset(
                t for chunk in parts[2].split(",") for t in tokenize(chunk)
            )
            if not triggers:
                raise SystemExit("%s:%d: near rule has no triggers" % (path, lineno))
            rules.append(
                ContextRule("near", term, toks, int(spec[1]), triggers, note)
            )
            continue
        raise SystemExit("%s:%d: cannot parse context rule: %s" % (path, lineno, raw))
    return rules


# --------------------------------------------------------------------------
# matching
# --------------------------------------------------------------------------


def blocked_positions_scoped(
    tokens: list[str], lex: Lexicon
) -> tuple[set[int], dict[str, set[int]]]:
    """Token indices covered by an idiom-stoplist phrase.

    Returns (blocked everywhere, {category: blocked for that category only}).
    A phrase tagged `|only:religion` lands in the second map, so "god damn"
    can stop counting as religion while still counting as mild profanity.
    """
    blocked: set[int] = set()
    scoped: dict[str, set[int]] = defaultdict(set)
    if not lex.stop_index:
        return blocked, scoped
    n = len(tokens)
    i = 0
    while i < n:
        hit = 0
        key: tuple[str, ...] = ()
        for size in range(min(lex.stop_max_len, n - i), 0, -1):
            candidate = tuple(tokens[i : i + size])
            if candidate in lex.stop_index:
                hit = size
                key = candidate
                break
        if hit:
            scope = lex.stop_scope.get(key)
            if scope is None:
                blocked.update(range(i, i + hit))
            else:
                for category in scope:
                    scoped[category].update(range(i, i + hit))
            i += hit
        else:
            i += 1
    return blocked, scoped


def blocked_positions(tokens: list[str], lex: Lexicon) -> set[int]:
    """Token indices blocked for every category (unscoped stoplist hits)."""
    return blocked_positions_scoped(tokens, lex)[0]


def context_blocked_positions(tokens: list[str], lex: Lexicon) -> set[int]:
    """Token indices suppressed by a `stoplist-context.txt` rule."""
    blocked: set[int] = set()
    if not lex.context_rules:
        return blocked
    n = len(tokens)
    for rule in lex.context_rules:
        size = len(rule.tokens)
        first = rule.tokens[0]
        for i, token in enumerate(tokens):
            if token != first or i + size > n:
                continue
            if tuple(tokens[i : i + size]) != rule.tokens:
                continue
            end = i + size
            if rule.kind == "repeat":
                prev_same = i > 0 and tokens[i - 1] == first
                next_same = end < n and tokens[end] == first
                if prev_same or next_same:
                    blocked.update(range(i, end))
                continue
            lo = max(0, i - rule.window)
            hi = min(n, end + rule.window)
            window = tokens[lo:i] + tokens[end:hi]
            if any(t in rule.triggers for t in window):
                blocked.update(range(i, end))
    return blocked


def match_song(
    tokens: list[str], spans: list[tuple[int, int]], text: str, lex: Lexicon
) -> tuple[dict[str, Counter], dict[str, dict[str, str]]]:
    """Longest-match-wins, non-overlapping scan over the token stream.

    Returns (counts_by_category, first_context_by_category_and_term).
    """
    blocked, scoped = blocked_positions_scoped(tokens, lex)
    blocked = blocked | context_blocked_positions(tokens, lex)
    counts: dict[str, Counter] = defaultdict(Counter)
    contexts: dict[str, dict[str, str]] = defaultdict(dict)
    n = len(tokens)
    i = 0
    while i < n:
        if i in blocked:
            i += 1
            continue
        matched = 0
        for size in range(min(lex.max_len, n - i), 0, -1):
            end = i + size
            if any(j in blocked for j in range(i, end)):
                continue
            found = lex.index.get(tuple(tokens[i:end]))
            if not found:
                continue
            start_char = spans[i][0]
            end_char = spans[end - 1][1]
            for category, term, _tag in found:
                cat_block = scoped.get(category)
                if cat_block and any(j in cat_block for j in range(i, end)):
                    continue
                counts[category][term] += 1
                if term not in contexts[category]:
                    contexts[category][term] = _context(text, start_char, end_char)
            matched = size
            break
        i += matched if matched else 1
    return counts, contexts


def _context(text: str, start: int, end: int) -> str:
    """<= CONTEXT_CHARS characters of surrounding text, single line."""
    pad = max(0, (CONTEXT_CHARS - (end - start)) // 2)
    lo = max(0, start - pad)
    hi = min(len(text), end + pad)
    snippet = " ".join(text[lo:hi].split())
    return snippet[:CONTEXT_CHARS]


# --------------------------------------------------------------------------
# structural measures
# --------------------------------------------------------------------------


def lz_ratio(text: str) -> float:
    """Compressed size / raw size of the lyric — a repetition proxy.

    The body is lowercased, whitespace-normalised and blank lines dropped
    first, so the ratio measures word repetition rather than the provider's
    indentation. Lower = more repetitive. zlib level is pinned so the number
    is reproducible.
    """
    normalised = "\n".join(
        " ".join(line.split()) for line in text.lower().splitlines() if line.strip()
    )
    raw = normalised.encode("utf-8")
    if not raw:
        return 0.0
    return round(len(zlib.compress(raw, 6)) / len(raw), 6)


def vocab_per_1000(tokens: list[str]) -> float:
    """Distinct tokens per 1,000 tokens, on the FIRST 1,000 tokens.

    Songs shorter than the window are measured on the whole body and scaled
    up, which is type-token ratio x 1000 and carries the same length bias
    below 1,000 tokens. Above the window it is length-stable, which is the
    point. `word_count` tells a reader which case a row is in.
    """
    window = tokens[:VOCAB_WINDOW]
    if not window:
        return 0.0
    return round(1000.0 * len(set(window)) / len(window), 4)


def proper_noun_rate(text: str, word_count: int) -> float:
    """Titlecase tokens that are not line-initial, per 100 words.

    Crude on purpose: it is a capitalisation counter, not a named-entity
    recogniser. It over-counts the capitalised first word of a sung phrase
    mid-line and under-counts lowercase-styled lyric sheets; ALL-CAPS ad-libs
    and one-letter tokens (the pronoun "I") are excluded.
    """
    if not word_count:
        return 0.0
    hits = 0
    for line in text.translate(_APOS).splitlines():
        for pos, match in enumerate(_LINE_TOKEN_RE.finditer(line)):
            if pos == 0:
                continue
            token = match.group(0)
            if len(token) < 2:
                continue
            if token[0].isupper() and token[1:] == token[1:].lower():
                hits += 1
    return round(100.0 * hits / word_count, 4)


def first_chorus_line_index(lines: list[str]) -> int:
    """Index of the first non-blank line that is repeated later, else -1.

    A cheap stand-in for "where the hook lands": in a verse/chorus song the
    first line that comes back is usually the first line of the first chorus.
    It is wrong for songs that repeat a verse line, and for songs with no
    exact repeat at all it is -1.
    """
    counts = Counter(lines)
    for idx, line in enumerate(lines):
        if counts[line] > 1:
            return idx
    return -1


def feature_count(artist: str) -> int:
    """Billed-act separators in the credited-artist string.

    Counts `featuring` / `feat.` / `ft.` / `&` / `with` / `,`; 0 means one
    billed act. It is a string measure of the *credit*, not of who sings:
    a group with a comma in its name reads as a feature and a guest who is
    not in the credit string reads as none.
    """
    if not artist:
        return 0
    return len(_FEATURE_SPLIT_RE.findall(artist))


def structural(text: str, tokens: list[str]) -> dict[str, float]:
    word_count = len(tokens)
    unique = len(set(tokens))
    total_len = sum(len(t) for t in tokens)

    raw_lines = [" ".join(line.split()).lower() for line in text.splitlines()]
    lines = [line for line in raw_lines if line]
    line_count = len(lines)

    seen: set[str] = set()
    repeats = 0
    for line in lines:
        if line in seen:
            repeats += 1
        else:
            seen.add(line)

    longest_run = 0
    run = 0
    prev = None
    for line in lines:
        if prev is not None and line == prev:
            run += 1
        else:
            run = 1
        longest_run = max(longest_run, run)
        prev = line

    def rate(words: frozenset) -> float:
        if not word_count:
            return 0.0
        return round(100.0 * sum(1 for t in tokens if t in words) / word_count, 4)

    return {
        "word_count": word_count,
        "unique_words": unique,
        "type_token_ratio": round(unique / word_count, 6) if word_count else 0.0,
        "mean_word_len": round(total_len / word_count, 4) if word_count else 0.0,
        "line_count": line_count,
        "repeated_line_share": round(repeats / line_count, 6) if line_count else 0.0,
        "longest_repeat_run": longest_run,
        "self_ref_rate": rate(SELF_REF),
        "second_person_rate": rate(SECOND_PERSON),
        "we_rate": rate(WE_WORDS),
        "she_rate": rate(SHE_WORDS),
        "he_rate": rate(HE_WORDS),
        "future_tense_rate": (
            round(
                100.0
                * sum(
                    1
                    for t in tokens
                    if t in FUTURE_WORDS or t.endswith("'ll")
                )
                / word_count,
                4,
            )
            if word_count
            else 0.0
        ),
        "lz_ratio": lz_ratio(text),
        "vocab_per_1000": vocab_per_1000(tokens),
        "proper_noun_rate": proper_noun_rate(text, word_count),
        "first_chorus_line_index": first_chorus_line_index(lines),
    }


STRUCTURAL_FIELDS = (
    "word_count",
    "unique_words",
    "type_token_ratio",
    "mean_word_len",
    "line_count",
    "repeated_line_share",
    "longest_repeat_run",
    "self_ref_rate",
    "second_person_rate",
    "we_rate",
    "she_rate",
    "he_rate",
    "future_tense_rate",
    "lz_ratio",
    "vocab_per_1000",
    "proper_noun_rate",
    "first_chorus_line_index",
    "feature_count",
)


# --------------------------------------------------------------------------
# joins
# --------------------------------------------------------------------------


def _read_csv(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def load_genre_families() -> tuple[dict[str, list[str]], str]:
    """Per-song genre families from the frozen Layer A listings + map v2.

    The published chart JSON is aggregate-only, but the per-song join it was
    built from is right here, so we rebuild it rather than skipping genre.
    Returns ({recording_id: [families]}, note).
    """
    if not (GENRE_LISTINGS.is_file() and GENRE_INDEX.is_file()):
        return {}, "genre listings not found; genre columns left blank"
    sys.path.insert(0, str(ROOT / "scripts"))
    try:
        from listings_to_family_v2 import classify_recording  # noqa: WPS433
    except Exception as exc:  # pragma: no cover - environment guard
        return {}, "listings_to_family_v2 unavailable (%s)" % exc

    by_recording: dict[str, list[tuple[int, str]]] = defaultdict(list)
    for row in _read_csv(GENRE_LISTINGS):
        spec = (row.get("specificity") or "").strip()
        if spec not in SPEC_RANK:
            continue
        label = (row.get("genre_label_raw") or "").strip()
        if label:
            by_recording[row["recording_id"]].append((SPEC_RANK[spec], label))

    families: dict[str, list[str]] = {}
    for row in _read_csv(GENRE_INDEX):
        rid = row["recording_id"]
        ranked = by_recording.get(rid, [])
        if ranked:
            best = min(rank for rank, _ in ranked)
            labels = [label for rank, label in ranked if rank == best]
        else:
            labels = []
        fams, _klass = classify_recording(row.get("listings_status") or "", labels)
        families[rid] = sorted(fams)
    note = (
        "per-song genre families rebuilt from "
        "methodology/overlays/v5-genre-identity-overlay-v1/genre-listings.csv "
        "through scripts/listings_to_family_v2.py (map listings-to-family-v2). "
        "Multi-family is allowed; membership cells do not sum to N."
    )
    return families, note


def load_songs() -> tuple[list[dict], list[str]]:
    """Manifest joined to title/artist/year/decade/genre. Returns (rows, warnings)."""
    warnings: list[str] = []
    manifest = _read_csv(MANIFEST)
    index = {row["recording_id"]: row for row in _read_csv(INDEX_CSV)}

    years: dict[str, list[int]] = defaultdict(list)
    for row in _read_csv(YEAR_CSV):
        try:
            years[row["recording_id"]].append(int(row["chart_year"]))
        except (TypeError, ValueError):
            continue

    families, genre_note = load_genre_families()
    if genre_note.startswith("genre listings not found"):
        warnings.append(genre_note)

    seen: set[str] = set()
    songs: list[dict] = []
    for row in manifest:
        rid = row["recording_id"]
        if rid in seen:
            warnings.append("duplicate recording_id in manifest: %s" % rid)
            continue
        seen.add(rid)
        body = CORPUS / (row.get("release_body_path") or "")
        if not body.is_file():
            warnings.append("missing lyric body: %s" % rid)
            continue
        idx = index.get(rid)
        if idx is None:
            warnings.append("recording_id not in yearend-song-index: %s" % rid)
            idx = {}
        year = idx.get("first_chart_year") or row.get("first_chart_year") or ""
        chart_years = sorted(years.get(rid, []))
        songs.append(
            {
                "song_id": rid,
                "title": idx.get("title") or row.get("title") or "",
                "artist": idx.get("credited_artist") or row.get("credited_artist") or "",
                "year": year,
                "decade": idx.get("decade") or row.get("decade") or "",
                "chart_years": chart_years,
                "genre_families": families.get(rid, []),
                "path": body,
            }
        )
    return songs, warnings


# --------------------------------------------------------------------------
# per-song measurement
# --------------------------------------------------------------------------


def outputs_for(corpus: str) -> tuple:
    """(csv, jsonl, summary) for a corpus; Year-End reads the module globals."""
    if corpus == "yearend":
        return OUT_CSV, OUT_JSONL, OUT_SUMMARY
    out = ROOT / "live/reads/kids-side-v1"
    return (out / "lexical-measures.csv", out / "lexical-hits.jsonl",
            out / "lexical-summary.json")


def load_kids_side_songs() -> tuple[list[dict], list[str]]:
    sys.path.insert(0, str(ROOT / "scripts"))
    import read_run  # noqa: WPS433
    songs = []
    for song in read_run.Ctx(ROOT, read_run.KIDS_SIDE).kids_songs():
        songs.append(dict(song, genre_families=[], chart_years=[]))
    missing = ["missing lyric body: %s" % s["song_id"] for s in songs if not s["path"].is_file()]
    return [s for s in songs if s["path"].is_file()], missing


def col(category: str) -> str:
    return category.replace("-", "_")


def measure_song(song: dict, lex: Lexicon) -> tuple[dict, dict, list[str]]:
    text = song["path"].read_text(encoding="utf-8", errors="replace")
    tokens, spans = tokenize_spans(text)
    counts, contexts = match_song(tokens, spans, text, lex)

    row = {
        "song_id": song["song_id"],
        "title": song["title"],
        "artist": song["artist"],
        "year": song["year"],
        "decade": song["decade"],
        "genre_families": "|".join(song["genre_families"]),
        "has_section_markers": int(bool(_SECTION_MARKER_RE.search(text))),
    }
    row.update(structural(text, tokens))
    row["feature_count"] = feature_count(song["artist"])

    word_count = row["word_count"] or 0
    hits: dict[str, list[dict]] = {}

    for category in lex.categories:
        cat_counts = counts.get(category, Counter())
        if category == "slurs":
            groups = {
                "slur_n_word": Counter(
                    {t: c for t, c in cat_counts.items() if t in lex.nword_terms}
                ),
                "slurs": Counter(
                    {t: c for t, c in cat_counts.items() if t not in lex.nword_terms}
                ),
            }
        else:
            groups = {col(category): cat_counts}

        for name, group in groups.items():
            total = sum(group.values())
            row["%s_count" % name] = total
            row["%s_per100" % name] = (
                round(100.0 * total / word_count, 4) if word_count else 0.0
            )
            row["any_%s" % name] = int(total > 0)
            if group:
                hits[name] = [
                    {
                        "term": term,
                        "count": group[term],
                        "context": contexts[category].get(term, ""),
                    }
                    for term in sorted(group, key=lambda t: (-group[t], t))
                ]

    # Derived rollup: all four drug families together.
    drug_cols = [
        col(c) for c in lex.categories if c.startswith("drugs-")
    ]
    drug_total = sum(row["%s_count" % c] for c in drug_cols)
    row["drugs_all_count"] = drug_total
    row["drugs_all_per100"] = (
        round(100.0 * drug_total / word_count, 4) if word_count else 0.0
    )
    row["any_drugs_all"] = int(drug_total > 0)

    return row, {"song_id": song["song_id"], "hits": hits}, tokens


def measure_columns(lex: Lexicon) -> list[str]:
    names: list[str] = []
    for category in lex.categories:
        if category == "slurs":
            names.extend(["slur_n_word", "slurs"])
        else:
            names.append(col(category))
    names.append("drugs_all")
    return names


# --------------------------------------------------------------------------
# summary
# --------------------------------------------------------------------------


def _mean(values: list[float]) -> float:
    return round(sum(values) / len(values), 6) if values else 0.0


def summarize_group(rows: list[dict], names: list[str]) -> dict:
    out: dict = {"n_songs": len(rows)}
    density = {}
    share = {}
    for name in names:
        density[name] = _mean([r["%s_per100" % name] for r in rows])
        share[name] = (
            round(sum(r["any_%s" % name] for r in rows) / len(rows), 6) if rows else 0.0
        )
    out["mean_density_per_100_words"] = density
    out["share_of_songs_with_any_match"] = share
    out["mean_structural"] = {
        field: _mean([float(r[field]) for r in rows]) for field in STRUCTURAL_FIELDS
    }
    return out


def slang_candidates(freq: Counter, in_lexicon: set[str], limit: int) -> list[dict]:
    """Frequent tokens that are neither lexicon terms nor common English.

    Heuristic only: length >= 4, not a pure number, not a stopword, not a
    single-token lexicon entry. These are candidates for the owner to read,
    not findings.
    """
    out = []
    for token, count in freq.most_common():
        if len(out) >= limit:
            break
        if len(token) < 4 or token.isdigit():
            continue
        if token in COMMON_ENGLISH or token in in_lexicon:
            continue
        bare = token.replace("'", "")
        if bare in COMMON_ENGLISH or bare in in_lexicon:
            continue
        out.append({"token": token, "count": count})
    return out


# --------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------


def run_all(verbose: bool = True, corpus: str = "yearend") -> dict:
    started = time.time()
    OUT_CSV, OUT_JSONL, OUT_SUMMARY = outputs_for(corpus)  # noqa: N806
    lex = Lexicon.load(LEXICON_DIR)
    songs, warnings = load_songs() if corpus == "yearend" else load_kids_side_songs()
    names = measure_columns(lex)

    single_token_terms = {
        toks[0] for toks in lex.index if len(toks) == 1
    } | {toks[0] for toks in lex.stop_index if len(toks) == 1}

    rows: list[dict] = []
    corpus_freq: Counter = Counter()
    empty_bodies: list[str] = []
    section_marker_files = 0

    OUT_JSONL.parent.mkdir(parents=True, exist_ok=True)
    with OUT_JSONL.open("w", encoding="utf-8") as jsonl:
        for song in songs:
            row, hit_record, tokens = measure_song(song, lex)
            if row["word_count"] == 0:
                empty_bodies.append(song["song_id"])
            rows.append(row)
            jsonl.write(json.dumps(hit_record, ensure_ascii=False, sort_keys=True))
            jsonl.write("\n")
            corpus_freq.update(tokens)
            section_marker_files += row["has_section_markers"]

    header = [
        "song_id",
        "title",
        "artist",
        "year",
        "decade",
        "genre_families",
        "has_section_markers",
        *STRUCTURAL_FIELDS,
    ]
    for name in names:
        header.extend(["%s_count" % name, "%s_per100" % name, "any_%s" % name])

    with OUT_CSV.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=header)
        writer.writeheader()
        for row in sorted(rows, key=lambda r: r["song_id"]):
            writer.writerow(row)

    by_decade: dict[str, list[dict]] = defaultdict(list)
    by_decade_genre: dict[str, dict[str, list[dict]]] = defaultdict(
        lambda: defaultdict(list)
    )
    for row in rows:
        by_decade[row["decade"] or "unknown"].append(row)
        fams = [f for f in row["genre_families"].split("|") if f] or ["unknown"]
        for fam in fams:
            by_decade_genre[row["decade"] or "unknown"][fam].append(row)

    summary = {
        "schema": "lexical-measures-1",
        "generated_by": "scripts/lexical_measures.py",
        "n_songs": len(rows),
        "categories": names,
        "lexicon_entry_counts": lex.entry_counts,
        "structural_fields": list(STRUCTURAL_FIELDS),
        "limits": [
            "Vocabulary, not meaning. A match is a word, not a topic.",
            "Lexicons are a hand-drafted first pass; the owner prunes.",
            "Slang drifts: a 2020s term measured across 1960s songs reads 0 "
            "for reasons of vocabulary, not of subject matter.",
            "The idiom stoplist is short by design and does not resolve metaphor.",
            "Genre families are catalog listings, multi-family, and do not sum to N.",
            "Categories overlap on purpose (sex_work with sex_graphic, "
            "country_checklist with alcohol) and must never be summed.",
            "tobacco is NOT part of the drugs_all rollup; only the four "
            "drugs-* files are.",
            "sex_suggestive, mental_health, country_checklist, "
            "tech_phone_social and police_authority are pointers, not "
            "measures; see the per-file headers and the README limits.",
        ],
        "by_decade": {
            decade: summarize_group(by_decade[decade], names)
            for decade in DECADES
            if decade in by_decade
        },
        "by_decade_genre": {
            decade: {
                fam: summarize_group(group, names)
                for fam, group in sorted(by_decade_genre[decade].items())
            }
            for decade in DECADES
            if decade in by_decade_genre
        },
        "corpus": summarize_group(rows, names),
        "slang_candidates": slang_candidates(
            corpus_freq, single_token_terms, SLANG_CANDIDATE_N
        ),
        "bodies_with_section_markers": section_marker_files,
        "data_notes": sorted(set(warnings)) + (
            ["empty lyric body (0 tokens): %s" % ", ".join(empty_bodies)]
            if empty_bodies
            else []
        ),
    }
    OUT_SUMMARY.write_text(
        json.dumps(summary, indent=2, ensure_ascii=False, sort_keys=False) + "\n",
        encoding="utf-8",
    )

    elapsed = time.time() - started
    if verbose:
        print("rows written: %d" % len(rows))
        print("runtime: %.2fs" % elapsed)
        print("outputs: %s, %s, %s" % (OUT_CSV.name, OUT_JSONL.name, OUT_SUMMARY.name))
        for note in summary["data_notes"]:
            print("note: %s" % note)
    summary["_elapsed_seconds"] = round(elapsed, 3)
    return summary


def run_one(song_id: str, corpus: str = "yearend") -> int:
    lex = Lexicon.load(LEXICON_DIR)
    songs, _warnings = load_songs() if corpus == "yearend" else load_kids_side_songs()
    match = next((s for s in songs if s["song_id"] == song_id), None)
    if match is None:
        print("no such song id: %s" % song_id, file=sys.stderr)
        return 1
    row, hit_record, _tokens = measure_song(match, lex)
    print("%s — %s / %s (%s, %s)" % (
        row["song_id"], row["title"], row["artist"], row["year"], row["decade"]
    ))
    print("genre families: %s" % (row["genre_families"] or "(none)"))
    print("\nstructural")
    for field in STRUCTURAL_FIELDS:
        print("  %-20s %s" % (field, row[field]))
    print("\ncategories with matches")
    for name in measure_columns(lex):
        if row["%s_count" % name]:
            print(
                "  %-22s count=%-4d per100=%s"
                % (name, row["%s_count" % name], row["%s_per100" % name])
            )
    print("\nhits")
    for name, items in sorted(hit_record["hits"].items()):
        print("  %s" % name)
        for item in items:
            print("    %-24s x%-3d  %s" % (item["term"], item["count"], item["context"]))
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--song", help="print one song's measures and hits")
    parser.add_argument("--corpus", choices=("yearend", "kids-side"), default="yearend")
    args = parser.parse_args(argv)
    if args.song:
        return run_one(args.song, args.corpus)
    run_all(corpus=args.corpus)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

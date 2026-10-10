#!/usr/bin/env python3
"""Detail under the headline measures: how violence, sex, hook-ups and
cheating show up in the songs, by decade (all songs and hip-hop).

Headline shares say "explicit rose this much". This says what is inside:
how the violence happens and whom it targets, which weapons are named and how
often, how many lines of a song are explicit and what that language is doing,
whether a hook-up is invited or happens, who cheats and how the song feels
about it.

Three sources, all already on disk (no model calls):
- card v3 (live/reads/full-v3/cards.csv): the reader's verdicts and the
  evidence lines it flagged (tags threat/act/weapon/mourning, graphic/explicit);
- topics card t1.2 (live/reads/topics-t1/): hook-ups, cheating, and each
  song's topic_index (sections and their tags);
- word counts over the hash-locked lyric bodies, gated like
  scripts/drug_mentions.py: a word only counts in a song the reader already
  put in that category (weapons in songs with violence threatened or enacted;
  crude sex words in songs rated graphic), so "strap" on a seatbelt or
  "kitty" the cat never counts.

Crude sex words are reported only as groups (acts, oral, anatomy...), never
as the words themselves. Weapons are reported by name, like drugs. Output is
counts only: no lyric text, no titles, no per-song rows.

Usage: python3 scripts/content_detail.py   ->  live/content-detail.json
"""

from __future__ import annotations

import csv
import json
import os
import sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_decade_genre_breakdown as B  # noqa: E402
import drug_mentions as DM  # noqa: E402
import lexical_measures as LM  # noqa: E402
import normalize_substances as NS  # noqa: E402

ROOT = NS.ROOT
TOPICS_DIR = os.path.join(ROOT, "live", "reads", "topics-t1")
OUT = os.path.join(ROOT, "live", "content-detail.json")
DECADES = NS.DECADES

# Weapons, by name. Counted only in songs with violence threatened or enacted.
WEAPONS = {
    "glock": ["glock", "glocks", "glock 19", "glock 40", "glizzy"],
    "ak / ar": ["ak", "ak 47", "ak47", "a k", "ar 15", "ar15", "ar", "assault rifle"],
    "draco": ["draco", "dracos"],
    "choppa": ["choppa", "choppas", "chopper", "choppers"],
    "uzi / mac / tec": ["uzi", "uzis", "mac 10", "mac 11", "mac", "macs", "tec 9", "tec nine", "tec"],
    "strap / pole / blick": ["strap", "straps", "strapped", "pole", "poles", "blicky", "blick", "blickey",
                             "gat", "gats", "heater", "burner", "burners", "nina", "jammy",
                             "jammies", "fn"],
    "gun / pistol": ["gun", "guns", "pistol", "pistols", "revolver", "handgun", "handguns", "firearm",
                     "firearms", "9mm", "nine millimeter", "357", "38 special", "44 mag", "magnum",
                     "desert eagle", "deagle", "beretta", "ruger", "smith and wesson", "sig sauer"],
    "shotgun / rifle": ["shotgun", "shotguns", "sawed off", "sawn off", "12 gauge", "twelve gauge",
                        "rifle", "rifles", "sniper", "machine gun", "tommy gun", "gatling"],
    "bullets / clip": ["bullet", "bullets", "clip", "clips", "extendo", "extended clip", "thirty clip",
                       "hollow points", "hollow tips", "ammo", "ammunition", "slugs", "shells"],
    "knife": ["knife", "knives", "shank", "machete", "switchblade", "dagger", "sword", "box cutter",
              "razor blade"],
    "explosives": ["grenade", "grenades", "bomb", "bombs", "tnt", "molotov", "dynamite", "explosives",
                   "rocket launcher"],
}

# What the violence words say. Same gate as weapons.
VIOLENCE_WORDS = {
    "kill / murder": ["kill", "kills", "killed", "killing", "killin", "murder", "murders", "murdered",
                      "homicide", "body bag", "caught a body", "drop a body", "bodies"],
    "shoot / shots": ["shoot", "shoots", "shooting", "shootin", "shot", "shots", "shots fired",
                      "shootout", "bang bang", "pull the trigger", "squeeze the trigger",
                      "let off", "spray", "spin the block", "slide on", "drill"],
    "death words (loose)": ["dead", "die", "died", "casket", "coffin", "funeral", "grave", "graveyard",
                        "rip", "rest in peace", "six feet"],
    "beat / fight": ["beat him up", "beat you up", "beat down", "beatdown", "fight", "fighting", "stomp",
                     "stomped", "punch", "jumped", "brawl", "throw hands", "square up"],
    "rob": ["rob", "robbed", "robbery", "robbing", "stick up", "stickup", "jack", "jacked", "carjack"],
}

# Crude sex words, as groups only. Counted only in songs rated graphic.
SEX_GROUPS = {
    "sex acts": ["fuck", "fucking", "fuckin", "fucked", "smash", "smashing", "beat it up", "hit it",
                 "hit that", "tap that", "banging", "pounding", "stroke", "stroking",
                 "strokin", "ride it", "ride me", "ride the", "bust it open", "throw it back", "screw",
                 "screwing", "hump", "humping", "dick her down", "dick me down", "lay the pipe", "pipe"],
    "oral": ["give me head", "gimme head", "get head", "give head", "giving head", "got head",
             "brain", "blowjob", "blow job", "suck", "sucking", "suckin", "lick", "licking", "lickin", "eat it", "eat it up", "go down", "going down", "deep throat", "deepthroat",
             "sloppy"],
    "genitals": ["pussy", "coochie", "cooch", "punani", "poonani", "kitty", "cookie", "vagina", "clit",
                 "wap", "dick", "dicks", "cock", "penis", "wood", "johnson", "dong", "balls", "nuts"],
    "breasts / butt": ["tits", "titties", "titty", "boobs", "boobies", "breasts", "nipples", "booty",
                       "butt", "cakes", "culo", "cheeks", "thighs"],
    "climax / fluids": ["cum", "cumming", "cummin", "nut", "bust a nut", "wet", "wetter", "squirt",
                        "squirting", "climax", "orgasm", "semen", "swallow"],
    "positions / kink": ["doggy", "doggystyle", "doggy style", "missionary", "cowgirl", "threesome",
                         "three way", "menage", "69", "sixty nine", "choke me", "spank", "spanking",
                         "handcuffs", "tie me up", "bdsm", "kinky"],
}


def tokens_of(sid, manifest):
    m = manifest.get(sid)
    body = LM.CORPUS / (m.get("release_body_path") or "") if m else None
    if not body or not body.is_file():
        return None
    toks = LM.tokenize(body.read_text(encoding="utf-8"))
    # possessives: "glock's" counts as "glock"
    return [t[:-2] if t.endswith("'s") else t for t in toks]


def tags(cell_text):
    """'threat:2|weapon:3' -> Counter."""
    out = Counter()
    for part in (cell_text or "").split("|"):
        if ":" in part:
            k, v = part.split(":", 1)
            try:
                out[k] += int(v)
            except ValueError:
                pass
    return out


class Scope:
    """Accumulators for one scope (all songs, or hip-hop)."""

    def __init__(self):
        self.n = Counter()
        self.c = defaultdict(Counter)          # decade -> "section.key" -> songs
        self.m = defaultdict(Counter)          # decade -> "section.key" -> mentions/lines
        self.top = defaultdict(Counter)        # decade -> "section.key" -> max in one song

    def song(self, dec, key):
        self.c[dec][key] += 1

    def add(self, dec, key, value):
        self.m[dec][key] += value
        self.top[dec][key] = max(self.top[dec][key], value)
        if value:
            self.c[dec][key + ".songs_with"] += 1

    def dump(self):
        out = {}
        for d in DECADES:
            if not self.n[d]:
                continue
            out[d] = {"n_songs": self.n[d], "songs": dict(self.c[d]),
                      "mentions": dict(self.m[d]), "max_in_one_song": dict(self.top[d])}
        return out


def main():
    with open(NS.CARDS, encoding="utf-8") as fh:
        cards = {r["song_id"]: r for r in csv.DictReader(fh)}
    topics = {}
    tpath = os.path.join(TOPICS_DIR, "cards.csv")
    if os.path.isfile(tpath):
        with open(tpath, encoding="utf-8") as fh:
            topics = {r["song_id"]: r for r in csv.DictReader(fh)}
    excluded = B.load_exclusions()
    with open(LM.MANIFEST, encoding="utf-8") as fh:
        manifest = {r["recording_id"]: r for r in csv.DictReader(fh)}

    pats = {name: {k: DM.phrases(v) for k, v in groups.items()}
            for name, groups in (("weapons", WEAPONS), ("violence_words", VIOLENCE_WORDS),
                                 ("sex_words", SEX_GROUPS))}
    scopes = {"all": Scope(), "hip_hop": Scope()}

    for sid, r in cards.items():
        if sid in excluded:
            continue
        dec = r["decade"]
        hh = "hip_hop" in (r.get("genre_families") or "").split("|")
        targets = [scopes["all"]] + ([scopes["hip_hop"]] if hh else [])
        for s in targets:
            s.n[dec] += 1
        toks = None

        # --- violence: how, whom, framing, flagged lines, weapons, words ---
        vp = r["violence.presence"]
        if vp in ("threatened", "enacted"):
            vt = tags(r.get("violence_evidence_tags"))
            toks = toks or tokens_of(sid, manifest)
            for s in targets:
                s.song(dec, "violence.songs")
                s.song(dec, "violence.presence." + vp)
                s.song(dec, "violence.framing." + (r["violence.framing"] or "n/a"))
                s.song(dec, "violence.target." + (r["violence.target"] or "n/a"))
                for tag in ("threat", "act", "weapon", "mourning"):
                    s.add(dec, "violence.lines." + tag, vt.get(tag, 0))
                if toks:
                    for k, p in pats["weapons"].items():
                        s.add(dec, "weapons." + k, DM.count(toks, p))
                    s.add(dec, "weapons.any", sum(DM.count(toks, p) for p in pats["weapons"].values()))
                    for k, p in pats["violence_words"].items():
                        s.add(dec, "violence_words." + k, DM.count(toks, p))

        # --- sex: level, lines, chorus, function, stance, consent, words ---
        lvl = r["sex.level"]
        if lvl in ("graphic", "explicit"):
            st = tags(r.get("sex_evidence_tags"))
            lines = st.get("graphic", 0) + st.get("explicit", 0)
            bucket = "1" if lines <= 1 else ("2-4" if lines <= 4 else "5+")
            chorus = (r.get("sex.in_chorus") or "").lower() == "true"
            for s in targets:
                s.song(dec, "sex.songs." + lvl)
                s.song(dec, "sex.lines_bucket.%s.%s" % (lvl, bucket))
                s.add(dec, "sex.lines." + lvl, lines)
                if chorus:
                    s.song(dec, "sex.in_chorus." + lvl)
                s.song(dec, "sex.function." + (r["sex.function"] or "n/a"))
                s.song(dec, "sex.stance." + (r["sex.speaker_stance"] or "n/a"))
                s.song(dec, "sex.consent." + (r["sex.consent"] or "n/a"))
            if lvl == "graphic":
                toks = toks or tokens_of(sid, manifest)
                if toks:
                    for s in targets:
                        for k, p in pats["sex_words"].items():
                            s.add(dec, "sex_words." + k, DM.count(toks, p))
                        s.add(dec, "sex_words.any",
                              sum(DM.count(toks, p) for p in pats["sex_words"].values()))

        # --- hook-ups and cheating (topics card) ---
        t = topics.get(sid)
        if t:
            index = None
            cs = t["relationship.casual_sex"]
            ch = t["cheating.presence"]
            if cs != "none" or ch in ("present", "central"):
                try:
                    with open(os.path.join(TOPICS_DIR, sid + ".json"), encoding="utf-8") as fh:
                        index = json.load(fh).get("topic_index") or []
                except (OSError, ValueError):
                    index = []
            sections = len(index or [])
            if cs != "none":
                sexy = sum(1 for it in index if {"sex", "desire"} & set(it.get("tags", [])))
                for s in targets:
                    s.song(dec, "hookup.songs")
                    s.song(dec, "hookup." + cs)
                    s.add(dec, "hookup.sections_total", sections)
                    s.add(dec, "hookup.sections_on_sex", sexy)
            if ch in ("present", "central"):
                cheat = sum(1 for it in index if "cheating" in it.get("tags", []))
                for s in targets:
                    s.song(dec, "cheating.songs")
                    s.song(dec, "cheating." + ch)
                    for who in [w for w in t["cheating.who"].split("|") if w]:
                        s.song(dec, "cheating.who." + who)
                    s.song(dec, "cheating.stance." + t["cheating.stance"])
                    s.add(dec, "cheating.sections_total", sections)
                    s.add(dec, "cheating.sections_on_cheating", cheat)

    res = {
        "schema": "content-detail/v1",
        "source": ("card v3 (live/reads/full-v3/cards.csv), topics card t1.2 (live/reads/topics-t1/), "
                   "and gated word counts over the hash-locked lyric bodies"),
        "note": ("Per decade: n_songs = songs in the decade (scope). songs[k] = songs with that "
                 "property; mentions[k] = words counted or lines flagged; max_in_one_song[k]; "
                 "'<k>.songs_with' in songs = songs with at least one. Violence detail covers songs "
                 "with violence threatened or enacted; weapon and violence words count only there. "
                 "Sex detail covers explicit and graphic songs; crude words count only in graphic "
                 "songs and are reported as groups, never as words. sex.lines / violence.lines are "
                 "the lines the reader flagged as evidence (a floor, not an exhaustive count). "
                 "hookup/cheating sections come from each song's topic_index."),
        "groups": {"weapons": WEAPONS, "violence_words": VIOLENCE_WORDS,
                   "sex_words": sorted(SEX_GROUPS)},
        "decades": DECADES,
        "all": scopes["all"].dump(),
        "hip_hop": scopes["hip_hop"].dump(),
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(res, fh, indent=1, sort_keys=True)
        fh.write("\n")
    print("wrote %s" % OUT)
    return res


if __name__ == "__main__":
    main()

# Slur-use card — s1.1

One small record per song that contains a gendered slur token: bitch (and
bitches, bitchin', biatch…), hoe / hoes, slut, whore, thot, skank. It asks
what card v3 asked only once per song (`gender_features.gendered_slur`),
but **for every use**: at whom the word is aimed, what kind of use it is,
and whether the line is plainly hostile. The card is **descriptive**: it
records what is there, not a moral verdict. Many of these words have become
everyday labels ("these bitches", "my bitch"); the card counts that as a
label, and records hostility separately as a fact about the line.
Output is JSON matching `config/read-card-slur.schema.json`.

The script has already found every line carrying one of these words and
lists them under each song as **target lines**. A line that repeats (a
chorus) is listed once with the lines where it repeats; classify it once, the
export multiplies by the repeats. Classify **every target line + word pair,
exactly once, and nothing else**: the validator rejects a card that misses a
target or adds one. If a line carries two different words (a "bitch" and a
"hoes"), they are two targets and get two entries. If the same word appears
twice on one line, it is one entry: classify the dominant use.

## Reading rules

- Read as a listener would: artist, era, genre, the song's story and its
  public interpretation all count. Use what you know about the song.
- **Who is speaking in this line?** Rap songs trade verses: a featured
  artist's verse is not the lead's. Use section headers ("[Verse 2: …]")
  when the lyric has them, your knowledge of the song when it does not.
  Record it in `voice`.
- Classify the use **in its line and its verse**, not the song's overall
  mood. The same word can be a plain label in one line and hostile two
  lines later; those are two entries.
- `why` is one short line, under 200 characters. Never quote more than 8
  consecutive lyric words (the validator rejects 9); a 2–4 word phrase is
  plenty.
- **Empty is not zero.** When you cannot tell, use `unclear` and lower
  `confidence`. Do not guess the harsher reading.

## aimed_at — at whom (or what) the word is aimed

- `a_woman`: a specific woman — the partner, the ex, a rival's girl, the
  woman in the club, the addressee "you" when she is a woman.
- `women_general`: women as a class or an unnamed plural ("these hoes",
  "all the bitches in here").
- `a_man`: a specific man (a rival rapper, "you" when he is a man).
- `men_general`: men as a class or an unnamed plural of men.
- `singer_self`: the speaker describing themself ("I'm a bad bitch").
- `mixed_group`: a crew or crowd of both, or a gender-neutral group.
- `no_one`: not aimed at a person — an exclamation, a thing, a situation, or
  a non-slur sense ("life's a bitch", "son of a bitch!" as a curse, "this
  bitch" = a car, "bitchin'" = great, a garden hoe).
- `unclear`.

## use — what kind of use it is (descriptive, no verdict)

- `label_for_others`: the word used as a name or term for someone other
  than the speaker — a woman, women, a man, a crew ("these bitches", "my
  bitch", "a hoe", "you bitch"). This is the plain, most common use; tone
  goes in `hostile`, not here.
- `label_for_self`: said of oneself ("bad bitch", "I'm that bitch", "call
  me a hoe, I am one"). Pairs with `singer_self`.
- `sexual`: the word sits in a sex line — the person named as a sexual
  partner, a sexual act or encounter described around the word, a roster
  of sexual partners. Takes precedence over `label_for_others` when the line
  is about sex.
- `idiom`: a fixed expression or non-slur sense, not calling a person the
  word ("son of a bitch" as a curse, "life's a bitch", "bitchin'" = great,
  "bitch and moan" = complain, "make it my bitch" = dominate a thing, a
  garden hoe). Pairs with `no_one`.
- `quoted`: the speaker voices someone else's words — what others call
  them, a line put in another person's mouth, a name reported in order to
  reject it.
- `unclear`.

## hostile — boolean, a fact about the line

`true` only when the line is **plainly** contemptuous, degrading or
threatening toward the person or people named: cursing them out, "fuck that
bitch", a threat, a put-down that is the point of the line. `false` for a
plain label, a boast, a warm greeting, a sex line without contempt, an
idiom, or when you cannot tell. Do not infer hostility from the word alone.
A `quoted` insult is hostile only if the speaker adopts it against someone.

## voice

`singer` (the credited lead's own voice or persona) | `featured_other` (a
featured artist's verse, or a second credited lead in a duet whose verse
this is) | `character` (a voice the song quotes or plays: a skit, a caller,
someone the singer imitates).

## Worked examples (described, not quoted)

- A 2010s male rap hit whose chorus talks about "hoes" at the party as what
  money brings: `women_general` / `label_for_others`, hostile false. His
  verse cursing out an ex by the word: `a_woman` / `label_for_others`,
  hostile **true**.
- A 2010s female rapper's anthem calling herself a bad bitch in the hook:
  `singer_self` / `label_for_self` / `singer`, hostile false. Her line
  telling a rival woman she is a broke bitch: `a_woman` /
  `label_for_others`, hostile true.
- A 1970s rock song shouting "son of a bitch!" at bad luck: `no_one` /
  `idiom`, hostile false. "Life's a bitch" in any era: `no_one` / `idiom`.
- A 1990s R&B song greeting friends as "my bitches" at a party:
  `women_general` (or `mixed_group`) / `label_for_others`, hostile false.
- A 2000s rap verse describing sex with a woman he calls by the word:
  `a_woman` / `sexual`, hostile false unless the line degrades her.
- A featured male verse on a female pop song that calls women hoes: the
  lead is a woman, but this line is `voice: featured_other`, `women_general`
  / `label_for_others` (or `sexual`), hostile as the line reads.
- A 2020s diss track calling a rival rapper a bitch: `a_man` /
  `label_for_others`, hostile true.
- A pop song where the singer says people call her a slut and she will
  not accept it: `singer_self` / `quoted`, hostile false.

## Schema

```json
{
  "song_id": "R…",
  "uses": [
    {"line": 12, "word": "bitch | hoe | slut | whore | thot | skank",
     "aimed_at": "a_woman | women_general | a_man | men_general | singer_self | mixed_group | no_one | unclear",
     "use": "label_for_others | label_for_self | sexual | idiom | quoted | unclear",
     "hostile": false,
     "voice": "singer | featured_other | character",
     "confidence": "high | medium | low",
     "why": "one short line, < 200 chars"}
  ],
  "context_used": ["own knowledge"],
  "notes": null
}
```

`line` is the **first** line number of the target as listed; `word` is the
family name exactly as the target list prints it.

## Line numbering

As card v3: lines numbered from 1 in the lyric file as stored, blanks and
section markers counted.

## Changelog

- s1.1 (2026-09-25): owner steer before the full run — `use` made
  descriptive (label_for_others / label_for_self / sexual / idiom / quoted /
  unclear, no "insult" category); tone recorded as a separate boolean
  `hostile`. Re-piloted blind.
- s1 (2026-09-25): first slur-use card (insult / objectifying / boast…
  categories). Piloted (aimed_at kappa 0.91, use 0.88) but superseded
  before the full run.

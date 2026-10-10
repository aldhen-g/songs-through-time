# Per-song read card — v3

One record per song, produced by a model that has read the whole lyric **with
context** (artist, title, year, its own knowledge of the song, and web lookup
when triggered). Output is JSON matching the schema below. Cite evidence by
line number; never quote more than a ≤6-word phrase, and only in `why`.

## Reading rules

- Read as a listener would: who is singing, in what era, to whom. Artist
  persona and public interpretation are allowed and encouraged.
- Web search **only** when it would change an answer: confidence below high
  on `sex.level`, `sex.function`, `violence.framing`, `drugs.framing`, or
  `voice`; a conflict between the lexical hits and your reading; or an artist
  known for coded language or persona work. Record sources in `context_used`.
- Evidence lines are observation; the verdict is your estimate; `why` is the
  interpretation. Keep them separate.
- Empty is not zero. If you cannot tell, say `unclear` and lower confidence.
- Lexical hits are hints. Confirm or overrule them; when you overrule, say so
  in `why` (e.g. "'ride' is a car").

## Defined ladders (apply these tests, in order)

**sex.level**
- `graphic`: names genitals, sex acts, or bodily sexual detail in plain or
  slang terms, or describes a sex act step by step. Test: a radio edit would
  have to cut or bleep it.
- `explicit`: sex is unmistakably the subject or an unmistakable event
  (going to bed together, "I want your sex", a described night) but without
  anatomical or act-level detail. Test: no listener could read it as
  non-sexual, yet nothing needs bleeping.
- `suggestive`: sexual meaning carried by innuendo, double meaning, or
  atmosphere; a literal reading is possible but not the intended one.
- `romantic`: love, longing, kissing, holding, without sexual intent.
- `none`: no romantic or sexual content.
Take the **highest** rung reached anywhere in the song. `in_chorus` is true if
that rung (or one below it, if noted) appears in the chorus/hook.

**sex.function** — what the sexual language is doing:
`erotic` (desire/pleasure), `boast` (conquest, status), `insult` (sexual
language as attack, diss, or accusation), `assault` (non-consensual act
described or condemned), `commentary` (talking about sex as a topic),
`n/a`.

**consent** — `mutual` | `pressured` (coaxing, "I know you want it") |
`non_consensual` | `unclear` | `n/a`.

**violence.presence** — `none` | `mentioned` | `threatened` (speaker or
character threatens) | `enacted` (an act happens in the song's world).
**violence.framing** — `celebrated` | `justified` | `neutral_narrated` |
`negated` (named as what did *not* happen) | `condemned` | `mourned` | `n/a`.
Erotic roughness ("beat it up", "hit it") is **sex**, not violence.

**drugs.presence** — `none` | `mentioned` | `use_described` | `sale_described`.
**drugs.framing** — `glorified` | `neutral` | `cautionary` | `n/a`.
Alcohol counts; list it in `substances`.

**subject.main** — `romantic_love | sex | self_ego | money_status | party |
hardship | social_political | diss_beef | other`. One pick: what a listener
would say the song is about. `secondary` optional.

**love.type** — `none | committed | pursuing | unrequited | casual |
betrayal | breakup | abstract` (love as a theme, no particular relationship).

**gender_features** — multi-select, may be empty. Record what the lyric does,
not a verdict: a song can carry `hostile_contempt` and `agency_asserted` at
once; both are listed. Never summed into a score.

**love.exclusivity** — the affair, the open many, and the replaceable roster
are three different things; never collapse them into `betrayal`.

**mental_health** — ordinary heartbreak is `mood: sadness`, not this field.
Use it only for explicit inner-state language (depression, anxiety, paranoia,
self-harm, therapy, medication, substances as coping).

**religion** — conversational "oh my god" is `idiom_only`; a passing reference
(church, heaven, angel as image) is `mentioned`; calling on God or prayer is
`invoked`.

**politics** — separate from `subject.main`; a protest verse inside a love
song still counts.

**craft** — three separate low-confidence reads, never summed. `figurative`
is the softest field on the card; mark its confidence low when unsure.

## Schema

```json
{
  "song_id": "R…",
  "subject": {"main": "…", "secondary": null, "why": "one line"},
  "voice": "self | character | ambiguous",
  "address": "lover | rival | audience | self | group | nobody",
  "irony": {"flag": false, "why": null},
  "sex": {"level": "…", "in_chorus": false, "function": "…",
          "speaker_stance": "n/a | desiring_mutual | objectifying | objectified | boasting",
          "consent": "…",
          "evidence": [{"line": 7, "tag": "graphic|explicit|suggestive"}],
          "why": "one line"},
  "love": {"type": "…",
           "exclusivity": "n/a | exclusive_committed | pursuing_one | secret_betrayal | open_multiple | serial_replaceable | unclear",
           "betrayal_framing": "celebrated | regretted | condemned | neutral | n/a",
           "why": "one line"},
  "gender_features": {"features": ["gendered_slur | interchangeable_partner | partner_as_means | body_only_description | partner_does_not_speak | idealizing_pedestal | agency_asserted | reclaimed_slur | hostile_contempt | toughness_posture"],
                      "target": "women | men | both | n/a", "why": "one line"},
  "violence": {"presence": "…", "framing": "…",
               "target": "n/a | rival_male | partner_or_woman | police_authority | self | group_or_crew | generic_unnamed",
               "evidence": [{"line": 18, "tag": "threat|act|weapon|mourning|negated|reference"}],
               "why": "one line"},
  "drugs": {"presence": "…", "framing": "…", "substances": [],
            "evidence": [{"line": 3, "tag": "use|sale|reference"}],
            "why": "one line"},
  "money": {"level": "none | some | central",
            "stance": "n/a | flex | struggle | hustle_ascent | refusal_critique | transactional",
            "brands_named": false,
            "brand_purpose": "n/a | flex | scene_detail | critique", "why": "one line"},
  "mental_health": {"presence": "none | mentioned | described | central",
                    "kinds": ["sadness_depression | anxiety_paranoia | self_harm_suicide | therapy_medication | substance_coping"],
                    "why": "one line"},
  "religion": {"presence": "none | idiom_only | mentioned | invoked | devotional | doubting | occult_or_satanic", "why": "one line"},
  "politics": {"presence": "none | mentioned | protest | patriotic | commentary", "why": "one line"},
  "craft": {"narrativity": "none | vignette | scene | full_story",
            "specificity": "generic | some_concrete | named_places_people",
            "figurative": "literal | some_imagery | sustained_metaphor",
            "why": "one line"},
  "outlook": "hopeful | resigned | nihilistic | defiant | neutral | n/a",
  "identity_vocabulary": false,
  "sex_work_named": false,
  "self_focus": "low | medium | high",
  "mood": "joy | desire | anger | sadness | pride | longing | fear | defiance | other",
  "minor_involved": false,
  "version_suspected_clean_edit": false,
  "lexicon_gaps": ["terms the word lists missed, or idioms they over-counted"],
  "confidence": {"overall": "low | medium | high", "lowest_field": "sex.level"},
  "context_used": ["own knowledge", "https://…"],
  "notes": null
}
```

## Line numbering

Lines are numbered from 1 in the lyric file as stored, counting blank lines
and section markers like `[Chorus]` as lines, so numbers match the file.

## Changelog

- v3 (2026-09-21): from `notes/claims-map.md` — added `love.exclusivity`,
  `love.betrayal_framing`, `gender_features`, `violence.target`,
  `money.stance`, `mental_health`, `religion`, `politics`, `craft`,
  `outlook`, `identity_vocabulary`, `sex_work_named`.

- v2 (2026-09-21): defined ladders with tests; added `sex.function`,
  `consent`, `violence.framing` (presence split from framing),
  `drugs.framing`, `address`, `brand_purpose`, `minor_involved`,
  `lexicon_gaps`; extended `subject.main` and `love.type`. From pilot-v1.
- v1: pilot card.

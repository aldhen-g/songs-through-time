# Topics add-on card — t1.2

One small record per song, read **alongside** card v3, never replacing it. It
measures what v3 never did: cheating, the shape of the relationship
(hook-up, marriage, breakup, jealousy), police and authority, and crime.
Output is JSON matching `config/read-card-topics.schema.json`, written to the
path given with each song.

## Reading rules (same as card v3)

- Read as a listener would: who is singing, in what era, to whom. Artist
  persona, the song's story and its public interpretation all count.
- Web search **only** when it would change an answer: `cheating.presence` or
  `police.presence` would move a rung on a lookup; the song's story is
  disputed (who is cheating on whom, whether a killing is by or of police);
  or the artist is known for coded language. Record sources in `context_used`.
- Evidence lines are observation; the verdict is your estimate; `why` is the
  interpretation. Never quote more than a ≤6-word phrase, and only in `why`.
- **Empty is not zero.** If you cannot tell, pick the lower rung, say so in
  `why`, and lower `confidence`. Never guess a rung up.
- The **speaker** is the song's voice as sung (a persona counts). In duets or
  traded verses, the roles of every voice are recorded.
- Metaphor is not the thing. "Cheating death", "you stole my heart",
  "killing it", "partners in crime" as a love image, "I'm a criminal" as a
  swagger word: none of these count unless the song builds a literal story on
  them. Say it in `why` when you overrule an obvious word.

## 1. cheating — infidelity

A romantic or sexual involvement that breaks a commitment one of the people
owes to someone else (a partner, spouse, "your man", "your girl", "wifey",
"my main"). The commitment has to be in play in the song's world.

**cheating.presence** — take the highest rung reached:
- `central`: the song is about the affair. Test: a listener asked "what is
  this song about?" would say cheating (or the other woman / other man).
- `present`: cheating happens, has happened, or is openly proposed or invited
  in the song's world, but the song is mostly about something else (a boast
  verse about a rival's girlfriend, one line about a side piece, a "main and
  a side" roster).
- `hinted`: suspicion, accusation, rumour, temptation refused, or innuendo
  about someone's partner, with no act and no invitation in the song. A
  jealous "who were you with last night?" song is `hinted` unless it
  confirms the affair.
- `none`.

Not cheating: dating several people when no one is owed exclusivity (that is
v3 `open_multiple` / `serial_replaceable`); an ex moving on after the
breakup; a partner leaving without an affair; cheating at games, taxes,
diets, death.

**cheating.who** — list, every role the song gives (empty when `none`):
- `speaker`: the speaker cheats on their own partner.
- `partner`: the speaker's partner cheats on the speaker.
- `speaker_as_other`: the speaker is (or wants to be, and pursues being) the
  outside lover of someone else's partner — "taking someone's wife / girl /
  man", the other woman, the other man. Pining for a friend's girlfriend
  with no pursuit is `hinted`, still `speaker_as_other`.
- `third_party`: the song tells other people's affair (story songs,
  observers, gossip), neither the speaker nor their partner.
- `unclear`: cheating is there but whose it is cannot be told.

**cheating.stance** — the song's attitude to the cheating (or the suspicion):
- `celebrated`: brag, conquest, thrill, fun, no cost; a comic "deny
  everything" song counts here.
- `romanticized`: forbidden love told sympathetically — bittersweet,
  secret, tender — with guilt not the point.
- `conflicted`: torn between desire and guilt, or between two lovers.
- `regretted`: the cheater's guilt, apology, confession.
- `wronged`: the betrayed side — hurt, anger, revenge, leaving, pleading.
- `condemned`: an observer's or narrator's moral judgment of cheaters.
- `neutral`: narrated flatly, no side taken.
- `n/a`: only when `presence` is `none`.
When the song's attitude moves (desire, then judgment), record the posture
the song **ends on**. When the speaker is also attached, `who` lists both
`speaker` and `speaker_as_other`.
Chart groups (the builder uses these, not the seven rungs):
**approving** = celebrated + romanticized; **torn/neutral** = conflicted +
neutral; **against** = regretted + wronged + condemned.

## 2. relationship — what kind of relationship the song is in

Four independent fields. Each asks one question.

**relationship.casual_sex** — sex framed as without commitment: a one-night
stand, hook-up, booty call, "just for tonight", no strings, strangers,
groupies, a roster of partners, a paid encounter.
- `described`: it happens or has happened in the song's world.
- `invited`: proposed or pursued, not shown happening ("come home with me,
  we just met").
- `none`.
Test: would the song change if the two were a couple? A couple's night in is
not casual. A roster counts only when it is sexual (women listed as
possessions with no sexual line is `none`). A predicted or imagined pickup
by someone other than the speaker (the cheater's next night out) is `none`
here; the cheating fields carry it. A proposition to someone else's partner
is `invited` only if it is framed as a no-strings night, not an affair.
Requires sexual intent (v3 `sex.level` suggestive or higher); flirting on a
dance floor with no proposition is `none`.

**relationship.marriage** — one pick, by this precedence:
- `divorce`: divorce, or a spouse leaving the marriage, is the speaker's (or
  the story's central couple's) situation.
- `married`: the central relationship is a marriage (spouse, "my
  wife/husband", ring as a marker of marriage, a wedding that happened).
- `wants_to_marry`: proposal, wedding plans, "marry me", wanting to be a
  wife or husband.
- `mentioned`: marriage words about others or in passing: "your wife" in a
  boast, someone else's wedding, "wifey" / "wife her up" as slang for a
  girlfriend, idiom.
- `none`.
Only literal marriage reaches `married`, `wants_to_marry` or `divorce`, and
the lyric itself must mark it (a spouse word, ring, wedding, vows, divorce).
Outside knowledge alone (the artist says it is about their parents' split)
does not lift the rung: record it in `why` and stay at `none`. Implied
households ("go home to their families") are `mentioned`. Slang goes to
`mentioned` and the `why` says so.

**relationship.breakup** —
- `happened`: the relationship has ended or ends within the song (including
  the aftermath: missing, moving on, revenge).
- `looming`: threatened, feared, about to leave, pleading not to be left.
- `none`.
A lover who never was (unrequited) is `none`.

**relationship.jealousy** — romantic or sexual jealousy only: resenting or
fearing a rival for someone's affection.
- `speaker`: the speaker is jealous.
- `other`: someone else is (partner, ex, rival), including the speaker
  deliberately making them jealous.
- `both`.
- `none`. Haters envying the speaker's money or fame is **not** this field
  (`none`; note it in `why` if it is the only "jealous" in the song).
The feeling has to be there — envy of the rival, fear of losing the partner
to them, possessive watching. A rival who is only named, dismissed, or met
with contempt for the betrayal is `none`.

## 3. police — law enforcement

Police, cops, sheriffs, deputies, troopers, detectives, the feds (FBI, DEA,
ATF), ICE, SWAT, narcs; slang (5-0, 12, the law, boys in blue, pigs, jakes);
the signs of police (sirens, blue lights, a patrol car) when the song reads
them as police. Courts, judges and prison are **not** police: they go to
`authority.targets: law_justice` and `crime.kinds: incarceration`.

**police.presence** — take the highest rung reached:
- `force`: physical force between police and anyone is described, threatened,
  or its aftermath told — a police shooting or beating, shooting a sheriff,
  threatening to shoot cops.
- `encounter`: a run-in happens in the song's world — a stop, chase, search,
  raid, arrest, booking; being wanted or on the run; cops at the door.
- `mentioned`: police named in passing, as scenery, as a joke, or as a
  general presence; "call the cops" as a line; a siren in a city picture.
- `none`.

**police.force_by** — who uses force (only when `presence` is `force`):
`police` | `against_police` | `both` | `n/a`.

**police.stance** — the song's attitude to police:
- `hostile`: contempt, insult, threat, "fuck the police".
- `critical`: police as unjust or dangerous — brutality, profiling,
  harassment described as wrong — without contempt as the point.
- `evasive`: dodging, outrunning, beating or fooling the police as thrill,
  skill or survival, with nothing said about police as such.
- `neutral`: police are just there.
- `supportive`: police as protectors or heroes; calling them sincerely.
- `n/a`: only when `presence` is `none`.
Chart group **anti-police** = hostile + critical. `evasive` is charted
separately (outlaw posture, not a statement about police).

## 4. authority — anti-authority stance

The song's attitude to institutional authority: government and politicians,
the law and courts, police, school, bosses and work, the military, the church
as an institution, parents as rule-makers, "the man" / "the system" /
society.

**authority.stance** — take the highest rung reached:
- `hostile`: attacks authority — contempt, insult, a call to resist or
  overthrow, a threat.
- `defiant`: serious refusal of authority's rules or demands, rebellion as a
  position ("we won't take it", "take this job…", draft refusal).
- `playful`: light rule-breaking as fun — sneaking out, school's out,
  partying past curfew — with no stance against the institution itself.
- `none`: authority absent, accepted, praised, or simply obeyed. A song that
  narrates losing to authority with resignation is `none` for stance (its
  police/crime fields still record the story).
Consistency: `police.stance: hostile` implies `authority.stance: hostile`
with `law_justice` or `police` in targets; `critical` implies at least
`defiant`.

**authority.targets** — list (empty when stance is `none`). Soft field
(pilot agreement on the exact set 0.6): record it, but the builder charts
only "police or law targeted" vs other targets, never the full list.
`police` | `law_justice` (courts, judges, prison, "the law" in the abstract) |
`government_politics` | `school` | `work_boss` | `military_war` |
`religion_institution` | `parents` | `system_generic`.

## 5. crime — crime described

An act the law punishes, **other than** personal drug or alcohol use (those
live on v3 `drugs`). Violent crime counts here too, tagged `violent`, so the
builder can chart crime with or without violence; war and self-defence
killings are not crime.

**crime.presence** —
- `described`: a crime is committed, planned or confessed, or its legal
  consequence (arrest, trial, prison, parole) happens, in the song's world.
- `mentioned`: crime named or alluded to in passing (a record, "the block",
  "I used to trap", a crime as scenery) with no act in the song.
- `none`.

**crime.kinds** — list (empty when `none`): `theft_robbery` (theft,
burglary, robbery, carjacking, heists, shoplifting) | `drug_dealing`
(selling, trafficking, "the trap", cooking to sell) | `violent` (murder,
assault, shooting as a crime) | `property_vandalism` (smashing, keying,
arson) | `fraud_scam` (fraud, scams, counterfeit, credit-card schemes) |
`gang` (gang membership or activity) | `weapons` (illegal guns, "strapped"
as outlaw kit) | `incarceration` (jail, prison, parole, court as
consequence) | `other` (bootlegging, pimping, illegal gambling, DUI, escape).

**crime.by** — `speaker` | `others` | `both` | `n/a`.

**crime.framing** — `glorified` (brag, thrill, lifestyle) | `justified`
(necessary or righteous: survival, self-defence, revenge, told with
sympathy) | `neutral` | `cautionary` (warning, regret, consequence as
lesson) | `n/a`. Chart group **approving** = glorified + justified.

## 6. topic_index — markers for future reads

A light map of the whole song so a later topic can find the songs, and the
lines, it needs without re-reading the corpus. It is **not** a verdict and
is never charted.

- One entry per section as the song runs (verse, pre-chorus, chorus, bridge,
  outro; your own split if there are no markers): `from` and `to` are line
  numbers; `tags` are 1–4 picks from the fixed list below, the main things
  that section is about **literally or as the song means it** (a drug
  metaphor for love is `love`, plus `drugs` only if drugs are really there).
- A repeated chorus is indexed at its **first** occurrence only; later
  repeats are skipped. Blank lines and bare markers need no entry.
- Keep it quick: this is a table of contents, not a second reading.

Tags: `love`, `desire`, `sex`, `breakup`, `cheating`, `jealousy`, `marriage`, `family_parents`, `children`, `friendship`, `loneliness`, `grief_death`, `mental_health`, `self_harm`, `religion_faith`, `party_dancing`, `alcohol`, `drugs`, `money_wealth`, `poverty_work`, `brands_luxury`, `cars_travel`, `place_home`, `nostalgia`, `fame_industry`, `rivalry_diss`, `violence`, `weapons`, `police`, `crime`, `prison`, `politics_protest`, `war_military`, `race_identity`, `gender_roles`, `body_appearance`, `self_confidence`, `nature_weather`, `music_itself`, `technology_phone`, `school_youth`, `rebellion`, `other`.
Use `other` only when nothing fits; it tells us the list is missing a topic.

## Examples (described, not quoted)

- A country revenge song where the singer smashes up a cheating boyfriend's
  truck: cheating `central`, who `partner`, stance `wronged`; breakup
  `happened`; crime `described`, kinds `property_vandalism`, by `speaker`,
  framing `justified`.
- A 1970s soul ballad about a secret, tender affair with a married woman:
  cheating `central`, who `speaker_as_other` (+ `speaker` if he is married
  too), stance `romanticized`; marriage `mentioned` (her marriage, not his).
- A reggae-pop comedy where a man caught in the act is coached to deny
  everything: cheating `central`, who `speaker`, stance `celebrated`.
- A rap flex with one line about taking a rival's girlfriend: cheating
  `present`, who `speaker_as_other`, stance `celebrated`; the rest of the
  card as the song gives it.
- A 1960s rock song about robbing people, being caught and sent to prison,
  and losing to the law: police `encounter` (arrest), stance `neutral`;
  authority `none` (resigned); crime `described`, kinds `theft_robbery` +
  `incarceration`, by `speaker`, framing `cautionary`.
- A reggae song where the singer admits shooting the sheriff in self-defence
  and denies shooting the deputy: police `force`, force_by `both`, stance
  `critical`; authority `defiant`, targets `police` + `law_justice`; crime
  `described`, `violent`, framing `justified`.
- A rap hit about a traffic stop and a search, told as a skill contest with
  the officer: police `encounter`, stance `evasive`; crime `mentioned` or
  `described` by what the song says is in the car.
- A pop party song with a siren sound and "the cops are coming" as fun:
  police `mentioned`, stance `neutral`; authority `playful`.
- A love song that says "you're a thief, you stole my heart": everything
  `none`, `why` notes the metaphor.

## Schema

```json
{
  "song_id": "R…",
  "cheating": {"presence": "none | hinted | present | central",
               "who": ["speaker | partner | speaker_as_other | third_party | unclear"],
               "stance": "celebrated | romanticized | conflicted | regretted | wronged | condemned | neutral | n/a",
               "evidence": [{"line": 12, "tag": "act | proposal | suspicion | reference"}],
               "why": "one line"},
  "relationship": {"casual_sex": "none | invited | described",
                   "marriage": "none | mentioned | wants_to_marry | married | divorce",
                   "breakup": "none | looming | happened",
                   "jealousy": "none | speaker | other | both",
                   "why": "one line"},
  "police": {"presence": "none | mentioned | encounter | force",
             "force_by": "n/a | police | against_police | both",
             "stance": "hostile | critical | evasive | neutral | supportive | n/a",
             "evidence": [{"line": 20, "tag": "mention | encounter | force"}],
             "why": "one line"},
  "authority": {"stance": "none | playful | defiant | hostile",
                "targets": ["police | law_justice | government_politics | school | work_boss | military_war | religion_institution | parents | system_generic"],
                "why": "one line"},
  "crime": {"presence": "none | mentioned | described",
            "kinds": ["theft_robbery | drug_dealing | violent | property_vandalism | fraud_scam | gang | weapons | incarceration | other"],
            "by": "speaker | others | both | n/a",
            "framing": "glorified | justified | neutral | cautionary | n/a",
            "evidence": [{"line": 30, "tag": "act | reference | consequence"}],
            "why": "one line"},
  "topic_index": [{"from": 1, "to": 8, "tags": ["love", "cheating"]},
                  {"from": 10, "to": 17, "tags": ["jealousy"]}],
  "confidence": {"overall": "low | medium | high", "lowest_field": "cheating.stance"},
  "context_used": ["own knowledge", "https://…"],
  "notes": null
}
```

`why` is one line, under 300 characters, or null when the block is all
`none`. Evidence is optional (may be empty) but expected whenever a block is
above `none`/`mentioned`.

## Line numbering

As card v3: lines numbered from 1 in the lyric file as stored, blanks and
section markers counted.

## Changelog

- t1.2 (2026-09-23): `topic_index` added — per-section line ranges with tags
  from a fixed list, so future topics can route to songs and lines instead
  of re-reading everything. Owner's request.

- t1.1 (2026-09-23): after the pilot's blind re-read (30 songs): marriage
  rungs need a marker in the lyric; jealousy needs the feeling, not just a
  rival; casual sex excludes imagined third-party pickups and non-sexual
  rosters; cheating stance is the posture the song ends on; authority
  targets marked soft. See `notes/topics-card-pilot.md`.
- t1 (2026-09-23): first add-on card. Five blocks, eight measures.

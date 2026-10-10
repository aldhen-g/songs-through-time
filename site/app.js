/* Billboard lyrics, 1960–2025 — the one-page site (v3, 2026-09-22).

   Reads four feeds at load, all local:
     ../live/decade-genre-breakdown.json   every decade / genre figure
     ../live/substances-by-decade.json     which substances, by decade
     ../live/kids-full-catalogue.json      the kids lists' figures
     ../live/kids-examples.json            the named kids example songs

   Every number on the page comes from a feed field. The page-side constants
   are the plain-English labels and the prose. The builders are DOM-free and
   exported so the node test can check the page's sentences against the feeds.

   Rules carried from the feeds' own method notes:
   - a decade-and-genre cell with reliable=false is never drawn as a point;
   - five-year periods are not used (the 2025-only period is incomplete);
   - genre families overlap, so "without hip-hop" drops every song that
     carries the hip-hop tag at all (by_decade_without_genre). */

(function (factory) {
  var lib = factory();
  if (typeof module !== "undefined" && module.exports) { module.exports = lib; }
  if (typeof window !== "undefined") {
    window.App = lib;
    // The story page (index.html, data-story) draws itself with story.js and
    // only borrows this file's builders; the old one-page layout is retired.
    if (typeof document !== "undefined" && !document.documentElement.hasAttribute("data-story")) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", lib.render);
      } else {
        lib.render();
      }
    }
  }
})(function () {
  "use strict";

  var FEEDS = {
    breakdown: "../live/decade-genre-breakdown.json",
    substances: "../live/substances-by-decade.json",
    kids: "../live/kids-full-catalogue.json",
    examples: "../live/kids-examples.json",
    race: "../live/race-ethnicity-breakdown.json"
  };

  /* ---------------- labels ---------------- */

  var GENRE_LABEL = {
    hip_hop: "Hip-hop",
    rock: "Rock",
    pop: "Pop",
    rnb_soul: "R&B / soul",
    country: "Country",
    electronic_dance: "Dance-pop, disco & electronic",
    latin: "Latin"
  };

  /* The song filters every chart offers. "wo:" is the complement cut. */
  var FILTERS = [
    { id: "all", label: "All songs" },
    { id: "g:hip_hop", label: "Hip-hop" },
    { id: "wo:hip_hop", label: "Everything but hip-hop" },
    { id: "g:rock", label: "Rock" },
    { id: "g:pop", label: "Pop" },
    { id: "g:rnb_soul", label: "R&B / soul" },
    { id: "g:country", label: "Country" },
    { id: "g:electronic_dance", label: "Dance-pop, disco & electronic" }
  ];

  /* Plain-English labels for every measure key, as "songs that …". */
  var LABEL = {
    sex_graphic_or_explicit: "describe sex explicitly or graphically",
    sex_graphic: "describe sex graphically",
    sex_suggestive: "keep sex to innuendo",
    sex_romantic_or_none: "are romantic, or have no sexual content",
    sex_objectifying: "take an objectifying stance",
    sex_in_chorus: "put sexual content in the chorus",
    violence_beyond_mention: "threaten or carry out violence",
    violence_enacted: "carry out violence in the song",
    violence_celebrated: "celebrate violence",
    violence_target_partner_or_woman: "aim violence at a partner or a woman",
    weapon_named: "name a weapon",
    drugs_use_or_sale: "describe using or selling drugs",
    drugs_glorified: "glorify drugs",
    drugs_opioids_pills: "name opioids or pills",
    drugs_cocaine: "name cocaine or crack",
    drugs_cannabis: "name cannabis",
    alcohol: "name alcohol",
    money_central: "are about money",
    money_flex: "flex about money",
    money_struggle_or_critique: "struggle for money, or turn it down",
    brands_named: "name brands to flex",
    profanity_strong: "use strong profanity (word count)",
    mental_health_described: "describe mental health",
    politics_protest: "carry political protest"
  };

  /* Short names for legends, tooltips and small multiples. */
  var SHORT = {
    sex_graphic_or_explicit: "Explicit or graphic sex",
    sex_graphic: "Graphic sex",
    sex_suggestive: "Innuendo only",
    sex_romantic_or_none: "Romantic or none",
    sex_objectifying: "Objectifying",
    sex_in_chorus: "Sex in the chorus",
    violence_beyond_mention: "Violence threatened or done",
    violence_enacted: "Violence carried out",
    violence_celebrated: "Violence celebrated",
    violence_target_partner_or_woman: "Aimed at a partner or woman",
    weapon_named: "Weapon named",
    drugs_use_or_sale: "Drug use or sale",
    drugs_glorified: "Drugs glorified",
    drugs_opioids_pills: "Opioids or pills named",
    drugs_cocaine: "Cocaine or crack named",
    drugs_cannabis: "Cannabis named",
    alcohol: "Alcohol named",
    money_central: "Money is the subject",
    money_flex: "Money flex",
    money_struggle_or_critique: "Money struggle or refusal",
    brands_named: "Brands named to flex",
    profanity_strong: "Strong profanity",
    mental_health_described: "Mental health",
    politics_protest: "Political protest"
  };

  var DEBATE_ORDER = ["sex", "violence", "drugs", "money", "cross_cutting"];
  var DEBATE_NAME = { sex: "Sex", violence: "Violence", drugs: "Drugs",
                      money: "Money", cross_cutting: "Everything else" };

  /* Chart presets per chapter. c: "s1" | "s2" (fixed order). */
  var CHARTS = {
    sex: {
      title: "Sex in the year’s biggest songs, by decade",
      presets: [
        { id: "ladder", label: "Explicit vs innuendo", series: [
          { key: "sex_graphic_or_explicit", c: "s1" },
          { key: "sex_suggestive", c: "s2" }] },
        { id: "explicit", label: "Explicit or graphic", series: [{ key: "sex_graphic_or_explicit", c: "s1" }] },
        { id: "graphic", label: "Graphic only", series: [{ key: "sex_graphic", c: "s1" }] },
        { id: "obj", label: "Objectifying", series: [{ key: "sex_objectifying", c: "s1" }] },
        { id: "chorus", label: "In the chorus", series: [{ key: "sex_in_chorus", c: "s1" }] }
      ]
    },
    violence: {
      title: "Violence in the year’s biggest songs, by decade",
      accent: "wo:hip_hop",
      presets: [
        { id: "beyond", label: "Threatened or done", series: [{ key: "violence_beyond_mention", c: "s1" }] },
        { id: "enacted", label: "Carried out", series: [{ key: "violence_enacted", c: "s1" }] },
        { id: "celebrated", label: "Celebrated", series: [{ key: "violence_celebrated", c: "s1" }] },
        { id: "partner", label: "At a partner or woman", series: [{ key: "violence_target_partner_or_woman", c: "s1" }] },
        { id: "weapon", label: "Weapon named", series: [{ key: "weapon_named", c: "s1" }] }
      ]
    },
    drugs: {
      title: "Drugs in the year’s biggest songs, by decade",
      accent: "wo:hip_hop",
      presets: [
        { id: "use", label: "Use or sale", series: [{ key: "drugs_use_or_sale", c: "s1" }] },
        { id: "glorified", label: "Glorified", series: [{ key: "drugs_glorified", c: "s1" }] }
      ]
    },
    money: {
      title: "Money in the year’s biggest songs, by decade",
      presets: [
        { id: "stance", label: "Flex vs struggle", series: [
          { key: "money_flex", c: "s1" },
          { key: "money_struggle_or_critique", c: "s2" }] },
        { id: "flex", label: "Flex", series: [{ key: "money_flex", c: "s1" }] },
        { id: "brands", label: "Brand names", series: [{ key: "brands_named", c: "s1" }] },
        { id: "central", label: "Money is the subject", series: [{ key: "money_central", c: "s1" }] }
      ]
    }
  };

  /* The opener: ten measures, first decade against last. */
  /* Folk bubbles around each chapter title: verbatim from notes/folk-*.md,
     people talking about songs. None repeats a lyric line; tests/test_site.py
     checks every one against the notes. */
  var BUBBLES = {
    "race": [{"text": "Labels love the money, not the societal effects it may cause. As long as their kids aren't aspiring to be like Sexy Red/ NBA Youngboy, ect. they don't care. Yes it is a minstrel show. A very profitable one.", "who": "r/blackmen"}, {"text": "Is Rap starting to turn into a minstrel show to anyone else? These new era songs and artists are doing anything and it’s dangerous.", "who": "@Sly___________"}, {"text": "They take black music, style, image, sound, remove all the black people, and sell it to the general public.", "who": "@chanysoul"}, {"text": "Like white girls were making RAUNCHY songs as teenagers. … But black women are uniquely hypersexual? Is it crack.", "who": "@LisKis93"}, {"text": "When people talk about appropriation … As soon as a white alternative was presented, the music that black artists made pennies on was now worth millions.", "who": "u/Unable-Statement4842"}],
    "sex": [
      {
        "text": "They had classiness and regalness to them that is missing today.",
        "who": "u/PapaPanda718"
      },
      {
        "text": "Everything is hypersexual and figurative language and poetic melodies no longer exist. Everything is dumbed down to pussy ass and money.",
        "who": "@Leisasabitch"
      },
      {
        "text": "I remember when yall used to complain about women being oversexualized in rap videos. Now yall are defending sexual rap lyrics?",
        "who": "@b1gtyme1984"
      },
      {
        "text": "Remember when the media spent a good decade glamorizing the term “pimp” in music and media, it was almost inescapable.",
        "who": "@Howlingmutant0"
      },
      {
        "text": "You know what's funny about those R&B songs we grew up listening to? They were plenty dirty but because a lot of the singers had great voices the lyrics flew right past us",
        "who": "@charlz_29"
      },
      {
        "text": "i might get a lot of hate for this but rap has become little more than open cussing, slander against women, and in general absolute filth",
        "who": "r/TrueChristian"
      }
    ],
    "violence": [
      {
        "text": "Many young people look up to rap musicians but the lyrics of a lot of these songs are absolutely abhorrent if you actually listen to them. They’re full of sexism, racism, bragging about violence and drug use, and they glorify a selfish anti-social lifestyle.",
        "who": "Reddit"
      },
      {
        "text": "I remember someone on this subreddit said R&B songs these days ain't about love songs anymore bc you'll have artists like sza talking about killing you then herself🤣",
        "who": "u/darkchiles"
      },
      {
        "text": "30 years ago politicians and church folks were coming for rappers promoting murder and degrading women. It's been nonstop people STILL coming against female rappers with sexual lyrics. We just saw this with …",
        "who": "@femceetv"
      },
      {
        "text": "pop music nowadays acting like rap music, dirty, drugs, crimes, violence",
        "who": "@SexretongMlupit"
      }
    ],
    "drugs": [
      {
        "text": "So much music is about drugs… I read the lyrics on Spotify as I listen to my music. Drug, alcohol, or women.",
        "who": "@EdRip1942"
      },
      {
        "text": "They're listening to lots of mumble rap, too much glorifying drugs and sex and violence. Their foster mom doesn't really like this.",
        "who": "u/NFS_Tyrone"
      },
      {
        "text": "Can you guys give me songs to share with them that don't rely on glorifying lots of sex and violence and drugs?",
        "who": "u/NFS_Tyrone"
      },
      {
        "text": "pop music nowadays acting like rap music, dirty, drugs, crimes, violence",
        "who": "@SexretongMlupit"
      }
    ],
    "money": [
      {
        "text": "Literally every rap song just seems to be about how they used to not have a lot of money or get many women, but now … they now in fact do have plenty of money and no issues picking up women.",
        "who": "@humanmale1984"
      },
      {
        "text": "Cs thats every … song, just flexing and showing they have money for the 2848th time",
        "who": "@mayzinito"
      },
      {
        "text": "All facts hip hop used to be about the struggle and what you go through not the kind of car you got or the kind of bitch you got I will blame all of that on … cuz he's the main one that made rap so materialistic",
        "who": "@LeeMoeFlvmeee"
      }
    ],
    "kids": [
      {
        "text": "Why is a toddler singing …? I caught my little sister writing the damn lyrics and she understands everything.",
        "who": "@OnlyBigTheo"
      },
      {
        "text": "I'd rather have my kids listen to conscious rap with swearing but thoughtful lyrics over rnb jams about fucking that are technically radio friendly.",
        "who": "u/SenorBirdman"
      },
      {
        "text": "Am I Being Too Strict About Restricting My Daughter From Listening to Rap Music?",
        "who": "r/TrueChristian"
      },
      {
        "text": "Can you guys give me songs to share with them that don't rely on glorifying lots of sex and violence and drugs?",
        "who": "u/NFS_Tyrone"
      }
    ]
  };

  var DUMBBELL_GENRES = ["all", "hip_hop", "rnb_soul", "pop", "rock", "country", "electronic_dance"];

  var SUBSTANCE_CLASSES = [
    { key: "alcohol", label: "Alcohol" },
    { key: "cannabis", label: "Cannabis" },
    { key: "cocaine", label: "Cocaine" },
    { key: "opioid", label: "Opioids (incl. lean, pills)" },
    { key: "empathogen", label: "MDMA / molly" },
    { key: "tobacco", label: "Tobacco" },
    { key: "psychedelic", label: "Psychedelics" }
  ];

  /* Kids lists, as on the retired kids page (v2). */
  var KIDS_GROUP = "kca_kidz_bop";
  var SEX = "sex_graphic_or_explicit";
  var KIDS_MEASURES = [
    { key: "drugs_use_or_sale", label: "describes someone using or selling drugs", head: "Drugs" },
    { key: "violence_beyond_mention", label: "threatens or carries out violence", head: "Violence" },
    { key: "profanity_strong", label: "uses strong profanity" }
  ];
  var LIST_META = {
    "kca": { name: "Kids’ Choice Awards", years: "2014–2025" },
    "kidz-bop": { name: "Kidz Bop", years: "2010–2026" }
  };

  /* ---------------- formatting ---------------- */

  function fmtPct(share, decimals) {
    if (share === null || share === undefined || isNaN(share)) { return "—"; }
    return (share * 100).toFixed(decimals === undefined ? 1 : decimals) + "%";
  }
  function fmtN(n) {
    if (n === null || n === undefined || isNaN(n)) { return "—"; }
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function fmtDate(iso) { return iso ? String(iso).slice(0, 10) : ""; }
  function oneIn(share) { return share > 0 ? Math.round(1 / share) : null; }
  function oneInPhrase(share) { var n = oneIn(share); return n ? "1 in " + n : "—"; }
  function ratioBand(ratio) {
    if (!isFinite(ratio)) { return null; }
    if (ratio < 0.40) { return "less than half"; }
    if (ratio < 0.60) { return "about half"; }
    if (ratio < 0.80) { return "about two-thirds"; }
    if (ratio <= 1.25) { return "about the same"; }
    return null;
  }
  /* A kids-feed measure block carries hits/n; a breakdown block carries n. */
  function kShare(node) { return node.hits / node.n; }

  /* ---------------- data ---------------- */

  function cellFor(bd, filter, dec) {
    if (filter === "all") { return bd.by_decade[dec]; }
    var parts = filter.split(":");
    if (parts[0] === "g") { return bd.by_decade_genre[dec + "|" + parts[1]]; }
    if (parts[0] === "wo") { return (bd.by_decade_without_genre || {})[dec + "|" + parts[1]]; }
    return null;
  }

  /* One point per decade; share is null when the cell is missing or below
     min_n, so it is never drawn. */
  function seriesFor(bd, filter, key) {
    return bd.decades.map(function (dec) {
      var c = cellFor(bd, filter, dec);
      if (!c) { return { decade: dec, share: null, hits: 0, n: 0 }; }
      var hits = c.measures[key].n;
      return {
        decade: dec,
        share: c.reliable ? hits / c.n_songs : null,
        hits: hits,
        n: c.n_songs
      };
    });
  }

  /* Five-year steps for the charts (the last is 2020–25, six years). */
  function p5Labels(bd) { return (bd.periods5 || []).map(function (p) { return p.label; }); }
  function cellForP(bd, filter, label) {
    if (filter === "all") { return (bd.by_period5 || {})[label]; }
    var parts = filter.split(":");
    if (parts[0] === "g") { return (bd.by_period5_genre || {})[label + "|" + parts[1]]; }
    if (parts[0] === "wo") { return (bd.by_period5_without_genre || {})[label + "|" + parts[1]]; }
    return null;
  }
  function seriesP(bd, filter, key) {
    return p5Labels(bd).map(function (l) {
      var c = cellForP(bd, filter, l);
      if (!c) { return { decade: l, when: l, share: null, hits: 0, n: 0 }; }
      var hits = c.measures[key].n;
      return { decade: l, when: l, share: c.reliable ? hits / c.n_songs : null, hits: hits, n: c.n_songs };
    });
  }
  /* A chart note when some steps are too thin to draw. */
  function gapNoteP(bd, filter, key) {
    if (filter === "all") { return ""; }
    var ser = seriesP(bd, filter, key), firstOk = null;
    ser.forEach(function (p) { if (firstOk === null && p.share !== null) { firstOk = p.decade; } });
    var gaps = ser.filter(function (p) { return p.share === null; });
    if (!gaps.length) { return ""; }
    return filterLabel(filter) + ": fewer than " + bd.min_n + " songs in some five-year steps" + (firstOk ? " (before " + firstOk + ")" : "") + ", so those are not drawn.";
  }

  function drawn(series) { return series.filter(function (p) { return p.share !== null; }); }
  function first(series) { return drawn(series)[0]; }
  function last(series) { var d = drawn(series); return d[d.length - 1]; }
  function range(series) {
    var v = drawn(series).map(function (p) { return p.share; });
    return { min: Math.min.apply(null, v), max: Math.max.apply(null, v) };
  }
  function filterLabel(id) {
    for (var i = 0; i < FILTERS.length; i++) { if (FILTERS[i].id === id) { return FILTERS[i].label; } }
    return id;
  }

  /* "all songs", "hip-hop songs", "songs not tagged hip-hop" */
  function filterNoun(id) {
    if (id === "all") { return "all songs"; }
    var p = id.split(":"), g = (GENRE_LABEL[p[1]] || p[1]).toLowerCase();
    return p[0] === "wo" ? "songs not tagged " + g : g + " songs";
  }

  /* ---------------- pure builders: sentences ----------------
     A sentence is an array of parts: strings, or {mark: "..."} for the
     figures the page highlights. */

  function flat(parts) {
    return parts.map(function (p) { return typeof p === "string" ? p : p.mark; }).join("");
  }

  function buildFacts(bd) {
    return [
      { value: fmtN(bd.n_songs), label: "songs read in full" },
      { value: String(bd.decades.length), label: "decades, 1960s to 2020s" },
      { value: String(Object.keys(bd.measures).length), label: "things measured in every song" },
      { value: String(Object.keys(bd.genres).length - 1), label: "genre families" }
    ];
  }

  function sexAnswer(bd) {
    var exp = seriesFor(bd, "all", "sex_graphic_or_explicit");
    var sug = range(seriesFor(bd, "all", "sex_suggestive"));
    return [
      "Explicit sex went from ", { mark: fmtPct(first(exp).share) },
      " of songs in the " + first(exp).decade + " to ", { mark: fmtPct(last(exp).share) },
      " in the " + last(exp).decade + ". Innuendo never went away: in every decade, between " +
      fmtPct(sug.min) + " and " + fmtPct(sug.max) + " of songs kept it to suggestion."
    ];
  }

  function violenceAnswer(bd) {
    var all = seriesFor(bd, "all", "violence_beyond_mention");
    var rest = range(seriesFor(bd, "wo:hip_hop", "violence_beyond_mention"));
    return [
      "Songs that threaten or carry out violence went from ", { mark: fmtPct(first(all).share) },
      " in the " + first(all).decade + " to ", { mark: fmtPct(last(all).share) },
      " in the " + last(all).decade + ". Take out every song tagged hip-hop and the rest stays between " +
      fmtPct(rest.min) + " and " + fmtPct(rest.max) + " in every decade."
    ];
  }

  function topSubstance(subs, dec) {
    var row = subs.by_decade_class[dec] || {};
    var best = null;
    Object.keys(row).forEach(function (k) {
      if (k === "unspecified") { return; }
      if (best === null || row[k] > row[best]) { best = k; }
    });
    return best;
  }

  function subShare(subs, dec, cls) {
    return ((subs.by_decade_class[dec] || {})[cls] || 0) / subs.n_songs_by_decade[dec];
  }

  function drugsAnswer(bd, subs) {
    var use = seriesFor(bd, "all", "drugs_use_or_sale");
    var alcoholEvery = subs.decades.every(function (d) { return topSubstance(subs, d) === "alcohol"; });
    var d0 = subs.decades[3], d1 = subs.decades[subs.decades.length - 1];
    var parts = [
      "Songs that describe using or selling drugs went from ", { mark: fmtPct(first(use).share) },
      " in the " + first(use).decade + " to ", { mark: fmtPct(last(use).share) },
      " in the " + last(use).decade + "."
    ];
    parts.push((alcoholEvery ? " Alcohol is the most-named substance in every decade." : "") +
      " Opioids, lean and pills went from " + fmtPct(subShare(subs, d0, "opioid")) + " of songs in the " +
      d0 + " to " + fmtPct(subShare(subs, d1, "opioid")) + " in the " + d1 + ".");
    return parts;
  }

  function moneyAnswer(bd) {
    var flex = seriesFor(bd, "all", "money_flex");
    var strug = range(seriesFor(bd, "all", "money_struggle_or_critique"));
    return [
      "Flexing about money went from ", { mark: fmtPct(first(flex).share) },
      " of songs in the " + first(flex).decade + " to ", { mark: fmtPct(last(flex).share) },
      " in the " + last(flex).decade + ". Songs about struggling for money, or turning it down, held between " +
      fmtPct(strug.min) + " and " + fmtPct(strug.max) + " the whole time."
    ];
  }

  /* Three numbers under a chapter chart: hip-hop now, everything else now,
     and one more the chapter picks. */
  function hipHopCallouts(bd, key) {
    var hh = last(seriesFor(bd, "g:hip_hop", key));
    var rest = last(seriesFor(bd, "wo:hip_hop", key));
    return [
      { value: fmtPct(hh.share), text: "of hip-hop songs in the " + hh.decade + " " + LABEL[key] +
        " (" + fmtN(hh.hits) + " of " + fmtN(hh.n) + ")." },
      { value: fmtPct(rest.share), text: "of every other song in the " + rest.decade + " do (" +
        fmtN(rest.hits) + " of " + fmtN(rest.n) + ")." }
    ];
  }

  /* The highest reliable cell outside hip-hop, over the named families. */
  function peakOutside(bd, key, skip) {
    var best = null;
    Object.keys(bd.by_decade_genre).forEach(function (id) {
      var c = bd.by_decade_genre[id];
      if (!c.reliable || !GENRE_LABEL[c.genre] || c.genre === skip) { return; }
      var s = c.measures[key].n / c.n_songs;
      if (best === null || s > best.share) {
        best = { share: s, genre: c.genre, decade: c.decade, hits: c.measures[key].n, n: c.n_songs };
      }
    });
    return best;
  }

  function callouts(bd, chapter) {
    if (chapter === "sex") {
      var obj = last(seriesFor(bd, "all", "sex_objectifying"));
      return hipHopCallouts(bd, "sex_graphic_or_explicit").concat([
        { value: fmtPct(obj.share), text: "of all songs in the " + obj.decade + " take an objectifying stance." }]);
    }
    if (chapter === "violence") {
      var p = peakOutside(bd, "violence_beyond_mention", "hip_hop");
      return hipHopCallouts(bd, "violence_beyond_mention").concat([
        { value: fmtPct(p.share), text: "the highest share outside hip-hop: " + GENRE_LABEL[p.genre] +
          " in the " + p.decade + " (" + fmtN(p.hits) + " of " + fmtN(p.n) + " songs)." }]);
    }
    if (chapter === "money") {
      var b = last(seriesFor(bd, "all", "brands_named"));
      return hipHopCallouts(bd, "money_flex").concat([
        { value: fmtPct(b.share), text: "of all songs in the " + b.decade + " name brands to flex." }]);
    }
    return [];
  }

  /* Decades a series could not draw, as a sentence for the chart foot. */
  function gapNote(bd, filter, key) {
    if (filter === "all") { return ""; }
    var gaps = seriesFor(bd, filter, key).filter(function (p) { return p.share === null; })
      .map(function (p) { return p.decade; });
    if (!gaps.length) { return ""; }
    return filterLabel(filter) + ": fewer than " + bd.min_n + " songs in the " + gaps.join(", ") +
      ", so " + (gaps.length === 1 ? "that decade is" : "those decades are") + " not drawn.";
  }

  /* ---------------- pure builders: kids (from the v2 kids page) ---------------- */

  function kGroup(feed) { return feed.lists[KIDS_GROUP]; }

  function kidsScope(feed) {
    return "We could not measure what children heard. We took two lists that pick songs for " +
      "children out of the pop charts: the Kids’ Choice Awards, where children vote (" +
      LIST_META["kca"].years + "), and the Kidz Bop albums, where adults choose hits and " +
      "re-record them (" + LIST_META["kidz-bop"].years + "). Then we read the original adult " +
      "recording of every song they picked: " + fmtN(kGroup(feed).full.n_songs) + " songs.";
  }

  function kidsHeadline(feed) {
    var m = kGroup(feed).full.measures[SEX];
    var s = kShare(m);
    return { share: s, pct: fmtPct(s), hits: m.hits, n: m.n,
             sentence: oneInPhrase(s) + " of those songs describes sex explicitly or graphically." };
  }

  function kidsVsChart(feed) {
    var vs = kGroup(feed).vs_chart;
    var picked = kShare(vs.group.measures[SEX]);
    var chart = kShare(vs.chart.measures[SEX]);
    var band = chart > 0 ? ratioBand(picked / chart) : null;
    var head;
    if (band === null) { head = "The lists pick more explicit songs than the chart they pick from."; }
    else if (band === "about the same") { head = "The lists pick about as explicit a song as the chart they pick from."; }
    else { head = "The lists pick the tamer half of the chart: " + band + " as often as the chart of the same years."; }
    return {
      fromYear: vs.from_year, band: band,
      rows: [
        { label: "Songs the kids’ lists picked", share: picked, n: vs.group.measures[SEX].n, tone: "s1" },
        { label: "Every chart song of the same years", share: chart, n: vs.chart.measures[SEX].n, tone: "ref" }
      ],
      sentence: head
    };
  }

  function kidsWho(feed) {
    var kca = kShare(feed.lists["kca"].vs_chart.group.measures[SEX]);
    var bop = kShare(feed.lists["kidz-bop"].vs_chart.group.measures[SEX]);
    return {
      kca: kca, bop: bop,
      sentence: kca >= bop
        ? "Among the hits they picked, children’s votes carry more explicit sex (" + fmtPct(kca) + ") than Kidz Bop’s adult picks (" + fmtPct(bop) + ")."
        : "Among the hits they picked, Kidz Bop’s adult picks carry more explicit sex (" + fmtPct(bop) + ") than children’s votes (" + fmtPct(kca) + ")."
    };
  }

  function kidsNumbers(feed) {
    return KIDS_MEASURES.map(function (m) {
      var node = kGroup(feed).full.measures[m.key];
      var s = kShare(node);
      return { key: m.key, value: oneInPhrase(s), text: "of those songs " + m.label + " (" + fmtPct(s) + " of " + fmtN(node.n) + ")." };
    });
  }

  function kidsClean(feed) {
    var g = kGroup(feed);
    return "If you counted only the songs that were also Year-End hits, as an earlier draft of this study did, " +
      "you would get " + fmtPct(kShare(g.yearend.measures[SEX])) + ". Counting everything the lists picked gives " +
      fmtPct(kShare(g.full.measures[SEX])) + ".";
  }

  function pickExamples(examples, key, count) {
    var block = (examples.measures || {})[key];
    if (!block) { return []; }
    return block.candidates.slice(0, count).map(function (c) {
      return {
        song_id: c.song_id, title: c.title, artist: c.artist, year: c.year, level: c.level,
        reading: c.reading, quote: c.quote || "", quoteLines: c.quote ? (c.quote_lines || "") : "",
        lists: c.lists.map(function (id) { return (LIST_META[id] || { name: id }).name; })
      };
    });
  }

  function exhibitLine(examples) {
    var ex = examples.exhibit;
    if (!ex) { return ""; }
    return "In " + ex.award_year + " The Weeknd’s “" + ex.title + "”, widely heard as a song about cocaine, " +
      "was a Kids’ Choice Awards " + ex.status + " for Favorite Song.";
  }

  function linePointer(lines) {
    var text = String(lines || "").trim();
    if (!text) { return ""; }
    text = text.replace(/\s*-\s*/g, "–");
    return (/^\d+$/.test(text) ? "line " : "lines ") + text;
  }

  /* ---------------- pure builders: method ---------------- */

  function methodCorpus(bd) {
    var wrong = bd.excluded.filter(function (e) { return (e.exclusion || "wrong_body").indexOf("wrong_body") === 0; }).length;
    var lean = bd.n_excluded - wrong;
    return fmtN(bd.n_songs + bd.n_excluded) + " songs made the Billboard Year-End Hot 100 between 1960 and 2025. " +
      fmtN(wrong) + " were left out because the stored lyric turned out to belong to a different recording, and " + fmtN(lean) +
      " because there was no lyric to read: near-instrumentals whose only words are a chant or a shout, and instrumental records stored with a sung version’s lyric. That leaves " +
      fmtN(bd.n_songs) + ", and every figure on this page counts only those.";
  }
  function methodCorpusOld(bd) {
    return fmtN(bd.n_songs + bd.n_excluded) + " songs made the Billboard Year-End Hot 100 between 1960 and 2025. " +
      fmtN(bd.n_excluded) + " were left out because the stored lyric turned out to belong to a different " +
      "recording, which leaves " + fmtN(bd.n_songs) + ".";
  }

  function agreementRows(bd) {
    return Object.keys(bd.measures).filter(function (k) {
      return typeof bd.measures[k].reread_agreement === "number";
    }).map(function (k) {
      return { key: k, label: SHORT[k], agreement: bd.measures[k].reread_agreement,
               n: bd.measures[k].reread_agreement_n };
    }).sort(function (a, b) { return b.agreement - a.agreement; });
  }

  /* ---------------- pure builders: scroll steps ----------------
     Each chapter is a pinned chart and a column of steps. A step names the
     chart state it wants (preset + song filter) and says, in words, what the
     reader is now looking at. Every figure is read off the feed. */

  function m(p) { return { mark: fmtPct(p.share) }; }

  /* How a line moved, in words, so the sentence stays true if the data does. */
  function moved(a, b) {
    if (b.share >= a.share * 2 && b.share - a.share >= 0.03) { return "rose"; }
    if (b.share <= a.share / 2 && a.share - b.share >= 0.03) { return "fell"; }
    return "barely moved";
  }

  function peak(series) {
    return drawn(series).reduce(function (best, p) { return best === null || p.share > best.share ? p : best; }, null);
  }

  function chapterSteps(bd, subs, chapter) {
    var S = function (f, k) { return seriesP(bd, f, k); };
    if (chapter === "sex") {
      var ex = S("all", SEX);
      var hh = S("g:hip_hop", SEX);
      return [
        { preset: "explicit", filter: "all", kicker: "All songs",
          parts: ["In " + first(ex).decade + ", ", m(first(ex)), " of the biggest songs described sex explicitly. By " +
            last(ex).decade + ": ", m(last(ex)), "."] },
        { preset: "explicit", filter: "g:hip_hop", kicker: "Hip-hop",
          parts: ["Hip-hop songs went furthest: ", m(first(hh)), " in " + first(hh).decade + ", ", m(last(hh)),
            " in " + last(hh).decade + "."] }
      ];
    }
    if (chapter === "violence") {
      var v = S("all", "violence_beyond_mention"), vh = S("g:hip_hop", "violence_beyond_mention");
      var vr = S("wo:hip_hop", "violence_beyond_mention"), rr = range(vr);
      var cel = S("all", "violence_celebrated"), celr = range(S("wo:hip_hop", "violence_celebrated"));
      return [
        { preset: "beyond", filter: "all", kicker: "All songs",
          parts: ["Songs that threaten or carry out violence went from ", m(first(v)), " in " + first(v).decade +
            " to ", m(last(v)), " in " + last(v).decade + "."] },
        { preset: "beyond", filter: "g:hip_hop", kicker: "Hip-hop",
          parts: ["In hip-hop: ", m(first(vh)), " of songs in " + first(vh).decade + ", ", m(last(vh)),
            " in " + last(vh).decade + ". Hip-hop songs are " + fmtPct(last(vh).hits / last(v).hits, 0) +
            " of all the violent songs in " + last(v).decade + "."] },
        { preset: "beyond", filter: "wo:hip_hop", kicker: "Everything but hip-hop",
          parts: ["Take hip-hop out and the line " + (rr.max - rr.min < 0.05 ? "goes flat" : "still moves") +
            ": between ", { mark: fmtPct(rr.min) }, " and ", { mark: fmtPct(rr.max) }, " in every five-year step."] }

      ];
    }
    if (chapter === "drugs") {
      var u = S("all", "drugs_use_or_sale"), uh = S("g:hip_hop", "drugs_use_or_sale"), ur = S("wo:hip_hop", "drugs_use_or_sale");
      var gl = S("all", "drugs_glorified"), pk = peak(gl), lg = last(gl);
      return [
        { preset: "use", filter: "all", kicker: "All songs",
          parts: ["Songs that describe using or selling drugs went from ", m(first(u)), " in " + first(u).decade +
            " to ", m(last(u)), " in " + last(u).decade + "."] },
        { preset: "use", filter: "g:hip_hop", kicker: "Hip-hop",
          parts: ["In hip-hop: ", m(first(uh)), " in " + first(uh).decade + ", ", m(last(uh)), " in " + last(uh).decade + "."] },
        { preset: "use", filter: "wo:hip_hop", kicker: "Everything but hip-hop",
          parts: ["Unlike violence, this is not only hip-hop. Everything else " + moved(first(ur), last(ur)) + " too, from ",
            m(first(ur)), " to ", m(last(ur)), "."] },
        { preset: "glorified", filter: "all", kicker: "Drugs glorified",
          parts: pk.decade === lg.decade
            ? ["Songs that glorify drugs are at their highest now: ", m(lg), " in " + lg.decade + "."]
            : ["Songs that glorify drugs peaked in " + pk.decade + " at ", m(pk), ", and fell to ", m(lg),
               " in " + lg.decade + "."] }
      ];
    }
    if (chapter === "money") {
      var f = S("all", "money_flex"), st = range(S("all", "money_struggle_or_critique"));
      var fh = S("g:hip_hop", "money_flex"), br = S("all", "brands_named");
      return [
        { preset: "flex", filter: "all", kicker: "All songs",
          parts: ["Flexing about money went from ", m(first(f)), " of songs in the " + first(f).decade + " to ", m(last(f)),
            " in " + last(f).decade + "."] },
        { preset: "stance", filter: "all", kicker: "Flex against struggle",
          parts: ["Songs about struggling for money, or turning it down, held between ", { mark: fmtPct(st.min) }, " and ",
            { mark: fmtPct(st.max) }, " the whole time. The flex grew beside them; it did not replace them."] },
        { preset: "flex", filter: "g:hip_hop", kicker: "Hip-hop",
          parts: ["In hip-hop the flex is the norm: ", m(last(fh)), " of hip-hop songs in " + last(fh).decade + "."] },
        { preset: "brands", filter: "all", kicker: "Brand names",
          parts: ["Naming brands to flex went from ", m(first(br)), " to ", m(last(br)), "."] }
      ];
    }
    return [];
  }

  /* The way into each chart: a short heading and a paragraph that says what
     is being counted and why this view, before the sentence with the numbers. */
  var STEP_INTRO = {
    sex: [
      ["Sixty years of sex on the charts", "Start with every song that finished a year on the chart. For each one, the reader asked a plain question: does it describe sex explicitly or graphically, rather than hint at it? A song that only flirts does not count here."],
      ["Where it is most explicit", "Genre matters. Hip-hop reaches the chart in force in the early 1990s, and it is where the steepest climb shows up. Here is hip-hop on its own, with all songs behind it for comparison."],
    ],
    violence: [
      ["The rise", "A song counts here only when violence is threatened or carried out in it: a shooting, a beating, a threat. A song that just mentions a gun or a fight does not."],
      ["Who carries it", "The claim names rap as the culprit, so start there. Split the chart by genre and look at hip-hop alone, from the first years it has enough songs to measure."],
      ["Everything else", "Now the test that settles it: take away every song tagged hip-hop and look at what is left."]
    ],
    drugs: [
      ["Getting high on the charts", "Counted here: songs that describe someone using or selling drugs. Naming a drug in passing is not enough; the song has to put it in the scene."],
      ["Where it started", "Hip-hop is where drug talk first became common on the chart. Here it is on its own."],
      ["Everyone else caught up", "Unlike violence, this one does not stay in one genre. Take hip-hop out and look again."],
      ["Glorified, not just described", "Describing drugs and celebrating them are different things. The reader also marked songs that frame using as something to want."]
    ]
  };

  /* Where the text sits and what the camera does, per step. The chart
     slides away from the card and turns toward it; some steps zoom into the
     recent decades, where the story is. */
  var CAMERA = {
    sex: [{}, {}, { from: 6 }, {}],
    violence: [{}, { from: 6 }, {}],
    drugs: [{}, { from: 6 }, {}, {}],
    money: [{}, {}, {}, {}]
  };

  function withCamera(steps, chapter) {
    var cams = CAMERA[chapter] || [];
    return steps.map(function (st, i) { return Object.assign({ lay: "center" }, st, cams[i] || {}); });
  }

  /* Money as a ratio: songs that flex for every song that struggles. */
  function flexRatio(bd) {
    return bd.decades.map(function (d) {
      var c = bd.by_decade[d], f = c.measures.money_flex.n, st = c.measures.money_struggle_or_critique.n;
      return { decade: d, flex: f, struggle: st, n: c.n_songs, r: st ? f / st : null };
    });
  }

  function ratioPair(r) {
    return r >= 1 ? { left: Math.round(r * 10) / 10, right: 1, dec: 1 } : { left: 1, right: Math.round(1 / r), dec: 0 };
  }

  function moneySteps(bd) {
    var rows = flexRatio(bd), end = rows.length - 1;
    var cross = rows.findIndex(function (x) { return x.r >= 0.8; });
    var brands = seriesFor(bd, "all", "brands_named");
    var steps = [{ i: 0, kicker: rows[0].decade,
      parts: ["In the " + rows[0].decade + ", for every song that flexed about money there were ",
        { mark: String(ratioPair(rows[0].r).right) }, " about struggling for it, or turning it down."] }];
    if (cross > 0 && cross < end) {
      var c = rows[cross];
      steps.push({ i: cross, kicker: c.decade, parts: [
        (c.r < 1.25 ? "By the " + c.decade + " the two were about even: " : "By the " + c.decade + " the flex had overtaken it: "),
        { mark: fmtN(c.flex) }, " songs flexing, ", { mark: fmtN(c.struggle) }, " struggling."] });
    }
    steps.push({ i: end, kicker: rows[end].decade, parts: ["In the " + rows[end].decade + ": ",
      { mark: ratioPair(rows[end].r).left.toFixed(1) }, " songs flexing for every one about struggling."] });
    steps.push({ i: end, kicker: "Brand names", parts: ["And the flex got specific. Songs that name brands to flex went from ",
      m(first(brands)), " to ", m(last(brands)), "."] });
    return steps;
  }

  function dumbbellRows(bd, key, d0, d1) {
    return DUMBBELL_GENRES.map(function (g) {
      var f = g === "all" ? "all" : "g:" + g;
      var a = cellFor(bd, f, d0), b = cellFor(bd, f, d1);
      if (!a || !b || !a.reliable || !b.reliable) { return null; }
      return { label: g === "all" ? "All songs" : GENRE_LABEL[g], all: g === "all",
               a: a.measures[key].n / a.n_songs, b: b.measures[key].n / b.n_songs, na: a.n_songs, nb: b.n_songs };
    }).filter(Boolean).sort(function (x, y) { return y.b - x.b; });
  }

  function substanceRanks(subs) {
    var out = {};
    SUBSTANCE_CLASSES.forEach(function (c) { out[c.key] = []; });
    subs.decades.forEach(function (d, i) {
      SUBSTANCE_CLASSES.map(function (c) { return { key: c.key, v: subShare(subs, d, c.key) }; })
        .sort(function (x, y) { return y.v - x.v || (x.key < y.key ? -1 : 1); })
        .forEach(function (x, r) { out[x.key][i] = { rank: r + 1, share: x.v }; });
    });
    return out;
  }

  /* Kids, hits only on every marker, so each is read against the same chart. */
  function kidsLines(feed) {
    var chart = feed.lists[KIDS_GROUP].vs_chart;
    var kca = feed.lists["kca"].vs_chart, bop = feed.lists["kidz-bop"].vs_chart;
    return [SEX, "drugs_use_or_sale", "violence_beyond_mention", "profanity_strong"].map(function (k) {
      return { key: k, label: SHORT[k],
        chart: kShare(chart.chart.measures[k]), chartN: chart.chart.measures[k].n,
        kca: kShare(kca.group.measures[k]), kcaN: kca.group.measures[k].n,
        bop: kShare(bop.group.measures[k]), bopN: bop.group.measures[k].n,
        fromYear: chart.from_year };
    });
  }


  /* ---------------- dom helpers ---------------- */

  function h(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") { node.className = attrs[k]; }
        else if (k === "text") { node.textContent = attrs[k]; }
        else if (k === "style") { node.setAttribute("style", attrs[k]); }
        else { node.setAttribute(k, attrs[k]); }
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined) { return; }
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }
  var SVGNS = "http://www.w3.org/2000/svg";
  function s(tag, attrs) {
    var node = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    return node;
  }
  function byId(id) { return document.getElementById(id); }
  function fill(id, text) { var n = byId(id); if (n) { n.textContent = text; } return n; }
  function fillParts(id, parts) {
    var n = byId(id);
    if (!n) { return; }
    n.textContent = "";
    parts.forEach(function (p) {
      n.appendChild(typeof p === "string" ? document.createTextNode(p) : h("mark", { text: p.mark }));
    });
  }
  function isDark() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t) { return t === "dark"; }
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }

  function reducedMotion() {
    return typeof window !== "undefined" && window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function pillGroup(host, items, current, onPick, accent) {
    host.textContent = "";
    var buttons = items.map(function (it) {
      var b = h("button", { class: "pill" + (it.id === accent ? " accent" : ""), type: "button",
                            "aria-pressed": String(it.id === current), text: it.label });
      b.addEventListener("click", function () {
        buttons.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        onPick(it.id);
      });
      host.appendChild(b);
      return b;
    });
    return buttons;
  }

  /* ---------------- reveal on scroll ---------------- */

  var enterFns = [];
  function onEnter(el, fn) { if (el) { enterFns.push({ el: el, fn: fn }); } }

  /* For charts: wait until the chart is well into view (its middle past the
     lower third of the screen), then a short beat, then play. */
  var views = [];
  function onView(el, fn) {
    if (!el) { return; }
    if (reducedMotion() || typeof IntersectionObserver === "undefined") { fn(); return; }
    var v = { el: el, fn: fn, done: false, io: null };
    views.push(v);
    watchView(v);
  }
  function watchView(v) {
    if (v.io) { v.io.disconnect(); }
    v.io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (en.isIntersecting && !v.done) { v.done = true; v.io.disconnect(); setTimeout(v.fn, 350); }
      });
    }, { threshold: [0, 0.5], rootMargin: "0px 0px -30% 0px" });
    v.io.observe(v.el);
  }
  // A page that was hidden or parked off-screen starts watching afresh when shown.
  function rearmViews() { views.forEach(function (v) { if (!v.done) { watchView(v); } }); }

  function observeReveals() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
    var targets = nodes.concat(enterFns.map(function (e) { return e.el; }));
    function fire(el) {
      el.classList.add("in");
      enterFns.forEach(function (e) {
        if (e.el === el && !e.done) { e.done = true; e.fn(); }
      });
    }
    if (reducedMotion() || typeof IntersectionObserver === "undefined") {
      targets.forEach(fire);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { fire(en.target); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    targets.forEach(function (t) {
      // Anything already scrolled past (a restored scroll position) shows at once.
      if (t.getBoundingClientRect().bottom < 0) { fire(t); } else { io.observe(t); }
    });
  }

  /* ---------------- scrolly: pinned figure + stepping text ---------------- */

  function stepCard(st, i, n) {
    var p = h("p", { class: "step-text" });
    st.parts.forEach(function (x) {
      p.appendChild(typeof x === "string" ? document.createTextNode(x) : h("mark", { text: x.mark }));
    });
    return h("div", { class: "step " + (st.lay || "center") }, [h("div", { class: "step-card" }, [
      st.kicker ? h("p", { class: "step-kicker", text: (i + 1) + " / " + n + " · " + st.kicker }) : null, p])]);
  }

  /* ---------------- stage: everything pinned, scroll scrubs the story ----------------
     No text boxes travel up the screen. The sentence and the figure stay in
     place; scrolling swaps the sentence (out to one side, in from the other),
     moves the figure the opposite way, and can scrub a reveal (0..1) within
     a step. A progress bar under the figure shows where you are. */

  /* Every sentence is rendered once, stacked in one grid cell, so the text
     area is always as tall as the longest one: nothing is ever cut off. */
  function Swapper(host, items, render) {
    var slides = items.map(function (it, i) {
      var sl = h("div", { class: "stage-slide", "aria-hidden": "true" }, [render(it, i)]);
      host.appendChild(sl);
      return sl;
    });
    var cur = -1;
    return function (i) {
      if (i === cur) { return; }
      var dir = i > cur ? 1 : -1;
      slides.forEach(function (sl, j) {
        sl.classList.remove("on", "out-left", "out-right", "from-left", "from-right");
        if (j === cur) { sl.classList.add(dir > 0 ? "out-left" : "out-right"); }
        else if (j !== i) { sl.classList.add(dir > 0 ? "from-right" : "from-left"); }
        sl.setAttribute("aria-hidden", j === i ? "false" : "true");
      });
      var next = slides[i];
      next.classList.add(dir > 0 ? "from-right" : "from-left");
      void next.offsetWidth;
      next.classList.remove("from-right", "from-left");
      next.classList.add("on");
      cur = i;
    };
  }

  function sentence(parts, cls) {
    var p = h("p", { class: cls });
    parts.forEach(function (x) {
      p.appendChild(typeof x === "string" ? document.createTextNode(x) : h("mark", { text: x.mark }));
    });
    return p;
  }

  function scrollProgress(root) {
    var r = root.getBoundingClientRect();
    var total = root.offsetHeight - window.innerHeight;
    return Math.max(0, Math.min(0.9999, -r.top / Math.max(1, total)));
  }

  function onScrollFrame(fn) {
    var ticking = false;
    function go() { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; fn(); }); } }
    window.addEventListener("scroll", go, { passive: true });
    window.addEventListener("resize", go);
    fn();
  }

  /* Plays itself once it is on screen: each step holds for a few seconds,
     the progress segments fill like story slides, and it pauses whenever it
     leaves the screen. Tap a segment to jump; replay at the end. */
  function Stage(root, steps, onStep, onArrive) {
    var bar = root.querySelector(".stage-progress");
    var n = steps.length, cur = -1, t0 = 0, elapsed = 0, playing = false, visible = false, done = false, arrived = false;
    var HOLD = 5600, FIRST = 7200;
    root.classList.add("autoplay");
    var show = Swapper(root.querySelector(".stage-text"), steps, function (st, i) {
      return h("div", null, [
        h("p", { class: "stage-kicker", text: (i + 1) + " / " + n + (st.kicker ? " · " + st.kicker : "") }),
        sentence(st.parts, "stage-line")]);
    });
    var segs = steps.map(function (st, i) {
      var seg = h("button", { type: "button", class: "seg", "aria-label": "Step " + (i + 1) }, [h("b", {})]);
      seg.addEventListener("click", function () { jump(i); play(); });
      bar.appendChild(seg);
      return seg;
    });
    var ctrl = h("button", { type: "button", class: "stage-ctrl", "aria-label": "Pause" });
    ctrl.addEventListener("click", function () { if (done) { jump(0); play(); } else if (playing) { pause(); } else { play(); } });
    bar.appendChild(ctrl);
    function hold(i) { return i === 0 ? FIRST : HOLD; }
    function jump(i) {
      done = false; elapsed = 0; t0 = performance.now();
      if (i !== cur) { cur = i; show(i); onStep(i); }
      paintSegs(0);
    }
    function paintSegs(local) {
      segs.forEach(function (sg, j) {
        sg.firstChild.style.transform = "scaleX(" + (j < cur ? 1 : j > cur ? 0 : local).toFixed(3) + ")";
        sg.classList.toggle("on", j === cur);
      });
      ctrl.className = "stage-ctrl " + (done ? "replay" : playing ? "pause" : "play");
      ctrl.setAttribute("aria-label", done ? "Replay" : playing ? "Pause" : "Play");
    }
    function tick(now) {
      if (!playing) { return; }
      var e = elapsed + (now - t0);
      var local = Math.min(1, e / hold(cur));
      paintSegs(local);
      if (local >= 1) {
        if (cur < n - 1) { elapsed = 0; t0 = now; cur++; show(cur); onStep(cur); }
        else { playing = false; done = true; paintSegs(1); return; }
      }
      requestAnimationFrame(tick);
    }
    function play() { if (playing) { return; } playing = true; t0 = performance.now(); paintSegs(0); requestAnimationFrame(tick); }
    function pause() { if (!playing) { return; } elapsed += performance.now() - t0; playing = false; paintSegs(Math.min(1, elapsed / hold(cur))); }
    jump(0);
    if (reducedMotion() || typeof IntersectionObserver === "undefined") { if (onArrive) { onArrive(); } paintSegs(0); return; }
    new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        visible = en.isIntersecting;
        if (visible && !arrived) { arrived = true; if (onArrive) { onArrive(); } }
        if (visible && !done) { play(); } else if (!visible) { pause(); }
      });
    }, { threshold: 0.55 }).observe(root);
  }

  /* ---------------- race / ethnicity (billed lead artist) ---------------- */

  var RACE_SHOWN = ["black", "white", "hispanic_latino", "multiracial"];
  var RACE_MEASURES = [
    { key: "sex_graphic_or_explicit", label: "Explicit sex" },
    { key: "violence_beyond_mention", label: "Violence" },
    { key: "drugs_use_or_sale", label: "Drug use" },
    { key: "money_flex", label: "Money flex" }
  ];

  function raceCell(race, view, key) { return (race[view] || {})[key.indexOf("|") >= 0 ? (key.split("|").length === 2 && race.decades.indexOf(key.split("|")[1]) >= 0 ? "by_group_decade" : "by_group_genre_any") : "by_group"][key]; }

  function raceShare(race, view, table, key, m) {
    var c = ((race[view] || {})[table] || {})[key];
    if (!c || !c.reliable) { return null; }
    return { share: c.measures[m].n / c.n_songs, hits: c.measures[m].n, n: c.n_songs };
  }

  function raceDecades(race, view, m) {
    return race.decades.map(function (d) {
      var row = { label: d };
      RACE_SHOWN.forEach(function (g) { row[g] = raceShare(race, view, "by_group_decade", g + "|" + d, m); });
      return row;
    });
  }

  function raceInsideGenre(race, view, m) {
    return [["hip_hop+rnb_soul", "Rap or R&B songs"], ["other_genres", "Everything else"]].map(function (pair) {
      return { label: pair[1], black: raceShare(race, view, "by_group_genre_any", "black|" + pair[0], m),
               white: raceShare(race, view, "by_group_genre_any", "white|" + pair[0], m) };
    });
  }

  /* Songs meeting a measure each decade, and how many were rap or R&B. */
  function rapRnbCounts(bd, key) {
    return p5Labels(bd).map(function (d) {
      var all = bd.by_period5[d], sub = (bd.by_period5_genre_any || {})[d + "|hip_hop+rnb_soul"];
      return { label: d, total: all.measures[key].n, sub: sub ? sub.measures[key].n : 0, n: all.n_songs };
    });
  }

  /* ---------------- one-liners: the facts worth saying out loud ----------------
     Each is computed from the feeds, so it stays true if the data moves.
     They compare hits with hits: what charted, never what anyone heard. */

  /* From the percentages as printed (one decimal), so "1.0% to 35.1%" reads as 35×. */
  function times(a, b) { var ra = Math.round(a * 1000) / 1000, rb = Math.round(b * 1000) / 1000; var r = rb / ra; return r >= 10 ? String(Math.round(r)) : (Math.round(r * 10) / 10).toString(); }

  /* 0.639 -> "Nearly 2 in 3"; 0.8 -> "4 in 5"; 0.35 -> "More than 1 in 3". */
  function fracWords(x) {
    var best = null;
    [2, 3, 4, 5, 10].forEach(function (d) {
      for (var n = 1; n < d; n++) {
        var f = n / d, err = Math.abs(f - x);
        if (best === null || err < best.err - 1e-9) { best = { n: n, d: d, f: f, err: err }; }
      }
    });
    var core = best.n + " in " + best.d;
    if (best.err <= 0.012) { return { lead: "", core: core }; }
    return { lead: x < best.f ? "Nearly " : "More than ", core: core };
  }

  /* "1 in 238" reads as false precision: round big denominators. */
  function roughOneIn(share) {
    var n = oneIn(share);
    if (n === null) { return "—"; }
    if (n >= 100) { var p = Math.pow(10, Math.floor(Math.log10(n)) - 1); n = Math.round(n / p) * p; return "about 1 in " + n; }
    return "1 in " + n;
  }

  function cap(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

  /* "1 in 3", "nearly 2 in 5": the share as people say it. */
  function said(x) {
    if (x < 0.2) { return roughOneIn(x); }
    var f = fracWords(x);
    return (f.lead ? f.lead.toLowerCase() : "") + f.core;
  }
  function saidBig(x) { return x < 0.2 ? roughOneIn(x).replace("about ", "") : fracWords(x).core; }

  function oneLiners(bd, subs, kids) {
    var S = function (f, k) { return seriesFor(bd, f, k); };
    var ex = S("all", SEX), hh = last(S("g:hip_hop", SEX));
    var v = S("all", "violence_beyond_mention"), vh = last(S("g:hip_hop", "violence_beyond_mention"));
    var vr = S("wo:hip_hop", "violence_beyond_mention");
    var dr = S("all", "drugs_use_or_sale");
    var d0 = subs.decades[3];
    var op0 = subShare(subs, d0, "opioid"), op1 = subShare(subs, subs.decades[subs.decades.length - 1], "opioid");
    var ratio = flexRatio(bd), rLast = ratio[ratio.length - 1];
    var br = last(S("all", "brands_named"));
    var restMove = last(vr).share / first(vr).share;
    var kidsSex = kids.lists[KIDS_GROUP].full.measures[SEX];
    var kca = kShare(kids.lists["kca"].vs_chart.group.measures[SEX]), bop = kShare(kids.lists["kidz-bop"].vs_chart.group.measures[SEX]);
    var then = function (p) { return "In the " + p.decade + ", "; };
    var of = function (p) { return fmtN(p.hits) + " of " + fmtN(p.n) + " songs in the " + p.decade; };
    var base = "Billboard Year-End Hot 100, every song; near-instrumentals and mismatched lyrics left out (see Method). “Today” is 2020–2025.";
    return {
      sex: [
        { big: saidBig(last(ex).share), parts: [then(first(ex)), { mark: said(first(ex).share) }, " of the year’s biggest songs described sex explicitly. Today it’s ", { mark: said(last(ex).share) }, "."],
          note: of(first(ex)) + "; " + of(last(ex)) + ". " + base },
        { big: saidBig(hh.share), parts: [cap(said(hh.share)), " of today’s biggest hip-hop songs describe sex explicitly."],
          note: of(hh) + " tagged hip-hop (a song can carry several genre tags). " + base }
      ],
      violence: [
        { big: saidBig(vh.hits / last(v).hits), parts: [cap(said(vh.hits / last(v).hits)), " of today’s violent songs are hip-hop songs."],
          note: fmtN(vh.hits) + " of the " + fmtN(last(v).hits) + " songs from 2020–2025 that threaten or carry out violence are tagged hip-hop. " + base },
        restMove < 1.5 && restMove > 0.67
          ? { big: "No change", parts: ["Leave hip-hop out, and songs today are ", { mark: "no more violent" }, " than they were in the " + first(vr).decade + ": " + said(first(vr).share) + " songs then, " + said(last(vr).share) + " now."],
              note: "Songs not tagged hip-hop: " + of(first(vr)) + "; " + of(last(vr)) + ". " + base }
          : { big: saidBig(last(vr).share), parts: ["Even without hip-hop, violence went from ", { mark: said(first(vr).share) }, " songs to ", { mark: said(last(vr).share) }, "."] }
      ],
      drugs: [
        { big: saidBig(last(dr).share), parts: [then(first(dr)), { mark: said(first(dr).share) }, " of the biggest songs described someone using or selling drugs. Today it’s ", { mark: said(last(dr).share) }, "."],
          note: of(first(dr)) + "; " + of(last(dr)) + ". Counts songs that describe use or sale, not ones that only name a drug. " + base },
        { big: saidBig(op1), parts: ["Songs naming opioids, lean or pills: ", { mark: said(op0) }, " in the " + d0 + ", ", { mark: said(op1) }, " today."],
          note: "Songs whose read names an opioid, lean/codeine or pills, out of every song in the decade (" + fmtN(subs.n_songs_by_decade[d0]) + " in the " + d0 + ", " + fmtN(subs.n_songs_by_decade[subs.decades[subs.decades.length - 1]]) + " in 2020–2025). Named, not necessarily used. " + base }
      ],
      money: [
        { big: String(Math.round(rLast.r)) + " to 1", parts: ["For every song about struggling for money, there are now ", { mark: String(Math.round(rLast.r)) }, " about showing it off."],
          note: "2020–2025: " + fmtN(rLast.flex) + " songs flex about money, " + fmtN(rLast.struggle) + " struggle for it or turn it down, of " + fmtN(rLast.n) + ". " + base },
        { big: saidBig(br.share), parts: [cap(said(br.share)), " of today’s biggest songs name-drops a brand."],
          note: of(br) + " name a brand as a status symbol. " + base }
      ],
      kids: [
        { big: saidBig(kShare(kidsSex)), parts: [cap(said(kShare(kidsSex))), " songs chosen for kids describes sex explicitly."],
          note: fmtN(kidsSex.hits) + " of " + fmtN(kidsSex.n) + " songs picked by the Kids’ Choice Awards (2014–2025) and Kidz Bop (2010–2026), counted on the original adult recording." },
        { big: saidBig(kca), parts: ["When kids vote for their favourite songs, ", { mark: said(kca) }, " of their picks describe sex explicitly. Among the songs adults choose for Kidz Bop, it’s ", { mark: said(bop) }, "."],
          note: "Chart songs only, 2010 onward, on both sides: Kids’ Choice Awards picks " + fmtN(kids.lists["kca"].vs_chart.group.measures[SEX].hits) + " of " + fmtN(kids.lists["kca"].vs_chart.group.measures[SEX].n) + "; Kidz Bop picks " + fmtN(kids.lists["kidz-bop"].vs_chart.group.measures[SEX].hits) + " of " + fmtN(kids.lists["kidz-bop"].vs_chart.group.measures[SEX].n) + "." }
      ],
      race: [],
      glance: []
    };
  }

  function raceFact(race) {
    var d = raceDecades(race, "all_labels", SEX), l = d[d.length - 1];
    if (!l.black || !l.white) { return null; }
    return { big: saidBig(l.black.share), parts: ["Today, ", { mark: said(l.black.share) }, " songs by Black lead artists describe sex explicitly, against ",
      { mark: said(l.white.share) }, " by white lead artists."],
      note: "2020–2025: " + fmtN(l.black.hits) + " of " + fmtN(l.black.n) + " songs by Black lead artists; " + fmtN(l.white.hits) + " of " + fmtN(l.white.n) +
        " by white lead artists. Race/ethnicity of the billed lead artist only; all labels (tick “high-confidence” in the chart to see the stricter view)." };
  }

  /* The school bus: 40 seats, each playing a different hit (a picture of the
     shares, not a measurement of listening). */
  function busSeats(bd) {
    var v = seriesFor(bd, "all", "violence_beyond_mention"), a = first(v), b = last(v);
    var hh = last(seriesFor(bd, "g:hip_hop", "violence_beyond_mention"));
    var then = Math.round(40 * a.share), now = Math.round(40 * b.share);
    var hhNow = Math.round(now * hh.hits / b.hits);
    return { seats: 40, then: then, now: now, hipHop: hhNow, from: a.decade, to: b.decade };
  }

  /* The birthday party: N song cards, one of them explicit (N = "1 in N"). */
  function partyCards(kids) {
    var m = kids.lists[KIDS_GROUP].full.measures[SEX], sh = kShare(m);
    return { n: Math.max(2, Math.min(10, oneIn(sh))), share: sh, hits: m.hits, total: m.n };
  }

  /* The author's opinion, set apart from the findings, with the numbers that
     sit behind it. The opinion is the author's; the ratios are the data's. */
  function opinionNote(bd) {
    var ex = seriesFor(bd, "all", SEX), a = first(ex), b = last(ex);
    var p = ex.filter(function (x) { return x.decade === "1990s"; })[0];
    return {
      opinion: "Kids nowadays hear far more songs about sex than any generation before them.",
      parts: ["What the data says: in the " + a.decade + ", ", { mark: said(a.share) }, " of the year’s biggest songs described sex explicitly. In the " +
        p.decade + ", when most of today’s parents were growing up, it was ", { mark: said(p.share) }, ". Today it’s ", { mark: said(b.share) },
        ". That is what made the charts, not what any one child heard."]
    };
  }

  /* One Notes list at the very bottom of the page, numbered straight through.
     The same text is only listed once. */
  var NOTES = { list: null, seen: {} };
  function addNote(text) {
    if (!text) { return null; }
    if (NOTES.seen[text]) { return NOTES.seen[text]; }
    if (!NOTES.list) { NOTES.list = byId("notes-list"); if (!NOTES.list) { return null; } }
    var k = NOTES.list.children.length + 1;
    NOTES.list.appendChild(h("li", { id: "note-" + k, text: text }));
    NOTES.seen[text] = k;
    return k;
  }
  function noteMark(k) { return k ? h("a", { class: "fn", href: "#note-" + k, "aria-label": "Note " + k, text: String(k) }) : null; }

  /* A one-liner, with a footnote number that points at the counts behind it. */
  function factBlock(f, sec) {
    var num = h("p", { class: "fact-big", text: f.big });
    var line = sentence(f.parts, "fact-line");
    if (f.note) { var mk = noteMark(addNote(f.note)); if (mk) { line.appendChild(mk); } }
    return h("div", { class: "fact reveal" }, [num, line]);
  }

  /* ---------------- chapter story: every point on the page at once ----------------
     The first finding gets a large chart, the rest a row of smaller ones.
     Each chart draws its line in when it arrives on screen; nothing plays
     through on a timer and nothing is tied to scroll position. */

  function drawStory(root, bd, subs, ch, fx) {
    if (!root) { return; }
    root.textContent = "";
    root.className = "story";
    var steps = withCamera(chapterSteps(bd, subs, ch), ch);
    var sec = root.closest(".chapter");
    if (fx && fx[0]) { root.appendChild(factBlock(fx[0], sec)); }
    steps.forEach(function (st, i) {
      if (i === 1 && fx && fx[1]) { root.appendChild(factBlock(fx[1], sec)); }
      var chartHost = h("div", { class: "module story-chart" + (i === 0 ? " lead" : "") });
      var intro = (STEP_INTRO[ch] || [])[i];
      var block = h("div", { class: "story-step" }, [
        intro ? h("h3", { class: "step-title", text: intro[0] }) : null,
        intro ? h("p", { class: "step-lead", text: intro[1] }) : null,
        sentence(st.parts, "story-line"), chartHost]);
      root.appendChild(block);
      var chart = new TrendChart(chartHost, bd, Object.assign({}, CHARTS[ch], { controls: false }));
      chart.setState(st.preset, st.filter, st.from);
      chart.setReveal(reducedMotion() ? 1 : 0);
      onView(chartHost, function () { chart.started = true; chart.draw(false); chart.playIntro(i === 0 ? 4600 : 3600); });
    });
  }

  function drawMoneyStory(root, bd, fx) {
    if (!root) { return; }
    root.textContent = "";
    root.className = "story money-story";
    var sec = root.closest(".chapter");
    if (fx && fx[0]) { root.appendChild(factBlock(fx[0], sec)); }
    root.appendChild(h("div", { class: "story-step" }, [
      h("h3", { class: "step-title", text: "Flexing against struggling" }),
      h("p", { class: "step-lead", text: "Songs about money come in two moods. There is the struggle: rent, bills, being broke, or turning money down. And there is the flex: cash, cars and labels worn as proof. The ratio below counts one against the other, decade by decade." })]));
    var fig = h("div", { class: "module ticker story-ticker" });
    root.appendChild(fig);
    var ticker = new Ticker(fig, bd), rows = flexRatio(bd);
    ticker.show(0);
    moneySteps(bd).forEach(function (st, i) {
      if (i === 3 && fx && fx[1]) { root.appendChild(factBlock(fx[1], sec)); }
      root.appendChild(h("div", { class: "story-step" }, [sentence(st.parts, "story-line")]));
    });
    // On arrival the ratio counts once through the decades and stops at the last.
    onView(fig, function () {
      rows.forEach(function (r, i) { setTimeout(function () { ticker.show(i); }, reducedMotion() ? 0 : i * 1200); });
    });
  }

  /* ---------------- opener: one line at a time, and the whole span of years ----------------
     A single sentence on a plain field, swapped in place as you scroll,
     over a 1960–2025 timeline that fills with the songs read so far. */

  /* The eras: how people listened, drawn in line art. Objects, not people. */
  var ERAS = {
    "1960s": { line: "AM radio and the 45", art: [
      '<rect x="40" y="96" width="160" height="56" rx="8"/>', '<circle cx="104" cy="96" r="44" class="fillp"/>', '<circle cx="104" cy="96" r="30"/>',
      '<circle cx="104" cy="96" r="7" class="acc"/>', '<path d="M178 60 L178 104 L140 118"/>', '<circle cx="178" cy="60" r="7"/>', '<path d="M52 140 H70 M160 140 H184"/>'] },
    "1970s": { line: "Disco and the 8-track", art: [
      '<path d="M120 16 V40"/>', '<circle cx="120" cy="74" r="34" class="fillp"/>', '<path d="M88 64 H152 M86 78 H154 M92 92 H148 M120 40 V108 M104 44 C98 62 98 88 104 106 M136 44 C142 62 142 88 136 106"/>',
      '<rect x="60" y="126" width="120" height="40" rx="6" class="fillp"/>', '<rect x="78" y="136" width="44" height="18" rx="3"/>', '<path d="M134 146 H164" class="acc"/>',
      '<path d="M44 60 L30 52 M196 60 L210 52 M48 96 L34 104 M192 96 L206 104" class="acc"/>'] },
    "1980s": { line: "The boombox and the cassette", art: [
      '<path d="M80 48 C80 30 160 30 160 48"/>', '<rect x="28" y="48" width="184" height="104" rx="12" class="fillp"/>', '<circle cx="70" cy="104" r="28"/>', '<circle cx="70" cy="104" r="10" class="acc"/>',
      '<circle cx="170" cy="104" r="28"/>', '<circle cx="170" cy="104" r="10" class="acc"/>', '<rect x="100" y="76" width="40" height="28" rx="3"/>', '<circle cx="112" cy="90" r="5"/>', '<circle cx="128" cy="90" r="5"/>',
      '<path d="M102 124 H138 M102 134 H138"/>'] },
    "1990s": { line: "The CD and the Discman", art: [
      '<circle cx="104" cy="96" r="60" class="fillp"/>', '<circle cx="104" cy="96" r="44"/>', '<circle cx="104" cy="96" r="12" class="acc"/>', '<path d="M76 70 C84 62 94 58 104 58" class="acc"/>',
      '<path d="M170 60 C200 60 214 90 204 120"/>', '<rect x="196" y="116" width="18" height="26" rx="8" class="fillp"/>', '<path d="M164 96 C176 96 184 100 196 116"/>'] },
    "2000s": { line: "The iPod", art: [
      '<rect x="84" y="24" width="72" height="128" rx="14" class="fillp"/>', '<rect x="96" y="36" width="48" height="40" rx="4"/>', '<circle cx="120" cy="114" r="24"/>', '<circle cx="120" cy="114" r="8" class="acc"/>',
      '<path d="M120 152 C120 170 80 168 70 150 M120 152 C124 172 170 170 176 146"/>', '<rect x="62" y="136" width="14" height="18" rx="6" class="fillp"/>', '<rect x="170" y="132" width="14" height="18" rx="6" class="fillp"/>'] },
    "2010s": { line: "The smartphone and streaming", art: [
      '<rect x="80" y="16" width="80" height="148" rx="14" class="fillp"/>', '<rect x="90" y="32" width="60" height="104" rx="4"/>', '<path d="M112 70 L112 98 L134 84 Z" class="acc"/>',
      '<path d="M98 120 H142"/>', '<path d="M98 120 H122" class="acc"/>', '<circle cx="120" cy="150" r="6"/>'] },
    "2020s": { line: "Earbuds and the 15-second clip", art: [
      '<rect x="76" y="92" width="88" height="64" rx="28" class="fillp"/>', '<path d="M76 118 H164"/>', '<circle cx="120" cy="136" r="3" class="acc"/>',
      '<path d="M66 40 C52 40 48 62 60 70 L66 94" />', '<circle cx="70" cy="46" r="12" class="fillp"/>', '<path d="M174 40 C188 40 192 62 180 70 L174 94"/>', '<circle cx="170" cy="46" r="12" class="fillp"/>',
      '<path d="M100 40 C108 32 132 32 140 40 M106 54 C112 48 128 48 134 54" class="acc"/>'] }
  };

  function openerSteps(bd) {
    var steps = [{ kind: "text", parts: ["Every song that finished a year on the Billboard Hot 100."], year: 1960 }];
    bd.decades.forEach(function (d) {
      steps.push({ kind: "era", decade: d, n: bd.by_decade[d].n_songs, line: (ERAS[d] || {}).line || "", year: parseInt(d, 10) });
    });
    steps.push({ kind: "text", parts: [{ mark: fmtN(bd.n_songs) }, " songs. Every lyric read in full, one at a time."], year: 2025 });
    steps.push({ kind: "text", parts: ["Now, the arguments."], year: 2025 });
    return steps;
  }

  /* Songs read by a given (fractional) year, from the per-year counts. */
  function songsByYear(bd, year) {
    var total = 0;
    Object.keys(bd.by_year || {}).forEach(function (y) {
      var f = Math.max(0, Math.min(1, year - parseInt(y, 10)));
      total += bd.by_year[y].n_songs * f;
    });
    return Math.round(total);
  }

  function eraArt(d) {
    var e = ERAS[d];
    if (!e) { return null; }
    var wrap = document.createElement("div");
    wrap.className = "era-art";
    wrap.innerHTML = '<svg viewBox="0 0 240 180" aria-hidden="true" fill="none" stroke-linecap="round" stroke-linejoin="round"><g class="draw">' +
      e.art.map(function (p, i) { return p.replace(/^<(\w+)/, '<$1 pathLength="1" style="--d:' + (i * 0.12).toFixed(2) + 's"'); }).join("") + "</g></svg>";
    return wrap;
  }

  /* The opener: a vertical rail of years down the left; beside it one thing
     at a time, a sentence or an era with its drawing. Scroll moves the year. */
  function Opener(root, bd) {
    if (!root) { return; }
    var steps = openerSteps(bd), n = steps.length, cur = -1;
    root.style.setProperty("--steps", n);
    var show = Swapper(root.querySelector(".opener-text"), steps, function (st) {
      if (st.kind === "text") { return sentence(st.parts, "opener-line"); }
      return h("div", { class: "era" }, [eraArt(st.decade),
        h("p", { class: "era-decade", text: st.decade }),
        h("p", { class: "era-line", text: st.line }),
        h("p", { class: "era-n", text: fmtN(st.n) + " songs" + (st.decade === "2020s" ? " (2020–2025)" : "") })]);
    });
    var rail = root.querySelector(".rail"), fill = root.querySelector(".rail-fill"), dot = root.querySelector(".rail-dot");
    var yearEl = root.querySelector(".rail-year"), countEl = root.querySelector(".rail-count");
    bd.decades.forEach(function (d) {
      var y0 = parseInt(d, 10);
      rail.appendChild(h("span", { class: "rail-tick", style: "top:" + ((y0 - 1960) / 66 * 100).toFixed(2) + "%", text: d }));
    });
    onScrollFrame(function () {
      var p = scrollProgress(root);
      var i = Math.min(n - 1, Math.floor(p * n)), local = p * n - i;
      if (i !== cur) { cur = i; show(i); }
      var st = steps[i], yr;
      if (st.kind === "era") { yr = st.year + Math.min(st.decade === "2020s" ? 6 : 10, local * (st.decade === "2020s" ? 6 : 10)); }
      else { yr = i === 0 ? 1960 : 2026; }
      var t = (yr - 1960) / 66;
      fill.style.transform = "scaleY(" + t.toFixed(4) + ")";
      dot.style.top = (t * 100).toFixed(2) + "%";
      yearEl.textContent = String(Math.min(2025, Math.floor(yr)));
      countEl.textContent = fmtN(songsByYear(bd, yr)) + " songs";
    });
  }


  /* Fires onStep(i) as each step crosses the middle of the screen. */
  function scrolly(stepsHost, steps, onStep) {
    var nodes = steps.map(function (st, i) {
      var node = stepCard(st, i, steps.length);
      stepsHost.appendChild(node);
      return node;
    });
    var current = -1;
    function activate(i) {
      if (i === current) { return; }
      current = i;
      nodes.forEach(function (n, j) { n.classList.toggle("active", j === i); });
      onStep(i);
    }
    if (typeof IntersectionObserver === "undefined") { activate(0); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { activate(nodes.indexOf(en.target)); }
      });
    }, { rootMargin: "-48% 0px -48% 0px" });
    nodes.forEach(function (n) { io.observe(n); });
    nodes[0].classList.add("active");
  }

  /* ---------------- trend chart ----------------
     One y-axis (share of songs), seven decades. Up to two measures in fixed
     colour order, plus a dashed neutral "all songs" line when a filter is on
     and the chart shows a single measure. Unreliable cells break the line.
     Direct labels at the last point; a legend always; crosshair tooltip. */

  function niceMax(v) {
    var pct = v * 100;
    var steps = [5, 10, 20, 25, 40, 50, 60, 75, 80, 100];
    for (var i = 0; i < steps.length; i++) { if (pct <= steps[i] * 0.98) { return steps[i] / 100; } }
    return 1;
  }

  function TrendChart(host, bd, cfg) {
    this.host = host; this.bd = bd; this.cfg = cfg;
    this.preset = cfg.presets[0]; this.filter = "all";
    this.labels = p5Labels(bd);
    this.prev = {}; this.started = false;
    this.build();
  }

  TrendChart.prototype.build = function () {
    var self = this, cfg = this.cfg;
    var title = h("p", { class: "module-title", text: cfg.title });
    this.sub = h("p", { class: "module-sub" });
    var head = h("div", { class: "module-head" }, [h("div", null, [title, this.sub])]);
    var controls = h("div", { class: "controls" });
    if (cfg.controls !== false && cfg.presets.length > 1) {
      var pr = h("div", { class: "pills", role: "group", "aria-label": "Measure" });
      controls.appendChild(h("div", { class: "row" }, [h("span", { text: "Measure" }), pr]));
      pillGroup(pr, cfg.presets, this.preset.id, function (id) {
        self.preset = cfg.presets.filter(function (p) { return p.id === id; })[0];
        self.update(true);
      });
    }
    if (cfg.controls !== false) {
      var fr = h("div", { class: "pills", role: "group", "aria-label": "Songs" });
      controls.appendChild(h("div", { class: "row" }, [h("span", { text: "Songs" }), fr]));
      pillGroup(fr, FILTERS, this.filter, function (id) { self.filter = id; self.update(true); }, cfg.accent);
    }

    this.legend = h("ul", { class: "legend" });
    this.chart = h("div", { class: "chart" });
    this.tip = h("div", { class: "tip", "aria-hidden": "true" });
    this.chart.appendChild(this.tip);
    this.note = h("p");
    this.table = h("details", { class: "table" }, [h("summary", { text: "Show the numbers" })]);
    var foot = h("div", { class: "module-foot" }, [this.note, this.table]);

    this.host.textContent = "";
    [head, controls, this.legend, this.chart, foot].forEach(function (n) { self.host.appendChild(n); });

    if (typeof ResizeObserver !== "undefined") {
      var lastW = 0;
      new ResizeObserver(function () {
        var w = self.chart.clientWidth;
        if (self.started && Math.abs(w - lastW) > 4) { lastW = w; self.draw(false); }
      }).observe(this.chart);
    }
    onEnter(this.host, function () { self.started = true; self.update(!reducedMotion()); });
    this.update(false, true);
  };

  /* Scroll-driven: a step sets the measure preset and the song filter. */
  TrendChart.prototype.setState = function (presetId, filter, from) {
    var p = this.cfg.presets.filter(function (x) { return x.id === presetId; })[0] || this.preset;
    from = from || 0;
    if (p === this.preset && filter === this.filter && from === (this.from || 0)) { return; }
    this.preset = p; this.filter = filter; this.from = from;
    this.update(true);
  };

  /* 0..1: how much of the decade axis is drawn. 1 = everything. */
  TrendChart.prototype.setReveal = function (f) {
    this.reveal = f;
    if (!this.clipRect || !this.clipGeom) { return; }
    var g = this.clipGeom;
    this.clipRect.setAttribute("width", f >= 1 ? g.W : Math.max(0, g.iw * f + 16));
  };

  /* The arrival: the line is drawn left to right like a stylus across a
     record; each point is simply there once the line reaches it. */
  TrendChart.prototype.playIntro = function (dur) {
    var self = this;
    if (reducedMotion()) { this.setReveal(1); return; }
    dur = dur || 2600;
    var dropped = {};
    this.setReveal(0);
    tween(dur, function (t) {
      self.setReveal(t);
      if (!self.groups || !self.clipGeom) { return; }
      var edge = self.clipGeom.l + self.clipGeom.iw * t + 4;
      self.groups.forEach(function (gr, gi) {
        gr.dots.forEach(function (c, i) {
          var key = gi + ":" + i;
          if (dropped[key] || c.getAttribute("display") === "none") { return; }
          if (parseFloat(c.getAttribute("cx")) <= edge) { dropped[key] = true; }
        });
      });
    });
  };

  TrendChart.prototype.lines = function () {
    var bd = this.bd, filter = this.filter;
    var out = this.preset.series.map(function (sp) {
      return { id: sp.key, key: sp.key, color: "var(--" + sp.c + ")", label: SHORT[sp.key],
               values: seriesP(bd, filter, sp.key), ref: false };
    });
    if (filter !== "all" && out.length === 1) {
      out.push({ id: "ref", key: out[0].key, color: "var(--ref)", label: "All songs",
                 values: seriesP(bd, "all", out[0].key), ref: true });
    }
    if (filter !== "all") {
      out.forEach(function (l) { if (!l.ref) { l.label = l.label + " — " + filterLabel(filter); } });
    }
    return out;
  };

  TrendChart.prototype.update = function (animate, silent) {
    var self = this, lines = this.lines();
    this.current = lines;
    var keys = this.preset.series.map(function (x) { return x.key; });
    this.sub.textContent = "Share of " + filterNoun(this.filter) + " that " + keys.map(function (k) { return LABEL[k]; }).join(", and share that ") + ".";

    this.legend.textContent = "";
    lines.forEach(function (l) {
      self.legend.appendChild(h("li", null, [
        h("i", { class: l.ref ? "dash" : "", style: "border-color:" + l.color }), l.label]));
    });
    var notes = keys.map(function (k) { return gapNoteP(self.bd, self.filter, k); })
      .filter(function (x, i, a) { return x && a.indexOf(x) === i; });
    notes.push("Line charts step every five years; the last step, 2020–25, covers six years so 2025 is never drawn alone.");
    this.note.textContent = "";
    var self2 = this;
    notes.forEach(function (t) { var k = addNote(t); if (k && self2.note.textContent.indexOf("Notes") < 0) { self2.note.appendChild(noteMark(k)); } });
    this.renderTable(lines);
    if (!silent && this.started) { this.draw(animate); }
  };

  TrendChart.prototype.renderTable = function (lines) {
    var bd = this.bd;
    var t = h("table");
    var hr = h("tr", null, [h("th", { text: "Years" })]);
    lines.forEach(function (l) { hr.appendChild(h("th", { text: l.label })); });
    t.appendChild(hr);
    this.labels.forEach(function (dec, i) {
      var tr = h("tr", null, [h("td", { text: dec })]);
      lines.forEach(function (l) {
        var p = l.values[i];
        tr.appendChild(h("td", { text: p.share === null ? (p.n ? "n=" + p.n + ", not drawn" : "—")
          : fmtPct(p.share) + " (" + fmtN(p.hits) + "/" + fmtN(p.n) + ")" }));
      });
      t.appendChild(tr);
    });
    var old = this.table.querySelector("table");
    if (old) { old.remove(); }
    this.table.appendChild(t);
  };

  TrendChart.prototype.draw = function (animate) {
    var self = this, lines = this.current, bd = this.bd;
    var W = Math.max(280, this.chart.clientWidth);
    var narrow = W < 560 || !!this.cfg.compact;
    var H = this.cfg.fit ? Math.max(220, Math.round(this.chart.clientHeight))
      : this.cfg.compact ? Math.round(Math.max(180, Math.min(240, W * 0.62)))
      : Math.round(Math.min(440, Math.max(260, W * 0.42)));
    var m = { t: 16, r: narrow ? 70 : 196, b: 30, l: 40 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var max = 0;
    // Data zoom: the axis can start at a later decade ("from"), and eases there.
    var sT = this.from || 0;
    var sFrom = animate && typeof this.prevFrom === "number" ? this.prevFrom : sT, sCur = sFrom;
    this.prevFrom = sT;
    lines.forEach(function (l) { l.values.forEach(function (p, i) { if (p.share !== null && i >= sT) { max = Math.max(max, p.share); } }); });
    var yMax = niceMax(Math.max(max, 0.04));
    // The axis eases from the last scale to the new one with the lines.
    var yFrom = animate && this.prevYMax ? this.prevYMax : yMax, yCur = yFrom;
    this.prevYMax = yMax;
    var labelsP = this.labels, n = labelsP.length;
    function x(i) { return m.l + (i - sCur) * iw / (n - 1 - sCur); }
    function y(v) { return m.t + ih - (v / yCur) * ih; }
    this.geom = { x: x, y: y, m: m, W: W, H: H, iw: iw, ih: ih, n: n };
    var decadeLabels = [];

    var svg = s("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img",
      "aria-label": this.cfg.title + ". " + lines.map(function (l) {
        var a = first(l.values), b = last(l.values);
        return a && b ? l.label + ": " + fmtPct(a.share) + " in " + a.decade + " to " + fmtPct(b.share) + " in " + b.decade : l.label;
      }).join(". ") });

    var grid = s("g", { class: "grid" }), axis = s("g", { class: "axis" });
    // Round steps: 75% -> 25/50/75, 60% -> 20/40/60, and so on.
    var TICKS = { 5: 5, 10: 5, 20: 4, 25: 5, 40: 4, 50: 5, 60: 3, 75: 3, 80: 4, 100: 4 };
    var ticks = TICKS[Math.round(yMax * 100)] || 4, tickEls = [];
    for (var t = 0; t <= ticks; t++) {
      var v = yMax * t / ticks;
      var ln = s("line", { x1: m.l, x2: m.l + iw });
      var lab = s("text", { x: m.l - 8, "text-anchor": "end" });
      lab.textContent = Math.round(v * 100) + "%";
      grid.appendChild(ln); axis.appendChild(lab);
      tickEls.push({ v: v, ln: ln, lab: lab });
    }
    function paintAxis() {
      tickEls.forEach(function (tk) {
        var yy = y(tk.v);
        tk.ln.setAttribute("y1", yy); tk.ln.setAttribute("y2", yy);
        tk.lab.setAttribute("y", yy + 4);
      });
    }
    labelsP.forEach(function (dec, i) {
      var tx = s("text", { y: H - 8, "text-anchor": "middle" });
      // Wide: every step's first year (the last in full); narrow: every other step.
      tx.textContent = i === n - 1 ? (narrow ? "’20–25" : dec) : (narrow ? (i % 2 ? "" : "’" + dec.slice(2, 4)) : dec.slice(0, 4));
      axis.appendChild(tx);
      decadeLabels.push(tx);
    });
    svg.appendChild(grid); svg.appendChild(axis);

    var rule = s("line", { class: "rule", y1: m.t, y2: m.t + ih, x1: 0, x2: 0 });
    svg.appendChild(rule);

    // A clip that lets the stage "draw" the lines left to right as you scroll.
    var clipId = "clip-" + Math.random().toString(36).slice(2, 9);
    var defs = s("defs", {}), clip = s("clipPath", { id: clipId });
    this.clipRect = s("rect", { x: m.l - 10, y: 0, height: H, width: W });
    this.clipGeom = { l: m.l, iw: iw, W: W };
    clip.appendChild(this.clipRect); defs.appendChild(clip); svg.appendChild(defs);
    var groups = lines.map(function (l) {
      var g = s("g", { class: "series", "clip-path": "url(#" + clipId + ")" });
      var path = s("path", { class: l.ref ? "ref" : "", stroke: l.color });
      g.appendChild(path);
      var dots = l.values.map(function () {
        var c = s("circle", { r: l.ref ? 3 : 4.5, fill: l.color });
        g.appendChild(c);
        return c;
      });
      var label = null;
      if (!l.ref || !narrow) {
        label = s("text", { class: "end-label" });
        g.appendChild(label);
      }
      svg.appendChild(g);
      return { l: l, path: path, dots: dots, label: label };
    });
    // Reference line underneath the series.
    groups.slice().reverse().forEach(function (gr) { if (gr.l.ref) { svg.insertBefore(gr.path.parentNode, rule.nextSibling); } });

    this.groups = groups; this.svg = svg;
    var hit = s("rect", { class: "hit", x: m.l - 20, y: 0, width: iw + 40, height: H });
    svg.appendChild(hit);

    var old = this.chart.querySelector("svg");
    if (old) { old.remove(); }
    this.chart.insertBefore(svg, this.tip);
    if (typeof this.reveal === "number") { this.setReveal(this.reveal); }

    function paint(frac) {
      yCur = yFrom + (yMax - yFrom) * frac;
      sCur = sFrom + (sT - sFrom) * frac;
      self.sCur = sCur;
      paintAxis();
      decadeLabels.forEach(function (tx, i) {
        tx.setAttribute("x", x(i));
        tx.setAttribute("opacity", i < sCur - 0.3 ? 0 : 1);
      });
      var labels = [];
      groups.forEach(function (gr) {
        var from = self.prev[gr.l.id] || gr.l.values.map(function () { return 0; });
        var vals = gr.l.values.map(function (p, i) {
          if (p.share === null) { return null; }
          var a = from[i];
          return a === null || a === undefined ? p.share : a + (p.share - a) * frac;
        });
        var d = "", pen = false;
        vals.forEach(function (v, i) {
          if (v === null) { pen = false; return; }
          d += (pen ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1);
          pen = true;
        });
        gr.path.setAttribute("d", d || "M0 0");
        gr.dots.forEach(function (c, i) {
          if (vals[i] === null) { c.setAttribute("display", "none"); return; }
          c.removeAttribute("display");
          c.setAttribute("cx", x(i)); c.setAttribute("cy", y(vals[i]));
        });
        gr.current = vals;
        var li = -1;
        vals.forEach(function (v, i) { if (v !== null) { li = i; } });
        if (gr.label && li >= 0) { labels.push({ gr: gr, i: li, v: vals[li], y: y(vals[li]) }); }
      });
      // Push end labels apart so they never collide.
      labels.sort(function (a, b) { return a.y - b.y; });
      var gap = narrow ? 16 : 34;
      for (var k = 1; k < labels.length; k++) {
        if (labels[k].y - labels[k - 1].y < gap) { labels[k].y = labels[k - 1].y + gap; }
      }
      labels.forEach(function (lb) {
        var tEl = lb.gr.label;
        tEl.textContent = "";
        tEl.setAttribute("x", x(lb.i) + 12);
        tEl.setAttribute("y", lb.y + 4);
        var v = s("tspan", {}); v.textContent = fmtPct(lb.v);
        tEl.appendChild(v);
        if (!narrow) {
          var l2 = s("tspan", { class: "l", x: x(lb.i) + 12, dy: 16 });
          l2.textContent = lb.gr.l.ref ? "All songs" : SHORT[lb.gr.l.key];
          tEl.appendChild(l2);
        }
      });
    }

    function finish() {
      groups.forEach(function (gr) { self.prev[gr.l.id] = gr.l.values.map(function (p) { return p.share; }); });
    }

    if (animate && !reducedMotion()) {
      var start = null, dur = 750;
      var step = function (ts) {
        if (start === null) { start = ts; }
        var tt = Math.min(1, (ts - start) / dur);
        paint(1 - Math.pow(1 - tt, 3));
        if (tt < 1) { requestAnimationFrame(step); } else { finish(); }
      };
      requestAnimationFrame(step);
    } else {
      paint(1); finish();
    }

    // Crosshair + tooltip.
    function move(ev) {
      var r = svg.getBoundingClientRect();
      var px = (ev.clientX - r.left) * (W / r.width);
      var sc = self.sCur || 0;
      var i = Math.max(Math.ceil(sc - 0.3), Math.min(n - 1, Math.round(sc + (px - m.l) / (iw / (n - 1 - sc)))));
      rule.setAttribute("x1", x(i)); rule.setAttribute("x2", x(i));
      self.chart.classList.add("hovering");
      self.tip.textContent = "";
      self.tip.appendChild(h("p", { class: "tip-head", text: labelsP[i] }));
      lines.forEach(function (l) {
        var p = l.values[i];
        var name = l.ref ? "All songs" : (self.filter !== "all" ? filterLabel(self.filter) : SHORT[l.key]);
        self.tip.appendChild(h("p", { class: "tip-row" }, [
          h("i", { style: "background:" + l.color }),
          h("b", { text: p.share === null ? "—" : fmtPct(p.share) }),
          h("span", { text: name }),
          h("small", { text: p.share === null ? (p.n ? "too few songs" : "") : fmtN(p.hits) + "/" + fmtN(p.n) })
        ]));
      });
      var tipX = (x(i) / W) * r.width;
      var tw = self.tip.offsetWidth || 200;
      var left = tipX + 14;
      if (left + tw > r.width) { left = tipX - tw - 14; }
      self.tip.style.left = Math.max(0, left) + "px";
      self.tip.style.top = "8px";
      self.tip.classList.add("on");
    }
    function leave() { self.chart.classList.remove("hovering"); self.tip.classList.remove("on"); }
    hit.addEventListener("pointermove", move);
    hit.addEventListener("pointerdown", move);
    hit.addEventListener("pointerleave", leave);
  };

  /* ---------------- sparkline (small multiples) ---------------- */

  function sparkline(series, ref, yMax) {
    var W = 200, H = 64, n = series.length;
    function x(i) { return 4 + i * (W - 8) / (n - 1); }
    function y(v) { return H - 4 - (v / yMax) * (H - 8); }
    function path(vals) {
      var d = "", pen = false;
      vals.forEach(function (p, i) {
        if (p.share === null) { pen = false; return; }
        d += (pen ? "L" : "M") + x(i).toFixed(1) + " " + y(p.share).toFixed(1); pen = true;
      });
      return d;
    }
    var svg = s("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none", "aria-hidden": "true" });
    var d = path(series);
    if (ref) { svg.appendChild(s("path", { class: "ref", d: path(ref), "vector-effect": "non-scaling-stroke" })); }
    svg.appendChild(s("path", { d: d, "vector-effect": "non-scaling-stroke" }));
    return svg;
  }

  function drawGlance(bd, filter) {
    var host = byId("glance-grid");
    if (!host) { return; }
    host.textContent = "";
    DEBATE_ORDER.forEach(function (deb) {
      (bd.debates[deb] || []).forEach(function (key) {
        var ser = seriesFor(bd, filter, key);
        var ref = filter === "all" ? null : seriesFor(bd, "all", key);
        var all = drawn(ser).concat(ref ? drawn(ref) : []);
        var yMax = niceMax(Math.max(0.04, Math.max.apply(null, all.map(function (p) { return p.share; }))));
        var a = first(ser), b = last(ser);
        host.appendChild(h("div", { class: "mini", title: "Songs that " + LABEL[key] }, [
          h("span", { class: "tag", text: DEBATE_NAME[deb] }),
          h("h4", { text: SHORT[key] }),
          sparkline(ser, ref, yMax),
          h("div", { class: "vals" }, [
            h("span", null, [a ? a.decade + " " : "", h("b", { text: a ? fmtPct(a.share) : "—" })]),
            h("span", null, [b ? b.decade + " " : "", h("b", { text: b ? fmtPct(b.share) : "—" })])
          ])
        ]));
      });
    });
    var leg = byId("glance-legend");
    if (leg) {
      leg.textContent = "";
      leg.appendChild(h("li", null, [h("i", { style: "border-color:var(--s1)" }), filterLabel(filter)]));
      if (filter !== "all") { leg.appendChild(h("li", null, [h("i", { class: "dash", style: "border-color:var(--ref)" }), "All songs"])); }
    }
    fill("glance-note", "Each small chart has its own scale; read the two numbers, not the height. " +
      (filter === "all" ? "" : gapNote(bd, filter, "sex_graphic") + " ") + "The 2020s are 2020–2025.");
  }

  /* ---------------- small tween helper ---------------- */

  function tween(dur, fn, done) {
    if (reducedMotion()) { fn(1); if (done) { done(); } return; }
    var start = null;
    function step(ts) {
      if (start === null) { start = ts; }
      var t = Math.min(1, (ts - start) / dur);
      fn(1 - Math.pow(1 - t, 3));
      if (t < 1) { requestAnimationFrame(step); } else if (done) { done(); }
    }
    requestAnimationFrame(step);
  }

  /* Push labels apart along one axis so none overlap. items: [{pos}] sorted in place. */
  function declutter(items, gap, lo, hi) {
    items.sort(function (a, b) { return a.pos - b.pos; });
    for (var i = 1; i < items.length; i++) {
      if (items[i].pos - items[i - 1].pos < gap) { items[i].pos = items[i - 1].pos + gap; }
    }
    var over = items.length ? items[items.length - 1].pos - hi : 0;
    if (over > 0) {
      items[items.length - 1].pos -= over;
      for (var j = items.length - 2; j >= 0; j--) {
        if (items[j + 1].pos - items[j].pos < gap) { items[j].pos = items[j + 1].pos - gap; }
      }
    }
    items.forEach(function (it) { it.pos = Math.max(lo, it.pos); });
    return items;
  }

  /* ---------------- hatched bars: pencil-shaded, drawn up on arrival ----------------
     groups: [{label, bars: [{value, tone, title}]}]; layout "overlay" draws a
     group's bars on one slot (total behind, subset in front), "side" puts
     them next to each other. Tones: grey, ink, s1, s2. */

  var hatchSeq = 0;
  function HatchBars(host, spec) {
    var self = this;
    this.host = host; this.spec = spec; this.t = reducedMotion() ? 1 : 0;
    this.box = h("div", { class: "hatch" });
    host.appendChild(this.box);
    if (spec.caption) { host.appendChild(sentence(spec.caption, "hatch-caption")); }
    if (typeof ResizeObserver !== "undefined") { new ResizeObserver(function () { self.draw(); }).observe(this.box); }
    this.draw();
    onView(host, function () { self.t = 0; tween(2600, function (t) { self.t = t; self.draw(); }); });
  }

  HatchBars.prototype.set = function (groups) { this.spec.groups = groups; this.draw(); };

  HatchBars.prototype.draw = function () {
    var spec = this.spec, groups = spec.groups, W = Math.max(280, this.box.clientWidth);
    var H = spec.height || Math.round(Math.max(240, Math.min(380, W * 0.42)));
    var m = { t: 12, r: 8, b: 30, l: 40 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
    var max = spec.max || 0;
    groups.forEach(function (g) { g.bars.forEach(function (b) { if (b.value !== null) { max = Math.max(max, b.value); } }); });
    var countStep = 0;
    if (spec.unit === "pct") { max = niceMax(max); }
    else {
      // Counts: a round step giving 3 to 5 gridlines (10, 20, 50, 100 ...).
      countStep = [5, 10, 20, 25, 50, 100, 200, 250, 500].filter(function (st) { return max / st <= 5; })[0] || 1000;
      max = Math.max(countStep, Math.ceil(max / countStep) * countStep);
    }
    var id = "h" + (++hatchSeq);
    var svg = s("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img", "aria-label": spec.aria || "" });
    var defs = s("defs", {});
    ["grey", "ink", "s1", "s2", "r1", "r2", "r3", "r4"].forEach(function (tone) {
      var pat = s("pattern", { id: id + tone, patternUnits: "userSpaceOnUse", width: 6, height: 6, patternTransform: "rotate(-38)" });
      pat.appendChild(s("line", { x1: 0, y1: 0, x2: 0, y2: 6, class: "hatch-line " + tone }));
      defs.appendChild(pat);
    });
    var f = s("filter", { id: id + "r", x: "-5%", y: "-5%", width: "110%", height: "110%" });
    f.appendChild(s("feTurbulence", { type: "fractalNoise", baseFrequency: "0.06", numOctaves: 2, seed: 3, result: "n" }));
    f.appendChild(s("feDisplacementMap", { in: "SourceGraphic", in2: "n", scale: 3.2 }));
    defs.appendChild(f); svg.appendChild(defs);
    var TK = { 5: 5, 10: 5, 20: 4, 25: 5, 40: 4, 50: 5, 60: 3, 75: 3, 80: 4, 100: 4 };
    var ticks = spec.unit === "pct" ? (TK[Math.round(max * 100)] || 4) : Math.round(max / countStep);
    for (var k = 0; k <= ticks; k++) {
      var v = max * k / ticks, yy = m.t + ih - v / max * ih;
      svg.appendChild(s("line", { class: "hatch-grid", x1: m.l, x2: W - m.r, y1: yy, y2: yy }));
      var tl = s("text", { class: "hatch-tick", x: m.l - 8, y: yy + 4, "text-anchor": "end" });
      tl.textContent = spec.unit === "pct" ? Math.round(v * 100) + "%" : fmtN(Math.round(v));
      svg.appendChild(tl);
    }
    var slot = iw / groups.length, t = this.t;
    var layer = s("g", { filter: "url(#" + id + "r)" });
    groups.forEach(function (g, gi) {
      var x0 = m.l + gi * slot, side = spec.layout === "side", nb = g.bars.length;
      var bw = side ? Math.min(34, slot * 0.8 / nb) : Math.min(46, slot * 0.62);
      g.bars.forEach(function (b, bi) {
        if (b.value === null) { return; }
        var local = Math.max(0, Math.min(1, t * 1.6 - gi * 0.06));
        var hgt = b.value / max * ih * local;
        var bx = side ? x0 + slot / 2 - (nb * bw) / 2 + bi * bw + 2 : x0 + slot / 2 - bw / 2;
        var r = s("rect", { x: bx, y: m.t + ih - hgt, width: side ? bw - 4 : bw, height: Math.max(0, hgt), fill: "url(#" + id + b.tone + ")" });
        var tt = s("title", {}); tt.textContent = b.title || ""; r.appendChild(tt);
        layer.appendChild(r);
      });
      var lab = s("text", { class: "hatch-label", x: x0 + slot / 2, y: H - 8, "text-anchor": "middle" });
      lab.textContent = g.short || g.label;
      svg.appendChild(lab);
    });
    svg.appendChild(layer);
    var old = this.box.querySelector("svg"); if (old) { old.remove(); }
    this.box.appendChild(svg);
  };

  function drawRapRnbBars(host, bd, key, noun) {
    if (!host) { return; }
    var rows = rapRnbCounts(bd, key), last = rows[rows.length - 1];
    host.appendChild(sentence(["How many of those songs were rap or R&B?"], "story-line"));
    host.appendChild(h("ul", { class: "legend race-legend" }, [
      h("li", null, [h("i", { class: "hatch-key grey" }), "songs that " + LABEL[key]]),
      h("li", null, [h("i", { class: "hatch-key ink" }), "…that was rap or R&B"])]));
    new HatchBars(host, {
      unit: "count", layout: "overlay",
      aria: "Songs per decade that " + LABEL[key] + ", and how many were rap or R&B",
      groups: rows.map(function (r, i) { return { label: r.label, short: i % 2 && i !== rows.length - 1 ? " " : "’" + r.label.slice(2, 4), bars: [
        { value: r.total, tone: "grey", title: r.label + ": " + r.total + " songs " + LABEL[key] },
        { value: r.sub, tone: "ink", title: r.label + ": " + r.sub + " of them rap or R&B" }] }; }),
      caption: ["Songs in each five-year step that " + LABEL[key] + ", with the ", { mark: "rap or R&B songs" }, " among them. In " + last.label + ", " +
        fmtN(last.sub) + " of " + fmtN(last.total) + ". The last step covers six years."]
    });
  }

  /* A labelled grid of shaded squares: rows × columns, each square showing
     its share. Same ramp as the heatmap; text flips to light on dark squares. */
  function numberGrid(host, rows, cols, cell, opts) {
    host.textContent = "";
    var max = 0;
    rows.forEach(function (r) { cols.forEach(function (c) { var v = cell(r, c); if (v) { max = Math.max(max, v.share); } }); });
    var ramp = isDark() ? RAMP_DARK : RAMP_LIGHT;
    var t = h("table", { class: "ngrid" + (opts && opts.cls ? " " + opts.cls : "") });
    var hr = h("tr", null, [h("th", { text: "" })]);
    cols.forEach(function (c) { hr.appendChild(h("th", { scope: "col", text: c.label })); });
    t.appendChild(hr);
    rows.forEach(function (r) {
      var tr = h("tr", null, [h("th", { scope: "row", text: r.label })]);
      cols.forEach(function (c, ci) {
        var v = cell(r, c);
        if (!v) { tr.appendChild(h("td", { class: "empty", text: "–", title: "Too few songs" })); return; }
        var f = max ? v.share / max : 0, bg = rampAt(Math.sqrt(f), ramp);
        var lightText = isDark() ? f < 0.55 : f > 0.45;
        tr.appendChild(h("td", { style: "background:" + bg + ";color:" + (lightText ? "#f6f2e8" : "#141311") + ";--ci:" + ci,
          title: v.hits + " of " + v.n + " songs" }, [h("b", { text: fmtPct(v.share, 0) })]));
      });
      t.appendChild(tr);
    });
    host.appendChild(t);
    onView(host, function () { t.classList.add("in"); });
  }

  function drawRace(race) {
    var sec = byId("race");
    if (!sec || !race) { return; }
    var view = "all_labels", m = RACE_MEASURES[0].key;
    var legend = byId("race-legend");
    if (legend) { legend.remove(); }
    var genreLegend = sec.querySelector("#race-genre") ? sec.querySelector("#race-genre").previousElementSibling : null;
    if (genreLegend && genreLegend.classList.contains("legend")) { genreLegend.remove(); }
    var groups = RACE_SHOWN.map(function (g) { return { id: g, label: race.group_labels[g] }; });
    var decades = race.decades.map(function (d) { return { id: d, label: "’" + d.slice(2) }; });
    function grids() {
      numberGrid(byId("race-decades"), groups, decades, function (g, d) { return raceShare(race, view, "by_group_decade", g.id + "|" + d.id, m); });
      var inside = raceInsideGenre(race, view, m);
      numberGrid(byId("race-genre"), [{ id: "black", label: "Black lead artist" }, { id: "white", label: "White lead artist" }],
        inside.map(function (x, i) { return { id: i, label: x.label }; }),
        function (g, c) { return inside[c.id][g.id]; }, { cls: "wide" });
    }
    function words() {
      var g = raceInsideGenre(race, view, m), d = raceDecades(race, view, m), lastD = d[d.length - 1];
      fill("race-lead", "In the " + lastD.label + ", " + (lastD.black ? fmtPct(lastD.black.share) : "—") + " of songs by Black lead artists " + LABEL[m] +
        ", against " + (lastD.white ? fmtPct(lastD.white.share) : "—") + " by white lead artists.");
      fill("race-genre-line", "Inside rap and R&B: " + fmtPct(g[0].black.share) + " against " + fmtPct(g[0].white.share) +
        ". Everywhere else: " + fmtPct(g[1].black.share) + " against " + fmtPct(g[1].white.share) +
        ". Genre accounts for part of the gap, not all of it.");
    }
    grids(); words();
    function redraw() { grids(); words(); }
    pillGroup(byId("race-measure"), RACE_MEASURES.map(function (x) { return { id: x.key, label: x.label }; }), m, function (id) { m = id; redraw(); });
    var cb = byId("race-high");
    if (cb) { cb.addEventListener("change", function () { view = cb.checked ? "high_confidence" : "all_labels"; redraw(); }); }
    document.addEventListener("themechange", grids);
    fill("race-note", fmtN(race.all_labels.n_songs - (race.all_labels.by_group.unknown || { n_songs: 0 }).n_songs) + " of " + fmtN(race.all_labels.n_songs) +
      " songs carry a label for the billed lead artist. Groups with fewer than " + race.min_n + " songs in a decade are not shown (–). " +
      fmtN(race.high_confidence.n_songs) + " labels are marked high-confidence; tick the box to see only those.");
  }


  /* ---------------- the school bus ---------------- */

  function drawBus(host, bd) {
    if (!host) { return; }
    var b = busSeats(bd);
    var head = h("p", { class: "story-line bus-line" });
    host.appendChild(head);
    var W = 560, H = 250, svg = s("svg", { class: "bus", viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": "A 40-seat school bus: " + b.then + " violent songs in the " + b.from + ", " + b.now + " in the " + b.to + ", " + b.hipHop + " of them hip-hop" });
    // body, windshield, wheels, door: seen from above
    svg.appendChild(s("rect", { class: "bus-body", x: 20, y: 30, width: 500, height: 190, rx: 26 }));
    svg.appendChild(s("rect", { class: "bus-nose", x: 500, y: 52, width: 40, height: 146, rx: 18 }));
    svg.appendChild(s("rect", { class: "bus-glass", x: 506, y: 66, width: 20, height: 118, rx: 8 }));
    [[70, 18], [70, 222], [430, 18], [430, 222]].forEach(function (w) { svg.appendChild(s("rect", { class: "bus-wheel", x: w[0], y: w[1] - 8, width: 46, height: 16, rx: 6 })); });
    svg.appendChild(s("line", { class: "bus-aisle", x1: 40, x2: 480, y1: 125, y2: 125 }));
    var seats = [];
    for (var col = 0; col < 10; col++) {
      [0, 1, 2, 3].forEach(function (r) {
        var x = 44 + col * 44, y = [46, 82, 134, 170][r];
        var g = s("g", { class: "seat" });
        g.appendChild(s("rect", { x: x, y: y, width: 34, height: 30, rx: 7 }));
        g.appendChild(s("path", { class: "seat-note", d: "M" + (x + 19) + " " + (y + 21) + " v-11 l6 -2 v11", fill: "none" }));
        g.appendChild(s("circle", { class: "seat-note", cx: x + 17, cy: y + 21, r: 2.4 }));
        svg.appendChild(g);
        seats.push(g);
      });
    }
    host.appendChild(svg);
    var key = h("ul", { class: "legend bus-key" }, [
      h("li", null, [h("i", { class: "seat-key on" }), "threatens or carries out violence"]),
      h("li", null, [h("i", { class: "seat-key hh" }), "…and is a hip-hop song"])]);
    host.appendChild(key);
    var busNote = addNote("The school bus is a picture of the numbers, not of a real bus: each seat stands for one song from that decade’s charts, 40 to a bus.");
    if (busNote) { key.appendChild(h("li", null, [noteMark(busNote)])); }
    // spread the lit seats around the bus, the same order every time
    var order = seats.map(function (_, i) { return i; }).sort(function (x, y) { return ((x * 37) % 41) - ((y * 37) % 41); });
    function state(n, hh, label, parts) {
      seats.forEach(function (g) { g.classList.remove("on", "hh"); });
      order.slice(0, n).forEach(function (i, k) {
        setTimeout(function () { seats[i].classList.add("on"); if (k < hh) { seats[i].classList.add("hh"); } }, reducedMotion() ? 0 : k * 160);
      });
      head.textContent = "";
      Array.prototype.slice.call(sentence(parts, "x").childNodes).forEach(function (c) { head.appendChild(c); });
    }
    var thenParts = ["Picture a school bus where every seat plays a different song. On a bus of " + b.from + " songs, ", { mark: b.then + " of 40" }, " songs threaten or carry out violence."];
    var nowParts = ["On a bus of " + b.to + " songs, ", { mark: b.now + " of 40" }, " do, and ", { mark: b.hipHop + " of those " + b.now }, " are hip-hop."];
    state(0, 0, "", thenParts);
    onView(host, function () {
      state(b.then, 0, b.from, thenParts);
      setTimeout(function () { state(b.now, b.hipHop, b.to, nowParts); }, reducedMotion() ? 0 : 3200);
    });
  }

  /* ---------------- the birthday party ---------------- */

  function drawParty(host, kids) {
    if (!host) { return; }
    var p = partyCards(kids), bad = Math.floor(p.n / 2);
    var W = 560, H = 360, cx = 280;
    var svg = s("svg", { class: "party", viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": p.n + " song cards at a birthday party; one describes sex explicitly" });
    // the cake, in the site's line-art style
    var cake = s("g", { class: "draw cake", stroke: "var(--ink)", "stroke-width": 3, fill: "var(--surface)" });
    cake.appendChild(s("path", { pathLength: 1, style: "--d:0s", d: "M190 300 H370 V250 C370 240 360 236 350 236 H210 C200 236 190 240 190 250 Z" }));
    cake.appendChild(s("path", { pathLength: 1, style: "--d:.3s", d: "M210 236 V206 C210 198 216 194 224 194 H336 C344 194 350 198 350 206 V236", fill: "var(--paper-2)" }));
    cake.appendChild(s("path", { pathLength: 1, style: "--d:.6s", d: "M190 262 C205 272 220 256 235 266 C250 276 265 258 280 266 C295 276 310 258 325 266 C340 276 355 258 370 264", fill: "none", stroke: "var(--s1)" }));
    [240, 280, 320].forEach(function (x, i) {
      cake.appendChild(s("path", { pathLength: 1, style: "--d:" + (0.9 + i * 0.15) + "s", d: "M" + x + " 194 V172", fill: "none" }));
    });
    svg.appendChild(cake);
    [240, 280, 320].forEach(function (x, i) {
      svg.appendChild(s("path", { class: "flame", style: "--i:" + i, d: "M" + x + " 168 C" + (x - 6) + " 160 " + x + " 152 " + x + " 148 C" + (x + 2) + " 154 " + (x + 7) + " 160 " + x + " 168 Z" }));
    });
    svg.appendChild(s("line", { x1: 150, x2: 410, y1: 302, y2: 302, stroke: "var(--rule-strong)", "stroke-width": 2 }));
    host.appendChild(svg);
    // the cards: HTML, so they can flip in 3D
    var fan = h("div", { class: "fan" });
    for (var i = 0; i < p.n; i++) {
      var ang = -50 + i * (100 / (p.n - 1));
      var card = h("div", { class: "card" + (i === bad ? " bad" : ""), style: "--a:" + ang.toFixed(1) + "deg; --i:" + i }, [
        h("div", { class: "card-in" }, [
          h("div", { class: "card-face front" }, [h("span", { class: "card-note", text: "♪" }), h("span", { text: "kids’ pick" })]),
          h("div", { class: "card-face back" }, [h("b", { text: "explicit" }), h("span", { text: "describes sex" })])])]);
      fan.appendChild(card);
    }
    host.insertBefore(fan, svg);
    var partyLine = sentence([{ mark: "1 in " + p.n }, " songs chosen for kids describes sex explicitly or graphically."], "fact-line");
    host.appendChild(partyLine);
    var pk = addNote("Birthday party: " + fmtN(p.hits) + " of " + fmtN(p.total) + " songs picked by the Kids’ Choice Awards and Kidz Bop, counted on the original adult recording. Kidz Bop sings rewritten versions.");
    if (pk) { partyLine.appendChild(noteMark(pk)); }
    onView(host, function () {
      host.classList.add("in");
      setTimeout(function () { host.classList.add("fanned"); }, reducedMotion() ? 0 : 900);
      setTimeout(function () { host.classList.add("flipped"); }, reducedMotion() ? 0 : 2600);
    });
  }

  /* ---------------- heatmap: every year, every measure ----------------
     Rows are measures, columns are the 66 years. Each cell is shaded on one
     ramp, by default against that row's own peak (so a small theme and a
     large one both show when they took off); "actual share" puts every row
     on one scale. Colour sweeps in from 1960 on arrival. */

  var HEAT_ROWS = [
    ["Sex", ["sex_graphic_or_explicit", "sex_graphic", "sex_objectifying"]],
    ["Violence", ["violence_beyond_mention", "violence_celebrated", "weapon_named"]],
    ["Drugs", ["drugs_use_or_sale", "drugs_glorified", "alcohol", "drugs_opioids_pills"]],
    ["Money", ["money_flex", "brands_named"]],
    ["Everything else", ["profanity_strong", "mental_health_described"]]
  ];
  var RAMP_LIGHT = ["#eef4f2", "#c4e2dc", "#86c3bc", "#4598a3", "#22627c", "#152f4a"];
  var RAMP_DARK = ["#1b2427", "#1e4448", "#2b6d70", "#43999a", "#7cc9c1", "#d2f2ec"];

  function heatRows(bd) {
    var years = Object.keys(bd.by_year || {}).sort();
    var rows = [];
    HEAT_ROWS.forEach(function (g) {
      g[1].forEach(function (key, i) {
        var vals = years.map(function (y) { var c = bd.by_year[y]; return { year: y, share: c.measures[key].n / c.n_songs, hits: c.measures[key].n, n: c.n_songs }; });
        var max = Math.max.apply(null, vals.map(function (v) { return v.share; }));
        rows.push({ key: key, group: i === 0 ? g[0] : null, label: SHORT[key], vals: vals, max: max });
      });
    });
    return { years: years, rows: rows };
  }

  function rampAt(t, ramp) {
    t = Math.max(0, Math.min(1, t));
    var x = t * (ramp.length - 1), i = Math.min(ramp.length - 2, Math.floor(x)), f = x - i;
    var a = ramp[i], b = ramp[i + 1];
    function ch(hex, k) { return parseInt(hex.slice(1 + k * 2, 3 + k * 2), 16); }
    var out = "#";
    for (var k = 0; k < 3; k++) { var v = Math.round(ch(a, k) + (ch(b, k) - ch(a, k)) * f); out += (v < 16 ? "0" : "") + v.toString(16); }
    return out;
  }

  function drawHeatmap(host, bd) {
    if (!host) { return; }
    var data = heatRows(bd), mode = "row", self = {};
    var dark = isDark;
    var controls = h("div", { class: "heat-controls" });
    host.appendChild(controls);
    pillGroup(controls, [{ id: "row", label: "Against its own peak" }, { id: "abs", label: "Actual share" }], mode, function (id) { mode = id; paint(); });
    var box = h("div", { class: "heat" });
    host.appendChild(box);
    var legend = h("div", { class: "heat-legend" }, [h("span", { text: "Lowest" }), h("i", { class: "heat-ramp" }), h("span", { text: "Highest" })]);
    var note = h("p", { class: "hatch-caption" });
    host.appendChild(legend); host.appendChild(note);
    var cells = [], shown = reducedMotion();
    function build() {
      var W = Math.max(300, box.clientWidth), narrow = W < 600;
      var lw = narrow ? 118 : 200, top = 22, rh = narrow ? 18 : 22, gapG = 12;
      var nG = HEAT_ROWS.length, cols = data.years.length, cw = (W - lw - 4) / cols;
      var H = top + data.rows.length * rh + (nG - 1) * gapG + 4;
      var svg = s("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img",
        "aria-label": "Heatmap of " + data.rows.length + " measures across " + cols + " years" });
      data.years.forEach(function (y, c) {
        if (+y % 10 === 0 || c === cols - 1) {
          var t = s("text", { class: "heat-year", x: lw + c * cw + cw / 2, y: 13, "text-anchor": c === cols - 1 ? "end" : "middle" });
          t.textContent = narrow && c !== cols - 1 ? "’" + y.slice(2) : y;
          svg.appendChild(t);
        }
      });
      cells = [];
      var y0 = top, gi = -1;
      data.rows.forEach(function (row) {
        if (row.group) {
          gi++;
          if (gi > 0) { y0 += gapG; }
          var gl = s("text", { class: "heat-group", x: 0, y: y0 - 3 }); gl.textContent = "";
        }
        var lab = s("text", { class: "heat-label" + (row.group ? " first" : ""), x: lw - 8, y: y0 + rh * 0.68, "text-anchor": "end" });
        lab.textContent = row.label;
        svg.appendChild(lab);
        row.vals.forEach(function (v, c) {
          var r = s("rect", { class: "heat-cell", x: (lw + c * cw).toFixed(2), y: y0 + 1, width: Math.max(1, cw - 0.8).toFixed(2), height: rh - 2,
            style: "transition-delay:" + (shown ? 0 : c * 45) + "ms" });
          r._v = v; r._row = row;
          svg.appendChild(r); cells.push(r);
        });
        y0 += rh;
      });
      var old = box.querySelector("svg"); if (old) { old.remove(); }
      box.appendChild(svg);
      paint();
    }
    function paint() {
      var ramp = dark() ? RAMP_DARK : RAMP_LIGHT;
      var gmax = Math.max.apply(null, data.rows.map(function (r) { return r.max; }));
      cells.forEach(function (c) {
        var t = mode === "row" ? (c._row.max ? c._v.share / c._row.max : 0) : c._v.share / gmax;
        c.setAttribute("fill", rampAt(Math.sqrt(t), ramp));
        c.classList.toggle("in", shown);
      });
      legend.querySelector(".heat-ramp").style.background = "linear-gradient(90deg," + ramp.join(",") + ")";
      note.textContent = mode === "row"
        ? "Each row is shaded against its own highest year, so a rare theme and a common one both show when they took off."
        : "Every row on one scale: the darkest square is the highest share of any measure in any year (" + fmtPct(gmax) + ").";
    }
    if (typeof ResizeObserver !== "undefined") { var lastW = 0; new ResizeObserver(function () { var w = box.clientWidth; if (Math.abs(w - lastW) > 4) { lastW = w; build(); } }).observe(box); }
    build();
    onView(host, function () { shown = true; cells.forEach(function (c) { c.classList.add("in"); }); });
    document.addEventListener("themechange", paint);
  }

  /* ---------------- the chart, and what kids' lists took from it ---------------- */

  var PICK_MEASURES = [
    { key: "sex_graphic_or_explicit", label: "Explicit sex", noun: "describe sex explicitly" },
    { key: "drugs_use_or_sale", label: "Drug use", noun: "describe drug use or dealing" },
    { key: "violence_beyond_mention", label: "Violence", noun: "threaten or carry out violence" },
    { key: "profanity_strong", label: "Strong swearing", noun: "use strong swearing" }
  ];

  function kidsPicked(bd, key) {
    var k = bd.kids_picked_by_year || {}, years = Object.keys(k).sort();
    var rows = years.map(function (y) {
      var c = k[y];
      return { year: y, all: c.measures[key].n, picked: (c.measures_picked[key] || { n: 0 }).n, songs: c.n_songs, songsPicked: c.n_picked };
    });
    var sum = function (f) { return rows.reduce(function (a, r) { return a + r[f]; }, 0); };
    return { rows: rows, all: sum("all"), picked: sum("picked"), songs: sum("songs"), songsPicked: sum("songsPicked"),
             from: years[0], to: years[years.length - 1] };
  }

  function drawKidsPicked(host, bd, sec) {
    if (!host) { return; }
    var m = PICK_MEASURES[0], t = kidsPicked(bd, m.key);
    var fact = factBlock({ big: String(t.picked), parts: ["Of the ", { mark: fmtN(t.all) }, " chart songs since " + t.from + " that describe sex explicitly, ",
      { mark: fmtN(t.picked) }, " were picked for kids: re-recorded by Kidz Bop for children, or put up for kids’ votes at the Kids’ Choice Awards."],
      note: t.from + "–" + t.to + ": " + fmtN(t.songs) + " Year-End chart songs, " + fmtN(t.songsPicked) + " of them picked by Kidz Bop or the Kids’ Choice Awards. " +
        "Explicit sex: " + fmtN(t.all) + " chart songs, " + fmtN(t.picked) + " picked. Counted on the original recording; Kidz Bop sings a rewritten version. Teen Choice and Radio Disney not included." }, sec);
    host.appendChild(fact);
    var line = h("p", { class: "story-line" });
    host.appendChild(line);
    var pills = h("div", { class: "pills pick-pills", role: "group", "aria-label": "Measure" });
    host.appendChild(pills);
    host.appendChild(h("ul", { class: "legend race-legend" }, [
      h("li", null, [h("i", { class: "hatch-key grey" }), "every chart song that year"]),
      h("li", null, [h("i", { class: "hatch-key s1" }), "…picked for kids"])]));
    var chartHost = h("div");
    host.appendChild(chartHost);
    function groups() {
      return t.rows.map(function (r) { return { label: r.year, short: "’" + r.year.slice(2), bars: [
        { value: r.all, tone: "grey", title: r.year + ": " + r.all + " chart songs " + m.noun },
        { value: r.picked, tone: "s1", title: r.year + ": " + r.picked + " of them picked for kids" }] }; });
    }
    function words() {
      line.textContent = "";
      Array.prototype.slice.call(sentence(["Every year since " + t.from + ", in grey, the chart songs that " + m.noun + ". In colour, the ones kids’ lists took: ",
        { mark: fmtN(t.picked) + " of " + fmtN(t.all) }, "."], "x").childNodes).forEach(function (c) { line.appendChild(c); });
    }
    words();
    var bars = new HatchBars(chartHost, { unit: "count", layout: "overlay", groups: groups(), aria: "Chart songs per year and those picked for kids" });
    pillGroup(pills, PICK_MEASURES.map(function (x) { return { id: x.key, label: x.label }; }), m.key, function (id) {
      m = PICK_MEASURES.filter(function (x) { return x.key === id; })[0]; t = kidsPicked(bd, id); bars.set(groups()); words();
    });
  }

  /* ---------------- topic art: one cut-paper drawing per chapter ----------------
     Same paper filter as the interlude (#paper-fx, defined once in the page).
     Each drawing is built here and plays once when it is well into view. */

  function rnd(seed) { var x = seed; return function () { x = (x * 9301 + 49297) % 233280; return x / 233280; }; }

  var ART = {
    sex: function () {
      var grooves = "";
      for (var r = 44; r <= 96; r += 7) { grooves += '<circle cx="0" cy="0" r="' + r + '" fill="none" stroke="#3a3440" stroke-width="1.5"/>'; }
      return '<g transform="translate(180 132)">' +
        '<g class="spin"><g class="piece" style="--i:0" filter="url(#paper-fx)"><circle r="104" fill="#1d1a20" stroke="#f6efe0" stroke-width="5"/></g>' + grooves +
        '<g class="piece" style="--i:1" filter="url(#paper-fx)"><circle r="34" fill="#e05a8a" stroke="#f6efe0" stroke-width="4"/><circle r="5" fill="#1d1a20"/></g></g>' +
        '<g class="stamp" filter="url(#paper-fx)" transform="translate(36 -40) rotate(-14)">' +
        '<path d="M-44 0 C-34 -20 -14 -24 0 -11 C14 -24 34 -20 44 0 C22 7 -22 7 -44 0 Z" fill="#d7263d" stroke="#f6efe0" stroke-width="3"/>' +
        '<path d="M-44 2 C-22 8 22 8 44 2 C30 26 -30 26 -44 2 Z" fill="#c21f35" stroke="#f6efe0" stroke-width="3"/></g></g>';
    },
    violence: function () {
      var out = '<g transform="translate(180 128)">', n = 7, R = rnd(5);
      for (var i = 0; i < n; i++) {
        var a0 = i / n * Math.PI * 2 + (R() - 0.5) * 0.25, a1 = (i + 1) / n * Math.PI * 2 + (R() - 0.5) * 0.25;
        var mid = (a0 + a1) / 2, dx = Math.cos(mid) * (18 + R() * 22), dy = Math.sin(mid) * (18 + R() * 22), rot = (R() - 0.5) * 30;
        var p = function (a, r) { return (Math.cos(a) * r).toFixed(1) + " " + (Math.sin(a) * r).toFixed(1); };
        out += '<g class="shard" style="--dx:' + dx.toFixed(1) + 'px;--dy:' + dy.toFixed(1) + 'px;--r:' + rot.toFixed(1) + 'deg;--i:' + i + '" filter="url(#paper-fx)">' +
          '<path d="M' + p(a0, 6) + ' L' + p(a0, 98) + ' A98 98 0 0 1 ' + p(a1, 98) + ' L' + p(a1, 6) + ' Z" fill="#1c1a1d" stroke="#f6efe0" stroke-width="4"/>' +
          '<path d="M' + p(a0, 8) + ' L' + p(a0, 32) + ' A32 32 0 0 1 ' + p(a1, 32) + ' L' + p(a1, 8) + ' Z" fill="#c8553d"/></g>';
      }
      for (var k = 0; k < 9; k++) {
        var ang = R() * Math.PI * 2, dist = 110 + R() * 40;
        out += '<path class="bit" style="--i:' + k + '" d="M' + (Math.cos(ang) * dist).toFixed(1) + ' ' + (Math.sin(ang) * dist).toFixed(1) + ' l' + (6 + R() * 8).toFixed(1) + ' ' + (R() * 6 - 3).toFixed(1) + ' l' + (-4 + R() * 3).toFixed(1) + ' ' + (5 + R() * 5).toFixed(1) + ' Z" fill="#1c1a1d" stroke="#f6efe0" stroke-width="2"/>';
      }
      return out + '</g>';
    },
    drugs: function () {
      var pills = "", R = rnd(11);
      for (var i = 0; i < 9; i++) {
        var x = 150 + i * 22 + R() * 10, y = 196 + R() * 18 - (i % 2) * 6, rot = R() * 180;
        var c1 = ["#f2f0ea", "#e0605a", "#6fb0e0", "#f2c94c"][i % 4];
        pills += '<g class="pill" style="--i:' + i + ';--tx:' + (x - 112).toFixed(0) + 'px;--ty:' + (y - 150).toFixed(0) + 'px;--r:' + rot.toFixed(0) + 'deg" filter="url(#paper-fx)">' +
          '<rect x="-12" y="-5" width="24" height="10" rx="5" fill="' + c1 + '" stroke="#f6efe0" stroke-width="2"/><rect x="0" y="-5" width="12" height="10" rx="5" fill="#f2f0ea"/></g>';
      }
      return '<g transform="translate(112 150) rotate(-72)"><g class="piece" style="--i:0" filter="url(#paper-fx)">' +
        '<rect x="-38" y="-10" width="76" height="120" rx="8" fill="#e8892f" fill-opacity=".92" stroke="#f6efe0" stroke-width="5"/>' +
        '<rect x="-30" y="26" width="60" height="50" rx="3" fill="#fbf4df"/><path d="M-22 40 H22 M-22 52 H14 M-22 64 H18" stroke="#c7bfae" stroke-width="3"/></g></g>' +
        '<g transform="translate(112 150) rotate(-72)"><g class="piece" style="--i:1" filter="url(#paper-fx)"><rect x="-44" y="-40" width="88" height="32" rx="6" fill="#f6f2e8" stroke="#f6efe0" stroke-width="4"/>' +
        '<path d="M-36 -34 V-14 M-24 -34 V-14 M-12 -34 V-14 M0 -34 V-14 M12 -34 V-14 M24 -34 V-14 M36 -34 V-14" stroke="#d9d2c2" stroke-width="2"/></g></g>' +
        '<g transform="translate(112 150)">' + pills + '</g>' +
        '<path d="M30 226 H340" stroke="#b9875a" stroke-width="5" stroke-linecap="round" filter="url(#paper-fx)"/>';
    },
    money: function () {
      var bills = "", R = rnd(3);
      for (var i = 0; i < 16; i++) {
        var x = 60 + R() * 240, y = 150 + R() * 60, rot = (R() - 0.5) * 70;
        bills += '<g class="bill" style="--i:' + i + ';--x:' + x.toFixed(0) + 'px;--y:' + y.toFixed(0) + 'px;--r:' + rot.toFixed(0) + 'deg;--s:' + (R() * 40 - 20).toFixed(0) + 'deg" filter="url(#paper-fx)">' +
          '<rect x="-34" y="-16" width="68" height="32" rx="3" fill="#7cb38a" stroke="#f6efe0" stroke-width="3"/>' +
          '<rect x="-27" y="-10" width="54" height="20" rx="2" fill="none" stroke="#4f8a5f" stroke-width="2"/><circle r="7" fill="#e7f1e3"/><text y="4" text-anchor="middle" font-size="10" font-weight="700" fill="#3f7350">$</text></g>';
      }
      return bills + '<path d="M40 232 H320" stroke="#b9875a" stroke-width="5" stroke-linecap="round" filter="url(#paper-fx)"/>';
    },
    race: function () {
      var out = '<g class="piece" style="--i:0" filter="url(#paper-fx)"><rect x="40" y="30" width="280" height="200" rx="14" fill="#2c2a33" stroke="#f6efe0" stroke-width="5"/></g>';
      var cols = ["#8a4fb8", "#d9822b", "#2a7fc4", "#3f9a4a"], lv = [0.2, 0.75, 0.45, 0.6];
      for (var i = 0; i < 4; i++) {
        var x = 88 + i * 62;
        out += '<g class="piece" style="--i:' + (i + 1) + '" filter="url(#paper-fx)"><circle cx="' + x + '" cy="62" r="12" fill="' + cols[i] + '" stroke="#f6efe0" stroke-width="3"/></g>' +
          '<rect x="' + (x - 3) + '" y="92" width="6" height="118" rx="3" fill="#46434e"/>' +
          '<g class="fader" style="--i:' + i + ';--to:' + (-(lv[i] * 100)).toFixed(0) + 'px" filter="url(#paper-fx)"><rect x="' + (x - 18) + '" y="194" width="36" height="16" rx="3" fill="#f2efe6" stroke="#f6efe0" stroke-width="2"/><path d="M' + (x - 12) + ' 202 H' + (x + 12) + '" stroke="' + cols[i] + '" stroke-width="3"/></g>';
      }
      return out;
    }
  };

  function drawTopicArt() {
    ["sex", "violence", "drugs", "money", "race"].forEach(function (ch) {
      var sec = byId(ch), head = sec && sec.querySelector(".chapter-head");
      if (!head || !ART[ch]) { return; }
      var wrap = h("div", { class: "topic-art art-" + ch });
      wrap.innerHTML = '<svg viewBox="0 0 360 260" aria-hidden="true">' + ART[ch]() + "</svg>";
      head.parentNode.insertBefore(wrap, head.nextSibling);
      onView(wrap, function () { wrap.classList.add("in"); });
    });
  }

  /* ---------------- the opening kid ----------------
     A cut-paper kid in headphones, drawn in the page's paper style. The kid
     bobs along on their own; scrolling moves the mood from joy to
     frustration: the sound waves and notes flowing into the headphones turn
     from bright to dark and from smooth to jagged, the card darkens, the
     face changes, and the hands come up to grip the headphones. */

  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function mix(c1, c2, t) { return rampAt(t, [c1, c2]); }

  /* The opening scene: an original, lofi-style room drawn in code. A kid in
     big headphones nods along with his eyes closed while the cat's tail
     sways, the mug steams and clouds drift past the window. Flat cel
     shading with warm dark-brown linework; nothing moves unless it should. */
  /* The opening: a mostly still line drawing of a kid listening to music.
     It reuses the headphone kid from the Kids chapter (moved up, not copied),
     drawn in once, with the notes drifting slowly. */
  /* The opening: a still cut-paper frame, same style as the interlude (torn
     paper edges, marker texture) but daytime: a kid sitting cross-legged in
     headphones, eyes closed and smiling, a record player beside them. Only
     the notes drift. */
  /* The opening: four lines arrive one by one on the dark page. Scrolling
     fades them out and fades the title and chapter index in, in place. The
     state glides toward the scroll position so nothing snaps. */
  function Opener(root) {
    if (!root) { return; }
    root.classList.add("play");
    if (reducedMotion()) { return; }
    var intro = root.querySelector(".opener-intro"), title = root.querySelector(".opener-title"),
        cue = root.querySelector(".opener-cue");
    function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function smooth(v) { v = clamp(v); return v * v * (3 - 2 * v); }
    function target() {
      var r = root.getBoundingClientRect(), run = r.height - window.innerHeight;
      return run > 0 ? clamp(-r.top / run) : 1;
    }
    var p = target(), running = false;
    function paint(q) {
      var out = smooth(q / .3), show = smooth((q - .35) / .3);
      intro.style.opacity = (1 - out).toFixed(3);
      intro.style.filter = "blur(" + (6 * out).toFixed(1) + "px)";
      cue.style.visibility = q > .02 ? "hidden" : "";
      title.style.opacity = show.toFixed(3);
      title.style.filter = "blur(" + (6 * (1 - show)).toFixed(1) + "px)";
      title.classList.toggle("live", show > .6);
    }
    function frame() {
      var t = target();
      p += (t - p) * .1;
      if (Math.abs(t - p) < .0005) { p = t; running = false; } else { requestAnimationFrame(frame); }
      paint(p);
    }
    function kick() { if (!running) { running = true; requestAnimationFrame(frame); } }
    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", kick);
    paint(p);
  }

  /* The chapter home screen: round bubble icons that float like the PS Vita
     home screen, each holding a small cut-paper drawing of its topic (same
     torn-paper filter as the chapter drawings). */
  var ICONS = {
    glance: function () {
      var cells = "", ramp = ["#3b3a52", "#5b4a7a", "#8a4f8f", "#c2577f", "#e8795f", "#f4b25c"];
      for (var r = 0; r < 3; r++) { for (var c = 0; c < 4; c++) {
        cells += '<rect class="vi-cell" style="--c:' + (c + r) + '" x="' + (22 + c * 14.5) + '" y="' + (32 + r * 13) + '" width="12" height="11" rx="2" fill="' + ramp[Math.min(5, c + r)] + '"/>';
      } }
      return '<g filter="url(#paper-fx)"><rect x="17" y="27" width="66" height="48" rx="5" fill="#1e1c24" stroke="#f6efe0" stroke-width="3"/>' + cells + '</g>';
    },
    sex: function () {
      return '<g class="vi-spin"><g filter="url(#paper-fx)"><circle cx="46" cy="52" r="27" fill="#1d1a20" stroke="#f6efe0" stroke-width="3"/>' +
        '<circle cx="46" cy="52" r="9" fill="#e05a8a" stroke="#f6efe0" stroke-width="2"/></g>' +
        '<circle cx="46" cy="52" r="19" fill="none" stroke="#3a3440" stroke-width="1.2"/><circle cx="46" cy="52" r="14" fill="none" stroke="#3a3440" stroke-width="1.2"/>' +
        '<path d="M46 25 V33" stroke="#f6efe0" stroke-width="1.5" opacity=".5"/></g>' +
        '<g class="vi-bob" filter="url(#paper-fx)" transform="translate(64 36) rotate(-14)">' +
        '<path d="M-17 0 C-13 -8 -5 -9 0 -4 C5 -9 13 -8 17 0 C8 3 -8 3 -17 0 Z" fill="#d7263d" stroke="#f6efe0" stroke-width="2"/>' +
        '<path d="M-17 1 C-8 4 8 4 17 1 C11 11 -11 11 -17 1 Z" fill="#c21f35" stroke="#f6efe0" stroke-width="2"/></g>';
    },
    violence: function () {
      var out = "", n = 5;
      for (var i = 0; i < n; i++) {
        var a0 = i / n * Math.PI * 2 + .2, a1 = (i + 1) / n * Math.PI * 2 + .1, mid = (a0 + a1) / 2;
        var dx = Math.cos(mid) * 4, dy = Math.sin(mid) * 4;
        var p = function (a, r) { return (50 + dx + Math.cos(a) * r).toFixed(1) + " " + (50 + dy + Math.sin(a) * r).toFixed(1); };
        out += '<path d="M' + p(a0, 3) + ' L' + p(a0, 28) + ' A28 28 0 0 1 ' + p(a1, 28) + ' L' + p(a1, 3) + ' Z" fill="#1c1a1d" stroke="#f6efe0" stroke-width="2.5"/>' +
          '<path d="M' + p(a0, 4) + ' L' + p(a0, 11) + ' A11 11 0 0 1 ' + p(a1, 11) + ' L' + p(a1, 4) + ' Z" fill="#c8553d"/>';
      }
      return '<g class="vi-shake" filter="url(#paper-fx)">' + out + '</g>';
    },
    drugs: function () {
      return '<g filter="url(#paper-fx)" transform="rotate(-35 50 50)">' +
        '<rect x="26" y="40" width="48" height="20" rx="10" fill="#e0605a" stroke="#f6efe0" stroke-width="3"/>' +
        '<path d="M50 40 H64 A10 10 0 0 1 64 60 H50 Z" fill="#f2f0ea"/><rect x="26" y="40" width="48" height="20" rx="10" fill="none" stroke="#f6efe0" stroke-width="3"/></g>' +
        '<g class="vi-bob" filter="url(#paper-fx)"><rect x="56" y="64" width="22" height="9" rx="4.5" fill="#6fb0e0" stroke="#f6efe0" stroke-width="2" transform="rotate(20 67 68)"/>' +
        '<circle cx="30" cy="70" r="6" fill="#f2c94c" stroke="#f6efe0" stroke-width="2"/></g>';
    },
    money: function () {
      var bill = function (x, y, r, cls) {
        return '<g class="' + cls + '" filter="url(#paper-fx)" transform="translate(' + x + ' ' + y + ') rotate(' + r + ')">' +
          '<rect x="-24" y="-12" width="48" height="24" rx="2.5" fill="#7cb38a" stroke="#f6efe0" stroke-width="2.5"/>' +
          '<rect x="-19" y="-7.5" width="38" height="15" rx="1.5" fill="none" stroke="#4f8a5f" stroke-width="1.5"/>' +
          '<circle r="6" fill="#e7f1e3"/><text y="3.5" text-anchor="middle" font-size="9" font-weight="700" fill="#3f7350">$</text></g>';
      };
      return bill(48, 58, -10, "") + bill(54, 42, 12, "vi-bob");
    },
    race: function () {
      var out = '<g filter="url(#paper-fx)"><rect x="20" y="22" width="60" height="56" rx="7" fill="#2c2a33" stroke="#f6efe0" stroke-width="3"/></g>';
      var cols = ["#8a4fb8", "#d9822b", "#2a7fc4", "#3f9a4a"], lv = [58, 40, 50, 34];
      for (var i = 0; i < 4; i++) {
        var x = 32 + i * 12;
        out += '<rect x="' + (x - 1.5) + '" y="32" width="3" height="38" rx="1.5" fill="#46434e"/>' +
          '<g class="vi-fader" style="--k:' + i + '" filter="url(#paper-fx)"><rect x="' + (x - 5) + '" y="' + lv[i] + '" width="10" height="7" rx="1.5" fill="' + cols[i] + '" stroke="#f6efe0" stroke-width="1.5"/></g>';
      }
      return out;
    },
    kids: function () {
      return '<g filter="url(#paper-fx)"><path d="M26 58 C26 32 74 32 74 58" fill="none" stroke="#f6efe0" stroke-width="9" stroke-linecap="round"/>' +
        '<path d="M26 58 C26 32 74 32 74 58" fill="none" stroke="#e8892f" stroke-width="5" stroke-linecap="round"/>' +
        '<rect x="18" y="52" width="16" height="24" rx="7" fill="#e05a8a" stroke="#f6efe0" stroke-width="3"/>' +
        '<rect x="66" y="52" width="16" height="24" rx="7" fill="#e05a8a" stroke="#f6efe0" stroke-width="3"/></g>' +
        '<path class="vi-note" d="M47 70 V52 L57 49 V66" fill="none" stroke="#f6efe0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<circle class="vi-note" cx="44.5" cy="70" r="3.5" fill="#f6efe0"/><circle class="vi-note" cx="54.5" cy="66" r="3.5" fill="#f6efe0"/>';
    }
  };

  function drawVitaIcons() {
    Array.prototype.forEach.call(document.querySelectorAll(".vita-icon[data-icon]"), function (el) {
      var draw = ICONS[el.getAttribute("data-icon")];
      if (!draw) { return; }
      el.innerHTML = '<svg viewBox="0 0 100 100">' +
        '<circle class="vi-disc" cx="50" cy="50" r="46"/><g class="vi-motif">' + draw() + '</g>' +
        '<ellipse class="vi-gloss" cx="38" cy="20" rx="24" ry="9" transform="rotate(-18 38 20)"/></svg>';
    });
    VitaAlive(document.querySelector(".vita"));
  }

  /* The icons are drawn to the cursor: within reach, a bubble eases toward
     it, grows a touch and tilts to meet it; the drawing and gloss shift with
     it for depth. Values glide
     (eased each frame) and the loop sleeps when nothing is moving. */
  function VitaAlive(nav) {
    if (!nav || reducedMotion()) { return; }
    nav.classList.add("vita-live");
    var items = Array.prototype.map.call(nav.querySelectorAll(".vita-bubble"), function (a) {
      var svg = a.querySelector("svg");
      return { a: a, svg: svg, motif: svg && svg.querySelector(".vi-motif"), gloss: svg && svg.querySelector(".vi-gloss"),
        s: { x: 0, y: 0, k: 1, rx: 0, ry: 0, mx: 0, my: 0, gx: 0 }, press: 0 };
    }).filter(function (it) { return it.svg; });
    var px = -1e4, py = -1e4, running = false;
    function lerp(o, key, v) { o[key] += (v - o[key]) * .075; return Math.abs(v - o[key]) > .005; }
    function frame() {
      var busy = false;
      items.forEach(function (it) {
        var r = it.svg.getBoundingClientRect(), R = r.width / 2 || 1;
        var cx = r.left + R, cy = r.top + R, dx = px - cx, dy = py - cy, d = Math.sqrt(dx * dx + dy * dy) || 1;
        var r0 = R * 1.9, nx = dx / d, ny = dy / d;
        function sm(v) { v = v < 0 ? 0 : v > 1 ? 1 : v; return v * v * (3 - 2 * v); }
        // Within reach, the bubble is drawn toward the cursor and tilts to meet it.
        var grab = d <= r0 ? sm((r0 - d) / (r0 * .9)) : 0;
        var inside = grab > .5, mv = grab * d * .35;
        var t = {
          x: nx * mv, y: ny * mv,
          k: 1 + .04 * grab - it.press * .05,
          rx: grab * -ny * 10, ry: grab * nx * 10,
          mx: nx * grab * 3, my: ny * grab * 3,
          gx: nx * grab * 12
        };
        Object.keys(t).forEach(function (k) { if (lerp(it.s, k, t[k])) { busy = true; } });
        it.a.classList.toggle("hot", inside);
        var s = it.s;
        it.svg.style.transform = "translate(" + s.x.toFixed(2) + "px," + s.y.toFixed(2) + "px) perspective(360px) rotateX(" +
          s.rx.toFixed(2) + "deg) rotateY(" + s.ry.toFixed(2) + "deg) scale(" + s.k.toFixed(4) + ")";
        it.motif.setAttribute("transform", "translate(" + s.mx.toFixed(2) + " " + s.my.toFixed(2) + ")");
        it.gloss.setAttribute("transform", "translate(" + s.gx.toFixed(2) + " " + (s.my * 2).toFixed(2) + ") rotate(-18 38 20)");
      });
      if (busy) { requestAnimationFrame(frame); } else { running = false; }
    }
    function kick() { if (!running) { running = true; requestAnimationFrame(frame); } }
    window.addEventListener("pointermove", function (e) { px = e.clientX; py = e.clientY; kick(); }, { passive: true });
    document.addEventListener("pointerleave", function () { px = py = -1e4; kick(); });
    window.addEventListener("scroll", kick, { passive: true });
    items.forEach(function (it) {
      it.a.addEventListener("pointerdown", function () { it.press = 1; kick(); });
      ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) {
        it.a.addEventListener(ev, function () { it.press = 0; kick(); });
      });
    });
  }

  /* ---------------- the landing: pick a section ----------------
     Seven tall panels (strips on a phone). Each holds a cut-paper scene that
     plays only while its panel is open (hovered, focused or tapped) and
     freezes when it closes. */
  var PX = 'filter="url(#paper-fx)"', CREAM = "#f6efe0";
  var SCENES = {
    glance: function () {
      var ramp = ["#3b3a52", "#5b4a7a", "#8a4f8f", "#c2577f", "#e8795f", "#f4b25c"], out = "";
      for (var r = 0; r < 5; r++) { for (var c = 0; c < 7; c++) {
        var v = Math.min(5, Math.max(0, Math.round(c * .75 + (r % 3) * .5 - (r === 4 ? 1 : 0))));
        out += '<rect class="sc-cell" style="--c:' + c + ';--r:' + r + '" x="' + (45 + c * 30) + '" y="' + (85 + r * 26) + '" width="26" height="22" rx="3" fill="' + ramp[v] + '"/>';
      } }
      return '<g ' + PX + '><rect x="34" y="74" width="232" height="152" rx="10" fill="#1e1c24" stroke="' + CREAM + '" stroke-width="4"/>' + out + '</g>' +
        '<g class="sc-scan"><rect x="40" y="80" width="6" height="140" rx="3" fill="' + CREAM + '" opacity=".55"/></g>' +
        '<text x="45" y="250" font-size="13" fill="' + CREAM + '" opacity=".8">1960</text><text x="255" y="250" font-size="13" fill="' + CREAM + '" opacity=".8" text-anchor="end">2025</text>';
    },
    sex: function () {
      return '<g class="sc-lips">' +
          '<g ' + PX + '><path d="M58 150 C80 116 120 106 141 128 Q150 136 159 128 C180 106 220 116 242 150 C200 160 100 160 58 150 Z" fill="#b71c34" stroke="' + CREAM + '" stroke-width="4"/>' +
          '<path d="M58 153 C100 162 200 162 242 153 C222 200 78 200 58 153 Z" fill="#d7263d" stroke="' + CREAM + '" stroke-width="4"/></g>' +
          '<path class="sc-coat" d="M78 168 C110 186 190 186 222 168" fill="none" stroke="#ff5a78" stroke-width="12" stroke-linecap="round" opacity=".85"/>' +
          '<path class="sc-shine" d="M110 176 C130 182 150 183 168 180" fill="none" stroke="#ffd0da" stroke-width="4" stroke-linecap="round"/>' +
        '</g>' +
        '<g class="sc-stick"><g transform="rotate(-38)"><g ' + PX + '>' +
          '<rect x="-13" y="0" width="26" height="54" rx="3" fill="#d9a441" stroke="' + CREAM + '" stroke-width="3"/>' +
          '<rect x="-15" y="-6" width="30" height="10" rx="2" fill="#b8862f" stroke="' + CREAM + '" stroke-width="3"/>' +
          '<path d="M-10 -6 V-30 L10 -40 V-6 Z" fill="#e0245e" stroke="' + CREAM + '" stroke-width="3"/></g></g></g>' +
        '<g class="sc-hearts" ' + PX + '>' +
          '<path class="sc-heart" style="--i:0" d="M240 96 c0 -8 12 -8 12 0 c0 -8 12 -8 12 0 c0 8 -12 14 -12 18 c0 -4 -12 -10 -12 -18 Z" fill="#ff7a93" stroke="' + CREAM + '" stroke-width="2"/>' +
          '<path class="sc-heart" style="--i:1" d="M52 108 c0 -6 9 -6 9 0 c0 -6 9 -6 9 0 c0 6 -9 10 -9 13 c0 -3 -9 -7 -9 -13 Z" fill="#ff7a93" stroke="' + CREAM + '" stroke-width="2"/></g>';
    },
    violence: function () {
      return '<g class="sc-gun">' +
          '<g ' + PX + '>' +
          '<rect x="138" y="118" width="120" height="20" rx="4" fill="#2b2a30" stroke="' + CREAM + '" stroke-width="4"/>' +
          '<rect x="252" y="112" width="8" height="10" rx="2" fill="#2b2a30" stroke="' + CREAM + '" stroke-width="3"/>' +
          '<path d="M96 112 H160 V156 H132 C122 156 116 160 112 170 L96 226 C94 232 88 234 82 232 L66 226 C60 224 58 218 60 212 L84 150 C86 142 88 136 92 130 Z" fill="#3a3740" stroke="' + CREAM + '" stroke-width="4"/>' +
          '<path d="M118 156 C116 176 126 186 142 184 C150 182 152 172 148 156" fill="none" stroke="' + CREAM + '" stroke-width="4"/>' +
          '</g>' +
          '<g class="sc-cyl" ' + PX + '><circle cx="128" cy="134" r="20" fill="#4a4652" stroke="' + CREAM + '" stroke-width="4"/>' +
            '<circle cx="128" cy="124" r="4" fill="#1c1a1d"/><circle cx="137" cy="139" r="4" fill="#1c1a1d"/><circle cx="119" cy="139" r="4" fill="#1c1a1d"/></g>' +
          '<g class="sc-hammer" ' + PX + '><path d="M98 116 L86 96 L96 92 L106 112 Z" fill="#2b2a30" stroke="' + CREAM + '" stroke-width="3"/></g>' +
          '<path class="sc-trigger" d="M134 158 C132 168 136 172 140 170" fill="none" stroke="' + CREAM + '" stroke-width="4" stroke-linecap="round"/>' +
        '</g>' +
        '<g class="sc-flash" ' + PX + '><path d="M262 128 L288 110 L280 126 L300 128 L280 132 L288 148 Z" fill="#f2c94c" stroke="' + CREAM + '" stroke-width="3"/>' +
          '<circle cx="270" cy="128" r="8" fill="#e8795f"/></g>' +
        '<g class="sc-shell" ' + PX + '><rect x="-4" y="-9" width="8" height="18" rx="2" fill="#d9a441" stroke="' + CREAM + '" stroke-width="2"/></g>' +
        '<path d="M30 250 H270" stroke="#b9875a" stroke-width="5" stroke-linecap="round" ' + PX + '/>';
    },
    drugs: function () {
      var pills = "", cols = ["#f2f0ea", "#6fb0e0", "#f2c94c", "#e0605a"];
      for (var i = 0; i < 5; i++) {
        pills += '<g class="sc-pill" style="--i:' + i + ';--x:' + (30 + i * 16) + 'px" ' + PX + '><rect x="-9" y="-4" width="18" height="8" rx="4" fill="' + cols[i % 4] + '" stroke="' + CREAM + '" stroke-width="2"/></g>';
      }
      return '<g class="sc-cup" ' + PX + '>' +
          '<path d="M52 110 L112 110 L104 232 L60 232 Z" fill="#f2efe6" stroke="' + CREAM + '" stroke-width="4"/>' +
          '<path d="M48 98 L116 98 L112 112 L52 112 Z" fill="#e6e1d4" stroke="' + CREAM + '" stroke-width="4"/>' +
          '<path d="M60 150 H106" stroke="#d8d2c2" stroke-width="2"/></g>' +
        '<g class="sc-lean"><ellipse cx="82" cy="100" rx="30" ry="6" fill="#8a4fb8" stroke="' + CREAM + '" stroke-width="2"/></g>' +
        '<g transform="translate(196 150)"><g class="sc-bottle"><g ' + PX + '>' +
          '<rect x="-28" y="-44" width="56" height="84" rx="7" fill="#e8892f" stroke="' + CREAM + '" stroke-width="4"/>' +
          '<rect x="-22" y="-14" width="44" height="34" rx="3" fill="#fbf4df"/><path d="M-16 -4 H16 M-16 6 H10" stroke="#c7bfae" stroke-width="3"/>' +
          '<rect x="-32" y="-58" width="64" height="18" rx="4" fill="#f6f2e8" stroke="' + CREAM + '" stroke-width="4"/></g>' +
          '<g transform="translate(0 -58)">' + pills + '</g></g></g>' +
        '<path d="M30 236 H270" stroke="#b9875a" stroke-width="5" stroke-linecap="round" ' + PX + '/>';
    },
    money: function () {
      var bills = "";
      for (var i = 0; i < 6; i++) {
        bills += '<g class="sc-bill" style="--i:' + i + ';--x:' + (40 + i * 42) + 'px;--r:' + ((i % 2 ? 1 : -1) * (10 + i * 5)) + 'deg" ' + PX + '>' +
          '<rect x="-26" y="-12" width="52" height="24" rx="2" fill="#7cb38a" stroke="' + CREAM + '" stroke-width="2.5"/>' +
          '<circle r="6" fill="#e7f1e3"/><text y="3.5" text-anchor="middle" font-size="9" font-weight="700" fill="#3f7350">$</text></g>';
      }
      return bills +
        '<g class="sc-chain"><path d="M90 60 C100 150 200 150 210 60" fill="none" stroke="#e2b53e" stroke-width="7" stroke-dasharray="9 5" stroke-linecap="round" ' + PX + '/>' +
        '<g class="sc-gem" ' + PX + '><path d="M122 138 L178 138 L190 156 L150 206 L110 156 Z" fill="#9fd6ec" stroke="' + CREAM + '" stroke-width="4"/>' +
          '<path d="M110 156 H190 M136 138 L128 156 L150 206 L172 156 L164 138" fill="none" stroke="#5ea8c9" stroke-width="2.5"/></g></g>' +
        '<path class="sc-spark" style="--i:0" d="M204 150 l4 -12 l4 12 l12 4 l-12 4 l-4 12 l-4 -12 l-12 -4 Z" fill="#fff7d6"/>' +
        '<path class="sc-spark" style="--i:1" d="M104 180 l3 -9 l3 9 l9 3 l-9 3 l-3 9 l-3 -9 l-9 -3 Z" fill="#fff7d6"/>';
    },
    race: function () {
      var cols = ["#8a4fb8", "#d9822b", "#2a7fc4", "#3f9a4a"], out = '<g ' + PX + '><rect x="40" y="60" width="220" height="180" rx="14" fill="#2c2a33" stroke="' + CREAM + '" stroke-width="4"/></g>';
      for (var i = 0; i < 4; i++) {
        var x = 80 + i * 47;
        out += '<rect x="' + (x - 3) + '" y="120" width="6" height="100" rx="3" fill="#46434e"/>' +
          '<g class="sc-fader" style="--i:' + i + '" ' + PX + '><rect x="' + (x - 16) + '" y="196" width="32" height="14" rx="3" fill="#f2efe6" stroke="' + CREAM + '" stroke-width="2"/>' +
          '<path d="M' + (x - 10) + ' 203 H' + (x + 10) + '" stroke="' + cols[i] + '" stroke-width="3"/></g>';
        for (var k = 0; k < 4; k++) {
          out += '<rect class="sc-vu" style="--i:' + i + ';--k:' + k + '" x="' + (x - 7) + '" y="' + (106 - k * 9) + '" width="14" height="6" rx="1.5" fill="' + cols[i] + '"/>';
        }
      }
      return out;
    },
    kids: function () {
      return '<g class="sc-phones"><g ' + PX + '>' +
          '<path d="M78 170 C78 90 222 90 222 170" fill="none" stroke="' + CREAM + '" stroke-width="18" stroke-linecap="round"/>' +
          '<path d="M78 170 C78 90 222 90 222 170" fill="none" stroke="#e8892f" stroke-width="11" stroke-linecap="round"/>' +
          '<rect x="56" y="152" width="44" height="66" rx="18" fill="#e05a8a" stroke="' + CREAM + '" stroke-width="4"/>' +
          '<rect x="200" y="152" width="44" height="66" rx="18" fill="#e05a8a" stroke="' + CREAM + '" stroke-width="4"/></g></g>' +
        [0, 1, 2].map(function (i) {
          var x = [120, 150, 180][i];
          return '<g class="sc-note" style="--i:' + i + '" ' + PX + '><path d="M' + x + ' 196 V168 L' + (x + 16) + ' 163 V190" fill="none" stroke="' + CREAM + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
            '<circle cx="' + (x - 4) + '" cy="196" r="6" fill="' + CREAM + '"/><circle cx="' + (x + 12) + '" cy="190" r="6" fill="' + CREAM + '"/></g>';
        }).join("") +
        '<path class="sc-star" d="M232 84 l5 -14 l5 14 l14 5 l-14 5 l-5 14 l-5 -14 l-14 -5 Z" fill="#f2c94c" ' + PX + '/>';
    }
  };

  var PAGES = ["glance", "sex", "violence", "drugs", "money", "race", "kids"];
  var PAGE_NAME = { glance: "The Big Picture", sex: "Sex & Relationships", violence: "Violence & Crime", drugs: "Drugs & Alcohol",
    money: "Money & Materialism", race: "Race & Representation", kids: "What Kids Hear" };

  function Picker(root) {
    if (!root) { return; }
    Array.prototype.forEach.call(root.querySelectorAll("[data-scene]"), function (el) {
      var draw = SCENES[el.getAttribute("data-scene")];
      if (draw) { el.innerHTML = '<svg viewBox="0 0 300 300">' + draw() + "</svg>"; }
    });
    var panels = Array.prototype.slice.call(root.querySelectorAll(".panel"));
    var touch = window.matchMedia && window.matchMedia("(hover: none)").matches;
    function open(p) { panels.forEach(function (q) { q.classList.toggle("on", q === p); }); }
    panels.forEach(function (p) {
      p.addEventListener("mouseenter", function () { if (!touch) { open(p); } });
      p.addEventListener("focus", function () { open(p); });
      p.addEventListener("click", function (e) {
        // On a phone the first tap opens the strip and plays it; the second goes in.
        if (touch && !p.classList.contains("on")) { e.preventDefault(); open(p); }
      });
    });
    root.addEventListener("mouseleave", function () { if (!touch) { open(null); } });
  }

  /* Each section is its own page: the landing shows the panels; a hash that
     names a section shows only that section, with a way back and a way on. */
  function Router() {
    var picker = byId("top"), back = document.querySelector(".back-home"), nav = byId("page-nav"), notes = byId("notes");
    var current = null;
    function show(page) {
      current = page;
      document.body.setAttribute("data-page", page || "home");
      if (picker) { picker.hidden = !!page; }
      if (back) { back.hidden = !page; }
      if (notes) { notes.hidden = !page; }
      Array.prototype.forEach.call(document.querySelectorAll("[data-page]"), function (el) {
        if (el !== document.body) { el.hidden = el.getAttribute("data-page") !== page; }
      });
      if (nav) {
        nav.hidden = !page;
        nav.innerHTML = "";
        if (page) {
          var i = PAGES.indexOf(page), prev = PAGES[i - 1], next = PAGES[i + 1];
          if (prev) { nav.appendChild(h("a", { class: "prev", href: "#" + prev }, [h("span", { text: "Previous" }), h("b", { text: PAGE_NAME[prev] })])); }
          nav.appendChild(h("a", { class: "home", href: "#top", text: "All sections" }));
          if (next) { nav.appendChild(h("a", { class: "next", href: "#" + next }, [h("span", { text: "Next" }), h("b", { text: PAGE_NAME[next] })])); }
        }
      }
      window.scrollTo(0, 0);
      rearmViews();
      window.dispatchEvent(new Event("resize"));
      window.dispatchEvent(new Event("scroll"));
    }
    function route() {
      var id = decodeURIComponent((location.hash || "").slice(1));
      if (PAGES.indexOf(id) >= 0) { return show(id); }
      if (id === "method") { show("glance"); var m = byId("method"); if (m) { m.scrollIntoView(); } return; }
      if (!id || id === "top") { return show(null); }
      // Any other anchor (a footnote, a note) lives inside the current page.
      if (!current) { show(null); }
    }
    window.addEventListener("hashchange", route);
    route();
  }

  function fillTeasers(FX, race) {
    var pick = { sex: FX.sex[0], violence: FX.violence[0], drugs: FX.drugs[0], money: FX.money[0], kids: FX.kids[0] };
    Object.keys(pick).forEach(function (k) {
      var el = document.querySelector('[data-teaser="' + k + '"]');
      if (el && pick[k]) { el.textContent = flat(pick[k].parts).replace(/\s+/g, " ").trim(); }
    });
  }

  /* Chapter breaks: each chapter opens on a full screen of its own colour
     that holds for a moment while its number and title fade in, then the
     chapter carries on in that colour. The state glides toward the scroll
     position so the fade is smooth. */
  function ChapterBreaks() {
    var breaks = [];
    ["glance", "sex", "violence", "drugs", "money", "race", "kids"].forEach(function (id) {
      var sec = byId(id), head = sec && sec.querySelector(".chapter-head");
      if (!head) { return; }
      var num = head.querySelector(".chapter-num"), h2 = head.querySelector("h2");
      var fill = h("div", { class: "break-fill" });
      var title = h("div", { class: "break-title" });
      if (num) { num.textContent = PAGE_NAME[id] || num.textContent; title.appendChild(num); }
      if (h2) { title.appendChild(h2); }
      var stage = h("div", { class: "break-stage" }, [fill, title]);
      var track = h("div", { class: "break-track" }, [stage]);
      var inner = h("div", { class: "wrap" }), rest = h("div", { class: "break-rest" }, [inner]);
      inner.appendChild(head);
      var panel = h("div", { class: "chapter-break break-" + id }, [track, rest]);
      sec.insertBefore(panel, sec.firstChild);
      sec.classList.add("has-break");
      breaks.push({ track: track, fill: fill, title: title, p: 0 });
    });
    // Each section now opens on its own page, so the title card is simply there.
    breaks.forEach(function (b) { b.title.parentNode.classList.add("static"); });
    return;
    function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function smooth(v) { v = clamp(v); return v * v * (3 - 2 * v); }
    function target(b) {
      var r = b.track.getBoundingClientRect(), run = r.height - window.innerHeight;
      return run > 0 ? clamp(-r.top / run) : 1;
    }
    function paint(b) {
      var show = smooth((b.p - .05) / .45);
      b.title.style.opacity = show.toFixed(3);
      b.title.style.filter = "blur(" + (6 * (1 - show)).toFixed(1) + "px)";
      b.title.style.transform = "translateY(" + (16 * (1 - show)).toFixed(1) + "px)";
    }
    var running = false;
    function frame() {
      var moving = false, vh = window.innerHeight;
      breaks.forEach(function (b) {
        var r = b.track.getBoundingClientRect();
        if (r.bottom < -vh || r.top > vh * 2) { return; }
        var t = target(b);
        b.p += (t - b.p) * .12;
        if (Math.abs(t - b.p) < .0005) { b.p = t; } else { moving = true; }
        paint(b);
      });
      if (moving) { requestAnimationFrame(frame); } else { running = false; }
    }
    function kick() { if (!running) { running = true; requestAnimationFrame(frame); } }
    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", kick);
    breaks.forEach(function (b) { b.p = target(b); paint(b); });
  }

  function KidHero(root) {
    var stage = root && root.querySelector(".kidhero-stage");
    if (!stage) { return; }
    var E = 'stroke="#f6efe0" filter="url(#paper-fx)"';
    stage.innerHTML =
      '<svg class="collage opener-collage" viewBox="0 0 480 400" role="img" aria-label="A child sitting cross-legged, listening to music on headphones, eyes closed and smiling">' +
      // room: warm wall, sunny window, floor, rug
      '<g class="piece" style="--i:0"><rect x="14" y="14" width="452" height="372" rx="6" fill="#e9b24e" stroke-width="5" ' + E + '/></g>' +
      '<g class="piece" style="--i:1"><rect x="56" y="52" width="128" height="140" rx="4" fill="#9fd3e6" stroke-width="5" ' + E + '/>' +
        '<path d="M120 52 V192 M56 122 H184" stroke="#e9b24e" stroke-width="6"/></g>' +
      '<g class="piece" style="--i:2"><circle cx="152" cy="86" r="18" fill="#fbe38a" stroke-width="3" ' + E + '/><ellipse cx="86" cy="150" rx="22" ry="9" fill="#fbf4df" stroke-width="3" ' + E + '/></g>' +
      '<g class="piece" style="--i:3"><rect x="14" y="330" width="452" height="56" fill="#b9875a" stroke-width="5" ' + E + '/></g>' +
      '<g class="piece" style="--i:4"><ellipse cx="240" cy="346" rx="150" ry="22" fill="#d9665a" stroke-width="4" ' + E + '/></g>' +
      // plant
      '<g class="piece" style="--i:5"><path d="M380 330 L386 292 H424 L430 330 Z" fill="#c05a36" stroke-width="3" ' + E + '/>' +
        '<path d="M404 292 C396 262 376 256 368 242 C388 244 402 258 404 276 C406 252 418 236 438 232 C434 254 418 268 406 290" fill="#6f9a4a" stroke-width="3" ' + E + '/></g>' +
      // record player with a spinning record
      '<g class="piece" style="--i:6"><rect x="330" y="292" width="72" height="40" rx="5" fill="#8a5a3a" stroke-width="3" ' + E + '/>' +
        '<ellipse class="rec" cx="366" cy="292" rx="30" ry="9" fill="#2a2730" stroke="#f6efe0" stroke-width="2"/><ellipse cx="366" cy="292" rx="8" ry="2.5" fill="#e05a8a"/>' +
        '<path d="M394 284 L382 294" stroke="#d9d2c2" stroke-width="3" stroke-linecap="round"/></g>' +
      // the kid, back to front: legs, body, arms, head, hair, face, headphones
      '<g class="piece" style="--i:7"><path d="M138 346 C130 314 170 300 240 300 C310 300 350 314 342 346 C334 362 290 368 240 368 C190 368 146 362 138 346 Z" fill="#7e9fd1" stroke-width="5" ' + E + '/></g>' +
      '<g class="piece" style="--i:8"><path d="M172 312 C168 256 196 222 240 222 C284 222 312 256 308 312 Z" fill="#2f9b90" stroke-width="5" ' + E + '/>' +
        '<path d="M222 224 L240 246 L258 224 Z" fill="#fbf4df"/></g>' +
      '<g class="piece" style="--i:9"><path d="M182 240 C160 256 154 292 170 314 C180 326 198 324 202 310 C206 290 204 268 206 250 Z" fill="#26877e" stroke-width="4" ' + E + '/>' +
        '<path d="M298 240 C320 256 326 292 310 314 C300 326 282 324 278 310 C274 290 276 268 274 250 Z" fill="#26877e" stroke-width="4" ' + E + '/>' +
        '<circle cx="178" cy="318" r="12" fill="#e8b48f"/><circle cx="302" cy="318" r="12" fill="#e8b48f"/></g>' +
      '<g class="piece opener-head" style="--i:10">' +
        '<g ' + E + ' stroke-width="4"><rect x="226" y="198" width="28" height="30" rx="8" fill="#e3ad85"/>' +
        '<circle cx="240" cy="160" r="54" fill="#eab795"/>' +
        '<path d="M186 158 C184 110 212 92 240 92 C268 92 296 110 294 158 C282 138 266 130 250 134 C242 124 226 124 218 134 C206 132 192 140 186 158 Z" fill="#3a2a22"/></g>' +
        '<g fill="none" stroke="#1d1715" stroke-width="4" stroke-linecap="round"><path d="M212 162 C218 154 228 154 234 162"/><path d="M246 162 C252 154 262 154 268 162"/>' +
          '<path d="M222 184 C232 196 248 196 258 184"/></g>' +
        '<circle cx="206" cy="180" r="9" fill="#f19a95" opacity=".7"/><circle cx="274" cy="180" r="9" fill="#f19a95" opacity=".7"/>' +
        '<g ' + E + ' stroke-width="3"><path d="M184 160 C180 86 300 86 296 160" fill="none" stroke="#ef7b62" stroke-width="12" stroke-linecap="round"/>' +
          '<rect x="170" y="140" width="28" height="48" rx="12" fill="#ef7b62"/><rect x="282" y="140" width="28" height="48" rx="12" fill="#ef7b62"/></g>' +
      '</g>' +
      // notes drifting up from the record player
      '<g class="notes slow" fill="#fbf4df">' +
        '<g class="note n1"><path d="M352 250 v-30 l18 -6 v30" fill="none" stroke="#fbf4df" stroke-width="3"/><ellipse cx="347" cy="251" rx="6" ry="4.5"/><ellipse cx="365" cy="245" rx="6" ry="4.5"/></g>' +
        '<g class="note n2"><path d="M388 236 v-26 c11 3 14 9 9 17" fill="none" stroke="#fbf4df" stroke-width="3"/><ellipse cx="383" cy="237" rx="6" ry="4.5"/></g>' +
        '<g class="note n3"><path d="M332 222 v-24 c11 3 14 9 9 17" fill="none" stroke="#fbf4df" stroke-width="3"/><ellipse cx="327" cy="223" rx="5.5" ry="4"/></g>' +
      '</g>' +
      '</svg>';
    onView(stage, function () { stage.classList.add("in"); });
  }

  /* ---------------- money: the ratio ticker ---------------- */

  function Ticker(host, bd) {
    this.host = host; this.rows = flexRatio(bd); this.i = -1; this.cur = { left: 1, right: 1 };
    var self = this;
    this.decade = h("p", { class: "tick-decade" });
    this.left = h("span", { class: "tick-num" }); this.right = h("span", { class: "tick-num" });
    this.big = h("p", { class: "tick-big" }, [this.left, h("span", { class: "tick-colon", text: ":" }), this.right]);
    this.legend = h("p", { class: "tick-legend" }, [h("span", { class: "k1", text: "songs flexing about money" }),
      h("span", { class: "k2", text: "songs struggling for it, or turning it down" })]);
    this.counts = h("p", { class: "tick-counts" });
    this.strip = h("div", { class: "tick-strip" });
    [this.decade, this.big, this.legend, this.counts, this.strip].forEach(function (n) { host.appendChild(n); });
    this.drawStrip();
  }

  Ticker.prototype.drawStrip = function () {
    var self = this;
    this.dots = this.rows.map(function (r, i) {
      var p = ratioPair(r.r);
      var b = h("div", { class: "tick-cell" }, [h("b", { text: r.decade }),
        h("span", { text: p.left + " : " + p.right })]);
      self.strip.appendChild(b);
      return b;
    });
  };

  Ticker.prototype.show = function (i) {
    if (i === this.i) { return; }
    this.i = i;
    var r = this.rows[i], to = ratioPair(r.r), from = { left: this.cur.left, right: this.cur.right }, self = this;
    this.decade.textContent = "The " + r.decade;
    this.counts.textContent = fmtN(r.flex) + " flexing · " + fmtN(r.struggle) + " struggling · of " + fmtN(r.n) + " hits";
    this.dots.forEach(function (d, j) { d.classList.toggle("on", j === i); });
    tween(700, function (t) {
      var L = from.left + (to.left - from.left) * t, R = from.right + (to.right - from.right) * t;
      self.left.textContent = to.dec ? L.toFixed(1) : String(Math.round(L));
      self.right.textContent = String(Math.round(R));
      self.cur = { left: L, right: R };
    }, function () { self.cur = { left: to.left, right: to.right }; });
  };

  /* ---------------- violence: dumbbells by genre ---------------- */

  function drawDumbbell(host, bd) {
    if (!host) { return; }
    var d0 = "1990s", d1 = bd.decades[bd.decades.length - 1], key = "violence_beyond_mention";
    var rows = dumbbellRows(bd, key, d0, d1);
    host.appendChild(h("div", { class: "module-head" }, [h("div", null, [
      h("p", { class: "module-title", text: "Where the violence is, " + d0 + " → " + d1 }),
      h("p", { class: "module-sub", text: "Share of each genre’s songs that threaten or carry out violence. Hollow: the " + d0 +
        ". Solid: the " + d1 + ". Genres overlap; hip-hop starts in the 1990s because earlier decades have too few songs." })])]));
    var box = h("div", { class: "chart dumbbell" });
    host.appendChild(box);
    var progress = 0;
    function draw() {
      var W = Math.max(280, box.clientWidth), narrow = W < 560, lw = narrow ? 104 : 170, rw = narrow ? 64 : 120;
      var rh = 44, H = rows.length * rh + 30;
      var max = niceMax(Math.max.apply(null, rows.map(function (r) { return Math.max(r.a, r.b); })));
      function x(v) { return lw + (v / max) * (W - lw - rw); }
      var svg = s("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img",
        "aria-label": rows.map(function (r) { return r.label + " " + fmtPct(r.a) + " to " + fmtPct(r.b); }).join("; ") });
      for (var t = 0; t <= 4; t++) {
        var v = max * t / 4;
        svg.appendChild(s("line", { class: "db-grid", x1: x(v), x2: x(v), y1: 6, y2: H - 22 }));
        var tx = s("text", { class: "db-tick", x: x(v), y: H - 6, "text-anchor": "middle" }); tx.textContent = Math.round(v * 100) + "%";
        svg.appendChild(tx);
      }
      rows.forEach(function (r, i) {
        var cy = 22 + i * rh, xb = x(r.a + (r.b - r.a) * progress);
        var lab = s("text", { class: "db-label" + (r.all ? " all" : ""), x: lw - 14, y: cy + 4, "text-anchor": "end" });
        lab.textContent = r.label; svg.appendChild(lab);
        svg.appendChild(s("line", { class: "db-bar", x1: x(r.a), x2: xb, y1: cy, y2: cy }));
        svg.appendChild(s("circle", { class: "db-a", cx: x(r.a), cy: cy, r: 5 }));
        svg.appendChild(s("circle", { class: "db-b" + (r.all ? " all" : ""), cx: xb, cy: cy, r: 6 }));
        var val = s("text", { class: "db-val", x: Math.max(x(r.a), xb) + 12, y: cy + 4 });
        val.textContent = narrow ? fmtPct(r.b, 0) : fmtPct(r.a) + " → " + fmtPct(r.b);
        svg.appendChild(val);
      });
      var old = box.querySelector("svg"); if (old) { old.remove(); }
      box.appendChild(svg);
    }
    if (typeof ResizeObserver !== "undefined") { new ResizeObserver(draw).observe(box); }
    draw();
    onView(host, function () { tween(2200, function (t) { progress = t; draw(); }); });
  }

  /* ---------------- drugs: bump chart of substance rank ---------------- */

  function drawBump(host, subs) {
    if (!host) { return; }
    var ranks = substanceRanks(subs), K = SUBSTANCE_CLASSES.length, n = subs.decades.length;
    var HI = { opioid: "s1", cannabis: "s2" };
    var box = h("div", { class: "chart bump" });
    host.appendChild(box);
    var drawnOnce = false;
    function draw(animate) {
      var W = Math.max(280, box.clientWidth), narrow = W < 560, lw = narrow ? 8 : 110, rw = narrow ? 96 : 190;
      var rh = narrow ? 34 : 42, H = K * rh + 34;
      function x(i) { return lw + i * (W - lw - rw) / (n - 1); }
      function y(r) { return 14 + (r - 1) * rh; }
      var svg = s("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img",
        "aria-label": "Rank of substances by share of songs naming them, per decade" });
      subs.decades.forEach(function (d, i) {
        var t = s("text", { class: "db-tick", x: x(i), y: H - 6, "text-anchor": "middle" });
        t.textContent = narrow ? "’" + d.slice(2) : d; svg.appendChild(t);
      });
      SUBSTANCE_CLASSES.slice().sort(function (a, b) { return (HI[a.key] ? 1 : 0) - (HI[b.key] ? 1 : 0); }).forEach(function (c) {
        var pts = ranks[c.key], tone = HI[c.key] || "ref";
        var d = pts.map(function (p, i) { return (i ? "L" : "M") + x(i) + " " + y(p.rank); }).join("");
        var path = s("path", { class: "bump-line " + tone, d: d });
        svg.appendChild(path);
        if (animate && !reducedMotion()) {
          var len = path.getTotalLength ? 2000 : 0;
          path.style.strokeDasharray = len; path.style.strokeDashoffset = len;
          requestAnimationFrame(function () { path.style.transition = "stroke-dashoffset 1.6s ease"; path.style.strokeDashoffset = 0; });
        }
        pts.forEach(function (p, i) {
          var dot = s("circle", { class: "bump-dot " + tone + (p.share === 0 ? " zero" : ""), cx: x(i), cy: y(p.rank), r: HI[c.key] ? 6 : 4.5 });
          var tt = s("title", {}); tt.textContent = c.label + ", " + subs.decades[i] + ": " + fmtPct(p.share) + " of songs (rank " + p.rank + ")";
          dot.appendChild(tt); svg.appendChild(dot);
        });
        var last = pts[n - 1];
        var r = s("text", { class: "bump-label " + tone, x: x(n - 1) + 14, y: y(last.rank) + 4 });
        r.textContent = c.label + " " + fmtPct(last.share); svg.appendChild(r);
        if (!narrow) {
          var l = s("text", { class: "bump-label " + tone, x: x(0) - 14, y: y(pts[0].rank) + 4, "text-anchor": "end" });
          l.textContent = c.label.split(" (")[0]; svg.appendChild(l);
        }
      });
      var old = box.querySelector("svg"); if (old) { old.remove(); }
      box.appendChild(svg);
    }
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(function () { if (drawnOnce) { draw(false); } }).observe(box);
    }
    onView(host, function () { drawnOnce = true; draw(true); });
    fill("substances-note", "Rank 1 is the substance named in the most songs that decade. Hollow dots: named in no song " +
      "that decade (rank then only breaks the tie). Counted from the substances the reader recorded, normalized to " +
      subs.normalized_substance_count + " substances; hover a dot for its share.");
  }

  /* ---------------- kids: number lines ---------------- */

  function drawNumberLines(host, feed) {
    if (!host) { return; }
    var rows = kidsLines(feed);
    host.appendChild(h("p", { class: "grid-caption", text: "Share of songs, chart songs only, " + rows[0].fromYear + " onward" }));
    var box = h("div");
    host.appendChild(box);
    var cols = [{ id: "chart", label: "Every chart song" }, { id: "kca", label: "Kids’ Choice picks" }, { id: "bop", label: "Kidz Bop picks" }];
    function draw() {
      numberGrid(box, rows.map(function (r) { return { id: r.key, label: r.label, r: r }; }), cols, function (row, c) {
        var r = row.r, v = r[c.id], n = c.id === "chart" ? r.chartN : c.id === "kca" ? r.kcaN : r.bopN;
        return { share: v, hits: Math.round(v * n), n: n };
      }, { cls: "kids" });
    }
    draw();
    document.addEventListener("themechange", draw);
  }


  /* ---------------- kids ---------------- */

  function exampleCard(ex) {
    var excerpt = null;
    if (ex.quote) {
      var pointer = linePointer(ex.quoteLines);
      excerpt = h("figure", { class: "excerpt" }, [
        h("blockquote", { class: "excerpt", text: ex.quote }),
        pointer ? h("figcaption", { class: "excerpt-lines", text: pointer }) : null
      ]);
    }
    return h("li", { class: "example" }, [
      h("p", { class: "title", text: ex.title }),
      h("p", { class: "meta" }, [h("span", { class: "badge", text: ex.lists.join(" · ") }),
        ex.artist + (ex.year ? " · " + ex.year : "") + " · " + ex.level]),
      excerpt,
      h("p", { class: "reading", text: ex.reading })
    ]);
  }

  function bleepArt() {
    var svg = byId("bleep-art");
    if (!svg) { return; }
    var rows = [[[40, 60], [110, 90], [210, 50], [270, 110]],
                [[40, 100], [150, 70], [230, 60], [300, 80]],
                [[40, 70], [120, 110], [240, 90]]];
    var bleep = [[0, 1], [1, 2], [2, 1]];
    var words = s("g", { fill: "var(--dot)" }), bl = s("g", { fill: "var(--ink)" }), fl = s("g", { fill: "var(--s1)" });
    var i = 0;
    rows.forEach(function (row, r) {
      row.forEach(function (w) {
        words.appendChild(s("rect", { class: "word", style: "--d:" + (i++ * 0.08).toFixed(2) + "s",
          x: w[0], y: 80 + r * 70, width: w[1], height: 18, rx: 9 }));
      });
    });
    bleep.forEach(function (p, k) {
      var w = rows[p[0]][p[1]], yy = 80 + p[0] * 70;
      bl.appendChild(s("rect", { class: "bleep", style: "--d:" + (1.2 + k * 0.35).toFixed(2) + "s",
        x: w[0] - 4, y: yy - 4, width: w[1] + 8, height: 26, rx: 4 }));
      fl.appendChild(s("rect", { class: "fill", style: "--d:" + (2.6 + k * 0.35).toFixed(2) + "s",
        x: w[0], y: yy - 34, width: w[1], height: 18, rx: 9 }));
    });
    [words, bl, fl].forEach(function (g) { svg.appendChild(g); });
  }

  function drawKids(feed, examples) {
    fill("kids-scope", kidsScope(feed));
    var head = kidsHeadline(feed);
    fill("kids-head", head.sentence);
    fill("kids-head-sub", head.pct + " — " + fmtN(head.hits) + " of " + fmtN(head.n) + " songs.");
    fill("kids-vs-head", kidsVsChart(feed).sentence);
    fill("kids-who-head", kidsWho(feed).sentence);
    drawNumberLines(byId("kids-lines"), feed);

    var ex = byId("kids-examples");
    if (ex) { ex.appendChild(h("ul", { class: "examples" }, pickExamples(examples, SEX, 4).map(exampleCard))); }
    fill("kids-exhibit", exhibitLine(examples));

    var nums = byId("kids-numbers");
    if (nums) {
      kidsNumbers(feed).forEach(function (it) {
        nums.appendChild(h("div", { class: "callout" }, [h("b", { text: it.value }), h("p", { text: it.text })]));
      });
    }
    var pairs = byId("kids-pairs");
    if (pairs) {
      KIDS_MEASURES.filter(function (m) { return m.head; }).forEach(function (m) {
        pairs.appendChild(h("p", { class: "pair-head", text: m.head }));
        pairs.appendChild(h("ul", { class: "examples" }, pickExamples(examples, m.key, 2).map(exampleCard)));
      });
    }
    fill("kids-clean-note", kidsClean(feed));
    bleepArt();
  }

  /* ---------------- method ---------------- */

  function drawMethod(bd) {
    fill("method-corpus", methodCorpus(bd));
    fill("method-minn", String(bd.min_n));
    var rows = agreementRows(bd);
    fill("method-agree-intro", (rows[0] ? fmtN(rows[0].n) : "A sample of") + " songs were read a second time, blind, " +
      "by an independent reader. How often the two readings agreed on each headline measure:");
    var t = byId("method-agree");
    if (t) {
      rows.forEach(function (r) {
        t.appendChild(h("tr", null, [h("td", { text: r.label }), h("td", { text: fmtPct(r.agreement) })]));
      });
    }
    fill("method-excluded-sum", fmtN(bd.n_excluded) + " songs whose stored lyric belongs to another recording");
    var ul = byId("method-excluded");
    if (ul) {
      bd.excluded.forEach(function (e) {
        ul.appendChild(h("li", { text: "“" + e.title + "”, " + e.artist + " (" + e.decade + ")" }));
      });
    }
  }

  /* ---------------- folk bubbles ----------------
     Speech bubbles scattered around a chapter's title. They pop in when the
     title arrives, bob gently, and drift at their own depth as you scroll. */

  /* A generic drawn face per handle: never a likeness of the real person,
     just a stable mix of skin, hair and accessory picked from the handle. */
  var SKIN = ["#f1d3b6", "#e0b48f", "#c68b5f", "#a86c43", "#7c4a2a", "#5b3620"];
  var HAIR = ["#1d1a16", "#3b2a1e", "#6b4a2b", "#b07a3c", "#d9c08a", "#8c2f2f"];
  var TINT = ["#f3d9d6", "#dfe8f3", "#e3efe4", "#f4ead2", "#ece0f2", "#f0e2d8"];
  function hash(str) { var x = 7; for (var i = 0; i < str.length; i++) { x = (x * 31 + str.charCodeAt(i)) >>> 0; } return x; }
  function avatar(handle) {
    var k = hash(handle), pick = function (arr, sh) { return arr[(k >>> sh) % arr.length]; };
    var svg = s("svg", { viewBox: "0 0 48 48", class: "avatar", "aria-hidden": "true" });
    svg.appendChild(s("circle", { cx: 24, cy: 24, r: 24, fill: pick(TINT, 3) }));
    svg.appendChild(s("path", { d: "M8 48 C10 36 16 32 24 32 C32 32 38 36 40 48 Z", fill: pick(HAIR, 11), opacity: ".85" }));
    svg.appendChild(s("circle", { cx: 24, cy: 21, r: 10, fill: pick(SKIN, 5) }));
    var style = (k >>> 7) % 5, hc = pick(HAIR, 9);
    var hair = [
      "M14 20 C14 10 34 10 34 20 C30 16 18 16 14 20 Z",
      "M13 22 C12 9 36 9 35 22 C35 17 32 13 24 13 C16 13 13 17 13 22 Z M13 22 C12 28 13 32 15 34 L15 22 Z M35 22 C36 28 35 32 33 34 L33 22 Z",
      "M15 17 C17 10 31 10 33 17 C29 14 19 14 15 17 Z",
      "M12 20 C11 8 37 8 36 20 C38 26 36 30 34 30 C34 22 32 16 24 16 C16 16 14 22 14 30 C12 30 10 26 12 20 Z",
      "M16 14 C20 8 30 8 33 14 C34 17 33 19 32 20 C29 16 20 15 16 18 Z"][style];
    svg.appendChild(s("path", { d: hair, fill: hc }));
    svg.appendChild(s("circle", { cx: 20.5, cy: 22, r: 1.1, fill: "#1d1a16" }));
    svg.appendChild(s("circle", { cx: 27.5, cy: 22, r: 1.1, fill: "#1d1a16" }));
    if ((k >>> 13) % 3 === 0) {   // some wear headphones
      svg.appendChild(s("path", { d: "M13 22 C13 9 35 9 35 22", fill: "none", stroke: "#c8553d", "stroke-width": 2.2 }));
      svg.appendChild(s("rect", { x: 10.5, y: 19, width: 5, height: 8, rx: 2, fill: "#c8553d" }));
      svg.appendChild(s("rect", { x: 32.5, y: 19, width: 5, height: 8, rx: 2, fill: "#c8553d" }));
    }
    return svg;
  }

  function drawBubbles() {
    var all = [];
    Object.keys(BUBBLES).forEach(function (ch) {
      var sec = byId(ch);
      var head = sec && sec.querySelector(".chapter-head");
      if (!head) { return; }
      head.classList.add("has-bubbles");
      var layer = h("div", { class: "bubbles", "aria-label": "What people say" });
      BUBBLES[ch].slice(0, 6).forEach(function (b, i) {
        var el = h("figure", { class: "bubble slot-" + (i + 1), style: "--i:" + i }, [
          h("div", { class: "bubble-in" }, [
            h("span", { class: "typing", "aria-hidden": "true" }, [h("i"), h("i"), h("i")]),
            h("blockquote", { class: "folk", text: b.text })]),
          h("figcaption", { class: "speaker" }, [avatar(b.who), h("span", { text: b.who })])]);
        layer.appendChild(el);
        all.push({ el: el, head: head, depth: [0.10, -0.08, 0.14, -0.12, 0.07, -0.1][i] });
      });
      head.appendChild(layer);
      onEnter(head, function () {
        head.classList.add("bubbles-in");
        // Each speaker "types" for a moment, then the quote appears.
        Array.prototype.forEach.call(layer.children, function (el, i) {
          setTimeout(function () { el.classList.add("said"); }, reducedMotion() ? 0 : 900 + i * 420);
        });
      });
    });
    if (reducedMotion()) { return; }
    onScrollFrame(function () {
      var mid = window.innerHeight / 2;
      all.forEach(function (b) {
        var r = b.head.getBoundingClientRect();
        if (r.bottom < -200 || r.top > window.innerHeight + 200) { return; }
        b.el.style.setProperty("--py", ((r.top + r.height / 2 - mid) * b.depth).toFixed(1) + "px");
      });
    });
  }

  /* ---------------- sound: an opt-in ambient pad ----------------
     Generated live with Web Audio: slow jazz-ish chords and the odd soft
     pentatonic note. No recording, nothing fetched. Off until the reader
     turns it on. */
  function Sound(button) {
    if (!button) { return; }
    var ctx = null, master = null, timer = null, on = false, step = 0;
    var CHORDS = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 69]];
    var PENTA = [72, 74, 76, 79, 81, 84];
    function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
    function voice(freq, t, len, gain, type) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + Math.min(1.6, len / 3));
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + len + 0.1);
    }
    function bar() {
      var t = ctx.currentTime + 0.05, ch = CHORDS[step % CHORDS.length];
      ch.forEach(function (m, i) { voice(hz(m - 12), t + i * 0.04, 4.6, 0.05, "triangle"); });
      for (var k = 0; k < 3; k++) {
        if (Math.random() < 0.6) { voice(hz(PENTA[Math.floor(Math.random() * PENTA.length)]), t + 0.6 + k * 1.3, 1.8, 0.035, "sine"); }
      }
      step++;
    }
    function start() {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { return; }
      if (!ctx) {
        ctx = new AC();
        master = ctx.createGain(); master.gain.value = 0.0001;
        var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1800;
        master.connect(lp); lp.connect(ctx.destination);
      }
      ctx.resume();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 1.5);
      bar(); timer = setInterval(bar, 4000);
    }
    function stop() {
      if (!ctx) { return; }
      clearInterval(timer);
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
    }
    button.addEventListener("click", function () {
      on = !on;
      if (on) { start(); } else { stop(); }
      button.setAttribute("aria-pressed", String(on));
      document.body.classList.toggle("sound-on", on);
    });
  }

  /* A sound-wave line at the top of each chapter, drawn in on arrival. */
  function drawWaves() {
    Array.prototype.forEach.call(document.querySelectorAll(".chapter"), function (sec) {
      var d = "M0 20";
      for (var x = 0; x <= 1200; x += 20) { d += " Q" + (x + 10) + " " + (20 + Math.sin(x / 70) * 14 * Math.sin(x / 260)) + " " + (x + 20) + " 20"; }
      var svg = s("svg", { class: "wave", viewBox: "0 0 1200 40", preserveAspectRatio: "none", "aria-hidden": "true" });
      svg.appendChild(s("path", { d: d, pathLength: 1 }));
      sec.insertBefore(svg, sec.firstChild);
      onEnter(svg, function () { svg.classList.add("in"); });
    });
  }

  /* ---------------- chrome: nav + progress ---------------- */

  function chrome() {
    var bar = byId("topbar"), prog = byId("progress");
    var links = Array.prototype.slice.call(document.querySelectorAll("#chapters a"));
    var ticking = false;
    function onScroll() {
      if (ticking) { return; }
      ticking = true;
      requestAnimationFrame(function () {
        var st = window.scrollY, max = document.documentElement.scrollHeight - window.innerHeight;
        if (prog) { prog.style.transform = "scaleX(" + (max > 0 ? st / max : 0).toFixed(4) + ")"; }
        if (bar) { bar.classList.toggle("scrolled", st > 8); }
        var active = null;
        links.forEach(function (a) {
          var sec = byId(a.getAttribute("href").slice(1));
          if (sec && sec.getBoundingClientRect().top < window.innerHeight * 0.4) { active = a; }
        });
        links.forEach(function (a) { a.classList.toggle("active", a === active); });
        if (active && active.scrollIntoView && active.parentNode.parentNode.scrollWidth > active.parentNode.parentNode.clientWidth) {
          var ul = active.parentNode.parentNode;
          var left = active.offsetLeft - ul.clientWidth / 2 + active.clientWidth / 2;
          ul.scrollTo({ left: left, behavior: "smooth" });
        }
        ticking = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------------- render ---------------- */

  function fetchJSON(path) {
    return fetch(path, { cache: "no-store" }).then(function (res) {
      if (!res.ok) { throw new Error(path + " -> HTTP " + res.status); }
      return res.json();
    });
  }

  function render() {
    Picker(byId("top"));
    ChapterBreaks();
    Promise.all([fetchJSON(FEEDS.breakdown), fetchJSON(FEEDS.substances),
                 fetchJSON(FEEDS.kids), fetchJSON(FEEDS.examples),
                 fetchJSON(FEEDS.race).catch(function () { return null; })])
      .then(function (f) { draw(f[0], f[1], f[2], f[3], f[4]); })
      .catch(function (err) {
        var host = byId("load-error");
        if (host) {
          host.textContent = "Could not load the feeds: " + err.message + ". Serve the repository with " +
            "scripts/serve_private_preview.py and open http://127.0.0.1:8765/site/index.html.";
          host.hidden = false;
        }
        observeReveals();
        Router();
      });
  }

  function draw(bd, subs, kids, examples, race) {
    var facts = byId("facts");
    buildFacts(bd).forEach(function (f) {
      facts.appendChild(h("li", null, [h("b", { text: f.value }), h("span", { text: f.label })]));
    });
    Opener(byId("opener"), bd);

    var FX = oneLiners(bd, subs, kids);
    ["sex", "violence", "drugs"].forEach(function (ch) { drawStory(byId(ch + "-stage"), bd, subs, ch, FX[ch]); });
    drawMoneyStory(byId("money-stage"), bd, FX.money);
    [["sex", SEX], ["violence", "violence_beyond_mention"], ["drugs", "drugs_use_or_sale"], ["money", "money_flex"]].forEach(function (p) {
      var st = byId(p[0] + "-stage");
      if (!st) { return; }
      var host = h("div", { class: "story-step rap-bars" });
      var steps = st.querySelectorAll(".story-step");
      st.insertBefore(host, steps.length > 1 ? steps[1] : null);
      drawRapRnbBars(host, bd, p[1]);
    });
    if (race) {
      var rf = raceFact(race), rs = byId("race-fact");
      if (rf && rs) { rs.appendChild(factBlock(rf, byId("race"))); }
      drawRace(race);
    }
    var kidsHead = byId("kids-headline");
    if (kidsHead) {
      var op = opinionNote(bd);
      kidsHead.parentNode.insertBefore(h("aside", { class: "opinion reveal" }, [
        h("p", { class: "opinion-tag", text: "The author’s opinion" }),
        h("p", { class: "opinion-line", text: "“" + op.opinion + "”" }),
        sentence(op.parts, "opinion-data")]), kidsHead);
      var picked = h("div", { class: "story kids-picked" });
      var intro = byId("kids").querySelector(".answer.lede");
      var introBlock = intro ? (intro.closest(".kids-grid") || intro) : null;
      kidsHead.parentNode.insertBefore(picked, introBlock ? introBlock.nextSibling : kidsHead);
      drawKidsPicked(picked, bd, byId("kids"));
      var party = h("div", { class: "party-wrap" });
      kidsHead.parentNode.insertBefore(party, kidsHead);
      drawParty(party, kids);
      kidsHead.parentNode.insertBefore(factBlock(FX.kids[1], byId("kids")), kidsHead);
    }

    var heat = byId("heatmap");
    if (heat && FX.glance[0]) { heat.parentNode.insertBefore(factBlock(FX.glance[0], byId("glance")), heat); }
    drawBump(byId("substances-bump"), subs);
    drawKids(kids, examples);

    drawHeatmap(byId("heatmap"), bd);

    drawMethod(bd);
    // Explanations that used to sit as small grey text in the chapters now
    // live in the Notes at the bottom, labelled by chapter.
    Array.prototype.forEach.call(document.querySelectorAll(".chapter .caveat"), function (el) {
      var sec = el.closest(".chapter"), name = sec ? (sec.querySelector(".chapter-num") || {}).textContent || "" : "";
      var text = el.textContent.replace(/\s+/g, " ").trim();
      if (text) { addNote((name.split("·").pop() || "").trim() + ": " + text); }
      el.remove();
    });
    drawBubbles();
    fillTeasers(FX, race);
    drawTopicArt();
    drawWaves();
    Sound(byId("sound"));
    var tt = byId("theme-toggle");
    if (tt) {
      var sync = function () { var d = isDark(); tt.textContent = d ? "☀" : "☾"; tt.setAttribute("aria-label", d ? "Switch to light mode" : "Switch to dark mode"); };
      sync();
      tt.addEventListener("click", function () {
        var next = isDark() ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        try { localStorage.setItem("theme", next); } catch (e) {}
        sync();
        document.dispatchEvent(new Event("themechange"));
      });
    }
    fill("footer-generated", "Figures generated " + fmtDate(bd.generated_at) + ".");
    chrome();
    observeReveals();
    Router();
  }

  return {
    FEEDS: FEEDS, BUBBLES: BUBBLES, seriesP: seriesP, kidsPicked: kidsPicked, heatRows: heatRows, rampAt: rampAt, busSeats: busSeats, partyCards: partyCards, opinionNote: opinionNote, rapRnbCounts: rapRnbCounts, raceDecades: raceDecades, raceInsideGenre: raceInsideGenre, raceFact: raceFact, oneLiners: oneLiners, fracWords: fracWords, times: times, FILTERS: FILTERS, LABEL: LABEL, SHORT: SHORT, CHARTS: CHARTS,
    KIDS_GROUP: KIDS_GROUP, SEX: SEX, KIDS_MEASURES: KIDS_MEASURES, LIST_META: LIST_META,
    fmtPct: fmtPct, fmtN: fmtN, oneInPhrase: oneInPhrase, niceMax: niceMax, said: said, saidBig: saidBig, oneIn: oneIn,
    seriesFor: seriesFor, flat: flat, gapNote: gapNote, peakOutside: peakOutside,
    chapterSteps: chapterSteps, withCamera: withCamera, openerSteps: openerSteps, songsByYear: songsByYear, moneySteps: moneySteps,
    flexRatio: flexRatio, ratioPair: ratioPair, dumbbellRows: dumbbellRows, substanceRanks: substanceRanks, kidsLines: kidsLines,
    buildFacts: buildFacts, sexAnswer: sexAnswer, violenceAnswer: violenceAnswer,
    drugsAnswer: drugsAnswer, moneyAnswer: moneyAnswer, callouts: callouts,
    kidsScope: kidsScope, kidsHeadline: kidsHeadline, kidsVsChart: kidsVsChart, kidsWho: kidsWho,
    kidsNumbers: kidsNumbers, kidsClean: kidsClean, pickExamples: pickExamples, exhibitLine: exhibitLine,
    linePointer: linePointer, methodCorpus: methodCorpus, agreementRows: agreementRows,
    render: render
  };
});

/* Billboard lyrics, 1960–2025 — the story page (2026-09-23).

   One page, one scroll. Reads four local feeds and computes every number on
   the page from them; the only fixed text is the prose around the numbers.
   Borrows the plain-language helpers from app.js (window.App).

   North star: the only thing that moves is the evidence, and it moves only
   to make a point. Charts draw in once when they arrive, then each makes its
   one move: sex adds innuendo, drugs fans out by genre, violence splits into
   hip-hop and everything else, money's two lines cross. */

(function () {
  "use strict";
  var A = window.App;
  var FEEDS = {
    bd: "../live/decade-genre-breakdown.json",
    subs: "../live/substances-by-decade.json",
    kids: "../live/kids-full-catalogue.json",
    race: "../live/race-ethnicity-breakdown.json",
    mentions: "../live/drug-mentions.json",
    detail: "../live/content-detail.json",
    examples: "../live/example-songs.json",
    body: "../live/body-phrases.json"
  };
  var SRC = "decade-genre-breakdown.json";
  var SEX = "sex_graphic_or_explicit";
  var KIDS_GROUP = "kca_kidz_bop";
  var SVGNS = "http://www.w3.org/2000/svg";

  /* ---------------- small helpers ---------------- */

  function byId(id) { return document.getElementById(id); }
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") { el.textContent = attrs[k]; } else if (attrs[k] !== null && attrs[k] !== undefined) { el.setAttribute(k, attrs[k]); }
    });
    (kids || []).forEach(function (c) { if (c) { el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); } });
    return el;
  }
  function s(tag, attrs, text) {
    var el = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    if (text !== undefined) { el.textContent = text; }
    return el;
  }
  function reduced() { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, reduced() ? 0 : ms); }); }
  function pct(x, d) { return (x * 100).toFixed(d === undefined ? 1 : d) + "%"; }
  function fmtN(n) { return Number(n).toLocaleString("en-US"); }
  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  // Plain percentages, whole numbers ("35%"); the exact count is in the note.
  function said(x) {
    if (!x) { return "0%"; }
    if (x < 0.01) { return "under 1%"; }
    return Math.round(x * 100) + "%";
  }
  function nb(t) { return String(t).replace(/–/g, "\u2060–\u2060"); }  // keep "2020–25" on one line
  function isDark() { return document.documentElement.getAttribute("data-theme") !== "light"; }

  function onView(el, fn, threshold) {
    if (!el) { return; }
    if (reduced() || typeof IntersectionObserver === "undefined") { fn(); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) { return; }
        io.disconnect();
        // Inside a slide, a chart only starts once the slide's heading has streamed in.
        var sl = document.documentElement.classList.contains("reels") && el.closest && el.closest(".slide");
        if (sl && !sl.classList.contains("ready")) { sl.addEventListener("slideready", function () { fn(); }, { once: true }); } else { fn(); }
      });
    }, { threshold: threshold === undefined ? 0.4 : threshold });
    io.observe(el);
  }

  /* ---------------- notes: one list at the bottom, numbered straight through ---------------- */

  var notes = { seen: {}, n: 0 };
  function note(text) {
    if (!text) { return null; }
    if (notes.seen[text]) { return notes.seen[text]; }
    var k = ++notes.n;
    byId("notes-list").appendChild(h("li", { id: "note-" + k, text: text }));
    notes.seen[text] = k;
    return k;
  }
  function mark(text) { var k = note(text); return k ? h("a", { class: "fn", href: "#note-" + k, "aria-label": "Note " + k, text: String(k) }) : null; }

  /* A sentence from parts: strings, or {b: "1 in 3", note: "…"}. */
  function say(el, parts) {
    if (!el) { return; }
    el.textContent = "";
    var marks = [];
    parts.forEach(function (p) {
      if (!p) { return; }
      if (typeof p === "string") { el.appendChild(document.createTextNode(p.replace(/(\d)–(\d)/g, "$1\u2060–\u2060$2"))); return; }
      if (p.nodeType) { el.appendChild(p); return; }
      if (p.b) { el.appendChild(h("b", { text: String(p.b).replace(/ /g, "\u00a0") })); }
      if (p.t) { el.appendChild(document.createTextNode(p.t)); }
      if (p.note) { marks.push(mark(p.note)); }
    });
    // Note numbers sit together at the end, never glued to a figure ("1 in 21" + note 15 read as "1 in 2115").
    if (marks.length) { var g = h("span", { class: "fns" }); marks.forEach(function (m, i) { if (i) { g.appendChild(document.createTextNode(",")); } g.appendChild(m); }); el.appendChild(g); }
  }

  /* ---------------- data access ---------------- */

  var D;  // the breakdown feed
  function cellOf(src, label, g) {
    var c = D[src][g ? label + "|" + g : label];
    return c && c.reliable !== false ? c : null;
  }
  function val(src, label, g, m) {
    var c = cellOf(src, label, g);
    if (!c) { return null; }
    var x = c.measures[m];
    if (!x || x.reliable === false) { return null; }  // topics measures carry their own min_n
    return { share: x.share, hits: x.n, n: c.n_songs, label: label, g: g, src: src, m: m };
  }
  var GNAME = { hip_hop: "hip-hop", pop: "pop", rock: "rock", rnb_soul: "R&B/soul", country: "country", electronic_dance: "dance/electronic", latin: "Latin" };
  function cite(v, what) {
    var who = v.src.indexOf("without") >= 0 ? ", songs with no " + GNAME[v.g] + " tag" : v.g ? ", songs tagged " + GNAME[v.g] : "";
    return v.label + who + ": " + fmtN(v.hits) + " of " + fmtN(v.n) + " songs (" + pct(v.share) + ") " + what + ". Source: " + SRC + ", " +
      v.src + ' "' + (v.g ? v.label + "|" + v.g : v.label) + '" → ' + v.m + ".";
  }
  // "Today" is a wider window than the short 2020s: every song since 2010.
  var WIN = ["2010s", "2020s"], WSINCE = "since 2010", WSINCE_C = "Since 2010";
  function decW(m, g, wo) {
    var xs = WIN.map(function (d) { return dec(m, d, g, wo); });
    if (xs.some(function (x) { return !x; })) { return null; }
    var hits = xs.reduce(function (t, x) { return t + x.hits; }, 0), n = xs.reduce(function (t, x) { return t + x.n; }, 0);
    return { share: hits / n, hits: hits, n: n, label: "2010s + 2020s", g: xs[0].g, src: xs[0].src, m: m };
  }
  // The comparison point: the quietest decade before 2000 for this topic, always named.
  function low(m, g, wo) {
    var best = null;
    DEC.filter(function (d) { return d < "2000s"; }).forEach(function (d) { var x = dec(m, d, g, wo); if (x && (!best || x.share < best.share)) { best = x; } });
    return best;
  }
  function dec(m, d, g, wo) { return val(wo ? "by_decade_without_genre" : g ? "by_decade_genre" : "by_decade", d, g, m); }
  function per(m, p, g, wo) { return val(wo ? "by_period5_without_genre" : g ? "by_period5_genre" : "by_period5", p, g, m); }
  function series(m, g, wo) { return PER.map(function (p) { var v = per(m, p, g, wo); return v ? v.share : null; }); }
  var PER, DEC, FIRST, LAST;

  var WHAT = {
    sex_graphic_or_explicit: "describe sex graphically", sex_suggestive: "keep sex to innuendo", sex_romantic_or_none: "have nothing sexual beyond romance",
    drugs_use_or_sale: "describe drug use or dealing", alcohol: "name alcohol", drugs_opioids_pills: "name opioids, lean or pills",
    violence_beyond_mention: "threaten or carry out violence", violence_celebrated: "celebrate violence",
    money_flex: "flex money", money_struggle_or_critique: "struggle for money or turn it down", brands_named: "name-drop a brand to flex",
    profanity_strong: "use strong swearing", weapon_named: "name a weapon", mental_health_described: "describe mental health",
    politics_protest: "carry political protest",
    casual_sex: "invite or describe a hook-up", cheating_act: "have someone cheating, or proposing to",
    cheating_speaker_as_other: "are sung by the other man or woman, taking someone’s partner", cheating_approving: "celebrate cheating",
    cheating_central: "are about cheating", crime_described: "describe a crime being committed, planned or punished",
    crime_approving: "glorify or justify crime", police_any: "have police in them", anti_police: "are hostile to or critical of police", sex_objectifying: "take an objectifying stance", sex_in_chorus: "put sex or romance in the chorus"
  };
  // Figures are song counts: "182 of 515". The note carries the source.
  function B(v) { return { b: fmtN(v.hits) + " of " + fmtN(v.n), note: cite(v, WHAT[v.m] || v.m) }; }
  // "482 of the 1,403" — reads as part of a sentence that says what the 1,403 are.
  // A share in plain percent, for the "(32%)" after a count.
  function P(v) { var x = v.share !== undefined ? v.share : v; return x > 0 && x < 0.01 ? "under 1%" : Math.round(100 * x) + "%"; }
  function Bof(v) { return { b: fmtN(v.hits) + " of the " + fmtN(v.n), note: cite(v, WHAT[v.m] || v.m) }; }
  function Bn(v) { return { b: fmtN(v.hits), note: cite(v, WHAT[v.m] || v.m) }; }
  // How today compares with the 1960s, in plain words: "5 times as many", "twice as many", "40% more".
  function times(now, then) {
    var when = "the " + (then ? then.label : FIRST);
    if (!then || !then.share) { return "In " + when + ": none"; }
    if (then.hits < 10) { return "In the whole " + then.label + ": " + then.hits; }
    var r = now.share / then.share;
    return r >= 1.8 ? "That’s " + Math.round(r) + "× the rate of " + when : "Up " + Math.round((r - 1) * 100) + "% on " + when;
  }



  /* ---------------- line charts ---------------- */

  function LineChart(host, o) {
    this.host = host; this.labels = o.labels; this.ymax = o.ymax || 0.5;
    var W = Math.round(Math.min(880, Math.max(320, host.clientWidth || 880)));
    this.narrow = W < 560;
    var H = this.narrow ? 280 : 380;
    var m = this.m = { t: 22, r: this.narrow ? 96 : 176, b: 32, l: 40 };
    this.W = W; this.H = H; this.iw = W - m.l - m.r; this.ih = H - m.t - m.b;
    var svg = this.svg = s("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": o.aria || "" });
    var grid = s("g", { class: "grid" }), axis = s("g", { class: "axis" });
    var self = this;
    [0, 0.25, 0.5].forEach(function (t) {
      if (t > self.ymax) { return; }
      grid.appendChild(s("line", { x1: m.l, x2: m.l + self.iw, y1: self.y(t), y2: self.y(t) }));
      axis.appendChild(s("text", { class: "ylab", x: m.l - 8, y: self.y(t) + 4, "text-anchor": "end" }, pct(t, 0)));
    });
    this.labels.forEach(function (lab, i) {
      if (i % 2 !== 0) { return; }
      var last = i === self.labels.length - 1;
      axis.appendChild(s("text", { x: self.x(i), y: H - 8, "text-anchor": last ? "middle" : "middle" }, last ? lab : lab.slice(0, 4)));
    });
    svg.appendChild(grid); svg.appendChild(axis);
    this.gL = s("g"); this.gLab = s("g"); this.gAnn = s("g");
    svg.appendChild(this.gL); svg.appendChild(this.gAnn); svg.appendChild(this.gLab);
    host.appendChild(svg);
    this.lines = {};
  }
  LineChart.prototype.x = function (i) { return this.m.l + this.iw * i / (this.labels.length - 1); };
  LineChart.prototype.y = function (v) { return this.m.t + this.ih * (1 - Math.min(v, this.ymax) / this.ymax); };
  LineChart.prototype.d = function (vals) {
    var self = this, d = "", pen = false;
    vals.forEach(function (v, i) {
      if (v === null || v === undefined) { pen = false; return; }
      d += (pen ? "L" : "M") + self.x(i).toFixed(1) + " " + self.y(v).toFixed(1);
      pen = true;
    });
    return d;
  };
  // The shaded area under a line, down to 0%.
  LineChart.prototype.area = function (vals) {
    var self = this, pts = [];
    vals.forEach(function (v, i) { if (v !== null && v !== undefined) { pts.push([self.x(i), self.y(v)]); } });
    if (!pts.length) { return ""; }
    var base = this.y(0).toFixed(1);
    return "M" + pts[0][0].toFixed(1) + " " + base + pts.map(function (p) { return " L" + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join("") + " L" + pts[pts.length - 1][0].toFixed(1) + " " + base + " Z";
  };
  LineChart.prototype.add = function (key, vals, cls, label) {
    var a = s("path", { class: "area " + cls, d: this.area(vals) });
    a.style.opacity = "0";
    this.gL.insertBefore(a, this.gL.firstChild);
    var p = s("path", { class: "l " + cls, d: this.d(vals) });
    p.style.opacity = "0";
    p.areaPath = a;
    this.gL.appendChild(p);
    var t = null;
    if (label) {
      t = s("text", { class: "lab" });
      t.appendChild(s("tspan", {}, label + " "));
      t.appendChild(s("tspan", { class: "v" }, ""));
      t.style.opacity = "0";
      t.style.transition = "opacity .6s ease";
      this.gLab.appendChild(t);
    }
    this.lines[key] = { path: p, label: t, vals: vals };
    this.relabel(key);
    return this.lines[key];
  };
  LineChart.prototype.relabel = function (key) {
    var L = this.lines[key]; if (!L.label) { return; }
    var i = L.vals.length - 1; while (i >= 0 && (L.vals[i] === null || L.vals[i] === undefined)) { i--; }
    if (i < 0) { return; }
    L.ly = this.y(L.vals[i]); L.lx = this.x(i) + 8;
    L.label.lastChild.textContent = pct(L.vals[i]);
    this.place();
  };
  // Keep end labels from overlapping: nudge them apart vertically.
  LineChart.prototype.place = function () {
    var self = this, ls = Object.keys(this.lines).map(function (k) { return self.lines[k]; })
      .filter(function (L) { return L.label && L.label.style.opacity !== "0" && L.ly !== undefined; });
    ls.sort(function (a, b) { return a.ly - b.ly; });
    var prev = -1e9;
    ls.forEach(function (L) { var y = Math.max(L.ly + 4, prev + 16); L.label.setAttribute("x", L.lx); L.label.setAttribute("y", y); prev = y; });
    Object.keys(this.lines).forEach(function (k) {
      var L = self.lines[k];
      if (L.label && L.label.style.opacity === "0" && L.ly !== undefined) { L.label.setAttribute("x", L.lx); L.label.setAttribute("y", L.ly + 4); }
    });
  };
  LineChart.prototype.showLabel = function (key) { var L = this.lines[key]; if (L && L.label) { L.label.style.opacity = "1"; this.place(); } };
  // Draw a line in from left to right.
  LineChart.prototype.draw = function (key, ms) {
    var L = this.lines[key], p = L.path, self = this;
    p.style.opacity = "1";
    if (p.areaPath) { p.areaPath.style.transition = "opacity 1.2s ease " + Math.round(ms * 0.5) + "ms"; p.areaPath.style.opacity = "1"; }
    if (reduced() || p.classList.contains("dash")) {
      p.style.transition = "opacity .8s ease"; self.showLabel(key); return wait(reduced() ? 0 : 800);
    }
    var len = p.getTotalLength();
    p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
    p.getBoundingClientRect();
    p.style.transition = "stroke-dashoffset " + ms + "ms cubic-bezier(.35,.1,.25,1)";
    p.style.strokeDashoffset = "0";
    return wait(ms).then(function () { p.style.strokeDasharray = ""; p.style.strokeDashoffset = ""; p.style.transition = ""; self.showLabel(key); });
  };
  // Move a line from one shape to another (the twist).
  LineChart.prototype.tween = function (key, from, to, ms) {
    var L = this.lines[key], self = this;
    L.path.style.opacity = "1";
    if (reduced()) { L.vals = to; L.path.setAttribute("d", this.d(to)); this.relabel(key); this.showLabel(key); return Promise.resolve(); }
    return new Promise(function (done) {
      var t0 = null;
      function step(t) {
        if (t0 === null) { t0 = t; }
        var k = Math.min(1, (t - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        var cur = to.map(function (v, i) { return v === null || from[i] === null ? null : from[i] + (v - from[i]) * e; });
        L.vals = cur; L.path.setAttribute("d", self.d(cur)); self.relabel(key);
        if (k < 1) { requestAnimationFrame(step); } else { self.showLabel(key); done(); }
      }
      requestAnimationFrame(step);
    });
  };
  LineChart.prototype.fade = function (key, op) { var p = this.lines[key].path; p.style.transition = "opacity .8s ease"; p.style.opacity = String(op); if (this.lines[key].label) { this.lines[key].label.style.opacity = op < 0.5 ? "0" : "1"; } };
  LineChart.prototype.note = function (i, v, text, above) {
    var g = s("g"), x = this.x(i), y = this.y(v), ty = above === false ? y + 22 : y - 14;
    g.appendChild(s("circle", { class: "ann-dot", cx: x, cy: y, r: 4 }));
    var anchor = x > this.m.l + this.iw * 0.7 ? "end" : x < this.m.l + this.iw * 0.2 ? "start" : "middle";
    g.appendChild(s("text", { class: "ann", x: x, y: ty, "text-anchor": anchor }, text));
    g.style.opacity = "0"; g.style.transition = "opacity .7s ease";
    this.gAnn.appendChild(g);
    g.getBoundingClientRect(); g.style.opacity = "1";
    return wait(700);
  };
  function legend(host, items) {
    host.appendChild(h("p", { class: "legend" }, items.reduce(function (acc, it) {
      var i = h("i", { class: it.dash ? "dash" : "" }); i.style.borderColor = it.color;
      return acc.concat([i, it.label]);
    }, [])));
  }
  function firstCross(a, b) { for (var i = 0; i < a.length; i++) { if (a[i] !== null && b[i] !== null && a[i] > b[i]) { return i; } } return -1; }
  function lastIdx(vals) { var i = vals.length - 1; while (i >= 0 && vals[i] === null) { i--; } return i; }

  /* ---------------- 0. opening ---------------- */

  // The opener: one ink dot per song, a column per year, stippling in left to right.
  function drawDots(host) {
    if (!host) { return; }
    var years = Object.keys(D.by_year).sort(), max = 0;
    years.forEach(function (y) { max = Math.max(max, D.by_year[y].n_songs); });
    var px = 8, py = 5, W = years.length * px, H = max * py;
    var svg = s("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": fmtN(D.n_songs) + " songs, one dot each, by year from " + years[0] + " to " + years[years.length - 1] + "." });
    years.forEach(function (y, i) {
      var n = D.by_year[y].n_songs, g = s("g", { class: "dcol", style: "--c:" + i });
      var t = s("title", null, y + ": " + n + " songs"); g.appendChild(t);
      for (var k = 0; k < n; k++) { g.appendChild(s("circle", { cx: (i * px + px / 2).toFixed(1), cy: (H - k * py - py / 2).toFixed(1), r: 1.7 })); }
      svg.appendChild(g);
    });
    host.appendChild(svg);
  }
  function drawOpen() {
    drawDots(byId("open-dots"));
    byId("open-count").textContent = fmtN(D.n_songs);
    byId("open-note").appendChild(mark(A.methodCorpus(D)));
    var cue = document.querySelector(".open-cue");
    window.addEventListener("scroll", function once() { if (window.scrollY > 20) { cue.classList.add("gone"); window.removeEventListener("scroll", once); } }, { passive: true });
  }

  /* ---------------- 1. the heatmap ---------------- */

  var HEAT_ROWS = [
    ["sex_suggestive", "Innuendo", "sex", "sex"],
    [SEX, "Graphic sex", "sex", "sex"],
    ["casual_sex", "Hook-ups", "sex", "sex"],
    ["cheating_act", "Cheating", "sex", "sex"],
    ["alcohol", "Alcohol", "drugs", "drugs"],
    ["drugs_use_or_sale", "Drug use or dealing", "drugs", "drugs"],
    ["money_flex", "Flexing money", "money", "money"],
    ["brands_named", "Brand name-drops", "money", "money"],
    ["profanity_strong", "Strong swearing", "grey", "rest"],
    ["weapon_named", "Names a weapon", "violence", "violence"],
    ["violence_beyond_mention", "Violence", "violence", "violence"],
    ["violence_celebrated", "Violence celebrated", "violence", "violence"],
    ["crime_approving", "Crime glorified", "violence", "violence"],
    ["mental_health_described", "Mental health", "grey", "rest"],
    ["politics_protest", "Protest", "grey", "rest"]
  ];
  var FAMILY = {
    dark: { sex: "#e8708f", drugs: "#4fbf8f", money: "#e2b53e", violence: "#e0845a", grey: "#c9c1b2", bg: "#0f0e0c" },
    light: { sex: "#b8325a", drugs: "#1f7a52", money: "#9a6d0a", violence: "#b0502a", grey: "#4a443a", bg: "#f6f2ea" }
  };
  function mixHex(a, b, t) {
    var pa = [1, 3, 5].map(function (i) { return parseInt(a.slice(i, i + 2), 16); });
    var pb = [1, 3, 5].map(function (i) { return parseInt(b.slice(i, i + 2), 16); });
    return "rgb(" + pa.map(function (v, i) { return Math.round(v + (pb[i] - v) * t); }).join(",") + ")";
  }

  function drawHeat() {
    var host = byId("heat"), years = Object.keys(D.by_year).sort();
    var rows = HEAT_ROWS.map(function (r) {
      var vals = years.map(function (y) { var c = D.by_year[y]; return { y: y, share: c.measures[r[0]].share, hits: c.measures[r[0]].n, n: c.n_songs }; });
      var max = Math.max.apply(null, vals.map(function (v) { return v.share; }));
      return { key: r[0], label: r[1], fam: r[2], ch: r[3], vals: vals, max: max };
    });
    var rowH = 20, labels = h("div", { class: "heat-labels" }), scroll = h("div", { class: "heat-scroll" });
    host.style.setProperty("--rowh", rowH + "px");
    rows.forEach(function (r) {
      var b = h("button", { type: "button", text: r.label, title: "Go to this chapter" });
      b.addEventListener("click", function () { var t = byId(r.ch); if (t) { t.scrollIntoView({ behavior: reduced() ? "auto" : "smooth" }); } });
      r.btn = b; labels.appendChild(b);
    });
    host.appendChild(labels); host.appendChild(scroll);
    var readout = byId("heat-readout"), cells = [];
    function paint() {
      var F = FAMILY[isDark() ? "dark" : "light"];
      cells.forEach(function (c) { c.el.setAttribute("fill", mixHex(F.bg, F[c.r.fam], c.r.max ? c.v.share / c.r.max : 0)); });
    }
    function build() {
      scroll.textContent = ""; cells = [];
      var W = Math.max(594, scroll.clientWidth || 594), cw = W / years.length, H = rows.length * rowH + 22;
      var svg = s("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img",
        "aria-label": "Heatmap: " + rows.length + " things a song can do, by year from " + years[0] + " to " + years[years.length - 1] + "; each row shaded against its own peak year." });
      rows.forEach(function (r, ri) {
        r.vals.forEach(function (v, ci) {
          var el = s("rect", { class: "hm-cell", x: (ci * cw).toFixed(2), y: ri * rowH + 1, width: (cw - 1).toFixed(2), height: rowH - 2, rx: 1.5 });
          el.style.setProperty("--c", ci);
          el.addEventListener("mouseenter", function () { show(r, v); });
          el.addEventListener("click", function () { show(r, v); });
          svg.appendChild(el); cells.push({ el: el, r: r, v: v });
        });
      });
      years.forEach(function (y, ci) {
        var lastY = ci === years.length - 1;
        if (+y % 10 === 0 || lastY) {
          svg.appendChild(s("text", { class: "hm-year", x: ci === 0 ? 0 : lastY ? W : ci * cw + cw / 2, y: H - 6, "text-anchor": ci === 0 ? "start" : lastY ? "end" : "middle" }, y));
        }
      });
      svg.addEventListener("mouseleave", clear);
      scroll.appendChild(svg);
      paint();
    }
    function show(r, v) {
      rows.forEach(function (x) { x.btn.classList.toggle("on", x === r); });
      readout.textContent = r.label + ", " + v.y + ": " + fmtN(v.hits) + " of " + fmtN(v.n) + " songs (" + said(v.share) + ").";
    }
    function clear() { rows.forEach(function (x) { x.btn.classList.remove("on"); }); readout.innerHTML = "&nbsp;"; }
    build();
    var rt = null;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { var go = host.classList.contains("go"); build(); if (go) { host.classList.add("go"); } }, 200); });
    document.addEventListener("themechange", paint);
    onView(host, function () { host.classList.add("go"); }, 0.25);
    byId("heat-caption").appendChild(mark("Each row is shaded against its own busiest year, so a row that barely moves still spans light to dark. Hover or tap a square for its count. Source: " + SRC + ", by_year, " + years.length + " years, " + fmtN(D.n_songs) + " songs."));
  }

  /* ---------------- chapter break cards ---------------- */

  function drawBreaks() {
    Array.prototype.forEach.call(document.querySelectorAll(".break"), function (b) { onView(b, function () { b.classList.add("in"); }, 0.35); });
  }

  /* ---------------- folk bubbles ---------------- */

  function avatar(who) {
    var hue = 0; for (var i = 0; i < who.length; i++) { hue = (hue * 31 + who.charCodeAt(i)) % 360; }
    var a = h("span", { class: "avatar", "aria-hidden": "true", text: who.replace(/^[@ur/]+/, "").charAt(0).toUpperCase() });
    a.style.background = "hsl(" + hue + " 45% 42%)";
    return a;
  }
  function drawBubbles() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-bubbles]"), function (host) {
      var ch = host.getAttribute("data-bubbles"), seen = {};
      (A.BUBBLES[ch] || []).filter(function (b) { if (seen[b.text]) { return false; } seen[b.text] = 1; return true; }).slice(0, 2).forEach(function (b) {
        host.appendChild(h("figure", { class: "bubble" }, [h("p", { text: b.text }), h("figcaption", null, [avatar(b.who), b.who])]));
      });
    });
  }



  /* ---------- annotations: a curved arrow from then to now with a "4×" tag, and a red ring on now ----------
     Drawn in after the chart comes into view (CSS: .anno inside a .go host). */
  var annoN = 0;
  function ratioTag(a, b) {
    if (a === null || b === null || b === undefined) { return ""; }
    if (a < 0.005) { return b >= 0.05 ? "from almost zero" : ""; }
    var r = b / a;
    return r >= 1.5 ? Math.round(r) + "×" : r <= 0.67 ? "−" + Math.round((1 - r) * 100) + "%" : "";
  }
  // A red-pen bracket beside the latest value: a dashed pencil line carries the old height across,
  // the bracket spans old to new, and the multiple is written next to it by hand.
  function annotate(svg, x0, y0, x1, y1, tag, side) {
    return;  // owner: no red markings on the charts (2026-09-24)
    if (!tag) { return; }
    var id = "rough" + (++annoN), defs = s("defs"), f = s("filter", { id: id, x: "-5%", y: "-5%", width: "110%", height: "110%" });
    f.appendChild(s("feTurbulence", { type: "fractalNoise", baseFrequency: "0.04", numOctaves: 2, seed: annoN, result: "n" }));
    f.appendChild(s("feDisplacementMap", { in: "SourceGraphic", in2: "n", scale: 2.5 }));
    defs.appendChild(f); svg.appendChild(defs);
    var left = side === "left", xb = left ? x1 - 14 : x1 + 14, tick = left ? 6 : -6;
    var g = s("g", { class: "anno", filter: "url(#" + id + ")" });
    g.appendChild(s("path", { d: "M" + x0.toFixed(1) + " " + y0.toFixed(1) + " H " + xb.toFixed(1), class: "anno-guide", pathLength: 1 }));
    g.appendChild(s("path", { d: "M" + (xb + tick).toFixed(1) + " " + y0.toFixed(1) + " H " + xb.toFixed(1) + " V " + y1.toFixed(1) + " H " + (xb + tick).toFixed(1), class: "anno-arrow", pathLength: 1 }));
    g.appendChild(s("text", { x: (left ? xb - 8 : xb + 8).toFixed(1), y: ((y0 + y1) / 2 + 7).toFixed(1), "text-anchor": left ? "end" : "start", class: "anno-hand" }, tag));
    svg.appendChild(g);
  }


  /* Solid vertical bars, one group per five-year step. Series: {vals, color, label, overlay}.
     An overlay series (a subset of the one before it) draws inside that bar, darker. */
  function barChart(host, o) {
    // Rule: one statistic -> bars; comparing two or more -> lines.
    if (o.series.length >= 2) {
      if (o.title) { host.appendChild(h("p", { class: "chart-title", text: o.title })); }
      var c = new LineChart(host, { labels: o.labels, aria: o.aria });
      var cls = function (col) { return col === "var(--line)" ? "main" : col === "var(--ink)" ? "comp" : "grey"; };
      o.series.forEach(function (sr, i) { c.add("s" + i, sr.vals, cls(sr.color), sr.label.charAt(0).toUpperCase() + sr.label.slice(1)); });
      if (o.legend) { legend(host, o.legend.map(function (l) { return { color: l.color, label: l.label }; })); }
      var p = Promise.resolve();
      o.series.forEach(function (sr, i) { p = p.then(function () { return c.draw("s" + i, i ? 1600 : 2400); }); });
      var a0 = o.series[0].vals, j0 = 0; while (j0 < a0.length && a0[j0] === null) { j0++; }
      var jN = a0.length - 1;
      p.then(function () { annotate(c.svg, c.x(j0), c.y(a0[j0]), c.x(jN), c.y(a0[jN]), o.tag !== undefined ? o.tag : ratioTag(a0[j0], a0[jN]), "left"); host.classList.add("go"); });
      return;
    }
    var W = Math.round(Math.min(880, Math.max(320, host.clientWidth || 880))), narrow = W < 560;
    var H = narrow ? 280 : 380, m = { t: 36, r: 12, b: 32, l: 40 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
    if (o.title) { host.appendChild(h("p", { class: "chart-title", text: o.title })); }
    var main = o.series.filter(function (sr) { return !sr.overlay; });
    var peak = 0; o.series.forEach(function (sr) { sr.vals.forEach(function (v) { if (v !== null) { peak = Math.max(peak, v); } }); });
    var ymax = o.ymax || (peak > 0.25 ? 0.5 : 0.25);
    var y = function (v) { return m.t + ih * (1 - v / ymax); };
    var n = o.labels.length, gw = iw / n, gap = Math.max(2, gw * 0.18), bw = (gw - gap) / main.length;
    var svg = s("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": o.aria || "" });
    var grid = s("g", { class: "grid" }), axis = s("g", { class: "axis" }), bars = s("g", { class: "vbars" });
    (ymax > 0.25 ? [0, 0.25, 0.5] : [0, 0.1, 0.2]).forEach(function (t) {
      grid.appendChild(s("line", { x1: m.l, x2: m.l + iw, y1: y(t), y2: y(t) }));
      axis.appendChild(s("text", { class: "ylab", x: m.l - 8, y: y(t) + 4, "text-anchor": "end" }, pct(t, 0)));
    });
    o.labels.forEach(function (lab, i) {
      if (i % 2 !== 0 && i !== n - 1) { return; }
      axis.appendChild(s("text", { x: m.l + gw * i + gw / 2, y: H - 8, "text-anchor": "middle" }, i === n - 1 ? lab : lab.slice(0, 4)));
    });
    var k = -1;
    o.series.forEach(function (sr) {
      if (!sr.overlay) { k++; }
      var slot = k, inset = sr.overlay ? bw * 0.22 : 0;
      sr.vals.forEach(function (v, i) {
        if (v === null || v === undefined) { return; }
        var x0 = m.l + gw * i + gap / 2 + slot * bw + inset, hgt = ih * v / ymax;
        var r = s("rect", { class: "vbar", x: x0.toFixed(1), y: y(v).toFixed(1), width: Math.max(1, bw - 1 - 2 * inset).toFixed(1), height: Math.max(0, hgt).toFixed(1), rx: 2, fill: sr.color, style: "--i:" + i });
        r.appendChild(s("title", null, o.labels[i] + " · " + sr.label + ": " + pct(v)));
        bars.appendChild(r);
      });
      var li = sr.vals.length - 1;
      if (!sr.overlay && sr.vals[li] !== null) {
        bars.appendChild(s("text", { class: "vlab", x: (m.l + gw * li + gap / 2 + slot * bw + bw / 2).toFixed(1), y: (y(sr.vals[li]) - 22).toFixed(1), "text-anchor": "middle" }, pct(sr.vals[li], 0)));
      }
    });
    svg.appendChild(grid); svg.appendChild(bars); svg.appendChild(axis);
    axis.appendChild(s("text", { class: "ylab", x: m.l - 8, y: m.t - 14, "text-anchor": "end" }, "of songs"));
    // then → now: from the first step to the last, with the multiple.
    var v0 = main[0].vals, i0 = 0; while (i0 < n && v0[i0] === null) { i0++; }
    var iN = n - 1, cx = function (i) { return m.l + gw * i + gap / 2 + bw / 2; };
    annotate(svg, cx(i0), y(v0[i0]), cx(iN) + bw / 2, y(v0[iN]), o.tag !== undefined ? o.tag : ratioTag(v0[i0], v0[iN]));
    host.appendChild(svg);
    if (o.legend) { legend(host, o.legend); }
    onView(host, function () { host.classList.add("go"); });
  }


  /* Reels: group the page into full-screen slides, each a sentence and the chart that
     proves it. Built at load from the existing blocks, so every id stays where it was. */
  function slidify() {
    function wrap(nodes, parent, before) {
      var sl = h("div", { class: "slide" });
      parent.insertBefore(sl, before);
      nodes.forEach(function (n) { sl.appendChild(n); });
      return sl;
    }
    var pic = byId("picture");
    if (pic) {
      var kids = Array.prototype.slice.call(pic.children), tn = kids.filter(function (k) { return k.querySelector && k.querySelector("#thennow"); });
      var head = kids.filter(function (k) { return tn.indexOf(k) < 0; });
      wrap(head, pic, pic.firstChild);
      if (tn.length) { wrap(tn, pic, null); }
    }
    Array.prototype.forEach.call(document.querySelectorAll("section.chapter"), function (sec) {
      var groups = [], cur = null;
      Array.prototype.slice.call(sec.children).forEach(function (el) {
        var isText = el.classList.contains("col") && el.classList.contains("beats");
        // One chart per slide: a sentence opens a slide, and a second chart starts its own.
        var hasChart = cur && cur.some(function (c) { return c.classList.contains("chart-col"); });
        if (!cur || (isText && hasChart) || (!isText && hasChart)) { cur = []; groups.push(cur); }
        cur.push(el);
      });
      groups.forEach(function (g) { wrap(g, sec, null); });
    });
    ["author", "method"].forEach(function (id) { var el = byId(id); if (el) { el.classList.add("slide"); } });
  }


  /* Reels motion: one gesture moves one slide with a slow, eased glide, then the slide
     comes alive — its words stream in and its charts draw (their own onView). Tall
     slides (the method) scroll normally until their edge. Reduced motion: plain scroll. */
  function reels() {
    var slides = Array.prototype.slice.call(document.querySelectorAll("#top, .slide"));
    if (!slides.length || reduced()) { slides.forEach(activate); return; }
    document.documentElement.classList.add("reels");
    // Native scrolling with the browser's own snap (CSS); a slide comes alive once it's mostly on screen.
    function streamWords(root) {
      var w = 0, walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), nodes = [];
      while (walk.nextNode()) { if (walk.currentNode.nodeValue.trim()) { nodes.push(walk.currentNode); } }
      nodes.forEach(function (t) {
        if (t.parentNode.closest && t.parentNode.closest(".fn, .fns")) { return; }
        var frag = document.createDocumentFragment();
        t.nodeValue.split(/(\s+)/).forEach(function (part) {
          if (!part) { return; }
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          var sp = document.createElement("span"); sp.className = "w"; sp.style.setProperty("--w", w++); sp.textContent = part; frag.appendChild(sp);
        });
        t.parentNode.replaceChild(frag, t);
      });
    }
    function countUp(el, delay) {
      if (reduced()) { return; }
      var txt = el.textContent, m = txt.match(/\d[\d,]*(\.\d+)?/);
      if (!m || /(^|\D)(19|20)\d\d/.test(txt)) { return; }  // never count up a year or decade
      var target = parseFloat(m[0].replace(/,/g, "")), dec = m[1] ? m[1].length - 1 : 0;
      if (!isFinite(target) || target < 2) { return; }
      var fmt = function (v) { var t = v.toFixed(dec); return m[0].indexOf(",") >= 0 ? Number(t).toLocaleString("en-US") : t; };
      el.textContent = txt.replace(m[0], fmt(0));
      setTimeout(function () {
        var t0 = performance.now(), ms = 1300;
        (function step(now) {
          var k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
          el.textContent = txt.replace(m[0], fmt(target * e));
          if (k < 1) { requestAnimationFrame(step); } else { el.textContent = txt; }
        })(t0);
      }, delay);
    }
    function activate(sl) {
      if (!sl || sl.classList.contains("on")) { return; }
      // The heading streams in first; the chart waits until its words are nearly all in.
      var words = 0;
      Array.prototype.forEach.call(sl.querySelectorAll(".cap .line, .col .line, .col .prose"), function (el) {
        if (!el.dataset.streamed) {
          el.dataset.streamed = "1"; streamWords(el);
          // Keep the note numbers glued to the last word (inline-block words let them drift).
          var fns = el.querySelector(":scope > .fns"), ws = el.querySelectorAll(".w");
          if (fns && ws.length) { ws[ws.length - 1].appendChild(fns); }
        }
        words += el.querySelectorAll(".w").length;
      });
      requestAnimationFrame(function () { sl.classList.add("on"); });
      // The picture leads; figures in the caption count up as its words stream in after it.
      Array.prototype.forEach.call(sl.querySelectorAll(".cap b .w"), function (w) { countUp(w, 1000 + (+w.style.getPropertyValue("--w") || 0) * 75); });
      Array.prototype.forEach.call(sl.querySelectorAll(".big-fig b, .tally-lead b, .mlead b"), function (el) { countUp(el, 350); });
      setTimeout(function () { sl.classList.add("ready"); sl.dispatchEvent(new Event("slideready")); }, 250);
    }
    var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { activate(en.target); } }); }, { threshold: 0.55 });
    slides.forEach(function (sl) { io.observe(sl); });
    activate(slides[0]);
  }

  /* ---------------- 2. sex ---------------- */

  function drawSex() {
    var ex0 = low(SEX), ex1 = decW(SEX);
    say(byId("sex-line"), [WSINCE_C + ", ", Bn(ex1), " year-end chart songs (" + P(ex1) + ") are sexually graphic. ", { b: times(ex1, ex0), note: cite(ex0, WHAT[SEX]) }, "."]);
    var sg0 = low("sex_suggestive"), sg1 = decW("sex_suggestive");
    say(byId("sex-twist"), ["Innuendo never left. Graphic piled on top."]);

    var host = byId("chart-sex"), ex = series(SEX), sg = series("sex_suggestive");
    barChart(host, { labels: PER, title: "Graphic sex vs innuendo, share of chart songs every five years", aria: "Graphic sex and innuendo, share of songs, five-year steps 1960 to 2025.",
      series: [{ vals: ex, color: "var(--line)", label: "graphic sex" }, { vals: sg, color: "var(--grey-line)", label: "innuendo only" }],
      legend: [{ color: "var(--line)", label: "graphic sex" }, { color: "var(--grey-line)", label: "innuendo only" }] });
    drawCheating();
  }

  /* Hook-ups and cheating (topics card). */
  function drawCheating() {
    var h0 = low("casual_sex"), h1 = decW("casual_sex");
    say(byId("hookup-line"), [WSINCE_C + ", ", Bn(h1), " year-end chart songs (" + P(h1) + ") have lyrics about hooking up. ", { b: times(h1, h0), note: cite(h0, WHAT.casual_sex) }, "."]);
    if (CD) { var hi0 = cd("all", FIRST, "songs", "hookup.invited"), hd0 = cd("all", FIRST, "songs", "hookup.described"), hi1 = cd("all", LAST, "songs", "hookup.invited"), hd1 = cd("all", LAST, "songs", "hookup.described");
      byId("hookup-how").hidden = true; }
    var c0 = low("cheating_act"), c1 = decW("cheating_act"), o1 = decW("cheating_speaker_as_other");
    var oh = decW("cheating_speaker_as_other", "hip_hop"), ab1 = decW("cheating_central");
    say(byId("cheat-line"), [WSINCE_C + ", ", Bn(c1), " year-end chart songs (" + P(c1) + ") have lyrics about cheating. ", { b: times(c1, c0), note: cite(c0, WHAT.cheating_act) }, "."]);
    var cw0 = CD ? cd("all", FIRST, "songs", "cheating.stance.wronged") : 0, cn0 = CD ? cd("all", FIRST, "songs", "cheating.songs") : 0, cc1 = CD ? cd("all", "W", "songs", "cheating.stance.celebrated") : 0;
    var so1 = CD ? cd("all", "W", "songs", "cheating.who.speaker_as_other") : 0, so0 = CD ? cd("all", FIRST, "songs", "cheating.who.speaker_as_other") : 0;
    say(byId("cheat-twist"), ["In the 1960s the singer was the one being cheated on. Now he’s the one sleeping with someone else’s wife or girlfriend: ",
      { b: fmtN(so1) + " songs", note: CD ? cdNote(so1 + " songs since 2010 have the singer as the other man; " + FIRST + ": " + so0, "W") : null }, " since 2010, ", { b: fmtN(so0) }, " in the whole " + FIRST + "."]);

    var hk = series("casual_sex"), ch = series("cheating_act");
    barChart(byId("chart-cheat"), { labels: PER, title: "Songs about hooking up, every five years", aria: "Hook-ups, share of songs, five-year steps 1960 to 2025.",
      series: [{ vals: hk, color: "var(--line)", label: "hook-ups" }] });
    barChart(byId("chart-cheat2"), { labels: PER, title: "Songs about cheating, every five years", aria: "Cheating, share of songs, five-year steps 1960 to 2025.",
      series: [{ vals: ch, color: "var(--line)", label: "cheating" }] });
  }

  /* ---------------- W. Wii Mii ----------------
     Built on the default Mii: egg head with soft 3D shading, glossy helmet
     hair, black oval eyes with a shine, thick short brows, a little J nose,
     a simple mouth, a bright shirt, stubby arms. Mii Channel backdrop. */
  var WII = {
    head: "M 0 -196 C 50 -196, 74 -156, 72 -108 C 70 -64, 42 -36, 0 -36 C -42 -36, -70 -64, -72 -108 C -74 -156, -50 -196, 0 -196 Z",
    torso: "M -44 80 C -48 20, -36 -26, 0 -28 C 36 -26, 48 20, 44 80 Z",
    spiky: "M -76 -104 C -84 -176, -46 -214, 0 -214 C 46 -214, 84 -176, 76 -104 C 74 -124, 68 -138, 60 -146 L 52 -130 L 44 -150 L 32 -132 L 24 -154 L 12 -134 L 2 -158 L -8 -134 L -20 -154 L -28 -132 L -40 -150 L -48 -130 L -58 -146 C -66 -140, -72 -126, -76 -104 Z",
    helmet: "M -78 -96 C -84 -178, -42 -214, 0 -214 C 42 -214, 84 -178, 78 -96 C 72 -130, 50 -148, 0 -150 C -50 -148, -72 -130, -78 -96 Z",
    longBack: "M -84 -20 C -96 -150, -56 -214, 0 -214 C 56 -214, 96 -150, 84 -20 C 70 -26, 66 -40, 64 -60 L -64 -60 C -66 -40, -70 -26, -84 -20 Z",
    longFront: "M -76 -108 C -80 -178, -40 -212, 4 -212 C 48 -212, 82 -178, 76 -108 C 66 -140, 40 -154, 20 -150 C 8 -148, -2 -140, -6 -130 C -14 -146, -40 -150, -76 -108 Z"
  };
  var KW = [
    { x: 165, y: 404, s: 1.02, hair: "spiky", hairc: "#6b4526", hairL: "#9a6a40", skin: "#c47a48", skinL: "#e0a070", skinD: "#9c5a30", shirt: "#3a8ee6", shirtL: "#7ab8ff", cup: "#ffffff", band: "#e9edf2", face: "joy", d: 0 },
    { x: 450, y: 414, s: 1.42, hair: "helmet", hairc: "#1e1c22", hairL: "#4a4652", skin: "#f6d1ad", skinL: "#fff0dc", skinD: "#dcae84", shirt: "#e0323c", shirtL: "#ff6d6d", cup: "#2b2a30", band: "#3a3940", face: "tense", d: 0 },
    { x: 735, y: 404, s: 1.02, hair: "long", hairc: "#5a3418", hairL: "#8e5a30", skin: "#ecb584", skinL: "#ffd6ad", skinD: "#c98c5a", shirt: "#f2b705", shirtL: "#ffe066", cup: "#ff5a9a", band: "#ff8ab8", face: "calm", d: -1.1 }
  ];
  function wiiDefs() {
    return '<radialGradient id="w-bg" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d6dbe2"/></radialGradient>' +
      '<radialGradient id="w-floor" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#9aa3ad" stop-opacity=".45"/><stop offset="1" stop-color="#9aa3ad" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="w-blush"><stop offset="0" stop-color="#ff7a7a" stop-opacity=".45"/><stop offset="1" stop-color="#ff7a7a" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="w-cloud" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a8f99"/><stop offset="1" stop-color="#5b606b"/></linearGradient>' +
      KW.map(function (k, i) {
        return '<radialGradient id="w-skin' + i + '" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="' + k.skinL + '"/><stop offset=".6" stop-color="' + k.skin + '"/><stop offset="1" stop-color="' + k.skinD + '"/></radialGradient>' +
          '<linearGradient id="w-hair' + i + '" x1=".2" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="' + k.hairL + '"/><stop offset=".55" stop-color="' + k.hairc + '"/><stop offset="1" stop-color="' + k.hairc + '"/></linearGradient>' +
          '<linearGradient id="w-shirt' + i + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + k.shirtL + '"/><stop offset=".5" stop-color="' + k.shirt + '"/></linearGradient>' +
          '<radialGradient id="w-cup' + i + '" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff" stop-opacity=".9"/><stop offset=".35" stop-color="' + k.cup + '"/><stop offset="1" stop-color="' + k.cup + '"/></radialGradient>';
      }).join("");
  }
  function wiiFace(k) {
    var B = "#141414";
    if (k.face === "joy") {
      return '<path d="M -34 -106 q 10 -12 20 0 M 14 -106 q 10 -12 20 0" fill="none" stroke="' + B + '" stroke-width="5" stroke-linecap="round"/>' +
        '<path d="M -38 -134 q 12 -6 24 -2 M 14 -136 q 12 -4 24 2" fill="none" stroke="' + B + '" stroke-width="7" stroke-linecap="round"/>' +
        '<path d="M -22 -72 Q 0 -48 22 -72 Z" fill="#ffffff" stroke="' + B + '" stroke-width="3.5" stroke-linejoin="round"/>' +
        '<path d="M -8 -70 V -60 M 0 -70 V -58 M 8 -70 V -60" stroke="' + B + '" stroke-width="2"/>';
    }
    if (k.face === "calm") {
      return '<ellipse cx="-24" cy="-108" rx="7.5" ry="11" fill="' + B + '"/><ellipse cx="24" cy="-108" rx="7.5" ry="11" fill="' + B + '"/>' +
        '<circle cx="-21.5" cy="-113" r="2.8" fill="#fff"/><circle cx="26.5" cy="-113" r="2.8" fill="#fff"/>' +
        '<path d="M -32 -116 l -7 -4 M 32 -116 l 7 -4" stroke="' + B + '" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M -36 -132 q 12 -5 24 -1 M 12 -133 q 12 -4 24 1" fill="none" stroke="' + B + '" stroke-width="5" stroke-linecap="round"/>' +
        '<path d="M -14 -70 q 14 10 28 0" fill="none" stroke="' + B + '" stroke-width="3.5" stroke-linecap="round"/>';
    }
    return '<ellipse cx="-24" cy="-108" rx="10" ry="13" fill="#ffffff" stroke="' + B + '" stroke-width="2.5"/><ellipse cx="24" cy="-108" rx="10" ry="13" fill="#ffffff" stroke="' + B + '" stroke-width="2.5"/>' +
      '<circle class="w-eye" cx="-22" cy="-106" r="4.5" fill="' + B + '"/><circle class="w-eye" cx="26" cy="-106" r="4.5" fill="' + B + '"/>' +
      '<path d="M -38 -128 L -12 -140 M 38 -128 L 12 -140" stroke="' + B + '" stroke-width="7" stroke-linecap="round"/>' +
      '<rect x="-20" y="-76" width="40" height="15" rx="4" fill="#ffffff" stroke="' + B + '" stroke-width="3"/>' +
      '<path d="M -20 -68.5 l 5 -3 l 5 3 l 5 -3 l 5 3 l 5 -3 l 5 3 l 5 -3 l 5 3" fill="none" stroke="' + B + '" stroke-width="1.8" stroke-linejoin="round"/>' +
      '<ellipse cx="-40" cy="-84" rx="19" ry="11" fill="#ff3b5c" opacity=".45"/><ellipse cx="40" cy="-84" rx="19" ry="11" fill="#ff3b5c" opacity=".45"/>' +
      '<path d="M -50 -88 l 5 -6 M -42 -88 l 5 -6 M -34 -88 l 5 -6 M 34 -88 l 5 -6 M 42 -88 l 5 -6 M 50 -88 l 5 -6" stroke="#d81e44" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>' +
      '<path class="drop" d="M 56 -140 C 48 -126, 50 -116, 57 -116 C 64 -116, 66 -126, 56 -140 Z" fill="#7cc4ff" stroke="#ffffff" stroke-width="1.5"/>';
  }
  function wiiHair(k, i) {
    var g = 'fill="url(#w-hair' + i + ')"', shine = '<path d="M -44 -186 C -30 -202, 4 -208, 26 -200" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" opacity=".28"/>';
    if (k.hair === "spiky") { return { back: "", front: '<path d="' + WII.spiky + '" ' + g + '/>' + shine }; }
    if (k.hair === "helmet") { return { back: "", front: '<path d="' + WII.helmet + '" ' + g + '/>' + shine }; }
    return { back: '<path d="' + WII.longBack + '" ' + g + '/>', front: '<path d="' + WII.longFront + '" ' + g + '/>' + shine };
  }
  function wiiKid(k, i) {
    var hair = wiiHair(k, i), B = "#141414";
    var phones = '<path d="M -80 -104 C -86 -222, 86 -222, 80 -104" fill="none" stroke="' + k.band + '" stroke-width="12" stroke-linecap="round"/>' +
      '<path d="M -50 -196 C -26 -212, 26 -212, 50 -196" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity=".5"/>' +
      '<rect x="-100" y="-136" width="32" height="62" rx="15" fill="url(#w-cup' + i + ')" stroke="rgba(0,0,0,.12)" stroke-width="1.5"/>' +
      '<rect x="68" y="-136" width="32" height="62" rx="15" fill="url(#w-cup' + i + ')" stroke="rgba(0,0,0,.12)" stroke-width="1.5"/>';
    var head = hair.back +
      '<rect x="-13" y="-46" width="26" height="24" rx="6" fill="' + k.skinD + '"/>' +
      '<path d="' + WII.head + '" fill="url(#w-skin' + i + ')"/>' +
      '<ellipse cx="-42" cy="-80" rx="15" ry="10" fill="url(#w-blush)"/><ellipse cx="42" cy="-80" rx="15" ry="10" fill="url(#w-blush)"/>' +
      hair.front + wiiFace(k) +
      '<path d="M 2 -98 q 7 9 1 13 q -5 2 -9 -2" fill="none" stroke="' + k.skinD + '" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      phones;
    var arms = k.face === "tense"
      ? '<path d="M -36 -14 C -66 -30, -92 -60, -86 -96 M 36 -14 C 66 -30, 92 -60, 86 -96" fill="none" stroke="url(#w-shirt' + i + ')" stroke-width="22" stroke-linecap="round"/>' +
        '<circle cx="-86" cy="-104" r="15" fill="url(#w-skin' + i + ')"/><circle cx="86" cy="-104" r="15" fill="url(#w-skin' + i + ')"/>'
      : '<path d="M -36 -16 C -56 -4, -64 24, -66 60 M 36 -16 C 56 -4, 64 24, 66 60" fill="none" stroke="url(#w-shirt' + i + ')" stroke-width="22" stroke-linecap="round"/>';
    var body = '<ellipse cx="0" cy="84" rx="80" ry="14" fill="url(#w-floor)"/>' +
      '<path d="' + WII.torso + '" fill="url(#w-shirt' + i + ')"/>' +
      '<path d="M -26 -22 C -10 -14, 10 -14, 26 -22" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity=".35"/>';
    var kisses = k.face !== "tense" ? "" : [0, 1, 2].map(function (n) {
      var side = n % 2 ? 1 : -1, x = side * 96;
      var glyph = n === 1
        ? '<path d="M 0 -150 c -4 -8 -16 -8 -16 2 c 0 8 10 12 16 18 c 6 -6 16 -10 16 -18 c 0 -10 -12 -10 -16 -2 z" fill="#ff5a8a"/>'
        : '<path d="M -14 -146 C -10 -154, -3 -155, 0 -150 C 3 -155, 10 -154, 14 -146 C 8 -144, -8 -144, -14 -146 Z" fill="#d7263d"/>' +
          '<path d="M -14 -145 C -8 -143, 8 -143, 14 -145 C 9 -136, -9 -136, -14 -145 Z" fill="#ef3b57"/>';
      return '<g class="note-g" style="--i:' + n + ';--d:' + k.d + 's"><g transform="translate(' + x + ' 76) scale(1.45)">' + glyph + '</g></g>';
    }).join("");
    var notesG = k.face === "tense" ? kisses : [0, 1, 2].map(function (n) {
      var side = n % 2 ? 1 : -1, col = ["#ff5a9a", "#3a8ee6", "#f2b705"][n];
      return '<g class="note-g" style="--i:' + n + ';--d:' + k.d + 's"><g transform="translate(' + (side * 120 + 40) + ' 0)">' +
        '<path d="M -40 -118 V -142 L -26 -146 V -124" fill="none" stroke="' + col + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<circle cx="-43" cy="-118" r="5.5" fill="' + col + '"/><circle cx="-29" cy="-124" r="5.5" fill="' + col + '"/></g></g>';
    }).join("");
    var cloud = k.face === "tense"
      ? '<g transform="translate(0 26)"><g class="w-cloud"><g transform="translate(0 -10) rotate(-5 0 -262)">' +
          '<rect x="-66" y="-300" width="132" height="80" fill="#000" opacity=".18" transform="translate(4 5)"/>' +
          '<rect x="-66" y="-300" width="132" height="80" fill="#0b0b0b" stroke="#ffffff" stroke-width="3"/>' +
          '<text x="0" y="-280" text-anchor="middle" font-family="Arial Black, Arial, Helvetica, sans-serif" font-size="14" font-weight="900" fill="#ffffff" textLength="96" lengthAdjust="spacing">PARENTAL</text>' +
          '<rect x="-60" y="-274" width="120" height="28" fill="#ffffff"/>' +
          '<text x="0" y="-252" text-anchor="middle" font-family="Arial Black, Arial, Helvetica, sans-serif" font-size="24" font-weight="900" fill="#0b0b0b" textLength="112" lengthAdjust="spacingAndGlyphs">ADVISORY</text>' +
          '<text x="0" y="-228" text-anchor="middle" font-family="Arial Black, Arial, Helvetica, sans-serif" font-size="11" font-weight="900" fill="#ffffff" textLength="108" lengthAdjust="spacingAndGlyphs">EXPLICIT CONTENT</text>' +
        '</g></g></g>'
      : "";
    return '<g transform="translate(' + k.x + ' ' + k.y + ') scale(' + k.s + ')"><g class="' + (k.face === "tense" ? "tense" : "calm w-bounce") + '" style="--d:' + k.d + 's">' +
      body + arms + notesG + '<g class="head">' + head + '</g>' + cloud + '</g></g>';
  }
  // The lofi room the owner liked, behind the Mii kids: dusk city through the
  // window, a plant, a poster, warm lamp light behind the calm two and a red
  // glow behind the one in the middle, all of them on a couch.
  function lofiRoom() {
    var city = "";
    [[572, 40], [590, 62], [612, 30], [630, 55], [652, 44], [672, 70], [690, 36]].forEach(function (b, i) {
      city += '<rect x="' + b[0] + '" y="' + (164 - b[1]) + '" width="' + (16 + (i % 3) * 3) + '" height="' + b[1] + '" fill="#1b1533"/>';
      if (i % 2 === 0) { city += '<rect class="twinkle" style="--t:-' + i * 0.4 + 's" x="' + (b[0] + 5) + '" y="' + (164 - b[1] + 8) + '" width="4" height="5" fill="#ffd58a"/>'; }
    });
    return '<linearGradient id="l-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2a5e"/><stop offset=".55" stop-color="#8a4f8f"/><stop offset="1" stop-color="#f08a6e"/></linearGradient>' +
      '<linearGradient id="l-wall" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a2f4f"/><stop offset="1" stop-color="#231c33"/></linearGradient>' +
      '<radialGradient id="l-lamp"><stop offset="0" stop-color="#ffd58a" stop-opacity=".6"/><stop offset="1" stop-color="#ffd58a" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="l-red"><stop offset="0" stop-color="#ff4d5e" stop-opacity=".5"/><stop offset="1" stop-color="#ff4d5e" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="l-couch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a4a5c"/><stop offset="1" stop-color="#4a2a3a"/></linearGradient>' +
      '|ROOM|' +
      '<rect width="900" height="440" fill="url(#l-wall)"/>' +
      '<rect x="560" y="44" width="150" height="120" rx="8" fill="url(#l-sky)"/>' + city +
      '<circle cx="686" cy="74" r="12" fill="#fff1c9" opacity=".9"/>' +
      '<rect x="560" y="44" width="150" height="120" rx="8" fill="none" stroke="#1a1426" stroke-width="8"/><path d="M635 44 V164" stroke="#1a1426" stroke-width="6"/>' +
      '<rect x="552" y="160" width="166" height="10" rx="3" fill="#1a1426"/>' +
      '<path d="M598 160 c -6 -22 -18 -30 -26 -30 c 10 10 16 20 18 30 z M606 160 c 4 -26 14 -36 24 -38 c -8 12 -12 24 -14 38 z" fill="#3f7a56"/><rect x="590" y="148" width="22" height="14" rx="3" fill="#b8664a"/>' +
      '<rect x="270" y="52" width="80" height="96" rx="4" fill="#e8708f" opacity=".85" transform="rotate(-3 310 100)"/><circle cx="310" cy="98" r="24" fill="#231c33" opacity=".85"/>' +
      '<circle cx="160" cy="240" r="200" fill="url(#l-lamp)"/><circle cx="740" cy="240" r="200" fill="url(#l-lamp)"/>' +
      '<circle class="pulse" cx="450" cy="250" r="185" fill="url(#l-red)"/>' +
      '<path d="M 30 442 L 30 330 Q 30 300 62 300 L 838 300 Q 870 300 870 330 L 870 442 Z" fill="url(#l-couch)"/>' +
      '<path d="M 300 310 V 440 M 600 310 V 440" stroke="#3a2030" stroke-width="4" opacity=".6"/>';
  }
  function styleW() {
    var parts = lofiRoom().split("|ROOM|");
    var room = '<defs>' + wiiDefs() + parts[0] + '<clipPath id="w-clip"><rect width="900" height="440" rx="18"/></clipPath></defs><g clip-path="url(#w-clip)">' + parts[1];
    // The flustered one is the subject: the other two sit back, soft and dim,
    // and a vignette pulls the eye to the middle.
    var fx = '<filter id="w-back" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6"/>' +
      '<feColorMatrix type="matrix" values=".62 0 0 0 .02  0 .58 0 0 .02  0 0 .7 0 .05  0 0 0 1 0"/></filter>' +
      '<radialGradient id="w-vig" cx=".5" cy=".5" r=".62"><stop offset=".35" stop-color="#0b0812" stop-opacity="0"/><stop offset="1" stop-color="#0b0812" stop-opacity=".82"/></radialGradient>' +
      '<radialGradient id="w-spot" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffb3c0" stop-opacity=".22"/><stop offset="1" stop-color="#ffb3c0" stop-opacity="0"/></radialGradient>';
    room = room.replace('<defs>', '<defs>' + fx);
    var back = '<g filter="url(#w-back)">' + wiiKid(KW[0], 0) + wiiKid(KW[2], 2) + '</g>';
    return '<svg viewBox="0 0 900 440" role="img" aria-label="Wii Mii style sample">' + room + back +
      '<rect width="900" height="440" fill="url(#w-vig)"/><ellipse cx="450" cy="250" rx="250" ry="210" fill="url(#w-spot)"/>' +
      wiiKid(KW[1], 1) + '</g></svg>';
  }

  /* The three listeners in the Sex chapter: one in three, drawn as Wii Miis.
     Motion only plays while the scene is on screen. */
  function drawTrio() {
    var host = byId("sex-trio"); if (!host) { return; }
    host.innerHTML = styleW().replace('aria-label="Wii Mii style sample"',
      'aria-label="Three kids drawn as Wii Miis, headphones on. Two sway to the music, smiling. The one in the middle is flustered and blushing, hands over both ears, as kiss marks and hearts drift out of his headphones and a Parental Advisory, Explicit Content label hangs above him."');
    if (typeof IntersectionObserver === "undefined") { host.classList.add("on"); return; }
    new IntersectionObserver(function (es) { es.forEach(function (en) { host.classList.toggle("on", en.isIntersecting); }); }, { threshold: 0.2 }).observe(host);
  }

  /* ---------------- 3. you draw it ---------------- */

  function drawDrawIt() {
    var host = byId("chart-draw"), real = series(SEX), known = 6, n = PER.length;
    var guess = PER.map(function () { return null; }), started = false, revealed = false;
    var c = new LineChart(host, { labels: PER, aria: "Draw your guess of explicit sex in songs from 1990 on." });
    var zone = s("rect", { class: "zone", x: c.x(known - 1), y: c.m.t, width: c.x(n - 1) - c.x(known - 1), height: c.ih });
    c.svg.insertBefore(zone, c.svg.firstChild);
    var hint = s("text", { class: "hint", x: (c.x(known) + c.x(n - 1)) / 2, y: c.m.t + c.ih / 2, "text-anchor": "middle" }, "draw here");
    c.svg.appendChild(hint);
    var knownVals = real.map(function (v, i) { return i < known ? v : null; });
    c.add("known", knownVals, "main"); c.lines.known.path.style.opacity = "1";
    guess[known - 1] = real[known - 1];
    var gl = c.add("guess", guess, "guess"); gl.path.style.opacity = "1";
    var btn = byId("draw-show"), skip = byId("draw-skip"), out = byId("draw-result"), last = null;

    function pointAt(e) {
      var pt = c.svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      var q = pt.matrixTransform(c.svg.getScreenCTM().inverse());
      var i = Math.round((q.x - c.m.l) / c.iw * (n - 1));
      var v = Math.max(0, Math.min(c.ymax, c.ymax * (1 - (q.y - c.m.t) / c.ih)));
      return { i: Math.max(known, Math.min(n - 1, i)), v: v };
    }
    function set(p) {
      if (last !== null && last.i !== p.i) {
        var a = Math.min(last.i, p.i), b = Math.max(last.i, p.i);
        for (var k = a; k <= b; k++) { guess[k] = last.v + (p.v - last.v) * (k - last.i) / (p.i - last.i); }
      } else { guess[p.i] = p.v; }
      last = p;
      gl.vals = guess; gl.path.setAttribute("d", c.d(guess));
      if (!started) { started = true; hint.style.display = "none"; }
      if (guess.slice(known).every(function (v) { return v !== null; })) { btn.hidden = false; }
    }
    var drawing = false;
    c.svg.addEventListener("pointerdown", function (e) {
      if (revealed) { return; }
      drawing = true; last = null;
      try { c.svg.setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety */ }
      set(pointAt(e)); e.preventDefault();
    });
    c.svg.addEventListener("pointermove", function (e) { if (drawing && !revealed) { set(pointAt(e)); } });
    // Letting go completes the guess: gaps close and the line runs flat to the end.
    function finish() {
      if (!drawing) { return; }
      drawing = false;
      var drawn = guess.slice(known).filter(function (v) { return v !== null; }).length;
      if (drawn < 2) { return; }
      var prev = known - 1;
      for (var i = known; i < n; i++) {
        if (guess[i] !== null) { prev = i; continue; }
        var nx = i + 1; while (nx < n && guess[nx] === null) { nx++; }
        guess[i] = nx < n ? guess[prev] + (guess[nx] - guess[prev]) * (i - prev) / (nx - prev) : guess[prev];
      }
      gl.vals = guess; gl.path.setAttribute("d", c.d(guess));
      btn.hidden = false;
    }
    ["pointerup", "pointercancel"].forEach(function (t) { c.svg.addEventListener(t, finish); });

    function reveal(withGuess) {
      if (revealed) { return; }
      revealed = true; btn.hidden = true; skip.hidden = true; hint.style.display = "none";
      if (withGuess) { gl.path.classList.add("done"); } else { gl.path.style.opacity = "0"; }
      var rest = real.map(function (v, i) { return i >= known - 1 ? v : null; });
      c.add("real", rest, "main", "Actual");
      c.draw("real", 1400).then(function () {
        var v = per(SEX, PER[n - 1]);
        if (withGuess) {
          say(out, ["You guessed ", { b: said(guess[n - 1]) }, " for " + nb(PER[n - 1]) + ". It was ", B(v), "."]);
        } else {
          say(out, ["By " + nb(PER[n - 1]) + " it was ", B(v), "."]);
        }
      });
    }
    btn.addEventListener("click", function () { if (guess[n - 1] !== null) { reveal(true); } });
    skip.addEventListener("click", function () { reveal(false); });
    if (reduced()) { /* still interactive; nothing animates on its own */ }
  }

  /* ---------------- 4. drugs ---------------- */

  var FAN = ["pop", "rock", "rnb_soul", "electronic_dance"];  // country left out: too few songs per step, the line zigzags
  function drawDrugs(subs) {
    var m = "drugs_use_or_sale", d0 = low(m), d1 = decW(m);
    say(byId("drugs-line"), [WSINCE_C + ", ", Bn(d1), " year-end chart songs (" + P(d1) + ") describe using or selling drugs. ", { b: times(d1, d0), note: cite(d0, WHAT[m]) }, "."]);
    var wo1 = decW(m, "hip_hop", true);
    var lows = FAN.concat(["hip_hop"]).map(function (g) { return per(m, PER[PER.length - 1], g); }).filter(Boolean);
    var lo = lows.reduce(function (a, b) { return a.share < b.share ? a : b; }), hi = lows.reduce(function (a, b) { return a.share > b.share ? a : b; });
    say(byId("drugs-twist"), ["Not just rap: ", Bn(wo1), " songs outside hip-hop do too (" + P(wo1) + " of them)."]);
    var a1 = decW("alcohol"), ah = decW("alcohol", "hip_hop"), aw = decW("alcohol", "hip_hop", true);
    say(byId("drugs-alcohol"), ["Alcohol isn’t a rap thing: it’s nearly as common everywhere else."]);

    var host = byId("chart-drugs"), all = series(m);
    barChart(host, { labels: PER, title: "Songs describing drug use or dealing, every five years", aria: "Drug use or dealing, share of songs, five-year steps 1960 to 2025.",
      series: [{ vals: all, color: "var(--line)", label: "drug use or dealing" }] });

  }

  /* ---------------- 4b. which drugs ---------------- */

  // Street names for the normalized substance labels. A song counts once per
  // label (substances-by-decade.json); counts are songs, not mentions.
  var KINDS = [
    { k: "cannabis", cls: true, name: "Weed" },
    { k: "lean_codeine", name: "Lean (codeine syrup)" },
    { k: "cocaine", cls: true, name: "Coke & crack" },
    { k: "rx_unspecified", name: "Pills (unnamed)" },
    { k: "mdma", name: "Molly / ecstasy" },
    { k: "rx_opioid", name: "Percs & painkillers" },
    { k: "rx_stimulant", name: "Addy & other uppers" },
    { k: "benzo_sedative", name: "Xans & other sedatives" },
    { k: "heroin", name: "Heroin" }
  ];
  function drawKinds(subs, men) {
    var line = byId("drugs-kinds-line"), rank = byId("drugs-rank"), minis = byId("drugs-minis");
    if (!subs || !subs.hip_hop || !line) { return; }
    // Inside hip-hop, where most of the drug talk is; decades with too few rap songs are left out.
    var HH = subs.hip_hop, N = HH.n_songs_by_decade;
    var decs = subs.decades.filter(function (d) { return (N[d] || 0) >= 30; }), last = "W";
    N = Object.assign({}, N, { W: WIN.reduce(function (x, w) { return x + (N[w] || 0); }, 0) });
    function cnt(kd, d, all) { if (d === "W") { return WIN.reduce(function (x, w) { return x + cnt(kd, w, all); }, 0); } var src = all ? subs : HH, t = kd.cls ? src.by_decade_class : src.by_decade_substance; return (t[d] || {})[kd.k] || 0; }
    function sh(kd, d) { return cnt(kd, d) / N[d]; }
    function src(kd, d) { return (d === "W" ? "2010–2025" : d) + ", songs tagged hip-hop: " + fmtN(cnt(kd, d)) + " of " + fmtN(N[d]) + " name or describe " + kd.name.toLowerCase() + ". Source: substances-by-decade.json, hip_hop." + (kd.cls ? "by_decade_class" : "by_decade_substance") + ' "' + d + '" → ' + kd.k + ". Counts are songs, not mentions."; }
    // Mentions: times the drug's words occur inside the songs the reader tagged with it (drug-mentions.json).
    var MK = { cannabis: "weed", lean_codeine: "lean", cocaine: "coke", rx_unspecified: "pills", mdma: "molly", rx_opioid: "percs", rx_stimulant: "addy", benzo_sedative: "xans", heroin: "heroin" };
    function men1(kd, d) {
      if (d === "W") { var xs = WIN.map(function (w) { return men1(kd, w); }).filter(Boolean); return xs.length ? { mentions: xs.reduce(function (x, y) { return x + y.mentions; }, 0), max_in_one_song: Math.max.apply(null, xs.map(function (y) { return y.max_in_one_song; })) } : null; }
      var t = men && men.hip_hop.by_decade[d]; return t ? t[MK[kd.k]] : null; }
    function countSaid(kd) { var c = cnt(kd, last); return fmtN(c) + (c === 1 ? " song" : " songs"); }
    function menSaid(kd) { var m = men1(kd, last); return m && m.mentions ? fmtN(m.mentions) + (m.mentions === 1 ? " mention" : " mentions") : ""; }
    var weed = KINDS[0], lean = KINDS[1], coke = KINDS[2];
    var leanAll = cnt(lean, last, true), leanHH = cnt(lean, last);
    var wm1 = men1(weed, last), lm1 = men1(lean, last), cm1 = men1(coke, last);
    say(line, ["In hip-hop since 2010, weed is named ", { b: fmtN(wm1 ? wm1.mentions : 0) + " times", note: src(weed, last) }, ". Lean and coke: ", { b: fmtN(lm1 ? lm1.mentions : 0), note: src(lean, last) }, " and ", { b: fmtN(cm1 ? cm1.mentions : 0), note: src(coke, last) }, "."]);
    var lm = men1(lean, last);
    say(byId("drugs-lean"), ["Lean: zero chart songs before 2000. Since 2010, nearly every song that names it is hip-hop (", { b: leanHH + " of " + leanAll, note: "2010–2025: " + leanHH + " of the " + leanAll + " songs that name lean are tagged hip-hop. Source: substances-by-decade.json." }, ")."]);

    var mnote = "Mentions count how many times the drug’s words (" + "lean, drank, codeine, wock, perc, xan, molly and so on" + ") occur inside the hip-hop songs the reader tagged with that drug; a word only counts in a song already tagged with it, so “lean on me” in a love song is not a mention. Source: drug-mentions.json.";
    // Rank and bar by mentions when the mention feed is there, else by songs.
    var rows = KINDS.map(function (kd) { var m = men1(kd, last); return { kd: kd, v: men ? (m ? m.mentions : 0) : sh(kd, last) }; }).sort(function (a, b) { return b.v - a.v; });
    var max = rows[0].v;
    var title = h("p", { class: "rank-title", text: "How many times hip-hop songs " + WSINCE + " name each drug" });
    title.appendChild(mark(rows.map(function (r) { return src(r.kd, last); }).join(" ")));
    if (men) { title.appendChild(mark(mnote)); }
    rank.appendChild(title);
    rows.forEach(function (r) {
      var fill = h("span", { class: "rank-fill" }); fill.style.setProperty("--w", (100 * r.v / max).toFixed(1) + "%");
      rank.appendChild(h("div", { class: "rank-row" }, [h("span", { class: "rank-name", text: r.kd.name }), h("span", { class: "rank-bar" }, [fill]), h("span", { class: "rank-v" }, menSaid(r.kd) ? [document.createTextNode(menSaid(r.kd)), h("small", { text: countSaid(r.kd) })] : [document.createTextNode(countSaid(r.kd))])]));
    });
    onView(rank, function () { rank.classList.add("go"); });

    var top = 0; KINDS.forEach(function (kd) { decs.forEach(function (d) { top = Math.max(top, sh(kd, d)); }); });
    if (!minis) { return; }
    minis.appendChild(h("p", { class: "rank-title", text: "Inside hip-hop, decade by decade (same scale)" }));
    var grid = h("div", { class: "kgrid" });
    KINDS.forEach(function (kd) {
      var W = 150, H = 64, bw = W / decs.length;
      var svg = s("svg", { viewBox: "0 0 " + W + " " + (H + 14), role: "img", "aria-label": kd.name + " in hip-hop by decade: " + decs.map(function (d) { return d + " " + pct(sh(kd, d)); }).join(", ") });
      svg.appendChild(s("line", { x1: 0, x2: W, y1: H + 0.5, y2: H + 0.5, class: "kbase" }));
      decs.forEach(function (d, i) {
        var v = sh(kd, d), bh = v ? Math.max(1.5, (H - 4) * v / top) : 0;
        var r = s("rect", { class: "kbar", x: (i * bw + 3).toFixed(1), y: (H - bh).toFixed(1), width: (bw - 6).toFixed(1), height: bh.toFixed(1), rx: 1.5 });
        r.appendChild(s("title", null, d + ": " + fmtN(cnt(kd, d)) + " of " + fmtN(N[d]) + " hip-hop songs"));
        svg.appendChild(r);
        svg.appendChild(s("text", { class: "kyr", x: (i * bw + bw / 2).toFixed(1), y: H + 12, "text-anchor": "middle" }, "’" + d.slice(2, 4)));
      });
      grid.appendChild(h("figure", { class: "kmini" }, [h("figcaption", null, [h("b", { text: kd.name }), h("span", { text: countSaid(kd) + " " + WSINCE })]), svg]));
    });
    minis.appendChild(grid);
    onView(minis, function () { minis.classList.add("go"); });
  }

  /* ---------------- 5. violence ---------------- */

  function drawViolence() {
    var m = "violence_beyond_mention", v0 = low(m), v1 = decW(m);
    say(byId("violence-line"), [WSINCE_C + ", ", Bn(v1), " year-end chart songs (" + P(v1) + ") have lyrics threatening or carrying out violence. ", { b: times(v1, v0), note: cite(v0, WHAT[m]) }, "."]);
    var w0 = dec(m, FIRST, "hip_hop", true), w1 = dec(m, LAST, "hip_hop", true), hh = decW(m, "hip_hop");
    say(byId("violence-twist"), ["Most of it is hip-hop: ", { b: P(hh), note: cite(hh, WHAT[m]) }, " of hip-hop songs."]);
    var c0 = low("violence_celebrated"), c1 = decW("violence_celebrated");
    byId("violence-celebrated").hidden = !!CD;
    if (!CD) { say(byId("violence-celebrated"), ["And ", Bn(c1), " songs sing violence with pride, not grief, ", { b: times(c1, c0), note: cite(c0, WHAT.violence_celebrated) }, "."]); }

    var host = byId("chart-violence"), all = series(m), hs = series(m, "hip_hop"), wo = series(m, "hip_hop", true);
    barChart(host, { labels: PER, title: "Songs threatening or carrying out violence, every five years", aria: "Violence in songs, share of songs, five-year steps 1960 to 2025.",
      series: [{ vals: all, color: "var(--line)", label: "violence threatened or carried out" }] });
  }

  /* ---------------- how often: tallies that lead with the count ----------------
     content-detail.json: words counted only inside songs the reader already put in
     that category (violent, graphic, …); flagged lines are a floor. Groups, never words. */
  var CD = null, CDSRC = "content-detail.json";
  // The words each sex group counts. Mirrors SEX_GROUPS in scripts/content_detail.py
  // (tests/test_site.py checks they match); the feed carries violence and weapon lists itself.
  var SEXW = {"sex acts": ["fuck", "fucking", "fuckin", "fucked", "smash", "smashing", "beat it up", "hit it", "hit that", "tap that", "banging", "pounding", "stroke", "stroking", "strokin", "ride it", "ride me", "ride the", "bust it open", "throw it back", "screw", "screwing", "hump", "humping", "dick her down", "dick me down", "lay the pipe", "pipe"], "oral": ["give me head", "gimme head", "get head", "give head", "giving head", "got head", "brain", "blowjob", "blow job", "suck", "sucking", "suckin", "lick", "licking", "lickin", "eat it", "eat it up", "go down", "going down", "deep throat", "deepthroat", "sloppy"], "genitals": ["pussy", "coochie", "cooch", "punani", "poonani", "kitty", "cookie", "vagina", "clit", "wap", "dick", "dicks", "cock", "penis", "wood", "johnson", "dong", "balls", "nuts"], "breasts / butt": ["tits", "titties", "titty", "boobs", "boobies", "breasts", "nipples", "booty", "butt", "cakes", "culo", "cheeks", "thighs"], "climax / fluids": ["cum", "cumming", "cummin", "nut", "bust a nut", "wet", "wetter", "squirt", "squirting", "climax", "orgasm", "semen", "swallow"], "positions / kink": ["doggy", "doggystyle", "doggy style", "missionary", "cowgirl", "threesome", "three way", "menage", "69", "sixty nine", "choke me", "spank", "spanking", "handcuffs", "tie me up", "bdsm", "kinky"]};
  // Example songs per row (example-songs.json): titles and counts only, linked out to their lyrics.
  var EX = null;
  function examplesFor(kind, key) { return (EX && EX.rows[kind] && EX.rows[kind][key]) || []; }
  function exampleList(list) {
    if (!list.length) { return null; }
    var p = h("p", { class: "tally-ex" }, [h("b", { text: "Says it most: " })]);
    list.forEach(function (x, i) {
      if (i) { p.appendChild(document.createTextNode(" · ")); }
      var a = h("a", { href: "https://genius.com/search?q=" + encodeURIComponent(x.title + " " + x.artist), target: "_blank", rel: "noopener", text: x.title });
      p.appendChild(a);
      p.appendChild(document.createTextNode(", " + x.artist + " (" + x.year + "), " + plural(x.mentions, "time", "times")));
    });
    return p;
  }
  function wordsFor(kind, key) { if (kind === "sex") { return SEXW[key] || []; } return (CD && CD.groups[kind] && CD.groups[kind][key]) || []; }
  // d = "W" sums the window (2010s + 2020s).
  function cd(scope, d, sec, k) { if (d === "W") { return WIN.reduce(function (t, w) { return t + cd(scope, w, sec, k); }, 0); } var c = CD && CD[scope][d]; return c ? (c[sec][k] || 0) : 0; }
  function cdN(scope, d) { if (d === "W") { return WIN.reduce(function (t, w) { return t + cdN(scope, w); }, 0); } var c = CD && CD[scope][d]; return c ? c.n_songs : 0; }
  function cdNote(what, d, scope) { return (d === "W" ? "2010–2025" : d) + (scope === "hip_hop" ? ", hip-hop" : "") + ": " + what + ". Mentions are counted only in songs the reader marked violent (or graphic, for sex words); flagged lines are a floor, not every line. Source: " + CDSRC + "."; }
  function per100(n, songs) { return songs ? n / songs * 100 : 0; }
  function r100(x) { return x >= 10 ? String(Math.round(x)) : x.toFixed(1).replace(/\.0$/, ""); }
  // "26 per 100 songs, against 4.3 in the 1960s: about 6 times as often" (fair to the short 2020s).
  function fair(nNow, songsNow, nThen, songsThen, thenLabel) {
    var a = per100(nNow, songsNow), b = per100(nThen, songsThen), r = b ? a / b : 0;
    return "That’s " + r100(a) + " per 100 songs, against " + r100(b) + " in the " + thenLabel + (r >= 1.5 ? ": about " + Math.round(r) + " times as often." : ".");
  }
  // "6× the 1960s" — per song, so the short 2020s is fair.
  function xFair(nNow, songsNow, nThen, songsThen, thenLabel) { if (!nThen) { return "None in the " + thenLabel; } var r = per100(nNow, songsNow) / per100(nThen, songsThen); return r >= 1.5 ? Math.round(r) + "× the " + thenLabel + ", per song" : ""; }
  // Quietest decade before 2000 for a content-detail count (per song), for the comparison chip.
  function cdLow(sec, keys) {
    var best = null;
    CD.decades.filter(function (d) { return d < "2000s"; }).forEach(function (d) {
      var n = keys.reduce(function (t, k) { return t + cd("all", d, sec, k); }, 0), r = per100(n, cdN("all", d));
      if (!best || r < best.r) { best = { d: d, n: n, songs: cdN("all", d), r: r }; }
    });
    return best;
  }
  function chipLow(nNow, sec, keys) { var b = cdLow(sec, keys); return xFair(nNow, cdN("all", "W"), b.n, b.songs, b.d); }
  function plural(n, one, many) { return fmtN(n) + " " + (n === 1 ? one : many); }
  // A big lead number with its caption, then rows: count first, then what, then songs.
  function tally(host, o) {
    if (!host) { return; }
    host.textContent = "";
    var lab = h("span", { text: o.bigLabel }); lab.appendChild(mark(o.note));
    var lead = h("div", { class: "tally-lead" }, [h("b", { text: fmtN(o.big) }), lab]);
    host.appendChild(lead);
    if (o.chip) { host.appendChild(h("p", { class: "tally-then" }, [h("span", { class: "chip", text: o.chip })])); }
    var max = Math.max.apply(null, o.rows.map(function (r) { return r.n; }).concat([1]));
    var list = h("div", { class: "tally-rows" });
    o.rows.forEach(function (r) {
      var fill = h("span", { class: "rank-fill" }); fill.style.setProperty("--w", (100 * r.n / max).toFixed(1) + "%");
      var row = h(r.words ? "summary" : "div", { class: "tally-row" }, [
        h("b", { class: "tally-n" }, [document.createTextNode(fmtN(r.n)), h("small", { text: " " + (r.unit ? (r.n === 1 ? r.unit[0] : r.unit[1]) : (r.n === 1 ? "mention" : "mentions")) })]),
        h("span", { class: "tally-name" }, [document.createTextNode(r.name), h("small", { text: (r.sub || "") + (r.words ? " · see words" : "") })]),
        h("span", { class: "rank-bar" }, [fill])
      ]);
      if (r.words) {
        var box = h("p", { class: "tally-words" }, [document.createTextNode(r.words.join(", "))]);
        if (r.wordsNote) { box.appendChild(h("em", { text: " " + r.wordsNote })); }
        var ex = exampleList(r.examples || []);
        row = h("details", { class: "tally-d" }, ex ? [row, box, ex] : [row, box]);
      }
      list.appendChild(row);
    });
    host.appendChild(list);
    onView(host, function () { host.classList.add("go"); });
  }

  function drawViolenceDetail() {
    if (!CD) { return; }
    var L = "W", F = FIRST, W = [["glock", "Glock"], ["strap / pole / blick", "“strap”, “pole”, “blick”"], ["gun / pistol", "gun, pistol"], ["draco", "Draco"], ["choppa", "“choppa”"],
      ["bullets / clip", "bullets, clip"], ["ak / ar", "AK, AR"], ["uzi / mac / tec", "Uzi, MAC, TEC"], ["explosives", "explosives"], ["shotgun / rifle", "shotgun, rifle"], ["knife", "knife"]];
    var wAll = cd("all", L, "mentions", "weapons.any"), wSongs = cd("all", L, "songs", "weapons.any.songs_with");
    tally(byId("weapons-tally"), {
      big: wAll, bigLabel: "times a weapon is named " + WSINCE,
      chip: chipLow(wAll, "mentions", ["weapons.any"]),
      note: cdNote(fmtN(wAll) + " weapon mentions in " + wSongs + " songs; " + F + ": " + cd("all", F, "mentions", "weapons.any") + " in " + cd("all", F, "songs", "weapons.any.songs_with"), L),
      rows: W.map(function (w) { return { n: cd("all", L, "mentions", "weapons." + w[0]), name: w[1], sub: plural(cd("all", L, "songs", "weapons." + w[0] + ".songs_with"), "song", "songs"), words: wordsFor("weapons", w[0]), examples: examplesFor("weapons", w[0]) }; })
        .filter(function (r) { return r.n > 0; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 6)
    });
    var VW = [["shoot / shots", "shoot, shots"], ["kill / murder", "kill, murder"], ["beat / fight", "beat, fight"], ["rob", "rob"]];
    var vwAll = VW.reduce(function (t, w) { return t + cd("all", L, "mentions", "violence_words." + w[0]); }, 0);
    tally(byId("vwords-tally"), {
      big: vwAll, bigLabel: "times they say shoot, kill, rob or fight",
      chip: chipLow(vwAll, "mentions", VW.map(function (w) { return "violence_words." + w[0]; })),
      note: cdNote(VW.map(function (w) { return w[1] + " " + cd("all", L, "mentions", "violence_words." + w[0]) + " (" + F + ": " + cd("all", F, "mentions", "violence_words." + w[0]) + ")"; }).join(", "), L),
      rows: VW.map(function (w) { return { n: cd("all", L, "mentions", "violence_words." + w[0]), name: w[1], sub: "the " + F + ": " + fmtN(cd("all", F, "mentions", "violence_words." + w[0])), words: wordsFor("violence_words", w[0]), examples: examplesFor("violence_words", w[0]) }; })
        .sort(function (a, b) { return b.n - a.n; })
    });
    var vs = cd("all", L, "songs", "violence.songs"), vc = cd("all", L, "songs", "violence.framing.celebrated");
    var vs0 = cd("all", F, "songs", "violence.songs"), vc0 = cd("all", F, "songs", "violence.framing.celebrated");
    var riv = cd("all", L, "songs", "violence.target.rival_male"), wom = cd("all", L, "songs", "violence.target.partner_or_woman");
    say(byId("violence-how"), ["It used to be mourned. Now it’s cheered on: ", { b: P((vc + cd("all", L, "songs", "violence.framing.justified")) / vs), note: cdNote(vc + " of " + vs + " violent songs celebrate it and " + cd("all", L, "songs", "violence.framing.justified") + " justify it; " + F + ": " + vc0 + " of " + vs0 + " celebrate it", L) }, " of violent songs since 2010."]);
  }

  function drawSexDetail() {
    if (!CD) { return; }
    var L = "W", G = [["sex acts", "sexual intercourse"], ["genitals", "genitals"], ["breasts / butt", "breasts and butt"], ["oral", "oral sex"], ["climax / fluids", "climax"], ["positions / kink", "positions and kink"]];
    var gs = cd("all", L, "songs", "sex.songs.graphic"), any = cd("all", L, "mentions", "sex_words.any"), anyS = cd("all", L, "songs", "sex_words.any.songs_with");
    tally(byId("sexwords-tally"), {
      big: any, bigLabel: "crude sexual words in the most graphic songs " + WSINCE + ". Tap a row to see the words.",
      chip: (function () { var b0 = cd("all", "1990s", "mentions", "sex_words.any"); return xFair(any, cdN("all", L), b0, cdN("all", "1990s"), "1990s"); })(),
      note: cdNote(any + " crude-word mentions in " + anyS + " of " + gs + " graphic songs; 1990s: " + cd("all", "1990s", "mentions", "sex_words.any") + "; largest in one song: " + Math.max.apply(null, WIN.map(function (w) { return CD.all[w].max_in_one_song["sex_words.any"] || 0; })), L),
      rows: G.map(function (g) { return { n: cd("all", L, "mentions", "sex_words." + g[0]), name: g[1], sub: plural(cd("all", L, "songs", "sex_words." + g[0] + ".songs_with"), "song", "songs"),
        words: wordsFor("sex", g[0]), examples: examplesFor("sex_words", g[0]), wordsNote: g[0] === "sex acts" ? "Every “fuck” counts here, even as a swear." : "" }; })
        .sort(function (a, b) { return b.n - a.n; })
    });
    var five = cd("all", L, "songs", "sex.lines_bucket.graphic.5+"), cho = cd("all", L, "songs", "sex.in_chorus.graphic");
    var ex = cd("all", L, "songs", "sex.songs.explicit"), boast = cd("all", L, "songs", "sex.function.boast");
    var ex0 = cd("all", FIRST, "songs", "sex.songs.explicit") + cd("all", FIRST, "songs", "sex.songs.graphic"), boast0 = cd("all", FIRST, "songs", "sex.function.boast");
    byId("sex-how").hidden = true;
  }

  /* Small multiples, decade by decade, from content-detail.json. Rates are per 100
     songs (or a share of the category), so the short 2020s isn't a false dip.
     Thin marks where the counts are too small to lean on. */
  var SLOT = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)", "var(--s5)", "var(--s6)"];
  function miniChart(o) {
    var decs = o.decs || CD.decades, W = 640, H = 250, top = 12, bw = W / decs.length;
    var vals = o.series.map(function (sr) { return decs.map(function (d) { return sr.get(d); }); });
    var SL = o.series.length === 1 ? ["var(--line)"] : SLOT;  // one series wears the chapter colour
    var max = 0;
    vals.forEach(function (v) { v.forEach(function (p) { max = Math.max(max, p.v); }); });
    if (o.cap) { max = o.cap; }
    max = max || 1;
    var y = function (v) { return top + (H - top) * (1 - v / max); };
    var svg = s("svg", { viewBox: "0 0 " + W + " " + (H + 16), role: "img", "aria-label": o.title + ": " + decs.map(function (d, i) { return d + " " + o.series.map(function (sr, k) { return sr.name + " " + r100(vals[k][i].v); }).join(", "); }).join("; ") });
    svg.appendChild(s("line", { x1: 0, x2: W, y1: H + 0.5, y2: H + 0.5, class: "kbase" }));
    svg.appendChild(s("text", { class: "kyr", x: 0, y: top - 1 }, r100(max) + (o.unit === "share" ? "%" : " per 100 songs")));
    // Rule: one statistic -> solid bars; comparing two or more -> lines.
    decs.forEach(function (d, i) {
      var thin = o.thin(d);
      if (vals.length === 1) {
        var v1 = vals[0][i], hgt1 = (H - top) * v1.v / max;
        if (hgt1 > 0) { var r1 = s("rect", { x: (i * bw + 6).toFixed(1), y: y(v1.v).toFixed(1), width: (bw - 12).toFixed(1), height: hgt1.toFixed(1), rx: 2, fill: SL[0], opacity: thin ? 0.35 : 1 });
          r1.appendChild(s("title", null, d + " · " + o.series[0].name + ": " + v1.label)); svg.appendChild(r1); }
      }
      svg.appendChild(s("text", { class: "kyr", x: (i * bw + bw / 2).toFixed(1), y: H + 12, "text-anchor": "middle", opacity: thin ? 0.5 : 1 }, "’" + d.slice(2, 4)));
    });
    if (vals.length >= 2) {
      vals.forEach(function (v, k) {
        var pts = v.map(function (p, i) { return [(i * bw + bw / 2), y(p.v)]; });
        svg.appendChild(s("path", { d: "M" + pts[0][0].toFixed(1) + " " + H + pts.map(function (p) { return " L" + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join("") + " L" + pts[pts.length - 1][0].toFixed(1) + " " + H + " Z", fill: SL[k], opacity: 0.14 }));
        svg.appendChild(s("path", { d: "M" + pts.map(function (p) { return p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" L"), fill: "none", stroke: SL[k], "stroke-width": 2.5, "stroke-linejoin": "round" }));
        pts.forEach(function (p, i) {
          var c = s("circle", { cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: 3.5, fill: SL[k], opacity: o.thin(decs[i]) ? 0.35 : 1, stroke: "var(--bg)", "stroke-width": 1.5 });
          c.appendChild(s("title", null, decs[i] + " · " + o.series[k].name + ": " + v[i].label)); svg.appendChild(c);
        });
      });
    }
    var f0 = 0; while (f0 < decs.length - 1 && (o.thin(decs[f0]) || !vals[0][f0].v)) { f0++; }
    var fN = decs.length - 1, px = function (i) { return i * bw + bw / 2; };
    if (f0 < fN) { annotate(svg, px(f0), y(vals[0][f0].v), px(fN) + (vals.length === 1 ? bw / 2 - 6 : 0), y(vals[0][fN].v), ratioTag(vals[0][f0].v / 100, vals[0][fN].v / 100)); }
    var key = h("p", { class: "mkey" });
    o.series.forEach(function (sr, k) { var sw = h("i"); sw.style.background = SL[k]; key.appendChild(sw); key.appendChild(document.createTextNode(sr.name)); });
    var t = h("span", { text: o.title }); t.appendChild(mark(o.note));
    var cap = h("figcaption", null, [h("p", { class: "mlead" }, [h("b", { text: o.lead }), h("em", { text: o.leadLabel })]), t]);
    var fig = h("figure", { class: "mchart" }, [cap, svg, key]);
    onView(fig, function () { fig.classList.add("go"); });
    return fig;
  }
  // Series builders. rate: per 100 songs in the decade. share: % of the category's songs.
  function rateS(name, sec, keys) {
    return { name: name, get: function (d) { var n = keys.reduce(function (t, k) { return t + cd("all", d, sec, k); }, 0); return { v: per100(n, cdN("all", d)), n: n, label: fmtN(n) + (sec === "mentions" ? " mentions" : " songs") + " of " + fmtN(cdN("all", d)) + " songs" }; } };
  }
  function shareS(name, base, keys) {
    return { name: name, get: function (d) { var n = keys.reduce(function (t, k) { return t + cd("all", d, "songs", k); }, 0), b = cd("all", d, "songs", base); return { v: b ? 100 * n / b : 0, n: n, label: fmtN(n) + " of " + fmtN(b) }; } };
  }
  function drawMinis(hostId, charts) {
    var host = byId(hostId); if (!host || !CD) { return; }
    var grid = h("div", { class: "mgrid" });
    charts.forEach(function (c) { grid.appendChild(miniChart(c)); });
    host.appendChild(grid);
  }
  function drawDetailMinis() {
    if (!CD) { return; }
    var L = "W", M = "Rates are per 100 chart songs in each decade, so the short 2020s (515 songs) is not a false dip; faded marks are decades with too few songs to lean on. Words are counted only inside songs the reader marked violent or graphic. Source: " + CDSRC + ".";
    var few = function (sec, keys) { return function (d) { return keys.reduce(function (t, k) { return t + cd("all", d, sec, k); }, 0) < 10; }; };
    var fewBase = function (base) { return function (d) { return cd("all", d, "songs", base) < 30; }; };
    var otherW = { name: "other", get: function (d) { var n = cd("all", d, "mentions", "weapons.any") - ["gun / pistol", "strap / pole / blick", "glock", "draco", "choppa"].reduce(function (t, k) { return t + cd("all", d, "mentions", "weapons." + k); }, 0);
      return { v: per100(n, cdN("all", d)), n: n, label: fmtN(n) + " mentions" }; } };
    var p = function (sec, k) { return r100(per100(cd("all", L, sec, k), cdN("all", L))); };
    drawMinis("violence-minis", [
      { title: "share of violent songs, by decade", lead: Math.round(100 * (cd("all", L, "songs", "violence.framing.celebrated") + cd("all", L, "songs", "violence.framing.justified")) / cd("all", L, "songs", "violence.songs")) + "%",
        leadLabel: "cheer it on, " + WSINCE, kind: "stack", unit: "share", cap: 100, thin: fewBase("violence.songs"), note: M,
        series: [shareS("cheered on", "violence.songs", ["violence.framing.celebrated", "violence.framing.justified"]), shareS("mourned or condemned", "violence.songs", ["violence.framing.mourned", "violence.framing.condemned"])] }
    ]);
    drawMinis("cheat-minis", [
      { title: "songs per 100 where the singer is the other man, by decade", lead: p("songs", "cheating.who.speaker_as_other"), leadLabel: "in every 100 songs, the singer is sleeping with someone else’s partner", kind: "lines", thin: few("songs", ["cheating.songs"]), note: M,
        series: [rateS("singer sleeps with someone else’s partner", "songs", ["cheating.who.speaker_as_other"])] }
    ]);
  }


  /* One bar split into parts, labelled on the bar where there's room, keyed below where not. */
  function splitBar(host, o) {
    if (!host) { return; }
    var total = o.parts.reduce(function (t, p) { return t + p.n; }, 0) || 1;
    var t = h("p", { class: "split-title", text: o.title }); if (o.note) { t.appendChild(mark(o.note)); }
    var bar = h("div", { class: "split-bar", role: "img", "aria-label": o.title + ": " + o.parts.map(function (p) { return p.name + " " + p.n; }).join(", ") });
    var key = h("p", { class: "split-key" });
    o.parts.forEach(function (p, i) {
      var w = 100 * p.n / total, seg = h("span", { class: "split-seg" });
      seg.style.flexBasis = w + "%"; seg.style.background = SLOT[i];
      if (w >= 18) { seg.appendChild(h("b", { text: fmtN(p.n) })); seg.appendChild(h("span", { text: p.name })); }
      else { var sw = h("i"); sw.style.background = SLOT[i]; key.appendChild(sw); key.appendChild(h("b", { text: fmtN(p.n) + " " })); key.appendChild(document.createTextNode(p.name)); }
      bar.appendChild(seg);
    });
    host.appendChild(t); host.appendChild(bar);
    if (key.childNodes.length) { host.appendChild(key); }
    onView(host, function () { host.classList.add("go"); });
  }

  /* Threats: who violent songs aim at, and how threats replaced stories. */
  function drawThreats() {
    if (!CD) { return; }
    var L = "W", thr = cd("all", L, "mentions", "violence.lines.threat"), thrS = cd("all", L, "songs", "violence.lines.threat.songs_with");
    var t0 = cd("all", FIRST, "songs", "violence.presence.threatened"), e0 = cd("all", FIRST, "songs", "violence.presence.enacted");
    var t1 = cd("all", L, "songs", "violence.presence.threatened"), e1 = cd("all", L, "songs", "violence.presence.enacted");
    say(byId("threat-line"), ["In the " + FIRST + " a violent song told you what happened. Now it’s a threat: ",
      { b: P(t1 / (t1 + e1)), note: cdNote("violent songs that threaten vs carry out violence: " + t1 + " vs " + e1 + "; " + FIRST + ": " + t0 + " vs " + e0, L) }, " of violent songs since 2010."]);
    var tally0 = byId("threat-tally");
    tally(tally0, {
      big: thr, bigLabel: "lines threatening someone " + WSINCE + ", in " + plural(thrS, "song", "songs"),
      chip: chipLow(thr, "mentions", ["violence.lines.threat"]),
      note: cdNote(thr + " threat lines flagged by the reader in " + thrS + " songs (a floor, not every line)", L),
      rows: []
    });
    // Who it's aimed at, as one plain line (the split bar read badly).
    var vs = cd("all", L, "songs", "violence.songs"), rm = cd("all", L, "songs", "violence.target.rival_male"), wm = cd("all", L, "songs", "violence.target.partner_or_woman");
    var who = h("p", { class: "line" }); tally0.appendChild(who);
    say(who, ["Usually it’s aimed at another man: ", { b: fmtN(rm) + " songs (" + P(rm / vs) + ")", note: cdNote("target per violent song: a rival man " + rm + ", a partner or woman " + wm + ", of " + vs + " violent songs", L) },
      ". At a woman: ", { b: fmtN(wm) + " (" + P(wm / vs) + ")" }, "."]);
    drawMinis("threat-minis", [
      { title: "share of violent songs, by decade", lead: Math.round(100 * t1 / (t1 + e1)) + "%", leadLabel: "of violent songs " + WSINCE + " are threats",
        kind: "stack", unit: "share", cap: 100, thin: function (d) { return cd("all", d, "songs", "violence.songs") < 30; },
        note: "Share of violent songs where violence is threatened vs carried out. Source: " + CDSRC + ".",
        series: [shareS("threatened", "violence.songs", ["violence.presence.threatened"]), shareS("carried out", "violence.songs", ["violence.presence.enacted"])] }
    ]);
  }


  /* Body lines ("shake that ass", "twerk", "make it clap"): body-phrases.json, a checked phrase
     count. Clear phrases count anywhere; loose ones only on lines the reader flagged as sexual,
     so the count is a floor. Songs lead, not mentions (choruses repeat). */
  var BP = null;
  function drawBody() {
    if (!BP || !CD) { return; }
    var A = BP.all, songs = WIN.reduce(function (t, d) { return t + ((A[d] || {}).songs_with_match || 0); }, 0);
    var n = WIN.reduce(function (t, d) { return t + ((A[d] || {}).n_songs || 0); }, 0);
    var early = ["1960s", "1970s", "1980s"].reduce(function (t, d) { return t + ((A[d] || {}).songs_with_match || 0); }, 0);
    var prec = BP.precision && BP.precision.share ? " Checked by hand: " + Math.round(100 * BP.precision.share) + "% of a sample were right." : " Not yet checked by hand.";
    var note = fmtN(songs) + " of " + fmtN(n) + " songs, 2010–2025, have a booty line: “shake that ass”, “twerk”, “make it clap”, or the booty itself (“big butts”, “apple bottom”); 1960s–80s: " + early + " songs in 30 years. Clear phrases count anywhere; loose ones (“drop it”, “back it up”) only on lines the reader flagged as sexual, so this is a floor." + prec + " Source: body-phrases.json.";
    say(byId("body-line"), [WSINCE_C + ", ", { b: fmtN(songs), note: note }, " year-end chart songs (" + P(songs / n) + ") have booty lines: shake it, twerk, make it clap, or just the booty itself. From 1960 to 1989: ", { b: early + " songs" }, " in thirty years."]);
    var host = byId("body-minis"); if (!host) { return; }
    var grid = h("div", { class: "mgrid" });
    grid.appendChild(miniChart({ title: "songs per 100, by decade", lead: r100(per100(songs, n)), leadLabel: "in every 100 songs " + WSINCE + " have a booty line", kind: "stack",
      thin: function (d) { return ((A[d] || {}).songs_with_match || 0) < 10; }, note: note,
      series: [{ name: "booty lines", get: function (d) { var x = A[d] || {}; return { v: per100(x.songs_with_match || 0, x.n_songs || 1), n: x.songs_with_match || 0, label: fmtN(x.songs_with_match || 0) + " of " + fmtN(x.n_songs || 0) + " songs" }; } }] }));
    host.appendChild(grid);
  }


  /* Mentions over time: line charts, per 100 songs so the short 2020s is fair. */
  var MEN = null, SUBS = null;
  function drawMentionLines() {
    if (!CD) { return; }
    var M = "Mentions per 100 chart songs in each decade; words count only inside songs the reader marked violent (or graphic, for sex words). Faded points: too few to lean on. Source: " + CDSRC + ".";
    var few = function (sec, keys) { return function (d) { return keys.reduce(function (t, k) { return t + cd("all", d, sec, k); }, 0) < 10; }; };
    var VW = ["violence_words.shoot / shots", "violence_words.kill / murder", "violence_words.beat / fight", "violence_words.rob"];
    var p = function (keys) { return r100(per100(keys.reduce(function (t, k) { return t + cd("all", "W", "mentions", k); }, 0), cdN("all", "W"))); };
    drawMinis("violence-mlines", [
      { title: "mentions per 100 songs, by decade", lead: p(["weapons.any"]), leadLabel: "weapon mentions per 100 songs " + WSINCE, kind: "lines", thin: few("mentions", ["weapons.any"]), note: M,
        series: [rateS("weapons named", "mentions", ["weapons.any"]), rateS("shoot, kill, rob, fight", "mentions", VW)] }
    ]);
    drawMinis("sex-mlines", [
      { title: "mentions per 100 songs, by decade", lead: p(["sex_words.any"]), leadLabel: "crude sexual words per 100 songs " + WSINCE, kind: "lines", thin: few("mentions", ["sex_words.any"]), note: M,
        series: [rateS("crude sexual words", "mentions", ["sex_words.any"])] }
    ]);
    if (MEN) {
      var HN = MEN.hip_hop.n_songs_by_decade, decs = MEN.decades.filter(function (d) { return (HN[d] || 0) >= 30; });
      var drug = function (name, key) { return { name: name, get: function (d) { var x = (MEN.hip_hop.by_decade[d] || {})[key], m = x ? x.mentions : 0; return { v: per100(m, HN[d]), n: m, label: fmtN(m) + " mentions in " + fmtN(HN[d]) + " hip-hop songs" }; } }; };
      var wm = WIN.reduce(function (t, d) { var x = (MEN.hip_hop.by_decade[d] || {}).weed; return t + (x ? x.mentions : 0); }, 0), wn = WIN.reduce(function (t, d) { return t + (HN[d] || 0); }, 0);
      drawMinis("drugs-mlines", [
        { title: "mentions per 100 hip-hop songs, by decade", decs: decs, lead: r100(per100(wm, wn)), leadLabel: "weed mentions per 100 hip-hop songs " + WSINCE, kind: "lines",
          thin: function (d) { return false; }, note: "Mentions per 100 hip-hop songs in each decade, counted only in songs the reader tagged with that drug. Source: drug-mentions.json.",
          series: [drug("weed", "weed"), drug("lean", "lean"), drug("coke", "coke")] }
      ]);
    }
  }


  /* Then and now: one dumbbell row per topic, the 1960s dot to the since-2010 dot on one scale.
     The new dot slides out from the old one when the chart comes into view. */
  function drawThenNow() {
    var host = byId("thennow"); if (!host) { return; }
    var R = [[SEX, "Sexually graphic", "sex"], ["casual_sex", "Hook-ups", "sex"], ["cheating_act", "Cheating", "sex"],
      ["violence_beyond_mention", "Violence", "violence"], ["crime_described", "Crime", "violence"],
      ["drugs_use_or_sale", "Drug use or dealing", "drugs"], ["money_flex", "Flexing money", "money"], ["brands_named", "Brand name-drops", "money"],
      ["profanity_strong", "Strong swearing", "grey"]];
    var rows = R.map(function (r) { return { m: r[0], name: r[1], fam: r[2], a: dec(r[0], FIRST), b: decW(r[0]) }; }).filter(function (r) { return r.a && r.b; })
      .sort(function (x, y) { return y.b.share - x.b.share; });
    var fam = FAMILY[isDark() ? "dark" : "light"];
    var W = 640, rowH = 34, top = 26, left = 170, right = 70, H = top + rows.length * rowH + 8;
    var max = Math.ceil(Math.max.apply(null, rows.map(function (r) { return r.b.share; })) * 10) / 10;
    var x = function (v) { return left + (W - left - right) * v / max; };
    var svg = s("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Share of year-end chart songs, the 1960s against since 2010: " + rows.map(function (r) { return r.name + " " + P(r.a) + " to " + P(r.b); }).join("; ") });
    [0, 0.1, 0.2, 0.3, 0.4].filter(function (v) { return v <= max; }).forEach(function (v) {
      svg.appendChild(s("line", { x1: x(v), x2: x(v), y1: top - 8, y2: H - 4, class: "tn-grid" }));
      svg.appendChild(s("text", { x: x(v), y: top - 12, "text-anchor": "middle", class: "tn-ax" }, Math.round(v * 100) + "%"));
    });
    rows.forEach(function (r, i) {
      var y = top + i * rowH + rowH / 2, c = fam[r.fam];
      var g = s("g", { class: "tn-row", style: "--i:" + i });
      g.appendChild(s("text", { x: left - 14, y: y + 4, "text-anchor": "end", class: "tn-name" }, r.name));
      g.appendChild(s("line", { x1: x(r.a.share), x2: x(r.b.share), y1: y, y2: y, stroke: c, "stroke-width": 3, "stroke-linecap": "round", class: "tn-bar", style: "--dx:" + (x(r.a.share) - x(r.b.share)).toFixed(1) + "px" }));
      g.appendChild(s("circle", { cx: x(r.a.share), cy: y, r: 5, class: "tn-then" }));
      var now = s("g", { class: "tn-now", style: "--dx:" + (x(r.a.share) - x(r.b.share)).toFixed(1) + "px" });
      now.appendChild(s("circle", { cx: x(r.b.share), cy: y, r: 7, fill: c }));
      now.appendChild(s("text", { x: x(r.b.share) + 12, y: y + 4, class: "tn-val" }, P(r.b)));
      g.appendChild(now);
      var t = s("title", null, r.name + ": " + P(r.a) + " of songs in the " + FIRST + " (" + fmtN(r.a.hits) + "), " + P(r.b) + " since 2010 (" + fmtN(r.b.hits) + ")"); g.appendChild(t);
      svg.appendChild(g);
    });
    var key = h("p", { class: "tn-key" }, [h("i", { class: "tn-k-then" }), document.createTextNode("the " + FIRST), h("i", { class: "tn-k-now" }), document.createTextNode("since 2010")]);
    key.appendChild(mark("Share of year-end chart songs that do each thing, the " + FIRST + " against 2010–2025. Source: " + SRC + ", by_decade."));
    host.appendChild(h("p", { class: "tn-title", text: "Then and now" }));
    host.appendChild(svg); host.appendChild(key);
    onView(host, function () { host.classList.add("go"); });
  }


  /* Big standalone figures for the beats that are one or two numbers, not a chart. */
  function bigStat(host, parts, note) {
    if (!host) { return; }
    host.textContent = "";
    parts.forEach(function (p, i) {
      var f = h("figure", { class: "big-fig" + (p.dim ? " dim" : "") }, [h("b", { text: p.n }), h("figcaption", { text: p.label })]);
      if (i === parts.length - 1 && note) { f.lastChild.appendChild(mark(note)); }
      host.appendChild(f);
    });
  }
  function drawBigs() {
    var ap = 0, all = 0;
    DEC.forEach(function (d) { var v = D.by_decade[d]; ap += v.measures.anti_police.n; all += v.n_songs; });
    bigStat(byId("police-big"), [{ n: fmtN(ap), label: "songs against the police, in 65 years" }], fmtN(ap) + " of " + fmtN(all) + " songs, 1960–2025, " + WHAT.anti_police + ". Source: " + SRC + ", by_decade → anti_police.");
    var ah = decW("alcohol", "hip_hop"), aw = decW("alcohol", "hip_hop", true);
    if (ah && aw) { bigStat(byId("alcohol-big"), [{ n: P(ah), label: "of hip-hop songs mention alcohol" }, { n: P(aw), label: "of everything else", dim: true }], cite(ah, WHAT.alcohol) + " " + cite(aw, WHAT.alcohol)); }
    var b1 = decW("brands_named"), b0 = dec("brands_named", FIRST);
    if (b1 && b0) { bigStat(byId("brands-big"), [{ n: fmtN(b1.hits), label: "songs since 2010 name-drop brands to show off" }, { n: fmtN(b0.hits), label: "in the whole 1960s", dim: true }], cite(b1, WHAT.brands_named) + " " + cite(b0, WHAT.brands_named)); }
  }


  /* New slides from the overhaul plan: swearing, pills, and "is it just rap?". */
  function drawOverhaul() {
    var sw0 = low("profanity_strong"), sw1 = decW("profanity_strong");
    say(byId("swear-line"), [WSINCE_C + ", ", Bn(sw1), " year-end chart songs (" + P(sw1) + ") use strong swearing. ", { b: times(sw1, sw0), note: cite(sw0, WHAT.profanity_strong) + " Strong swearing is a word count from a fixed list, so it is a floor." }, "."]);
    var hs = byId("chart-swear");
    if (hs) { barChart(hs, { labels: PER, title: "Songs with strong swearing, every five years", aria: "Strong swearing, share of songs, five-year steps 1960 to 2025.", series: [{ vals: series("profanity_strong"), color: "var(--line)", label: "strong swearing" }] }); }

    var pl1 = decW("drugs_opioids_pills"), lean0 = 0;
    if (SUBS) { SUBS.decades.filter(function (d) { return d < "2000s"; }).forEach(function (d) { lean0 += ((SUBS.by_decade_substance[d] || {}).lean_codeine || 0); }); }
    say(byId("pills-line"), ["Pills, percs and lean: ", Bn(pl1), " songs since 2010 (" + P(pl1) + ")." + (SUBS && !lean0 ? " Lean: none before 2000." : "")]);
    var hp = byId("chart-pills");
    if (hp) { barChart(hp, { labels: PER, title: "Songs naming opioids, lean or pills, every five years", aria: "Opioids, lean or pills, share of songs, five-year steps 1960 to 2025.", series: [{ vals: series("drugs_opioids_pills"), color: "var(--line)", label: "opioids, lean or pills" }] }); }

    var M = [[SEX, "sex"], ["violence_beyond_mention", "violence"], ["drugs_use_or_sale", "drugs"], ["money_flex", "flexing"], ["weapon_named", "weapons"], ["profanity_strong", "swearing"]];
    var groups = M.map(function (mm) {
      var a = decW(mm[0], "hip_hop"), b = decW(mm[0], "hip_hop", true);
      return { group: mm[1], items: [{ label: "hip-hop", v: a, cls: "main" }, { label: "everything else", v: b, cls: "comp" }] };
    }).filter(function (g) { return g.items[0].v && g.items[1].v; });
    var hr = byId("rap-bars");
    if (hr) { bars(hr, groups, "Since 2010, hip-hop songs against everything else, six measures."); }
    var rs = decW(SEX, "hip_hop", true), rd = decW("drugs_use_or_sale", "hip_hop", true);
    say(byId("rap-line"), ["Most of it is hip-hop. Not all: outside hip-hop, ", Bn(rs), " songs (" + P(rs) + ") are sexually graphic and ", Bn(rd), " (" + P(rd) + ") describe drug use."]);
    say(byId("drugs-alcohol"), ["Alcohol isn’t a rap thing."]);
  }

  /* Crime and police (topics card). */
  function drawCrime() {
    var d0 = low("crime_described"), d1 = decW("crime_described"), g1 = decW("crime_approving");
    say(byId("crime-line"), [Bn(d1), " songs since 2010 have lyrics about committing a crime. ", Bn(g1), " of them glorify it."]);
    var gh = decW("crime_approving", "hip_hop"), gw = decW("crime_approving", "hip_hop", true);
    say(byId("crime-twist"), ["Crime is glorified in ", { b: P(gh), note: cite(gh, WHAT.crime_approving) }, " of hip-hop songs, and ", { b: P(gw), note: cite(gw, WHAT.crime_approving) }, " of everything else."]);
    var p1 = decW("police_any"), ap = 0, all = 0;
    DEC.forEach(function (d) { var v = D.by_decade[d]; ap += v.measures.anti_police.n; all += v.n_songs; });
    say(byId("police-line"), ["Songs openly against the police are rarer than you’d think."]);

    var host = byId("chart-crime"), cd = series("crime_described"), ca = series("crime_approving");
    barChart(host, { labels: PER, title: "Crime in songs, and crime glorified, every five years", aria: "Songs describing a crime, and songs glorifying it, share of songs, five-year steps 1960 to 2025.",
      series: [{ vals: cd, color: "var(--line)", label: "a crime in the song" }, { vals: ca, color: "var(--ink)", label: "glorified", overlay: true }],
      legend: [{ color: "var(--line)", label: "a crime in the song" }, { color: "var(--ink)", label: "…and glorified" }] });
  }

  /* ---------------- 6. money ---------------- */

  function drawMoney() {
    var f0 = low("money_flex"), f1 = decW("money_flex");
    say(byId("money-line"), [WSINCE_C + ", ", Bn(f1), " year-end chart songs (" + P(f1) + ") flex money. ", { b: times(f1, f0), note: cite(f0, WHAT.money_flex) }, "."]);
    var b0 = low("brands_named"), b1 = decW("brands_named");
    say(byId("money-brands"), ["Name-dropping brands to show off barely existed before."]);

    var host = byId("chart-money"), fl = series("money_flex");
    barChart(host, { labels: PER, title: "Songs flexing money, every five years", aria: "Songs flexing money, five-year steps 1960 to 2025.",
      series: [{ vals: fl, color: "var(--line)", label: "flexing money" }] });
  }

  /* Hatched bar groups: [{group, items: [{label, v:{share}, cls}]}]. */
  var hatchN = 0;
  function bars(host, groups, aria) {
    var W = Math.round(Math.min(820, Math.max(320, host.clientWidth || 820))), H = 196, top = 26, base = 164;
    var svg = s("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": aria });
    var id = "hatch" + (++hatchN), defs = s("defs"), pat = s("pattern", { id: id, width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
    pat.appendChild(s("rect", { width: 6, height: 6, fill: "transparent" }));
    pat.appendChild(s("line", { x1: 0, y1: 0, x2: 0, y2: 6, stroke: "currentColor", "stroke-width": 2.2 }));
    defs.appendChild(pat); svg.appendChild(defs);
    var max = 0; groups.forEach(function (g) { g.items.forEach(function (it) { max = Math.max(max, it.v.share); }); });
    max = Math.max(max, 0.05);
    var gw = W / groups.length, bw = Math.min(64, gw / (groups[0].items.length + 1.5));
    groups.forEach(function (g, gi) {
      var cx = gw * gi + gw / 2, n = g.items.length, x0 = cx - (n * bw + (n - 1) * 10) / 2;
      g.items.forEach(function (it, ii) {
        var x = x0 + ii * (bw + 10), hgt = Math.max(2, (base - top) * it.v.share / max);
        var gg = s("g", { class: "bargrp" });
        gg.style.color = it.cls === "main" ? "var(--line)" : "var(--ink-2)";
        gg.appendChild(s("rect", { class: "bar", x: x, y: base - hgt, width: bw, height: hgt, fill: it.cls === "main" ? "var(--line)" : "url(#" + id + ")",
          stroke: it.cls === "main" ? "none" : "var(--ink-2)", "stroke-width": 1.2 }));
        svg.appendChild(gg);
        svg.appendChild(s("text", { class: "bv", x: x + bw / 2, y: base - hgt - 8, "text-anchor": "middle" }, P(it.v.share)));
      });
      svg.appendChild(s("text", { class: "bl", x: cx, y: base + 22, "text-anchor": "middle", "font-weight": 600 }, g.group));
    });
    host.appendChild(svg);
    // One key instead of a label under every bar (they collided when narrow).
    var key = h("p", { class: "legend" });
    groups[0].items.forEach(function (it) {
      key.appendChild(h("i", { class: it.cls === "main" ? "k-main" : "k-hatch" }));
      key.appendChild(document.createTextNode(it.label));
    });
    host.appendChild(key);
    onView(host, function () { host.classList.add("go"); });
  }

  /* ---------------- 7. race ---------------- */

  function drawRace(race) {
    if (!race) { byId("race-prose").textContent = "The race feed did not load."; return; }
    var rows = function (m) { return A.raceInsideGenre(race, "all_labels", m)[0]; };
    var sx = rows(SEX), vi = rows("violence_beyond_mention"), mf = rows("money_flex");
    function rn(x, what) { return { b: P(x), note: fmtN(x.hits) + " of " + fmtN(x.n) + " rap or R&B songs " + what + ". Source: race-ethnicity-breakdown.json, all_labels → by_group_genre_any." }; }
    say(byId("race-prose"), ["Inside rap and R&B, by the lead artist’s race. Graphic sex: ", rn(sx.black, "by Black lead artists " + WHAT[SEX]), " of songs by Black artists, ", rn(sx.white, "by white lead artists " + WHAT[SEX]), " by white artists."]);
    var state = { m: SEX, view: "all_labels" };
    var MEAS = [[SEX, "Graphic sex"], ["violence_beyond_mention", "Violence"], ["money_flex", "Money flex"]];
    var VIEWS = [["all_labels", "All labels"], ["high_confidence", "High-confidence labels only"]];
    var tg = byId("race-toggles");
    function group(opts, key) {
      var g = h("div", { class: "grp", role: "group" });
      opts.forEach(function (o) {
        var b = h("button", { type: "button", "aria-pressed": String(state[key] === o[0]), text: o[1] });
        b.addEventListener("click", function () { state[key] = o[0]; Array.prototype.forEach.call(g.children, function (x) { x.setAttribute("aria-pressed", String(x === b)); }); grid(); });
        g.appendChild(b);
      });
      tg.appendChild(g);
    }
    group(MEAS, "m"); group(VIEWS, "view");
    var COLS = [["black", "Black"], ["white", "White"], ["hispanic_latino", "Hispanic / Latino"], ["multiracial", "Multiracial"]];
    function grid() {
      var host = byId("race-grid"); host.textContent = "";
      var data = A.raceDecades(race, state.view, state.m), max = 0;
      data.forEach(function (r) { COLS.forEach(function (c) { if (r[c[0]]) { max = Math.max(max, r[c[0]].share); } }); });
      var tbl = h("table", { class: "ngrid" }), head = h("tr", null, [h("th")]);
      COLS.forEach(function (c) { head.appendChild(h("th", { text: c[1] })); });
      tbl.appendChild(h("thead", null, [head]));
      var body = h("tbody");
      data.forEach(function (r) {
        var tr = h("tr", null, [h("th", { class: "rowh", scope: "row", text: r.label })]);
        COLS.forEach(function (c) {
          var x = r[c[0]];
          if (!x) { tr.appendChild(h("td", { class: "na", text: "—", title: "Too few songs to count" })); return; }
          var td = h("td", { text: pct(x.share, 0), title: fmtN(x.hits) + " of " + fmtN(x.n) + " songs" });
          td.style.background = "color-mix(in srgb, var(--ink) " + Math.round((max ? x.share / max : 0) * 38) + "%, transparent)";
          tr.appendChild(td);
        });
        body.appendChild(tr);
      });
      tbl.appendChild(body); host.appendChild(tbl);
    }
    grid();
    var cav = byId("race-caveat");
    say(cav, ["Each cell is the share of that group’s songs; a dash means too few songs to count. Race here is the billed lead artist’s, and many labels were inferred, so race and genre are tangled; “high-confidence labels only” keeps the surest ones. This shows what charted, not why.",
      mark("Race and ethnicity: race-ethnicity-breakdown.json (by_group_decade, by_group_genre_any). Its method notes: " + race.method_notes.join(" "))]);
  }

  /* ---------------- 8. kids ---------------- */

  function drawKids(kids) {
    var vs = kids.lists[KIDS_GROUP].vs_chart, from = vs.from_year;
    var pickShare = vs.group.n_songs / vs.chart.n_songs;
    var gs = vs.group.measures[SEX], gd = vs.group.measures.drugs_use_or_sale;
    function kn(node, who, what) { return fmtN(node.hits) + " of " + fmtN(node.n) + " " + who + " " + what + ". Source: kids-full-catalogue.json, lists." + KIDS_GROUP + ".vs_chart."; }
    say(byId("kids-line"), ["Since " + from + ", ", { b: fmtN(vs.group.n_songs), note: fmtN(vs.group.n_songs) + " of " + fmtN(vs.chart.n_songs) + " Year-End songs from " + from + " on were picked by the Kids’ Choice Awards or Kidz Bop. Source: kids-full-catalogue.json, lists." + KIDS_GROUP + ".vs_chart." }, " chart songs were picked for kids. ", { b: fmtN(gs.hits), note: kn(gs, "picked songs", WHAT[SEX]) }, " are sexually graphic. ", { b: fmtN(gd.hits), note: kn(gd, "picked songs", WHAT.drugs_use_or_sale) }, " describe drug use."]);
    var M = [[SEX, "graphic sex"], ["drugs_use_or_sale", "drug use"], ["violence_beyond_mention", "violence"], ["profanity_strong", "strong swearing"]];
    bars(byId("kids-bars"), M.map(function (mm) {
      return { group: mm[1], items: [
        { label: "all songs", v: vs.chart.measures[mm[0]], cls: "comp" },
        { label: "kids’ picks", v: vs.group.measures[mm[0]], cls: "main" }] };
    }), "Year-End songs since " + from + " against the ones picked for kids, for four measures.");
    say(byId("kids-caveat"), ["These are the songs that were picked, counted on the original adult recording. Kidz Bop rewrites lyrics before children sing them, and radio plays clean edits, so this is what was chosen for kids, not what came out of the speakers."]);
  }

  /* ---------------- 10. scoreboard ---------------- */

  function drawScoreboard(kids) {
    var host = byId("scoreboard"), P1 = PER[PER.length - 1], P0 = PER[PER.length - 2];
    var vs = kids.lists[KIDS_GROUP].vs_chart;
    var genres = ["pop", "rock", "rnb_soul", "country", "electronic_dance", "hip_hop", "latin"].map(function (g) { return per("drugs_use_or_sale", P1, g); }).filter(Boolean);
    var gl = genres.reduce(function (a, b) { return a.share < b.share ? a : b; }), gh = genres.reduce(function (a, b) { return a.share > b.share ? a : b; });
    var ms = DEC.map(function (d) { return dec("money_struggle_or_critique", d); });
    var ml = ms.reduce(function (a, b) { return a.share < b.share ? a : b; }), mh = ms.reduce(function (a, b) { return a.share > b.share ? a : b; });
    var C = [
      ["Music is so sexualized now.", "holds", ["Explicit sex: ", B(dec(SEX, FIRST)), " songs in the " + FIRST + ", ", B(dec(SEX, LAST)), " now."]],
      ["It used to be innuendo; now it’s blunt.", "half", ["Explicit sex was added, but innuendo never left: ", B(dec("sex_suggestive", FIRST)), " then, ", B(dec("sex_suggestive", LAST)), " now."]],
      ["It was always sex, drugs and rock and roll.", "fails", ["In the " + FIRST + ": ", B(dec(SEX, FIRST)), " explicit, ", B(dec("drugs_use_or_sale", FIRST)), " drug use."]],
      ["Every genre sings about drugs now.", "holds", ["Today every genre with enough songs to count is between ", { b: said(gl.share), note: cite(gl, WHAT.drugs_use_or_sale) }, " and ", { b: said(gh.share), note: cite(gh, WHAT.drugs_use_or_sale) }, "."]],
      ["It’s all violence now.", "half", ["Up, but far from all: ", B(dec("violence_beyond_mention", LAST)), " songs overall, and ", B(dec("violence_beyond_mention", LAST, "hip_hop", true)), " outside hip-hop."]],
      ["It’s rap’s fault.", "half", ["True for violence (flat without hip-hop), not for alcohol: ", B(dec("alcohol", LAST, "hip_hop")), " in hip-hop, ", B(dec("alcohol", LAST, "hip_hop", true)), " everywhere else."]],
      ["Songs used to be about being broke.", "fails", ["Broke songs were never common and never left: between ", B(ml), " and ", B(mh), " every decade."]],
      ["Every rap song is flexing.", "half", ["Not every one, but most: ", B(dec("money_flex", LAST, "hip_hop")), " hip-hop songs in the " + LAST + " flex money."]],
      ["Songs swear way more now.", "holds", ["Strong swearing: ", B(dec("profanity_strong", FIRST)), " songs in the " + FIRST + ", ", B(dec("profanity_strong", LAST)), " now."]],
      ["Kids’ lists are full of explicit songs.", "half", ["The lists filter: ", { b: said(vs.group.measures[SEX].share), note: fmtN(vs.group.measures[SEX].hits) + " of " + fmtN(vs.group.n_songs) + " picked songs describe sex explicitly. Source: kids-full-catalogue.json." },
        " picked songs are explicit, against ", { b: said(vs.chart.measures[SEX].share), note: fmtN(vs.chart.measures[SEX].hits) + " of " + fmtN(vs.chart.n_songs) + " Year-End songs since " + vs.from_year + ". Source: kids-full-catalogue.json." }, " chart songs overall since " + vs.from_year + "."]],
      ["Music got cleaner in the 2020s.", "fails", ["Explicit sex: ", { b: pct(per(SEX, P0).share), note: cite(per(SEX, P0), WHAT[SEX]) }, " in " + P0 + ", ", { b: pct(per(SEX, P1).share), note: cite(per(SEX, P1), WHAT[SEX]) }, " in " + P1 + ". A plateau, not a drop."]]
    ];
    var WORD = { holds: "Holds", half: "Half holds", fails: "Doesn’t hold" };
    C.forEach(function (c) {
      var ev = h("p", { class: "evidence" }); say(ev, c[2]);
      host.appendChild(h("li", null, [h("span", { class: "verdict " + c[1], text: WORD[c[1]] }), h("p", { class: "claim", text: c[0] }), ev]));
    });
  }

  /* ---------------- 11–12. author, method ---------------- */

  function drawAuthor() {
    var o = A.opinionNote(D);
    byId("author-opinion").textContent = o.opinion;
    var ex = A.seriesFor(D, "all", SEX), a = ex[0], mid = ex.filter(function (x) { return x.decade === "1990s"; })[0], b = ex[ex.length - 1];
    say(byId("author-data"), ["What the data says: graphic sex was in ", { b: P(dec(SEX, a.decade)), note: cite(dec(SEX, a.decade), WHAT[SEX]) }, " of songs in the " + a.decade + ", ", { b: P(dec(SEX, mid.decade)), note: cite(dec(SEX, mid.decade), WHAT[SEX]) }, " in the " + mid.decade + ", when most of today’s parents were growing up, and ", { b: P(decW(SEX)), note: cite(decW(SEX), WHAT[SEX]) }, " since 2010. That is what made the charts, not what any one child heard."]);
  }
  function drawMethod() {
    byId("method-corpus").textContent = A.methodCorpus(D);
    var t = h("table", { class: "ngrid" }), body = h("tbody");
    t.appendChild(h("thead", null, [h("tr", null, [h("th", { text: "What was read" }), h("th", { text: "Agreed" }), h("th", { text: "Songs re-read" })])]));
    A.agreementRows(D).forEach(function (r) { body.appendChild(h("tr", null, [h("th", { class: "rowh", scope: "row", text: r.label }), h("td", { text: pct(r.agreement, 1) }), h("td", { text: fmtN(r.n) })])); });
    t.appendChild(body); byId("agree").appendChild(t);
    var gen = byId("footer-generated"); if (gen && D.generated_at) { gen.textContent = "Figures built " + D.generated_at.slice(0, 10) + "."; }
  }

  /* ---------------- theme ---------------- */

  function theme() {
    var b = byId("theme-toggle"); if (!b) { return; }
    function sync() { var d = isDark(); b.textContent = d ? "☀" : "☾"; b.setAttribute("aria-label", d ? "Switch to light mode" : "Switch to dark mode"); }
    b.addEventListener("click", function () {
      var next = isDark() ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) { /* private window */ }
      sync(); document.dispatchEvent(new Event("themechange"));
    });
    sync();
  }

  /* ---------------- boot ---------------- */

  function get(p) { return fetch(p, { cache: "no-store" }).then(function (r) { if (!r.ok) { throw new Error(p + " → HTTP " + r.status); } return r.json(); }); }
  function boot() {
    theme(); drawBreaks();
    Promise.all([get(FEEDS.bd), get(FEEDS.subs), get(FEEDS.kids), get(FEEDS.race).catch(function () { return null; }), get(FEEDS.mentions).catch(function () { return null; }), get(FEEDS.detail).catch(function () { return null; }), get(FEEDS.examples).catch(function () { return null; }), get(FEEDS.body).catch(function () { return null; })]).then(function (f) {
      CD = f[5]; EX = f[6]; BP = f[7];
      D = f[0]; PER = D.periods5.map(function (p) { return p.label; }); DEC = D.decades; FIRST = DEC[0]; LAST = DEC[DEC.length - 1];
      drawOpen(); drawHeat(); drawThenNow(); drawBubbles();
      drawSex(); drawTrio(); drawDrugs(f[1]); MEN = f[4]; SUBS = f[1]; drawKinds(f[1], f[4]); drawViolence(); drawViolenceDetail(); drawCrime(); drawSexDetail(); drawDetailMinis(); drawThreats(); drawBody(); drawMentionLines(); drawBigs(); drawOverhaul(); drawMoney(); drawKids(f[2]); setTimeout(reels, 0);
      drawAuthor(); drawMethod();  // scoreboard off for now (owner, 2026-09-23)
    }).catch(function (err) {
      var e = byId("load-error");
      e.textContent = "Could not load the figures: " + err.message + ". Serve the repository with scripts/serve_private_preview.py and open http://127.0.0.1:8765/site/index.html.";
      e.hidden = false;
      if (window.console) { console.error(err); }
    });
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", boot); } else { boot(); }
})();

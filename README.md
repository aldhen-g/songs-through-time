# Songs Through Time

What people *say* Billboard hits have become, set beside what the songs
actually contain. The study reads **6,197 Billboard Year-End Hot 100 songs
(1960s–2020s)** and charts what they talk about by decade, genre and audience.

Live site: <https://songsthroughtime.com>

## What is here

| Path | What |
|---|---|
| `site/` | The whole site: plain HTML, CSS and JavaScript, no build step |
| `live/` | The chart feeds the site reads. Every number on the page comes from one of these |
| `scripts/` | The scripts that build those feeds |
| `config/` | The reading instructions and card schemas used to read each song |

To view it locally, serve the repo root (for example `python3 -m http.server`)
and open `/site/`.

## What is not here

No lyrics. The song texts the study reads are copyrighted, so they stay in a
private working repository, and the scripts in `scripts/` will not run without
them. What is published is the method and the aggregate results: counts,
shares and labels per decade, genre and list, never the words of the songs.

Numbers report their own coverage. An empty cell means "not measured", not
zero, and songs whose artist's race is unknown are counted as unknown.

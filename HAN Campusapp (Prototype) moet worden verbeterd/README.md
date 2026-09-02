# HAN Campusapp

A static, no-build multi-page implementation of the HAN Campusapp brief:
plain HTML/CSS/JS, one shared `styles/global.css`, and one small script
per page under `scripts/`.

## Running it

Everything is plain static files, but a few features (ES module imports,
`getDisplayMedia`, third-party cookies in the iframe) need a real HTTP
origin — opening the files directly as `file://` will not work correctly.
From this folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

Any static file server works equally well (`npx serve`, VS Code's Live
Server, etc.).

## Structure

```
index.html              redirects to /schedule/index.html
styles/global.css        design tokens + every shared component style
scripts/nav.js            injects the top-right logo + bottom pill nav on every page
scripts/schedule.js       cookie-consent gate, iframe viewer, Add to Calendar capture
scripts/misc.js           collapsibles ("Overige") + dynamic add hook
scripts/services.js       location search → map iframe navigation
scripts/comms.js          category selector + dynamic service card list
scripts/education.js      "Vraag hier je Opleiding" info modal
scripts/page.js           profile/settings tabs + edit-profile modal
scripts/assistant.js      HANssistent AI (WebLLM) wiring
assets/                   test.svg (nav icon), logo.svg, location.svg,
                           internet.svg, schedulefake.png, placeholder.jpg
schedule/index.html        Rooster — "MyX" schedule view
schedule/misc.html         Overige — collapsibles
schedule/services.html     Locatie — mapping / search
comms/index.html           Comms — Brightspace, Teams, Outlook, etc.
education/index.html       Opleiding — study progress blocks
page/index.html            Mijn pagina — profile & settings
assistant/index.html       HANssistent AI
```

## Naming / routing decisions

The brief names pages two different ways in a couple of places. I resolved
them like this:

- **Opleiding page**: the pill nav links to `/education/index.html`; the
  content section was headed "study/index.html". I kept the nav path
  (`/education/index.html`) since that's what every other page links to,
  and put the described study-block content there.
- **Mapping/"Locatie" section**: the brief first says the collapsibles
  live on `/schedule/misc.html`, then a later line says "this page
  describes `/schedule/services.html`" right after the mapping div. I read
  that as the mapping section actually belonging on its own page, so
  `misc.html` holds the collapsibles ("Overige") and `services.html` holds
  the map/location search.
- **Mobile-only 767px breakpoint**: skipped per your instruction — the
  pill nav and top logo are always on, not gated to a media query.

## HANssistent AI / WebLLM note

The assistant runs `@mlc-ai/web-llm` (loaded from a CDN, requires WebGPU)
entirely in the browser — nothing is sent to a server. One real
limitation worth knowing: WebLLM runs its own precompiled MLC-format
models, it does not parse arbitrary raw `.gguf` bytes the way
`llama.cpp`/`wllama` do. The import pill keeps the requested "drop a
.gguf file" UI, and best-effort maps the chosen filename to a matching
WebLLM prebuilt model (falling back to a small default, or a
vision-capable model automatically when a schedule screenshot is
present). If you specifically need literal arbitrary-GGUF loading later,
swap the loader in `scripts/assistant.js` for `@wllama/wllama`, which is
built for that.

`assistantLLM` and `calenderLLM` are two system prompts against the same
loaded engine, toggled with the mode buttons. `calenderLLM` automatically
picks up the screenshot captured by the "Add to Calender" button on
`/schedule/index.html` (stored in `sessionStorage` only — non-persistent,
cleared when the tab closes).

## Placeholder assets

`assets/schedulefake.png` and `assets/placeholder.jpg` are generated
placeholders (a fake weekly timetable and a generic avatar silhouette) —
swap them for real artwork whenever you have it. `test.svg`, `location.svg`,
`internet.svg`, and `logo.svg` are simple hand-drawn stand-ins using
`currentColor`, so they recolor via CSS wherever the brief asks for that
(the pill nav icons in particular).

## Extending it later

- New "Overige" item: `HANCampus.addCollapsible(title, body)`
- New Comms card: `HANCampus.addCommsCard(title, desc, url, category)`
- Toast helper for any page: `HANCampus.toast(message)`

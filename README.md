# Your Script

A line-learning web app for actors — upload a script, choose your role, and
rehearse your lines by active recall or flashcards, with cue prompts pulled
straight from the text.

This repository is the **web interface** for the project: a single-page React
app built around a hand-drawn, notebook-paper visual language.

---

## Design & authorship

I owned the product and **every design decision** in this interface:

- the **hand-drawn, notebook-paper art direction** and the whole visual language
- the **colour system**, typography, spacing, and information hierarchy
- the **end-to-end flow** — landing → upload → 3-step setup wizard → practice → review
- the **micro-interactions and motion** (sketch "boil" frames, mascot animation,
  the streaming progress bar, the correct-answer flourish)
- the **copy**, the component behaviour, and the iterative polish

The work went through many directed passes: I set the vision, reviewed each
iteration, and steered the look, feel, and behaviour until it matched what I
wanted — down to specifics like which colours belong in the palette, how the
controls should read, and how every screen flows into the next.

**Disclosure:** the front-end *code* was implemented by an AI coding assistant
(Anthropic's Claude) working to my direction. The creative direction, design
system, product decisions, and review are mine; the AI handled the
implementation. I'm noting this in the interest of transparency.

> The script-parsing engine that powers the app is a separate service of mine
> and isn't included in this repository.

---

## What's in the UI

- **3D scroll-driven landing page** (Three.js + GSAP)
- **The practice app** — upload a `.pdf`/`.txt`, confirm your role and start
  line, then run your lines via active recall (type from memory) or flashcards
- **A live design system** at `/design-system` documenting the tokens,
  components, and patterns — rendered from the real CSS, so it never drifts
- Hand-drawn **"RoughBox"** SVG frames, mascots, and `prefers-reduced-motion`-
  aware interactions throughout

---

## Tech

React 18 + Vite · Three.js / GSAP for the landing · a hand-rolled CSS design
system (no UI framework).

---

## Run it locally

```bash
npm install
npm run dev      # Vite dev server → http://localhost:5173
```

The parsing API is a separate service, so script upload/parsing isn't wired up
from this repo alone — but the full UI, the landing page, and the design system
(`/design-system`) are all browsable.

Routes: `/` (landing) · `/upload` (the practice app) · `/design-system`.

---

## License

© Me. All rights reserved. _(Update with your name / chosen license before publishing.)_

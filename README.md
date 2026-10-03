# Math Buddy

A math helper for kids, built as a Progressive Web App (PWA). It works in any modern browser,
can be installed to an Android or iPhone home screen, and runs offline. No app store, no
Android SDK, no account, no server.

## What it does

- **Solve**: type a problem and get step-by-step working, explained the way a teacher would:
  column addition with carrying, borrowing, long multiplication, long division, common
  denominators, "keep, change, flip", lining up decimal points, percent shortcuts, and solving
  equations by doing the same thing to both sides (plus a check at the end).
- **Let me try first** (on by default): the kid answers first, then can ask for a hint or
  reveal one step at a time. The full answer only appears at the end.
- **Practice**: 11 topics × 3 levels, 10 problems a round, an on-screen keypad, a hint after a
  wrong first try, and "Show me how" after a second miss. Stars and streaks.
- **Progress**: stars, best streak, and first-try accuracy per topic, with a "worth more
  practice" tip. Saved on the device only.
- **Camera (optional)**: snap a printed problem. The text goes into the box so the kid can check
  it before solving. This downloads an OCR library (Tesseract.js) the first time, so it needs
  internet; everything else works offline. Handwriting recognition is hit-and-miss.

### Problems it understands

| Type | Examples |
| --- | --- |
| Whole numbers | `347 + 285`, `1000 - 1`, `236 x 45`, `864 ÷ 7` |
| Order of operations | `2 + 3 × (8 − 2)`, `4^2 - 3 × 2` |
| Fractions and mixed numbers | `3/4 + 1/6`, `2 1/3 - 3/4`, `12 × 3/4`, `3/4 ÷ 2/5` |
| Decimals | `3.5 + 12.25`, `2.5 × 1.2`, `7.5 ÷ 0.25` |
| Percents | `25% of 80`, `35% of 60` |
| Equations / missing numbers | `3x + 5 = 20`, `2(x + 3) = 4x - 2`, `? × 6 = 42` |
| Checking a statement | `5 + 2 = 8` (says whether it's true) |

Typing tips: `x` means times unless there's an `=` sign (then it's the unknown). `3/4` with no
spaces is a fraction; `3 / 4` is division. Words like *plus*, *minus*, *times*, *divided by*
and *of* work too.

Not supported yet: word problems, squared equations, geometry.

## Run it

It's plain HTML, CSS and JavaScript with no build step. Serve the folder with any static server:

```sh
npm start            # or: python3 -m http.server 8080
```

Then open http://localhost:8080. Service workers (offline mode and install) need either
`localhost` or HTTPS.

## Put it on a phone

1. Host the folder on any HTTPS static host. GitHub Pages is free: repo **Settings → Pages →
   Deploy from branch → main / root**.
2. Open the URL in Chrome on Android (or Safari on iPhone).
3. Tap **Install app** in the header, or the browser menu → **Add to Home screen**.

To ship it on the Play Store later, wrap the hosted PWA as a Trusted Web Activity with
[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap). No app code changes needed.

## Tests

```sh
npm test
```

## Project layout

```
index.html            app shell
css/app.css           styles (light and dark)
js/rational.js        exact fractions (so 1/3 + 1/3 + 1/3 is exactly 1)
js/parser.js          turns typed text into an expression tree
js/explain.js         explains each single operation (carrying, long division, fractions…)
js/solver.js          walks the tree in order of operations; solves linear equations
js/practice.js        practice problem generators
js/store.js           progress saved in localStorage
js/ocr.js             optional photo reading (loads Tesseract.js on first use)
sw.js                 offline cache (bump VERSION when files change)
```

# Math Buddy

Built by Jeegar using Claude Code.

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
- **CBSE class**: set each kid's class (1–8, shown with ages) when adding them or under
  Progress → For grown-ups. Practice follows the CBSE (NCERT) syllabus for that class:
  **Medium** is what the class expects, **Easy** a step below, **Hard** a step above. Every
  kid in the same class gets the same levels. Word problems use ₹.
- **Stars by level**: right on the first try earns ★1 on Easy, ★2 on Medium, ★3 on Hard.
- **Family view**: Progress → Family compares every kid side by side: stars, first-try
  accuracy, problems this week, best streak, what each needs to practice, a topic-by-topic
  table and the last 7 days of practice.
- **Practice**: 13 topics (including word problems and negative numbers) × 3 levels, 10 problems a round, an on-screen keypad, a hint after a
  wrong first try, and "Show me how" after a second miss. Stars and streaks.
- **Profiles**: one per kid, each with their own stars, streaks, stats, recent problems and
  settings. Tap the name in the header to switch kids or add one. Rename, reset or delete a
  profile under Progress → For grown-ups.
- **Progress**: stars, best streak, and first-try accuracy per topic, with a "worth more
  practice" tip. Saved on the device.
- **Move progress to another device**: Progress → *Save progress* writes every kid's progress
  to a small JSON file (on Android, pick **Drive** in the share sheet). On the other device,
  tap *Load progress* (or *Load progress from a file* on the first screen) and pick the file.
  Kids in the file replace the same-named kid on that device or are added; other kids stay.
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
| Word problems | `6 friends share 24 cookies equally. How many cookies does each friend get?` |

### Word problems

Word problems are read offline, the way kids are taught: find the question, find the
numbers, spot the clue words ("shared equally" → ÷, "each" → ×, "left" → −, "in all" → +,
"how many more" → compare), then write the math sentence and solve it step by step. The
numbers and clue words are highlighted in the story, and the answer comes with its unit
("4 cookies", "$14").

It handles one- and two-step problems: adding, taking away, comparing, equal groups,
sharing, money, "25% off", "2/3 of the students", "what fraction is left". If it can't tell
what a problem is asking, it says so and asks the kid to write the math sentence instead of
guessing.

Typing tips: `x` means times unless there's an `=` sign (then it's the unknown). `3/4` with no
spaces is a fraction; `3 / 4` is division. Words like *plus*, *minus*, *times*, *divided by*
and *of* work too.

Not supported yet: squared equations, geometry, and word problems that need more than a couple of steps.

## Family sync

Sign in once on each device with a family email and password, and every kid's progress
stays the same on all of them. It uses Firebase (Google's free app database):

- Counts (stars, problems right, topic tries) are sent as "add N", so practice on two
  devices at the same time adds up. Names, colors and settings are "latest change wins".
- Each device keeps its own copy and works offline; changes sync when it's back online.
- When a device with existing progress joins, it asks whether to use the family account's
  progress or add this device's on top (so a kid copied over by file isn't counted twice).
- Each family can only read its own data (Firestore rules below).

### Setting it up (once, for the app)

1. In the [Firebase console](https://console.firebase.google.com) create a project.
2. **Authentication → Sign-in method → Email/Password → Enable.** Under **Settings →
   Authorized domains**, add the site's domain (for example `jpwiki.github.io`).
3. **Firestore Database → Create database** (production mode), then set **Rules** to:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /families/{uid}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```
4. **Project settings → Your apps → Web app**, then copy the `firebaseConfig` values into
   `js/config.js` as `FIREBASE_CONFIG`. They're public identifiers, not secrets.

With `FIREBASE_CONFIG = null` the app works exactly as before, with no sync option.

`js/vendor/firebase.js` is the Firebase JS SDK 10.14.1 (app, auth, firestore) bundled with
esbuild, so the app doesn't depend on a CDN. To rebuild it, bundle an entry file that
re-exports the functions `js/cloud-firebase.js` uses:
`npx esbuild entry.js --bundle --format=esm --minify --outfile=js/vendor/firebase.js`.

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
js/written.js         long multiplication and long division laid out like on paper
js/words.js           reads word problems (question, numbers, clue words)
js/practice.js        practice problem generators
js/store.js           kid profiles and progress, saved in localStorage
js/sync.js            family sync: merges progress across devices (adds counts, never overwrites)
js/cloud-firebase.js  family sync through Firebase sign-in and Firestore
js/config.js          Firebase settings for family sync (null = sync off)
js/vendor/firebase.js bundled Firebase SDK
js/ocr.js             optional photo reading (loads Tesseract.js on first use)
js/version.js         app version shown in the footer and saved in progress files
sw.js                 offline cache (change VERSION to match js/version.js on every release)
```

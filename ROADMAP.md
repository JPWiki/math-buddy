# Roadmap

Ideas agreed with Jeegar but not built yet. Pick these up when making a large change.

## More practice topics (and Classes 9–10)

Add these practice topics, following the CBSE (NCERT) syllabus like the existing ones:
**Medium** is what the class expects, **Easy** a step below, **Hard** a step above.

| Topic | Classes | Difficulty ladder (easiest first) |
|---|---|---|
| Decimals ↔ fractions | 4–7 | tenths → fraction; n/10, n/100 → decimal; hundredths → simplest fraction; n/2, n/4, n/5, n/20, n/25, n/50 → decimal; mixed numbers (2.75 ↔ 2 3/4); thousandths (0.125 ↔ 1/8) |
| Perimeter & area | 3–10 | square perimeter; rectangle perimeter; rectangle/square area; missing side from area or perimeter; triangle (½bh) and parallelogram; circle circumference/area with π = 22/7 (radius a multiple of 7); trapezium and composite shapes; Heron's formula (13-14-15, 5-12-13 style triangles) |
| Volume & surface area | 8–10 | cube/cuboid volume; cube/cuboid surface area; cylinder volume; cylinder curved/total surface area; cone volume, sphere/hemisphere surface area; sphere volume (r = 21), cone curved surface with slant height from a Pythagorean triple |
| Angles & triangles | 6–10 | complementary/supplementary; third angle of a triangle; straight line and exterior angle; Pythagoras hypotenuse; Pythagoras missing side; regular polygon interior angle / angle sum; exterior angle → number of sides, isosceles triangles |
| Algebra | 6–10 | evaluate 3x + 4 at x = 5; like terms (5a + 3a − 2a = ?a); two variables with negatives; identities for mental maths (103², 104 × 96); polynomial values p(3); pair of linear equations; quadratic roots by factorising; AP nth term and sum |
| Place value & rounding | 1–6 | tens and ones; tens in a 2-digit number; place value in 3 digits; expanded form; Indian place value (3,46,780); round to nearest 10/100; nearest 1000; decimals to whole / 1 decimal place |
| Factors, HCF & LCM | 4–7 | count factors; LCM of small numbers; HCF; larger HCF/LCM by prime factors; three numbers; word problems (bells ringing together, largest tile) |
| Squares, roots & powers | 7–9 | squares to 20²; small powers (2⁵); square roots of perfect squares; laws of exponents (2³ × 2⁴ = 2^?); cubes and cube roots; large square roots by prime factors, negative exponents |
| Measurement & time | 2–6 | m ↔ cm, hours ↔ minutes; kg/g, L/mL, hours and minutes; decimals of units (2.5 km = ? m); elapsed time; adding mixed units; speed = distance ÷ time; time/distance and 24-hour clock |
| Ratio, profit & interest | 6–8 | unitary method; sharing in a ratio; selling price from profit/loss %; simple interest; profit %; discount then GST; compound interest (2 years) |
| Data & probability | 6–10 | mean; mode; median (odd count); median (even count) and range; mean from a frequency table; missing value from the mean; simple probability (as a fraction) |
| Trigonometry | 10 | standard values with rational answers (sin 30°, tan 45°, cos 0°…); expressions (2 sin 30° + tan 45°, sin²60°); given sin A = 5/13 find cos A (Pythagorean triples); heights and distances / identities (ladder at 60°, sec²A − tan²A) |

**Extending to Classes 9 and 10** (needed for trigonometry, which CBSE teaches in Class 10):
- `GRADES` in `js/practice.js` and `validGrade` in `js/store.js` go up to 10 (ages are already `class + 5`).
- Existing topics continue into Classes 9–10 where CBSE has them: equations, integers, BODMAS, word problems.

### How to build it

- New topics can't be solved by the typed-problem solver, so each generator returns a
  **prepared problem** instead of a string: `{ text, html?, answer: Q, unit, format, hint, steps: [{ title, lines }] }`.
  Keep these in a new `js/topics-extra.js` and append them to `TOPICS`.
- `format` is `'number'`, `'fraction'` or `'decimal'`. `checkAnswer` should take it so
  "write it as a fraction" refuses 0.75 and "write it as a decimal" refuses 3/4.
  The simplest-form rule already applies to fractions.
- In `js/app.js`: practice uses `solve(text)` for strings and a `preparedResult(item)` for
  objects; `makeRound`'s duplicate check and the no-negatives filter must handle both; the
  Solve tab examples should only use string (solver) topics; `stepHTML` should skip an
  empty "before" line.
- `readAnswer` should also accept units after a number (cm², m³, °) and Indian commas (3,46,780).
- Choose numbers so every answer is exact: radius a multiple of 7 with π = 22/7, Pythagorean
  triples, Heron triangles with whole areas, terminating decimals for decimal answers.
- Tests: every step of every topic gives a valid problem, and its own answer passes
  `checkAnswer` in the right format; every class's Easy < Medium < Hard.

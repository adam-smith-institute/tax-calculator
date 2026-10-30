# ASI Design System: interactive patterns

The ASI Design System covers artwork and print and defines no interactive UI. This calculator
needed some, so this document records each pattern for adding to the system. They build on
the policy paper's `web` treatment: a white page, ASI blue `#134079`, Josefin Sans for
headings, labels, numbers and charts, and PT Serif for explanatory text.

**Departures from the Design System, made at ASI's request (30 October 2026):**

1. **The spending chart uses a vivid, varied palette**, one colour per category, set in
   `src/spending/taxonomy.json`. Fourteen categories cannot be told apart in the system's
   four chart colours.
2. **A pie (donut) chart** shows the spending split, in place of the system's ranked bar.
3. **A light panel** (`#F3F5F8`) groups the inputs, and explanations sit on a white or
   panel ground with a blue left rule. The system otherwise has no panels or tints.

Everything else keeps to the system: no rounded corners, no shadows, sentence case, flush
left, no hyphenation, line-height never below 1.2.

The code is in `src/styles.css` and `src/ui/pie.js`.

## Tokens

| Token | Value | Use | Contrast |
|---|---|---|---|
| `--asi-blue` | `#134079` | Headings, key figures, links, selected states, focus ring | 10.3:1 on white, 9.4:1 on the panel |
| `--ink` | `#161616` | Text | 18.1:1 |
| `--grey` | `#52585e` | Hints, captions, sources, unselected tabs | 7.2:1 on white, 6.6:1 on the panel |
| `--hairline` | `#c9cdd2` | Rules between content; never a control boundary | (decorative) |
| `--panel` (new) | `#f3f5f8` | Background of the inputs panel and of explanations in the results | |
| `--hover` (new) | `#eef1f6` | Hover and highlight background of legend rows and the segmented control | ink 16.0:1 |
| `--control-border` (new) | `#52585e` | Borders of inputs | 7.2:1 (WCAG asks 3:1) |
| `--focus` (new) | `#134079` | Focus ring | 10.3:1 |
| Category colours (new) | in `taxonomy.json` | Pie slices and legend swatches only | (the legend carries every figure as text) |

Lavender `#8B8DBE` appears only as the payload on the share image. Navy `#1B2A4A` appears
only in the logo and as the link hover colour.

## Type for screens

Josefin Sans reads small, so it is set larger than instinct suggests.

| Role | Face | Size / line-height |
|---|---|---|
| Page title | Josefin 400, blue | 28 to 40px (fluid) / 1.2 |
| Panel heading | Josefin 600, blue | 22px / 1.25 |
| Headline figure | Josefin 600, blue, tabular | 52 to 76px (fluid) / 1.0 |
| Tabs | Josefin 600 | 19px |
| Field label | Josefin 600, ink | 17.5px / 1.3 |
| Input text | Josefin 400, ink, tabular | 20px |
| Hint | PT Serif 400, grey | 15px / 1.4 |
| Explanations and body | PT Serif 400, ink | 15.5 to 17px / 1.5 |
| Legend and tables | Josefin 400 or 600, tabular | 14.5 to 18px |

## Layout

Two columns from 960px wide: **Your details** (the inputs panel, about 390px) on the left,
results on the right. Below that width there is one column, inputs first. Only what most
people need is open: tax year, age, salary (with the employer NI option) and
self-employment profit. Everything else sits in four closed groups, so the page shows little
at once.

## Patterns

### Focus

A **2px solid ASI blue outline, offset 2px**, for keyboard focus only (`:focus-visible`).
It is never removed. Inside the segmented control and legend rows the ring is inset, so it
stays visible against the blue fill or the row background.

### Text input

A white field with a **1px `--control-border` border**, square, 46px minimum height. Money
fields have a "£" box on the left and percentages a "%" box on the right. The label sits
above, with any hint between label and field, linked by `aria-describedby`. On error the
border thickens to **2px ink** and a message beginning "Error:" appears beneath, and the
field gets `aria-invalid="true"`.

### Segmented control (tax year)

Two equal buttons in a 1px blue frame, each with `aria-pressed`. The selected one is
**filled ASI blue with white text**; the other is white with blue text and takes the hover
colour on hover. A short note sits under each year ("this year", "after Budget 2026").

### Help button ("?") and explanation

A **26px circle** with a 1.5px blue border and a blue "?" in Josefin 600. Josefin's "?" sits
high in its em box, so the glyph is nudged down 0.09em to look centred. The button has a
descriptive `aria-label` (for example "How age affects your tax") and `aria-expanded`. It
takes the hover colour on hover and fills blue while its explanation is open.

The explanation opens **inline**, under the label: plain PT Serif text in ink, with no bar,
box or background, fading in over 180ms. Help never appears on hover alone.

### Input group (closed by default)

Native `<details>`. The summary line has a blue plus sign (two flat 2px bars, the vertical
one hidden when open), the group name in Josefin 600 blue, and on the right a **status in
grey that says what has been entered** ("£7,000 entered", "2 children"). That way a closed
group still shows whether it affects the result. Groups are separated by hairline rules.

### Tabs

The WAI-ARIA tabs pattern: `role="tablist"`, `tab` and `tabpanel`. The left and right
arrows, Home and End move between tabs. The selected tab is blue with a **3px blue
underline** sitting on the tablist's hairline; the others are grey and turn blue on hover.
Used for **Your tax** and **Where it goes**. A primary button at the end of the first panel,
"See where it goes →", leads to the second.

### Donut chart with an interactive legend

- An SVG donut (outer radius 156, inner 98, on a 320 grid), slices clockwise from 12
  o'clock, largest first, with 2px white separators. The total sits in the centre in
  Josefin 600 blue, with a grey label beneath.
- **The legend is the interface.** It is a list of buttons, one per category: a colour
  swatch, the name in Josefin 600, "Your tax" and "In £1" in right-aligned tabular columns,
  under small grey column headings. It works by keyboard and screen reader, and the SVG has
  an `aria-label` that points to it.
- Hovering or focusing a legend row, or hovering a slice, highlights that pair and fades the
  other slices to 35% opacity.
- **Selecting a category** (legend button or slice click) redraws the donut with its parts.
  A "← All spending" link and the category's name and description head the legend, and
  focus moves to the name. Parts are listed with their descriptions running full width
  beneath. A net negative part (EU transactions) is listed but left out of the donut, with a
  note saying so. "All spending" returns focus to the category's button.
- A "Show as a table" disclosure gives every figure as a data table.

### Motion

Motion is used only to show where things go. All of it is skipped for users who ask for
reduced motion (`prefers-reduced-motion`).

- **The chart sweeps in** (750ms, ease-in-out) each time "Where it goes" is opened: every
  slice grows from 12 o'clock to its place.
- **Opening a category:** its slice grows to fill the ring while the others shrink away
  (380ms), then the ring splits into the category's parts (520ms). The largest part takes
  the category's own colour, so the split reads as one shape dividing.
- **"All spending"** runs the same in reverse.
- The centre figure cross-fades (160ms), and legend rows fade up 5px one after another (22ms
  apart).
- Explanations fade in over 180ms, and "?" buttons change colour over 150ms.

### Data table

A header row in Josefin 600 blue over a **2px blue rule**, body rows on hairline rules, and
no vertical rules or fills. Numbers are right-aligned and tabular. The total row is Josefin
600 blue over a 2px blue rule. Wide tables scroll inside their own box, so the page never
scrolls sideways.

### Buttons

**Primary:** Josefin 600, 17px, white on ASI blue, square, 46px minimum height. **Secondary:**
blue text on white with a 2px blue border. Hover underlines the label. Disabled while busy,
with a progress cursor.

### Embedding

The page posts `{ type: 'asi-tax-calculator:height', height }` to its parent whenever its
height changes (see `EMBED.md`).

## Share image

A 1080 × 1350 (4:5) card, laid out on the Design System's Stat Card grid: the mark top-right
at 12.5% of width with a 2% margin, 150px margins, and the footer rule (480 × 6 at 2048 scale)
with adamsmith.org anchored 202px from the bottom.

**Departure, at ASI's request:** the card is **white**, not ASI blue. So the total is set in
ASI blue (Josefin 600), the headline in ink, the mark is the navy roundel (the system's
version for light grounds), and the footer rule and URL are blue. The three largest shares
are a **horizontal bar chart in the pie chart's category colours**: the name above each bar,
the bar scaled to the largest, and the amount just past its end. The categories, colours
and order come from the data. A grey source line sits below. The card waits for
`document.fonts.ready` before drawing, and a test checks it never runs into the footer.

# ASI Design System: interactive patterns

The ASI Design System covers artwork and print and defines no interactive UI. This calculator
needed some, so this document records each new pattern for adding to the system. Each one
extends the policy paper's `web` treatment: a white page, ASI blue `#134079` as the only
interior accent, Josefin Sans for headings, labels, numbers and charts, and PT Serif for
explanatory text. None of them introduces a rounded corner, shadow, gradient, tint, opacity
variant of the blue or floating panel.

The code is in `src/styles.css`, with each pattern's name in a comment.

## Tokens

The design system's palette and the policy paper's web tokens, plus two additions.

| Token | Value | Use | Contrast on white |
|---|---|---|---|
| `--asi-blue` | `#134079` | Headings, key figures, links, selected states, focus ring, primary chart series | 10.3:1 |
| `--ink` | `#161616` | Text | 18.1:1 |
| `--grey` | `#52585e` | Hints, captions, sources, notes | 7.2:1 |
| `--hairline` | `#c9cdd2` | Rules between content only, never a control boundary | (decorative) |
| `--asi-amber` | `#C67A2E` | Second chart series (sub-categories) | 3.37:1, enough for a graphic (3:1) |
| **`--control-border`** (new) | `#52585e` | Borders of inputs and checkboxes | 7.2:1 (WCAG asks 3:1) |
| **`--focus`** (new) | `#134079` | Focus ring | 10.3:1 |

Lavender `#8B8DBE` and navy `#1B2A4A` stay out of the interface. Lavender appears only as the
payload in the share image; navy only in the logo and as the link hover colour, as in the
policy paper.

## Type for screens

Josefin Sans reads small, so it is set larger than instinct suggests. No line-height goes
below 1.2, everything is flush left in sentence case, and nothing is hyphenated.

| Role | Face | Size / line-height |
|---|---|---|
| Page title | Josefin 400, blue | 30 to 46px (fluid) / 1.2 |
| Section heading | Josefin 600, blue | 24px / 1.25 |
| Headline figure | Josefin 600, blue, tabular | 52 to 80px (fluid) / 1.0 (a numeral, as on the Stat Card) |
| Field label | Josefin 600, ink | 18px / 1.3 |
| Input text | Josefin 400, ink, tabular | 20px / 1.3 |
| Hint | PT Serif 400, grey | 15.5px / 1.45 |
| Body and explanations | PT Serif 400, ink | 16 to 17px / 1.5 |
| Table numbers and chart labels | Josefin 400 or 600, tabular | 15 to 18px |

## Patterns

### Focus

Every focusable element shows a **2px solid ASI blue outline, offset 2px**, only for keyboard
focus (`:focus-visible`). It is never removed and never replaced by colour alone. Bar rows
use a 4px offset so the ring clears the bar.

### Text input

A white field with a **1px `--control-border` border**, square corners, 12px horizontal
padding and a minimum height of 48px (a comfortable touch target). Money fields carry a "£"
box joined to the left, percentages a "%" box on the right, in the same border. The label
sits above in Josefin 600, with any hint between label and field in PT Serif grey. The hint
is tied to the field with `aria-describedby`.

**Error:** the border thickens to **2px ink**, and a message in Josefin 600 ink appears
under the field, starting "Error:". The field gets `aria-invalid="true"`. The system has no
red, and colour alone would not do, so weight and words carry the error.

### Checkbox and radio choice

Native controls at 22px, with `accent-color: #134079`, so they keep the platform's
accessibility. Labels are Josefin 600, 18px, to the right; hints sit under the label. Radio
choices sit side by side in a `fieldset` whose `legend` asks the question.

### Segmented control (tax year)

A row of text buttons with `aria-pressed`. The selected one is **Josefin 600 in blue with a
3px blue underline bar**; the others are ink, with a hairline underline on hover. A short
note follows in Josefin 300 ("current", "after Budget 2026"). The pattern is taken from the
Global Energy Security Index tracker's view switch.

### Disclosure (expandable section)

Native `<details>` and `<summary>`, with the browser's marker hidden. The summary is Josefin
600, 19px, blue, preceded by a **plus sign drawn as two 2px blue bars**, which becomes a minus
when open. The section is bounded by hairline rules above and below. There are no panels and
no fills. Used for "More income and allowances", "Detailed breakdown" and "Show as a table".

### Explainer ("What does this mean?")

Replaces hover tooltips. A text button, Josefin 400, 15.5px, blue and underlined, with
`aria-expanded` and `aria-controls`. It reveals a block of PT Serif text **inline**, beneath
a hairline rule. It never floats over content, so it works by keyboard, touch and screen
reader, and inside an iframe. The underline thickens from 1px to 2px while open.

### Expandable bar row (chart)

A ranked horizontal bar chart in which each row is a full-width `<button>` with
`aria-expanded`:

- The top line has the category name (Josefin 600, 18px) on the left and the figures
  (Josefin 400, "£X · Yp in every £1") on the right. They wrap onto two lines on narrow
  screens.
- The bar (16px high, flat ASI blue) runs underneath, scaled to the largest category. There
  is no track, no rounding and no value label inside the bar.
- On the right sits the same plus or minus sign as the disclosure.
- Opening a row shows its description and its sub-categories inline, each with a 10px
  **amber** bar (the second series colour) scaled to the largest sub-category.
- Rows are separated by hairline rules. Hover underlines the name.
- A "Show as a table" disclosure gives the same figures as a data table for screen readers
  and copying.

### Data table

Policy paper §6.9, adapted for screen: a header row in Josefin 600 blue over a **2px blue
rule**, body rows on hairline rules, no vertical rules and no fills. Numbers are right-aligned
and tabular. Section rows are Josefin 600 blue over a 1px blue rule. The total row is Josefin
600 blue over a 2px blue rule. Wide tables scroll inside their own box, so the page itself
never scrolls sideways.

### Button

Josefin 600, 18px, white on flat ASI blue, square, 12 × 22px padding, minimum height 48px.
Hover underlines the label. The fill never changes, because there are no tints or opacity
variants of the blue. While busy the button is disabled and shows a progress cursor. One
primary button per view.

### Rules and spacing

Sections are separated by space and **1px hairline rules**. A blue rule (1px, or 2px under
table headers and totals) marks structure within tables. Cards, panels, boxes and left-border
callouts are not used.

### Embedding

The page posts `{ type: 'asi-tax-calculator:height', height }` to its parent whenever its
height changes, so a host page can size the iframe and avoid an inner scrollbar (see
`EMBED.md`).

## Share image

The Stat Card at 1080 × 1350 (4:5): flat blue ground, the white roundel top-right at 12.5%
of width with a 2% margin, and the total in lavender as the numeral. Beneath it, in white
Josefin, are the headline "is what I pay in tax in 2026-27.", the three largest categories
ranked from the data, and a source line. The footer has the 480 × 6 rule (at 2048 scale) and
adamsmith.org. The card waits for `document.fonts.ready` before drawing.

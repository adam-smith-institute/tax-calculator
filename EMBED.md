# Embedding the calculator

The calculator lives at `https://adam-smith-institute.github.io/tax-calculator/`, the same
address as before, so the existing iframe on adamsmith.org/tax-calculator keeps working.

To have the frame grow and shrink with its content instead of scrolling inside itself,
replace the Squarespace code block with this:

```html
<iframe id="asi-tax-calculator"
  src="https://adam-smith-institute.github.io/tax-calculator/"
  title="Adam Smith Institute tax calculator"
  style="width:100%;border:0;height:2400px"
  loading="lazy"></iframe>
<script>
  window.addEventListener('message', function (e) {
    if (e.origin !== 'https://adam-smith-institute.github.io') return;
    if (!e.data || e.data.type !== 'asi-tax-calculator:height') return;
    var frame = document.getElementById('asi-tax-calculator');
    if (e.source !== frame.contentWindow) return;
    frame.style.height = e.data.height + 'px';
  });
</script>
```

How it works: the calculator measures its own height whenever it changes (on load, as
results update, as sections open) and posts it to the parent page. The script checks the
message's origin and that it came from this frame, then sets the frame's height. If the
script doesn't run, the 2,400px starting height still shows the whole calculator on most
screens.

The page has no horizontal scroll at any width from 320px.

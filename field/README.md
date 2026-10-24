# Field

`../field.html` shows the portfolio as a [Hairline](https://github.com/lucasmarkes/hairline) figure, full screen: a site model with one raised bed per portfolio section (five, in rows) and one block per project, taller the newer it is. Moving over it raises the projects near the pointer, and the corner names the one under it.

| File | Purpose |
|---|---|
| `portfolio.js` | The figure. The only file to edit. Its project list is written into `SECTIONS` |
| `mount.js` | Mounts the figure full size on `field.html` (stage, read-out, theme toggle) |
| `kernel.js` | Hairline's engine, an unchanged copy from the `hairline-create` skill. Don't edit |

The figure is self-contained by design (no fetch), so after `build_data.py` adds or renames projects, update `SECTIONS` in `portfolio.js`, then check it with the skill:

```
node ~/.claude/skills/hairline-create/look.mjs portfolio.js --answer 140,25,18 --edge 124.5,101,15
```

That builds a checking page (`hairline-portfolio.html`, git-ignored), validates the figure and writes a contact sheet to look over. `field.html` loads `portfolio.js` directly, so there is nothing else to build.

## Deploying

GitHub Pages lets browsers cache files for 10 minutes, so a new page could pair with an old cached `style.css` or script. Both pages load their local files with a version string (`style.css?v=20261024d`); bump it in `index.html` and `field.html` whenever you change CSS or JS.

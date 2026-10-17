# Portfolio Project Graph

Interactive d3 graph for https://portfolio-5208db.webflow.io/ — styled after the blog's tag graph.

- **Projects** (coloured dots) are coloured by portfolio section.
- **Themes** (ring hubs) join projects that share a topic. Rules live in `THEME_RULES` in `graph.js`.
- Search (`/`), section legend filter, zoom/pan, light/dark, deep links (`#node=p:3`).

## Files
| File | Purpose |
|---|---|
| `index.html`, `style.css`, `graph.js` | The graph (static, d3 from CDN) |
| `data/projects.js` | Project data (generated) |
| `build_data.py` | Scrapes the live site into `data/projects.js` (stdlib only) |

## Run
```
py build_data.py        # refresh data from the live site (optional)
py -m http.server 8765  # then open http://localhost:8765
```

## Embedding in Webflow
Host the folder (e.g. GitHub Pages) and link to it, or embed with an iframe:
`<iframe src="https://YOUR-HOST/portfolio-graph/" style="width:100%;height:80vh;border:0"></iframe>`

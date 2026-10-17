"""Scrape the portfolio site and write data/projects.js for the graph.

Usage:  python build_data.py [URL_OR_LOCAL_HTML]
Re-run whenever you publish new projects.
"""
import html
import json
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

SRC = sys.argv[1] if len(sys.argv) > 1 else "https://portfolio-5208db.webflow.io/"
BASE = "https://portfolio-5208db.webflow.io"


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(req, timeout=30).read().decode("utf8")


if SRC.startswith("http"):
    page = fetch(SRC)
else:
    page = Path(SRC).read_text(encoding="utf8")

# Sections: <section id="..."> ... <h2 class="section-divider-title">Title</h2>
starts = [(m.start(), m.group(1)) for m in re.finditer(r'<section id="([^"]+)"', page)]
starts.append((len(page), None))

clean = lambda t: html.unescape(re.sub(r"<[^>]+>", "", t)).strip()
# drop the leading emoji / symbols from section titles
clean_title = lambda t: re.sub(r"^[^A-Za-z0-9]+", "", clean(t))
absolute = lambda h: h if h.startswith("http") else BASE + h

# The panel cover is ~340px wide, so ~680px covers 2x screens. Webflow's srcset has
# -p-500 / -p-800 variants that are a fraction of the original's size.
COVER_W = 680


def cover(img_tag):
    srcset = re.search(r'srcset="([^"]+)"', img_tag)
    if srcset:
        cands = sorted((int(w), html.unescape(u)) for u, w in re.findall(r"(\S+)\s+(\d+)w", srcset.group(1)))
        if cands:
            return next((u for w, u in cands if w >= COVER_W), cands[-1][1])
    src = re.search(r'src="([^"]+)"', img_tag)
    return html.unescape(src.group(1)) if src else ""


# Models / tools named in a project's write-up. Taglines rarely name them, so graph.js
# matches its theme rules against these as well. Order = display order.
TECH = {
    "LLM": r"\bllms?\b|large language models?|\bgemma\w*|\bllama\b|\bphi-?3\b|\bgemini\b|\bgpt-?\d|\bmistral\b|\bqwen|\bai chat\b|chatbot|conversational ai",
    "Vision-language model": r"\bllava\b|florence-2|\bblip\b|vision[- ]language|\bvlm\b",
    "Ollama": r"\bollama\b",
    "Stable Diffusion": r"stable diffusion|\bsdxl\b",
    "FLUX": r"\bflux\b",
    "Midjourney": r"\bmidjourney\b",
    "ControlNet": r"\bcontrolnet\b",
    "ComfyUI": r"\bcomfyui\b",
    "LoRA": r"\blora\b",
    "Image generation": r"image generation|text-to-image|\bfal ?ai\b",
    "Text-to-3D": r"text-to-3d|\bmeshy\b|3d (model )?generation",
    "Audio generation": r"\baudiogen\b|\baudiocraft\b",
    "Text-to-speech": r"text-to-speech|\btts\b",
    "YOLO": r"\byolo\w*",
    "OpenCV": r"\bopencv\b",
    "MediaPipe": r"\bmediapipe\b",
    "Face recognition": r"\binsightface\b|face-api",
}
# Sentences crediting AI help with code or prose, not part of the project itself.
CREDIT = re.compile(r"[^.]*\b(coding assistants?|writing assistance|attribution|reviewed and commented|(help|assistance) (of|from) \w+)\b[^.]*\.?", re.I)


def tech(url):
    """Tech named in a portfolio project page's body (title to the prev/next links)."""
    if not url.startswith(BASE):
        return []
    try:
        doc = fetch(url)
    except Exception as e:  # keep building; the project just gets no tech tags
        print("  ! could not fetch", url, e)
        return []
    a, b = doc.find('class="h1"'), doc.find("fs-prevnext")
    body = doc[a if a >= 0 else 0:b if b > a else len(doc)]
    body = re.sub(r"<(script|style)\b.*?</\1>", " ", body, flags=re.S)
    text = CREDIT.sub(" ", clean(re.sub(r"<[^>]+>", " ", body)))
    return [name for name, rx in TECH.items() if re.search(rx, text, re.I)]


projects = []
for (a, sid), (b, _) in zip(starts, starts[1:]):
    chunk = page[a:b]
    t = re.search(r'class="section-divider-title">(.*?)</h2>', chunk, re.S)
    if not t:
        continue
    section = clean_title(t.group(1))
    items = re.findall(r'<div[^>]*role="listitem".*?</a></div>', chunk, re.S)
    items += re.findall(r'<div[^>]*class="mentored-project-div".*?</a></div>', chunk, re.S)
    for item in items:
        href = re.search(r'href="([^"]+)"', item)
        name = re.search(r'class="project-name">(.*?)</h3>', item, re.S)
        year = re.search(r'black-40">(\d{4})<', item)
        tag = re.search(r'class="project-tag">(.*?)</h4>', item, re.S)
        img = re.search(r"<img[^>]*>", item)
        alt = re.search(r'<img[^>]*?alt="([^"]*)"', item)
        if not (href and name):
            continue
        tagline = clean(tag.group(1)) if tag else ""
        if not tagline and alt:  # mentored projects carry their description in the alt text
            tagline = html.unescape(alt.group(1)).strip()
        projects.append({
            "title": clean(name.group(1)),
            "url": absolute(href.group(1)),
            "year": year.group(1) if year else "",
            "tagline": tagline,
            "section": section,
            "image": cover(img.group(0)) if img else "",
        })

with ThreadPoolExecutor(8) as pool:
    for p, t in zip(projects, pool.map(tech, [p["url"] for p in projects])):
        p["tech"] = t


out = Path(__file__).parent / "data" / "projects.js"
out.parent.mkdir(exist_ok=True)
out.write_text("window.PORTFOLIO_PROJECTS = " + json.dumps(projects, indent=2, ensure_ascii=False) + ";\n", encoding="utf8")
print(len(projects), "projects")
for s in sorted({p["section"] for p in projects}):
    print(" ", s.encode("ascii", "replace").decode(), sum(p["section"] == s for p in projects))

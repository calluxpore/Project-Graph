/**
 * Portfolio: a site model of the portfolio. A plinth holds four raised beds,
 * one per section and each as large as its section; every project is a block
 * on its bed, standing taller the newer it is, so the latest work is the
 * skyline. The pointer moves over the field: the blocks near it rise, the one
 * under it highest, and that one takes the bright edge and the dot mark. At
 * rest the mark sits on the newest project. The slider is the radius, in cells.
 */
const {
  Cam, clamp, facing, fit, prism, proj, rings, unproj, spring, stepS,
  flatDot, mk, place, pointer, put, register, disposer, solid,
} = HL;

/* One bed per section: its bed's width in blocks, and its projects, newest first, as [name, year]. */
const SECTIONS = [
  [9, [["Mind Palace XR", 2026], ["GridPhoto", 2026], ["Control Map Studio", 2026], ["LoRA Dataset Studio", 2026],
    ["Birdsong Canvas", 2026], ["Echo-Gnosis", 2026], ["Acoustic Chronotope", 2026], ["Memory Mirror", 2026],
    ["Toronto Broski", 2026], ["MapleTax", 2026], ["Temporal Self", 2026], ["Face Image Sorter", 2026],
    ["OMAFA Evaluation", 2025], ["Comp. Semiotics", 2025], ["Webcam Captioning", 2025], ["From Noise to Art", 2025],
    ["Yolo Diffusion", 2025], ["ControlNet", 2025], ["Text to 3D Model", 2025], ["Frame Vision Maps", 2025],
    ["BLIP vs Human", 2025], ["Memory Maps", 2025], ["Webcam to Captions", 2025], ["Image to Captions", 2025],
    ["AI for 3D Modeling", 2024], ["AI-Driven VR NPCs", 2024]]],
  [6, [["Compute. Couture", 2024], ["Compute. Art", 2024], ["Compute. Play", 2024], ["Compute. Sound", 2024],
    ["Compute. Detox", 2024], ["Nakuko Obelisk", 2023], ["Parametric Prosthesis", 2023], ["Generative Reverb", 2023],
    ["Alter-Ego in Design", 2023], ["Hive Mind", 2023], ["Node Parameters", 2023], ["Bio-Morphologies", 2024]]],
  [5, [["Computational Mythos"], ["Xeno Morphology"], ["Algorithmic Modelling"], ["Fictional Narratives"],
    ["Character Stories"], ["Illustrative Sketches"], ["ID Prompts Generator"], ["ADHD Quiz"],
    ["Stopwatch"], ["RSVP Speed Reader"]]],
  [4, [["Kara 108RG"], ["Budding Buddy"], ["Artemis 389"], ["Skims"]]],
];

const CELL = 14, FOOT = 10, BED = 3, M = 4, PATH = 9, PB = 5, HMAX = 56;
/** Rest height by year: the newer, the taller. Undated work stands in the middle. */
const AGE = { 2026: 21, 2025: 15, 2024: 10, 2023: 7 };

/**
 * The share of full height at u radii from the pointer: a cosine bell, 1 at the
 * pointer, .5 at half the radius, 0 at the edge and beyond. Blocks sit a whole
 * cell apart, so the bell is broader at the top than Terrain's falloff.
 */
const falloff = (u) => (u >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * Math.max(0, u)));
/** While the pointer is on the field, the rest of the skyline settles to this share of its height. */
const SETTLE = 0.75;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const beds = [], blocks = [];
  // Beds are centred on the widest, so the field steps in from both sides.
  const X1 = Math.max(...SECTIONS.map(([w]) => w)) * CELL + 2 * M;
  let y = 0, k = 0;
  for (const [w, items] of SECTIONS) {
    const rows = Math.ceil(items.length / w), ox = (X1 - w * CELL - 2 * M) / 2;
    beds.push({ x0: ox, y0: y, x1: X1 - ox, y1: y + rows * CELL + 2 * M, items: [] });
    items.forEach(([name, year], n) => {
      const c = n % w, r = Math.floor(n / w);
      const x0 = ox + M + c * CELL + (CELL - FOOT) / 2, y0 = y + M + r * CELL + (CELL - FOOT) / 2;
      const h0 = (AGE[year] ?? 12) + 3 * Math.sin(k++ * 2.1);
      beds.at(-1).items.push({ name, c, r, h0, cx: x0 + FOOT / 2, cy: y0 + FOOT / 2, rg: rings(x0, y0, x0 + FOOT, y0 + FOOT, 2.4, 0.9) });
    });
    y += rows * CELL + 2 * M + PATH;
  }
  const Y1 = y - PATH;

  const C = Cam(45, 0.5, 1.36);
  fit(C, [[-6, -6, -PB], [X1 + 6, Y1 + 6, -PB], [X1 + 6, -6, -PB], [-6, Y1 + 6, -PB], [M + CELL, M + CELL, BED + HMAX]], 200, 166);
  const P = proj(C), front = facing(C);
  let R = value * CELL, over = null;

  // Back to front: the plinth, then each bed and its blocks diagonal by diagonal.
  const g = mk("g", {}, svg);
  const [pr, pi] = rings(-6, -6, X1 + 6, Y1 + 6, 8, 2);
  put(solid(g), prism(P, front, pr, pi, -PB, 0));
  for (const b of beds) {
    const [br, bi] = rings(b.x0, b.y0, b.x1, b.y1, 5, 1.4);
    put(solid(g), prism(P, front, br, bi, 0, BED));
    b.items.sort((p, q) => p.c + p.r - (q.c + q.r));
    for (const it of b.items) {
      blocks.push(Object.assign(it, { sp: spring(it.h0, { eps: 0.04 }), el: solid(g), drawn: NaN }));
    }
  }

  // The mark: a 3 × 3 of dots on the lid of one block, moved in the paint order to just after it.
  const mark = mk("g", {}, g), md = [];
  for (let i = 0; i < 9; i++) md.push(flatDot(mark, C, 0.55, i === 4 ? "dot" : "dot m"));
  const newest = blocks.find((b) => b.name === SECTIONS[0][1][0][0]);
  let mc = null, want = newest;

  function drawMark() {
    if (want !== mc) {
      if (mc) mc.el.sil.classList.remove("hi");
      mc = want;
      mc.el.g.after(mark);
      mc.el.sil.classList.add("hi");
    }
    const h = BED + Math.max(0.6, mc.sp.x);
    md.forEach((el, i) => place(el, P(mc.cx + ((i % 3) - 1) * 2.4, mc.cy + (Math.floor(i / 3) - 1) * 2.4, h)));
  }
  // A block whose spring hasn't moved keeps its paths.
  function drawBlock(b) {
    const h = Math.max(0.6, b.sp.x);
    if (h === b.drawn) return;
    b.drawn = h;
    put(b.el, prism(P, front, b.rg[0], b.rg[1], BED, BED + h));
  }

  const B = register(stage, (dt) => {
    let m = false;
    for (const b of blocks) { if (stepS(b.sp, dt)) m = true; drawBlock(b); }
    drawMark();
    return m;
  });
  bag.add(B.unregister);

  // Rule 01: the block under the pointer is found on the rest pose, each block's own rest lid.
  function pick(p) {
    let best = null, bd = Infinity;
    for (const b of blocks) {
      const [wx, wy] = unproj(C, p[0], p[1], BED + b.h0);
      const d = Math.hypot(wx - b.cx, wy - b.cy);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  // The rise rides over the skyline, which settles a little so the rise stands out.
  function retarget() {
    for (const b of blocks) {
      b.sp.t = over ? Math.max(b.h0 * SETTLE, HMAX * falloff(Math.hypot(b.cx - over.cx, b.cy - over.cy) / R)) : b.h0;
    }
    want = over || newest;
    read.textContent = over ? over.name : "rest";
    B.wake();
  }

  bag.add(pointer(stage, {
    move: (p) => {
      const [gx, gy] = unproj(C, p[0], p[1], BED);
      const on = gx > -6 && gy > -6 && gx < X1 + 6 && gy < Y1 + 6;
      const next = on ? pick(p) : null;
      if (next !== over) { over = next; retarget(); }
    },
    leave: () => { over = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { R = clamp(v, 0.5, 8) * CELL; retarget(); },
    destroy: bag.dispose,
  };
}


hairline({
  name: "portfolio",
  means: "Every project a block on its section's bed, taller the newer it is; the blocks near the pointer rise.",
  rules: [1, 3, 5, 9],
  range: [2, 3.2, 5],
  tour: [[258, 136], [208, 160], [149, 215], null],
  mount,
});

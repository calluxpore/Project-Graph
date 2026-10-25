/* Field page host: receives the figure's hairline({ … }) declaration and mounts it
 * full size, the way the Hairline package mounts its own figures (and the skill's
 * bench does for checking). The kernel maps the pointer by the stage's box onto the
 * 400 × 320 viewBox, so the stage keeps the 5:4 ratio; style.css sizes it. */
(() => {
  const $ = id => document.getElementById(id);
  const root = document.documentElement;

  $('pg-theme-btn').addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next; // the figure's palette follows [data-theme="dark"]
    try { localStorage.setItem('pg-theme', next); } catch (e) { /* storage blocked */ }
  });

  if (matchMedia('(pointer: coarse)').matches) {
    $('pg-help').textContent = 'Touch the field: the projects near your finger rise · Each bed is a section, each block a project';
  }

  window.hairline = figure => {
    const stage = $('pg-figure'), out = $('pg-readout');
    HL.inject(document);
    stage.setAttribute('data-hairline', figure.name);
    stage.setAttribute('role', 'img');
    stage.setAttribute('aria-label', figure.means);
    const svg = HL.mk('svg', { viewBox: '0 0 400 320', 'aria-hidden': 'true' }, stage);

    // The largest 5:4 box that fits the stage, centred, on any screen. Done here rather
    // than only in CSS so it holds even with an older cached stylesheet.
    const area = stage.parentElement;
    Object.assign(stage.style, { position: 'absolute', inset: '0', margin: 'auto', aspectRatio: 'auto' });
    Object.assign(out.style, { left: '0', right: '0', textAlign: 'center' });
    let floor = 320; // the drawing's lowest point in viewBox units: the plinth's front edge
    const fitStage = () => {
      const w = Math.max(0, Math.min(area.clientWidth * 0.98, area.clientHeight * 0.98 * 1.25));
      stage.style.width = `${w}px`;
      stage.style.height = `${w * 0.8}px`;
      // The read-out sits centred just under the field, in the space below the plinth.
      const top = stage.offsetTop + (floor / 320) * stage.offsetHeight + 16;
      out.style.top = `${Math.min(top, area.clientHeight - out.offsetHeight - 8)}px`;
    };

    // The figure writes "rest" when nothing is under the pointer; say what to do instead.
    const read = {
      set textContent(value) {
        const rest = value == null || value === '' || value === 'rest';
        out.textContent = rest ? 'Move over a block' : String(value);
        out.classList.toggle('is-rest', rest);
      }
    };
    read.textContent = 'rest';
    const handle = figure.mount({ stage, svg, read }, figure.range[1]);

    // The plinth is drawn in mount and nothing moves below it, so measure it once.
    try { const b = svg.getBBox(); if (b.height) floor = b.y + b.height; } catch (e) { /* not rendered yet */ }
    fitStage();
    new ResizeObserver(fitStage).observe(area);

    const projects = handle.projects || [];
    $('pg-stats').textContent = `${projects.length} projects · ${new Set(projects.map(p => p.section)).size} sections`;
    search(projects, name => handle.focus(name));
  };

  // Search, as on the graph page: type, pick with the arrows or a click, and the block rises.
  function search(projects, focus) {
    const input = $('pg-search-input'), list = $('pg-suggestions');
    let results = [], active = 0;

    const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); };
    const mark = (text, q) => {
      const f = document.createDocumentFragment(), i = text.toLowerCase().indexOf(q);
      if (i < 0) { f.append(text); return f; }
      const m = document.createElement('mark'); m.textContent = text.slice(i, i + q.length);
      f.append(text.slice(0, i), m, text.slice(i + q.length));
      return f;
    };
    const choose = p => { input.value = ''; close(); input.blur(); focus(p.name); };
    const setActive = i => {
      active = i;
      [...list.children].forEach((li, k) => li.setAttribute('aria-selected', String(k === active)));
      const a = list.children[active];
      if (a && a.id) { a.scrollIntoView({ block: 'nearest' }); input.setAttribute('aria-activedescendant', a.id); }
    };

    function render() {
      const q = input.value.trim().toLowerCase();
      list.innerHTML = '';
      if (!q) { close(); return; }
      results = projects.filter(p => p.name.toLowerCase().includes(q))
        .sort((a, b) => (b.name.toLowerCase().startsWith(q) - a.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name))
        .slice(0, 12);
      if (!results.length) {
        const li = document.createElement('li'); li.className = 'pg-suggestion-empty'; li.textContent = 'No matching project';
        list.append(li);
      }
      results.forEach((p, i) => {
        const li = document.createElement('li');
        li.className = 'pg-suggestion'; li.id = `pg-opt-${i}`; li.setAttribute('role', 'option');
        const label = document.createElement('span'); label.append(mark(p.name, q));
        const kind = document.createElement('span'); kind.className = 'pg-suggestion-kind'; kind.textContent = p.year || '';
        li.append(label, kind);
        li.addEventListener('pointerdown', e => e.preventDefault());
        li.addEventListener('click', () => choose(p));
        list.append(li);
      });
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      setActive(0);
    }

    input.addEventListener('input', render);
    input.addEventListener('focus', () => { if (input.value) render(); });
    input.addEventListener('blur', () => setTimeout(close, 120));
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' && results.length) { e.preventDefault(); setActive((active + 1) % results.length); }
      else if (e.key === 'ArrowUp' && results.length) { e.preventDefault(); setActive((active - 1 + results.length) % results.length); }
      else if (e.key === 'Enter') { e.preventDefault(); if (results[active]) choose(results[active]); }
      else if (e.key === 'Escape') { e.stopPropagation(); input.value = ''; render(); input.blur(); }
    });
    document.addEventListener('keydown', e => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); input.focus(); }
      else if (e.key === 'Escape') focus(null);
    });
  }
})();

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
    $('pg-help').textContent = 'Touch the field: the projects near your finger rise · Tap a block for details · Each bed is a section, each block a project';
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
    const area = stage.parentElement, panel = $('pg-panel');
    const narrow = () => matchMedia('(max-width: 720px)').matches;
    Object.assign(stage.style, { position: 'absolute', inset: '0', margin: 'auto', aspectRatio: 'auto' });
    Object.assign(out.style, { left: '0', right: '0', textAlign: 'center' });
    let floor = 320; // the drawing's lowest point in viewBox units: the plinth's front edge
    const fitStage = () => {
      // With the panel open, the field fits in the space beside it (above it on a phone).
      const side = panel.hidden || narrow() ? 0 : panel.offsetWidth + 14;
      const below = panel.hidden || !narrow() ? 0 : panel.offsetHeight + 8;
      stage.style.right = out.style.right = `${side}px`;
      stage.style.bottom = `${below}px`;
      const w = Math.max(0, Math.min((area.clientWidth - side) * 0.98, (area.clientHeight - below) * 0.98 * 1.25));
      stage.style.width = `${w}px`;
      stage.style.height = `${w * 0.8}px`;
      // The read-out sits centred just under the field, in the space below the plinth.
      const top = stage.offsetTop + (floor / 320) * stage.offsetHeight + 16;
      out.style.top = `${Math.min(top, area.clientHeight - below - out.offsetHeight - 8)}px`;
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
    const select = details(projects, name => { handle.focus(name); fitStage(); });
    search(projects, select);

    // A click (or tap) on a block opens it; a click on the bare field closes the panel.
    stage.addEventListener('click', () => { const name = handle.current(); select(name && projects.find(p => p.name === name)); });
    stage.addEventListener('pointermove', () => { stage.style.cursor = handle.current() ? 'pointer' : ''; });
  };

  /* The panel, as on the graph page. The field's block names are short, so each one is
   * matched to its full record in data/projects.js by section and position: both lists
   * follow the portfolio's order. Returns select(project | null). */
  function details(projects, focus) {
    const data = window.PORTFOLIO_PROJECTS || [];
    const sections = [...new Set(data.map(d => d.section))];
    const palette = ['#c85f42', '#4f81ce', '#2f8579', '#9070c4', '#b8791f', '#c04a74']; // graph.js's section colours
    const seen = new Map();
    projects.forEach(p => {
      const n = seen.get(p.section) || 0; seen.set(p.section, n + 1);
      p.data = data.filter(d => d.section === sections[p.section])[n] || { title: p.name, year: p.year, tagline: '' };
      p.color = palette[p.section % palette.length];
    });

    const panel = $('pg-panel'), input = $('pg-search-input'), page = document.querySelector('.pg');
    const el = {
      cover: $('pg-panel-cover'), title: $('pg-panel-title'), meta: $('pg-panel-meta'), desc: $('pg-panel-desc'),
      open: $('pg-panel-open'), tech: $('pg-panel-tech'), techLabel: $('pg-tech-label'),
      projects: $('pg-panel-projects'), projectsLabel: $('pg-projects-label')
    };
    let selected = null;

    function listItem(p) {
      const li = document.createElement('li');
      const b = document.createElement('button'); b.type = 'button';
      const t = document.createElement('span'); t.className = 'pg-list-title';
      const dot = document.createElement('span'); dot.className = 'pg-chip-dot'; dot.style.setProperty('--node-color', p.color);
      const name = document.createElement('span'); name.textContent = p.data.title;
      t.append(dot, name);
      const sub = document.createElement('span'); sub.className = 'pg-list-sub';
      sub.textContent = [p.data.year, p.data.tagline].filter(Boolean).join(' · ');
      b.append(t, sub);
      b.addEventListener('click', () => select(p));
      li.append(b);
      return li;
    }

    function select(p) {
      selected = p || null;
      // The chosen project's name stays in the search field, as the field's current pick.
      input.value = p ? p.data.title : '';
      if (!p) { panel.hidden = true; page.classList.remove('has-panel'); focus(null); return; }
      const d = p.data;
      panel.style.setProperty('--node-color', p.color);
      el.title.textContent = d.title;
      el.cover.hidden = !d.image;
      if (d.image) el.cover.src = d.image; else el.cover.removeAttribute('src');
      el.meta.textContent = [d.year, d.section].filter(Boolean).join(' · ');
      el.desc.textContent = d.tagline || '';
      el.open.hidden = !d.url; if (d.url) el.open.href = d.url;
      el.tech.textContent = (d.tech || []).join(' · ');
      el.techLabel.hidden = !el.tech.textContent;
      el.projects.innerHTML = '';
      const rest = projects.filter(o => o !== p && o.section === p.section);
      el.projectsLabel.hidden = !rest.length;
      rest.forEach(o => el.projects.append(listItem(o)));
      panel.querySelector('.pg-panel-body').scrollTop = 0;
      panel.hidden = false; page.classList.add('has-panel');
      focus(p.name);
    }

    $('pg-panel-close').addEventListener('click', () => select(null));
    // Leaving the search field without choosing puts the pick's name back.
    input.addEventListener('blur', () => { if (selected) input.value = selected.data.title; });
    // Clearing the search field (its × or by deleting the name) lets go of the pick.
    input.addEventListener('input', () => { if (!input.value && selected) select(null); });
    return select;
  }

  // Search, as on the graph page: type, pick with the arrows or a click, and the block rises.
  function search(projects, select) {
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
    const choose = p => { close(); input.blur(); select(p); };
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
      const title = p => p.data.title, hit = p => title(p).toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
      results = projects.filter(hit)
        .sort((a, b) => (title(b).toLowerCase().startsWith(q) - title(a).toLowerCase().startsWith(q)) || title(a).localeCompare(title(b)))
        .slice(0, 12);
      if (!results.length) {
        const li = document.createElement('li'); li.className = 'pg-suggestion-empty'; li.textContent = 'No matching project';
        list.append(li);
      }
      results.forEach((p, i) => {
        const li = document.createElement('li');
        li.className = 'pg-suggestion'; li.id = `pg-opt-${i}`; li.setAttribute('role', 'option');
        const label = document.createElement('span'); label.append(mark(p.data.title, q));
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
    // Focusing the field with a pick's name in it selects the name, so typing replaces it.
    input.addEventListener('focus', () => { input.select(); });
    input.addEventListener('blur', () => setTimeout(close, 120));
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' && results.length) { e.preventDefault(); setActive((active + 1) % results.length); }
      else if (e.key === 'ArrowUp' && results.length) { e.preventDefault(); setActive((active - 1 + results.length) % results.length); }
      else if (e.key === 'Enter') { e.preventDefault(); if (results[active]) choose(results[active]); }
      else if (e.key === 'Escape') { e.stopPropagation(); close(); input.blur(); }
    });
    document.addEventListener('keydown', e => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); input.focus(); }
      else if (e.key === 'Escape') select(null);
    });
  }
})();

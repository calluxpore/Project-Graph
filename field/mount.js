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
    const fitStage = () => {
      const w = Math.max(0, Math.min(area.clientWidth * 0.98, area.clientHeight * 0.98 * 1.25));
      stage.style.width = `${w}px`;
      stage.style.height = `${w * 0.8}px`;
    };
    fitStage();
    new ResizeObserver(fitStage).observe(area);

    // The figure writes "rest" when nothing is under the pointer; say what to do instead.
    const read = {
      set textContent(value) {
        const rest = value == null || value === '' || value === 'rest';
        out.textContent = rest ? 'Move over a block' : String(value);
        out.classList.toggle('is-rest', rest);
      }
    };
    read.textContent = 'rest';
    figure.mount({ stage, svg, read }, figure.range[1]);
  };
})();

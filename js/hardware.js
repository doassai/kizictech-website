/* Hardware section: draws the tower, swaps the captions and lights the machine,
   all as a function of scroll position (so it runs backwards when scrolling up).
   Nothing here blocks or alters scrolling. */
(function () {
  'use strict';

  var root = document.querySelector('.s-hardware');
  if (!root) return;
  var track = root.querySelector('.s-hardware__track');
  var stage = root.querySelector('.s-hardware__stage');
  var svg = root.querySelector('.s-hardware__svg');
  if (!track || !stage || !svg) return;
  if (!(window.CSS && CSS.supports && CSS.supports('position', 'sticky'))) return;
  if (!window.requestAnimationFrame || !window.matchMedia) return;

  var LEAD = 0.5;        // the build starts this many viewport heights before the stage pins
  var POWER_AT = 0.85;   // progress at which the machine switches on
  var CAPTION_RAMP = 0.03;
  var CAPTION_SHIFT = 22; // px

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var rail = root.querySelector('.s-hardware__rail span');
  var strokes = [];  // {el, a, b, v}
  var fades = [];    // {el, a, b, v}
  var groups = [];   // {el, a, v}  fade groups, hidden outright until they start
  var spins = [];    // {el, cx, cy, dir, v}
  var beats = [];    // {el, a, b, v}
  var live = false;
  var queued = false;
  var stickyTop = 0;

  function clamp01(n) { return n < 0 ? 0 : n > 1 ? 1 : n; }
  function ease(t) { return t * t * (3 - 2 * t); }
  function range(el, name) {
    var parts = (el.getAttribute(name) || '').split(/\s+/);
    return [parseFloat(parts[0]) || 0, parseFloat(parts[1]) || 1];
  }

  // Each group owns a slice of the scroll; its shapes take turns inside that slice.
  function spread(list, a, b, share) {
    var n = list.length;
    var dur = (b - a) * (n > 1 ? share : 1);
    var step = n > 1 ? (b - a - dur) / (n - 1) : 0;
    return list.map(function (el, i) {
      return { el: el, a: a + step * i, b: a + step * i + dur, v: -1 };
    });
  }

  function collect() {
    var i, r, list, parts;
    var draw = svg.querySelectorAll('[data-draw]');
    for (i = 0; i < draw.length; i++) {
      r = range(draw[i], 'data-draw');
      list = Array.prototype.slice.call(draw[i].querySelectorAll('path'));
      strokes = strokes.concat(spread(list, r[0], r[1], Math.max(0.3, Math.min(1, 3.5 / list.length))));
    }
    var fade = svg.querySelectorAll('[data-fade]');
    for (i = 0; i < fade.length; i++) {
      r = range(fade[i], 'data-fade');
      list = Array.prototype.slice.call(fade[i].children);
      fades = fades.concat(spread(list, r[0], r[1], 0.45));
      groups.push({ el: fade[i], a: r[0], v: -1 });
    }
    var spin = svg.querySelectorAll('[data-spin]');
    for (i = 0; i < spin.length; i++) {
      parts = spin[i].getAttribute('data-spin').split(/\s+/);
      spins.push({ el: spin[i], cx: parts[0], cy: parts[1], dir: parseFloat(parts[2]) || 1, v: -1 });
    }
    var beat = root.querySelectorAll('.s-hardware__beat');
    for (i = 0; i < beat.length; i++) {
      beats.push({
        el: beat[i],
        a: beat[i].hasAttribute('data-in') ? parseFloat(beat[i].getAttribute('data-in')) : null,
        b: beat[i].hasAttribute('data-out') ? parseFloat(beat[i].getAttribute('data-out')) : null,
        v: ''
      });
    }
  }

  function progress() {
    var rect = track.getBoundingClientRect();
    var lead = window.innerHeight * LEAD;
    var travel = rect.height - stage.offsetHeight;
    if (travel <= 0) return 1;
    return clamp01((stickyTop + lead - rect.top) / (travel + lead));
  }

  function render() {
    queued = false;
    if (!live) return;
    var s = progress();
    var i, o, t, k;

    for (i = 0; i < strokes.length; i++) {
      o = strokes[i];
      t = Math.round(ease(clamp01((s - o.a) / (o.b - o.a))) * 1000) / 1000;
      if (t === o.v) continue;
      o.v = t;
      if (t <= 0) {
        o.el.style.visibility = 'hidden';
      } else {
        o.el.style.visibility = 'visible';
        o.el.style.strokeDasharray = t >= 1 ? 'none' : '1 1';
        o.el.style.strokeDashoffset = t >= 1 ? '0' : String(1 - t);
      }
    }

    for (i = 0; i < groups.length; i++) {
      o = groups[i];
      k = s > o.a ? 1 : 0;
      if (k !== o.v) {
        o.v = k;
        o.el.style.visibility = k ? 'visible' : 'hidden';
      }
    }
    for (i = 0; i < fades.length; i++) {
      o = fades[i];
      t = Math.round(ease(clamp01((s - o.a) / (o.b - o.a))) * 100) / 100;
      if (t === o.v) continue;
      o.v = t;
      o.el.style.opacity = String(t);
    }

    // Fans turn as the power comes up.
    t = clamp01((s - POWER_AT) / (1 - POWER_AT));
    k = Math.round(t * t * 4000) / 10;
    for (i = 0; i < spins.length; i++) {
      o = spins[i];
      if (k === o.v) continue;
      o.v = k;
      o.el.setAttribute('transform', 'rotate(' + (k * o.dir) + ' ' + o.cx + ' ' + o.cy + ')');
    }

    for (i = 0; i < beats.length; i++) {
      o = beats[i];
      var fin = o.a === null ? 1 : clamp01((s - o.a) / CAPTION_RAMP);
      var fout = o.b === null ? 1 : clamp01((o.b - s) / CAPTION_RAMP);
      var op = Math.round(ease(fin) * ease(fout) * 100) / 100;
      var y = Math.round(((1 - ease(fin)) - (1 - ease(fout))) * CAPTION_SHIFT * 10) / 10;
      var key = op + '|' + y;
      if (key === o.v) continue;
      o.v = key;
      o.el.style.opacity = String(op);
      o.el.style.transform = 'translate3d(0,' + y + 'px,0)';
    }

    if (rail) rail.style.setProperty('--s-hardware-p', (Math.round(s * 1000) / 1000).toString());
  }

  function request() {
    if (queued || !live) return;
    queued = true;
    window.requestAnimationFrame(render);
  }

  function measure() {
    stickyTop = parseFloat(window.getComputedStyle(stage).top) || 0;
    request();
  }

  function start() {
    if (live) return;
    live = true;
    root.classList.add('is-live');
    stickyTop = parseFloat(window.getComputedStyle(stage).top) || 0;
    render(); // set the first frame before the browser paints it
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', measure, { passive: true });
    window.addEventListener('load', measure); // layout above may settle once fonts and images arrive
  }

  // Back to the plain static section (used if reduced motion is switched on mid-visit).
  function stop() {
    if (!live) return;
    live = false;
    window.removeEventListener('scroll', request);
    window.removeEventListener('resize', measure);
    window.removeEventListener('load', measure);
    root.classList.remove('is-live');
    var i;
    for (i = 0; i < strokes.length; i++) { strokes[i].el.removeAttribute('style'); strokes[i].v = -1; }
    for (i = 0; i < fades.length; i++) { fades[i].el.removeAttribute('style'); fades[i].v = -1; }
    for (i = 0; i < groups.length; i++) { groups[i].el.removeAttribute('style'); groups[i].v = -1; }
    for (i = 0; i < spins.length; i++) { spins[i].el.removeAttribute('transform'); spins[i].v = -1; }
    for (i = 0; i < beats.length; i++) { beats[i].el.removeAttribute('style'); beats[i].v = ''; }
    if (rail) rail.removeAttribute('style');
  }

  collect();
  if (!reduce.matches) start();

  var onPreference = function () { if (reduce.matches) stop(); else start(); };
  if (reduce.addEventListener) reduce.addEventListener('change', onPreference);
  else if (reduce.addListener) reduce.addListener(onPreference);
})();

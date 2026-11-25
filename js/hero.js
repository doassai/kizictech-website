/* KizicTech — hero.
   1. Power-up on load: the sign starts unlit, flickers on, then the type arrives (CSS
      animations; this script only sets the classes at the right moments).
   2. Power-down on scroll: writes scroll progress (0 to 1) to --s-hero-p on the sign
      and on each light element;
      CSS turns that into the sign receding and its light fading.
   Does nothing under prefers-reduced-motion, so the static lit hero stays as authored. */
(function () {
  'use strict';

  var root = document.querySelector('.s-hero');
  if (!root || !window.matchMedia || !window.requestAnimationFrame) return;

  var track = root.querySelector('.s-hero__track');
  var stage = root.querySelector('.s-hero__stage');
  var inner = root.querySelector('.s-hero__inner');
  var sign = root.querySelector('.s-hero__sign');
  if (!track || !stage || !inner || !sign) return;

  /* ---------- 0. The knobs switch the sign off and on ---------- */

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var knobs = root.querySelectorAll('.s-hero__knob');
  // the elements whose brightness follows the scroll; each gets --s-hero-p directly
  var lights = root.querySelectorAll('.s-hero__wall, .s-hero__layer--spill, .s-hero__layer--light, .s-hero__bloom');
  var startY = 0;      // where the scroll fade begins (set by measure)
  var current = -1;    // scroll progress, 0 to 1 (set by update)
  var powerTimer;

  function setPower(on) {
    clearTimeout(powerTimer);
    clearTimeout(root._introGuard);
    // a press during the load sequence ends it: the type shows at once
    root.classList.remove('is-intro', 'is-on', 'is-powering');
    root.classList.toggle('is-off', !on);
    if (on && !reduced.matches) {
      // replay the power-up: every LED in turn, then the edge light and the wall
      var count = parseFloat(getComputedStyle(sign).getPropertyValue('--s-hero-n')) || 30;
      void root.offsetWidth;
      root.classList.add('is-powering');
      powerTimer = setTimeout(function () {
        root.classList.remove('is-powering');
      }, (0.12 + count * 0.055 + 0.42 + 0.15 + 1.9) * 1000 + 200);
    }
    for (var i = 0; i < knobs.length; i++) knobs[i].setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  for (var k = 0; k < knobs.length; k++) {
    knobs[k].hidden = false;   // hidden in the markup: without this script they would do nothing
    knobs[k].addEventListener('click', function () {
      // once scrolling has dimmed the sign a toggle would be invisible: a press brings
      // the visitor back to the lit sign instead
      if (current > 0.5) {
        window.scrollTo({ top: startY, behavior: reduced.matches ? 'auto' : 'smooth' });
        if (root.classList.contains('is-off')) setPower(true);
        return;
      }
      setPower(root.classList.contains('is-off'));
    });
  }

  if (reduced.matches) return;

  root.classList.add('is-live');

  /* ---------- 1. Power-up ---------- */

  function alreadyPainted() {
    // If the page was on screen for a while before this script ran, hiding the type
    // again would read as a glitch: skip the intro and keep the lit state.
    try {
      var fcp = performance.getEntriesByName('first-contentful-paint')[0];
      return !!fcp && performance.now() - fcp.startTime > 400;
    } catch (e) {
      return false;
    }
  }

  function intro() {
    var done = false;
    var started = false;
    var last = root.querySelector('.s-hero__actions');

    function finish() {
      if (done) return;
      done = true;
      root.classList.remove('is-intro', 'is-on');
    }

    function start() {
      if (started) return;
      started = true;
      // two frames, so the unlit state is painted before the power comes on
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (!done) root.classList.add('is-on');
        });
      });
      // the last thing to arrive ends the intro; the timer covers a tab whose
      // animations are frozen, so the type can never stay hidden
      if (last) {
        last.addEventListener('animationend', function (e) {
          if (e.target === last) finish();
        });
      }
      setTimeout(finish, 5600);
    }

    clearTimeout(root._introGuard);
    root.classList.add('is-intro');

    // opened in a background tab: hold the power-up until someone is looking
    if (document.hidden) {
      document.addEventListener('visibilitychange', function onShow() {
        if (document.hidden) return;
        document.removeEventListener('visibilitychange', onShow);
        start();
      });
    } else {
      start();
    }
  }

  // An inline script in the page hides the hero before first paint (pre), so there is
  // nothing to flash; without it, skip the intro if the lit hero was already on screen.
  var pre = root.classList.contains('is-intro');
  if (window.pageYOffset < 40 && (pre || !alreadyPainted())) {
    intro();
  } else {
    clearTimeout(root._introGuard);
    root.classList.remove('is-intro');
  }

  /* ---------- 2. Power-down on scroll ---------- */

  var wide = window.matchMedia('(min-width: 56.0625rem)');
  var range = 1;
  var queued = false;

  function measure() {
    var pinned = wide.matches;
    root.classList.toggle('is-pinned', pinned);
    if (pinned) {
      // pin only if the sign and the type fit the stage; otherwise let it flow
      var cs = getComputedStyle(stage);
      var room = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      if (inner.offsetHeight > room + 1) {
        pinned = false;
        root.classList.remove('is-pinned');
      }
    }
    var y = window.pageYOffset;
    if (pinned) {
      var stickyTop = parseFloat(getComputedStyle(stage).top) || 0;
      startY = Math.max(0, track.getBoundingClientRect().top + y - stickyTop);
      range = Math.max(1, track.offsetHeight - stage.offsetHeight);
    } else {
      // not pinned: the sign powers down as it scrolls out from under the visitor
      var signBottom = sign.getBoundingClientRect().bottom + y;
      startY = 0;
      range = Math.max(1, signBottom * 0.8);
    }
    current = -1;
    update();
  }

  function update() {
    queued = false;
    var p = (window.pageYOffset - startY) / range;
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    p = Math.round(p * 1000) / 1000;
    if (p === current) return;
    current = p;
    sign.style.setProperty('--s-hero-p', p);
    for (var i = 0; i < lights.length; i++) lights[i].style.setProperty('--s-hero-p', p);
  }

  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }

  var resizeQueued = false;
  function onResize() {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(function () {
      resizeQueued = false;
      measure();
    });
  }

  measure();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
})();

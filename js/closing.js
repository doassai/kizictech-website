/* KizicTech — closing bundle: approach, in development (lab), contact.
   Enhancement only. Without this file, or with reduced motion, every section
   is fully visible and static. */
(function () {
  'use strict';

  var approach = document.querySelector('.s-approach');
  var lab = document.querySelector('.s-lab');
  var contact = document.querySelector('.s-contact');

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window) || !window.requestAnimationFrame) return;

  function clamp(n) {
    return n < 0 ? 0 : n > 1 ? 1 : n;
  }

  /* ---------- Approach: each principle lights as it comes into view ---------- */

  if (approach) {
    var items = approach.querySelectorAll('.s-approach__item');
    var itemObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        // Light it when it arrives, or straight away if it is already above the fold.
        if (entry.isIntersecting || entry.boundingClientRect.bottom < 0) {
          entry.target.classList.add('is-on');
          itemObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -14% 0px', threshold: 0.3 });

    approach.classList.add('is-live');
    Array.prototype.forEach.call(items, function (item) {
      itemObserver.observe(item);
    });
  }

  /* ---------- Lab and contact: tied to scroll position ---------- */

  var figure = lab && lab.querySelector('.s-lab__figure');
  var cable = contact && contact.querySelector('.s-contact__cable');
  var bend = cable && cable.querySelector('.s-contact__bend');
  var plug = cable && cable.querySelector('.s-contact__plug');

  var hasLab = !!figure;
  var hasContact = !!(cable && bend && plug);
  if (!hasLab && !hasContact) return;

  var labVisible = hasLab;
  var contactVisible = hasContact;
  var lastGlow = -1;
  var lastDrawn = -1;
  var ticking = false;

  // The closer the unit is to the middle of the screen, the more light gets out.
  function readLab(vh) {
    var r = figure.getBoundingClientRect();
    var g = 1 - clamp(Math.abs(r.top + r.height / 2 - vh / 2) / (vh * 0.72));
    g = g * g * (3 - 2 * g);
    return Math.round(g * 200) / 200;
  }

  // The cable draws in step with the scroll. The run down the edge keeps its
  // tip just above the bottom of the screen; the bend and the run back under
  // the address follow, and always finish before the page ends.
  function readContact(vh) {
    var r = cable.getBoundingClientRect();
    if (!r.height || !r.width) return null;

    var doc = document.documentElement;
    var scrollTop = window.pageYOffset;
    var radius = bend.offsetWidth;
    var down = Math.max(1, r.height - radius);
    var along = Math.max(1, r.width - radius - plug.offsetWidth);
    var corner = radius * 1.57;
    var line = vh * 0.9;

    var v = clamp((line - r.top) / down);

    var below = doc.scrollHeight - (r.bottom + scrollTop);
    var endY = vh - Math.min(vh * 0.42, below - 12);
    var span = Math.max(60, line + radius - endY);
    var q = clamp((line + radius - r.bottom) / span);
    if (scrollTop + vh >= doc.scrollHeight - 2) {
      v = 1;
      q = 1;
    }
    var drawn = q * (corner + along);

    return {
      key: Math.round(v * down + drawn),
      v: v,
      c: clamp(drawn / corner),
      h: clamp((drawn - corner) / along),
      done: q >= 0.995
    };
  }

  function update() {
    ticking = false;
    var vh = window.innerHeight;

    // Read everything first, then write.
    var g = labVisible ? readLab(vh) : null;
    var d = contactVisible ? readContact(vh) : null;

    if (g !== null && g !== lastGlow) {
      lastGlow = g;
      figure.style.setProperty('--s-lab-g', String(g));
    }

    if (d && d.key !== lastDrawn) {
      lastDrawn = d.key;
      cable.style.setProperty('--s-contact-v', d.v.toFixed(4));
      cable.style.setProperty('--s-contact-c', d.c.toFixed(3));
      cable.style.setProperty('--s-contact-h', d.h.toFixed(4));
      contact.classList.toggle('is-connected', d.done);
    }
  }

  function request() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(update);
    }
  }

  function remeasure() {
    lastDrawn = -1;
    request();
  }

  if (hasLab) {
    lab.classList.add('is-live');
    new IntersectionObserver(function (entries) {
      labVisible = entries[entries.length - 1].isIntersecting;
      lab.classList.toggle('is-awake', labVisible);
      if (labVisible) request();
    }, { rootMargin: '10% 0px 10% 0px' }).observe(lab);
  }

  if (hasContact) {
    // Start from nothing drawn, so the finished cable never flashes first.
    cable.style.setProperty('--s-contact-v', '0');
    cable.style.setProperty('--s-contact-c', '0');
    cable.style.setProperty('--s-contact-h', '0');
    contact.classList.add('is-live');
    new IntersectionObserver(function (entries) {
      contactVisible = entries[entries.length - 1].isIntersecting;
      if (contactVisible) request();
    }, { rootMargin: '10% 0px 10% 0px' }).observe(contact);
  }

  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', remeasure, { passive: true });
  window.addEventListener('load', remeasure);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(remeasure);
  }
  request();
})();

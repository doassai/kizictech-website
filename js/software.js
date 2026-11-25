/* KizicTech — AI / software section.
   Lights the opening statement and the board traces as the section scrolls past
   a "front" line in the viewport, as if current were flowing down the board.
   Stateless: everything is derived from scroll position on each frame.
   With reduced motion this does nothing and the CSS default (fully lit) stands. */
(function () {
  "use strict";

  var root = document.querySelector(".s-software");
  if (!root || !window.requestAnimationFrame || !root.getBoundingClientRect) return;

  var FRONT = 0.8;        // the current front sits this far down the viewport
  var BRANCH_SPAN = 0.16; // a branch finishes within this much of a viewport of scrolling

  var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var title = root.querySelector(".s-software__title");
  var lede = root.querySelector(".s-software__lede");
  var titleText = title ? title.textContent : "";

  var live = false;
  var ticking = false;
  var words = [];
  var traces = [];
  var k = 1;
  var observer = null;

  function clamp01(n) {
    return n < 0 ? 0 : n > 1 ? 1 : n;
  }

  function toggle(el, on) {
    if (!el) return;
    if (el.classList.contains("is-on") !== on) el.classList.toggle("is-on", on);
  }

  function light(seg, p) {
    // unlit sits a little past 1 so a round end cannot show as a dot at the start
    var v = p > 0 ? (1 - clamp01(p)).toFixed(4) : "1.5";
    if (seg.last === v) return;
    seg.last = v;
    seg.el.style.strokeDashoffset = v;
  }

  function splitTitle() {
    if (!title) return;
    var parts = titleText.trim().split(/\s+/);
    title.setAttribute("aria-label", parts.join(" "));
    title.textContent = "";
    words = parts.map(function (word, i) {
      var span = document.createElement("span");
      span.className = "s-software__word";
      span.setAttribute("aria-hidden", "true");
      span.textContent = word;
      if (i) title.appendChild(document.createTextNode(" "));
      title.appendChild(span);
      return span;
    });
  }

  function restoreTitle() {
    if (!title) return;
    title.removeAttribute("aria-label");
    title.textContent = titleText;
    words = [];
  }

  function collect() {
    traces = Array.prototype.map.call(root.querySelectorAll(".s-software__trace"), function (svg) {
      var t = {
        svg: svg,
        host: svg.closest(".s-software__area"),
        lines: [],
        turn: null,
        run: null
      };
      Array.prototype.forEach.call(svg.querySelectorAll("[data-seg]"), function (el) {
        var kind = el.getAttribute("data-seg");
        var seg = { el: el, last: null };
        // one dash as long as the shape (pathLength="1"), slid in by light(); set inline
        // so the copies drawn by <use> pick it up in every browser
        el.style.strokeDasharray = "1 2";
        el.style.strokeDashoffset = "1.5";
        if (kind === "v") {
          seg.y1 = parseFloat(el.getAttribute("y1")) || 0;
          t.lines.push(seg);
        } else if (kind === "turn") {
          seg.straight = parseFloat(el.getAttribute("data-v")) || 0;
          seg.len = el.getTotalLength ? el.getTotalLength() : seg.straight + 17;
          t.turn = seg;
        } else if (kind === "run") {
          seg.x1 = parseFloat(el.getAttribute("x1")) || 0;
          t.run = seg;
        }
      });
      return t;
    });
  }

  function measure() {
    k = parseFloat(getComputedStyle(root).getPropertyValue("--sw-k")) || 1;
  }

  function frame() {
    ticking = false;
    if (!live) return;

    var vh = window.innerHeight || document.documentElement.clientHeight;
    var front = vh * FRONT;
    var cap = (vh * BRANCH_SPAN) / k;
    var i;
    var j;

    // read every position first, then write, so the browser lays out once per frame
    var titleTop = title && words.length ? title.getBoundingClientRect().top : 0;
    var ledeTop = lede ? lede.getBoundingClientRect().top : 0;
    var rects = traces.map(function (t) {
      return t.svg.getBoundingClientRect();
    });

    for (i = 0; i < words.length; i++) {
      toggle(words[i], titleTop < vh * (0.9 - i * 0.07));
    }
    if (lede) toggle(lede, ledeTop < front);

    for (i = 0; i < traces.length; i++) {
      var t = traces[i];
      var r = rects[i];
      var w = r.width / k;
      var h = r.height / k;
      var s = (front - r.top) / k; // how far the front has travelled down this drawing, in its own units

      for (j = 0; j < t.lines.length; j++) {
        var line = t.lines[j];
        light(line, (s - line.y1) / Math.max(1, h - line.y1));
      }

      if (t.turn && t.run) {
        var runLen = Math.max(0.5, w - t.run.x1);
        var total = t.turn.len + runLen;
        var rest = total - t.turn.straight;
        // straight down at scroll speed, alongside its neighbours; then the turn and
        // the run across finish within a fixed stretch of scroll however long they are
        var rate = Math.max(1, rest / Math.max(1, cap));
        var d = s <= t.turn.straight ? s : t.turn.straight + (s - t.turn.straight) * rate;
        light(t.turn, d / t.turn.len);
        light(t.run, (d - t.turn.len) / runLen);
        toggle(t.host, d >= total);
      } else {
        toggle(t.svg, s >= 13); // the pin header at the top of the feed
      }
    }
  }

  function request() {
    if (ticking || !live) return;
    ticking = true;
    window.requestAnimationFrame(frame);
  }

  function onResize() {
    measure();
    request();
  }

  function start() {
    if (live) return;
    live = true;
    splitTitle();
    collect();
    measure();
    root.classList.add("is-live");
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("load", onResize);
    if (window.ResizeObserver) {
      observer = new ResizeObserver(onResize);
      observer.observe(root);
    }
    frame(); // settle the first paint before anything is shown unlit by mistake
  }

  function stop() {
    if (!live) return;
    live = false;
    window.removeEventListener("scroll", request);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("load", onResize);
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    root.classList.remove("is-live");
    traces.forEach(function (t) {
      t.lines.concat(t.turn || [], t.run || []).forEach(function (seg) {
        seg.el.style.strokeDasharray = "";
        seg.el.style.strokeDashoffset = "";
      });
      if (t.host) t.host.classList.remove("is-on");
      t.svg.classList.remove("is-on");
    });
    if (lede) lede.classList.remove("is-on");
    restoreTitle();
    traces = [];
  }

  function sync() {
    if (reduce && reduce.matches) stop();
    else start();
  }

  if (reduce) {
    if (reduce.addEventListener) reduce.addEventListener("change", sync);
    else if (reduce.addListener) reduce.addListener(sync);
  }
  sync();
})();

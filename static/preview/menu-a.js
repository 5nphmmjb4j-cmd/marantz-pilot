/* Menu A: "Notch Glow" (wg zaktualizowanego skilla animowane-menu-glass)
   ciemne szkło, garb jako raised cosine, neonowa kreska (gradient + błysk), poświata jako druga ścieżka, sprężyna zależna od czasu */
(function () {
  var CSS = ".gm{position:relative;height:68px;border-radius:34px;background:linear-gradient(180deg,rgba(32,42,52,.80),rgba(14,20,27,.86));-webkit-backdrop-filter:blur(18px) saturate(1.4);backdrop-filter:blur(18px) saturate(1.4);border:1px solid rgba(255,255,255,.2);box-shadow:0 14px 34px rgba(8,14,20,.38),inset 0 1px 0 rgba(255,255,255,.14);padding:0 24px}" +
    ".gm-svg{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none}" +
    ".gm-g{fill:none;stroke:#3fe0c5;stroke-width:9;stroke-opacity:.2;stroke-linecap:round;stroke-linejoin:round}" +
    ".gm-p{fill:none;stroke:url(#gmsh);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;animation:gmflick 3.1s infinite}" +
    "@keyframes gmflick{0%,100%{opacity:1}7%{opacity:.82}9%{opacity:1}41%{opacity:.9}43%{opacity:1}73%{opacity:.8}75%{opacity:1}}" +
    ".gm-b{position:relative;display:flex;height:100%}" +
    ".gm-b button{flex:1;border:0;background:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:#AEB9C1;font:inherit;transition:color .35s;touch-action:manipulation;-webkit-tap-highlight-color:transparent;min-height:44px;padding-top:3px}" +
    ".gm-b button.on{color:#fff}" +
    ".gm-ic{display:flex;transition:transform .2s}.gm-b button:active .gm-ic{transform:scale(.92)}" +
    ".gm-ic svg{width:26px;height:26px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}" +
    ".gm-l{font-size:11px;font-weight:600;line-height:1}" +
    ".gm-b button::after{content:'';width:4px;height:4px;border-radius:50%;background:#3fe0c5;opacity:0;transition:opacity .3s;margin-top:-1px}" +
    ".gm-b button.on::after{opacity:1}" +
    "@media(prefers-reduced-motion:reduce){.gm-p{animation:none}.gm-b button{transition:color .2s}}";
  window.PilotMenu = {
    name: "A: Notch Glow",
    mount: function (nav, tabs, active, onSelect) {
      var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
      var n = tabs.length;
      nav.innerHTML = '<div class="gm"><svg class="gm-svg" aria-hidden="true"><defs>' +
        '<linearGradient id="gmsh" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="170" y2="0" spreadMethod="repeat">' +
        '<stop offset="0" stop-color="#17a894"/><stop offset=".25" stop-color="#3fe0c5"/><stop offset=".5" stop-color="#e2fff9"/><stop offset=".75" stop-color="#3fe0c5"/><stop offset="1" stop-color="#17a894"/>' +
        '<animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="170 0" dur="2.6s" repeatCount="indefinite"/></linearGradient></defs>' +
        '<path class="gm-g"/><path class="gm-p"/></svg><div class="gm-b" role="tablist">' +
        tabs.map(function (t, i) { return '<button type="button" role="tab" data-i="' + i + '" aria-label="' + t.label + '"><span class="gm-ic">' + t.icon + '</span><span class="gm-l">' + t.label + '</span></button>'; }).join("") +
        '</div></div>';
      var bar = nav.querySelector(".gm"), glow = nav.querySelector(".gm-g"), line = nav.querySelector(".gm-p"), btns = nav.querySelectorAll("button");
      var H = 68, PAD = 24, W = bar.clientWidth, x = 0, v = 0, target = 0, raf = 0, last = 0, cur = 0;
      var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      function cx(i) { return PAD + (i + .5) * (W - 2 * PAD) / n; }
      function draw(c) {
        var r = H / 2, R = r - 2, top = 9, slot = (W - 2 * PAD) / n, hw = slot * .66, pl = slot * .04, fl = hw - pl, pts = [];
        for (var px = 2; px <= W - 2; px += 2) {
          var xx = px < r ? px : (px > W - r ? W - px : r), dx = r - xx;
          var yb = r + Math.sqrt(Math.max(0, R * R - dx * dx));
          var d = Math.abs(px - c);
          var f = d <= pl ? 1 : (d >= hw ? 0 : .5 + .5 * Math.cos(Math.PI * (d - pl) / fl));
          pts.push(px + "," + (yb - (yb - top) * f).toFixed(1));
        }
        var dd = "M" + pts.join(" L"); line.setAttribute("d", dd); glow.setAttribute("d", dd);
      }
      var K = 330, C = 2 * Math.sqrt(K) * .82;
      function tick(ts) {
        var dt = Math.min(.05, (ts - last) / 1000 || .016); last = ts;
        var steps = Math.max(1, Math.round(dt / .008)), h = dt / steps;
        for (var s = 0; s < steps; s++) { v += (K * (target - x) - C * v) * h; x += v * h; }
        draw(x);
        if (Math.abs(v) < .4 && Math.abs(target - x) < .08) { x = target; v = 0; draw(x); raf = 0; } else raf = requestAnimationFrame(tick);
      }
      function set(i, instant) {
        cur = i; target = cx(i);
        btns.forEach(function (b, k) {
          b.classList.toggle("on", k === i); b.setAttribute("aria-selected", k === i ? "true" : "false");
          if (k === i) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
        });
        if (instant || reduce) { x = target; v = 0; draw(x); } else if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
      }
      btns.forEach(function (b) { b.addEventListener("click", function () { var i = +b.dataset.i; set(i); onSelect(tabs[i].id); }); });
      if (window.ResizeObserver) new ResizeObserver(function () { W = bar.clientWidth; set(cur, true); }).observe(bar);
      set(Math.max(0, tabs.findIndex(function (t) { return t.id === active; })), true);
      return { select: function (id) { set(Math.max(0, tabs.findIndex(function (t) { return t.id === id; })), false); } };
    }
  };
})();

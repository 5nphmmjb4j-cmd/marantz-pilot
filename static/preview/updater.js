/* Pilot Marantz: ekran aktualizacji (premium Hi-Fi).
   Warstwa wizualna prawdziwego procesu: pobiera pliki aplikacji ze świeżym odświeżeniem pamięci podręcznej,
   liczy postęp z bajtów, weryfikuje rozmiary i składnię, a sukces pokazuje dopiero po potwierdzeniu wszystkiego.
   Nie dotyka wzmacniacza ani protokołu komunikacji z nim. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg", CX = 160, R = 112, CIRC = 2 * Math.PI * R;
  var ASSETS = ["./", "menu-a.js", "updater.js", "version.json", "manifest.webmanifest", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/favicon-32.png", "fonts/ibm-plex-sans-latin-wght-normal.woff2", "fonts/ibm-plex-sans-latin-ext-wght-normal.woff2"];
  var STATUS = { init: "Przygotowywanie aktualizacji", connect: "Łączenie z pilotem", download: "Pobieranie oprogramowania", transfer: "Przesyłanie danych", verify: "Weryfikacja oprogramowania", install: "Instalowanie aktualizacji", done: "Aktualizacja zakończona", offline: "Brak połączenia z pilotem", error: "Aktualizacja nie powiodła się", current: "Pilot jest aktualny" };

  var CSS = [
    "#pud{border:0;padding:0;margin:0;width:100vw;height:100dvh;max-width:none;max-height:none;border-radius:0;background:#020509;color:#E8F4FF;overflow:hidden;--d:min(86vw,56dvh,440px);--c1:#0C9CFF;--c2:#44E4FF;--c3:#E6FDFF;--gi:.5;font-family:var(--font,'IBM Plex Sans',system-ui,sans-serif)}",
    "#pud::backdrop{background:#020509}",
    "#pud.err{--c1:#E2563F;--c2:#FF9A66;--c3:#FFE6D8}",
    "#pud .bg{position:absolute;inset:0;background:radial-gradient(52% 38% at 50% 40%,rgba(18,104,170,.30),rgba(6,24,44,.12) 55%,transparent 75%),radial-gradient(120% 80% at 50% 110%,rgba(8,20,34,.9),transparent 60%),#020509}",
    "#pud.err .bg{background:radial-gradient(52% 38% at 50% 40%,rgba(170,70,40,.22),rgba(40,14,10,.10) 55%,transparent 75%),#020509}",
    "#pud .col{position:relative;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;padding:max(20px,env(safe-area-inset-top)) 20px max(18px,env(safe-area-inset-bottom))}",
    "#pud .dial{position:relative;width:var(--d);height:var(--d);flex:none}",
    "#pud .dial svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}",
    "#pud .pct{position:absolute;left:0;right:0;top:47%;display:flex;justify-content:center;align-items:baseline;gap:.08em;font-weight:300;font-size:calc(var(--d)*.2);line-height:1;letter-spacing:-.02em;color:#EAF6FF;font-variant-numeric:tabular-nums;text-shadow:0 0 18px rgba(76,199,255,.35);transition:opacity .3s}",
    "#pud .pct small{font-size:.36em;font-weight:400;color:#7FB3D6;letter-spacing:.02em}",
    "#pud .tri{transform-origin:160px 125px;animation:ud-breathe 2.6s ease-in-out infinite}",
    "#pud .wrap{margin-top:calc(var(--d)*.08);text-align:center;min-height:64px}",
    "#pud .st{font-size:18px;font-weight:500;letter-spacing:.01em;color:#D7ECFA;transition:opacity .24s ease}",
    "#pud .sb{margin-top:6px;font-size:13px;color:#5C7D95;font-variant-numeric:tabular-nums;min-height:18px;transition:opacity .24s ease}",
    "#pud .fade{opacity:0}",
    "#pud .btns{display:flex;gap:10px;margin-top:18px;min-height:46px}",
    "#pud .btns button{min-height:46px;padding:0 22px;border-radius:23px;font:inherit;font-weight:500;font-size:15px;cursor:pointer;border:1px solid rgba(140,190,230,.28);background:rgba(20,40,60,.55);color:#CFE6F7;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}",
    "#pud .btns button.pri{background:linear-gradient(180deg,#14A6FF,#0B7FD6);border-color:#4FC3FF;color:#fff}",
    "#pud .btns button[hidden]{display:none}",
    "#pud .tst{position:absolute;left:0;right:0;bottom:max(10px,env(safe-area-inset-bottom));display:flex;gap:6px;overflow-x:auto;padding:0 14px;scrollbar-width:none;justify-content:flex-start}",
    "#pud .tst::-webkit-scrollbar{display:none}",
    "#pud .tst button{flex:none;min-height:34px;padding:0 12px;border-radius:17px;font:inherit;font-size:12.5px;color:#7FA2BA;background:rgba(14,28,44,.7);border:1px solid rgba(120,170,210,.16)}",
    "#pud .tst b{flex:none;align-self:center;font-weight:500;font-size:11px;letter-spacing:.08em;color:#3E5A70;text-transform:uppercase;padding-right:4px}",
    /* inicjalizacja warstw */
    "#pud .L{opacity:0}",
    "#pud.go .L{animation:ud-in .7s cubic-bezier(.2,.7,.2,1) forwards;animation-delay:calc(var(--i)*110ms)}",
    "#pud.go .pct{animation:ud-in .6s ease .55s both}",
    "#pud:not(.go) .pct,#pud:not(.go) .wrap{opacity:0}",
    "@keyframes ud-in{from{opacity:0;transform:scale(.965)}to{opacity:1;transform:none}}",
    "@keyframes ud-breathe{0%,100%{opacity:.62;transform:scale(.96)}50%{opacity:1;transform:scale(1.04)}}",
    "@keyframes ud-pulse{0%,100%{opacity:calc(.78 + .22*var(--gi))}50%{opacity:calc(.46 + .3*var(--gi))}}",
    "@keyframes ud-metal{0%,100%{opacity:.78}50%{opacity:1}}",
    "@keyframes ud-twk{0%,100%{opacity:.18}45%{opacity:.85}60%{opacity:.3}}",
    "@keyframes ud-wait{0%,100%{opacity:.55;transform:scale(.9)}50%{opacity:1;transform:scale(1.25)}}",
    "@keyframes ud-flash{0%{opacity:.9;transform:scale(1)}100%{opacity:0;transform:scale(1.13)}}",
    "@keyframes ud-glowup{0%{opacity:1}30%{opacity:1.0;filter:brightness(1.9)}100%{opacity:1;filter:brightness(1)}}",
    "@keyframes ud-okpulse{0%,100%{transform:scale(1)}50%{transform:scale(1.022)}}",
    "#pud .glow{animation:ud-pulse 2.4s ease-in-out infinite}",
    "#pud .metal{animation:ud-metal 3.4s ease-in-out infinite}",
    "#pud .twk{animation:ud-twk 3.2s ease-in-out infinite}",
    "#pud.wait .hd{animation:ud-wait 1.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}",
    "#pud.off .tri{animation:ud-wait 1.6s ease-in-out infinite}",
    "#pud .flash{opacity:0;transform-origin:160px 160px}",
    "#pud.ok .flash{animation:ud-flash .8s ease-out 1}",
    "#pud.ok .live{animation:ud-okpulse 1.1s ease-in-out .95s 1;transform-origin:160px 160px}",
    "#pud.ok .glow{animation:ud-glowup 1.3s ease-out 1 both}",
    "#pud .chk path{fill:none;stroke-linecap:round;stroke-linejoin:round}",
    "#pud .chk .a,#pud .chk .b{stroke-dasharray:var(--l);stroke-dashoffset:var(--l)}",
    "#pud.ok .chk .a{animation:ud-draw .26s cubic-bezier(.4,0,.2,1) .28s forwards}",
    "#pud.ok .chk .b{animation:ud-draw .38s cubic-bezier(.4,0,.2,1) .52s forwards}",
    "@keyframes ud-draw{to{stroke-dashoffset:0}}",
    "#pud.ok .tri,#pud.ok .pct,#pud.ok .head,#pud.err .tri,#pud.err .head{opacity:0!important;transition:opacity .35s}",
    "#pud.ok .pct{opacity:0}",
    "@media (prefers-reduced-motion:reduce){#pud .L,#pud.go .L{animation:none;opacity:1}#pud.go .pct{animation:none}#pud .glow,#pud .metal,#pud .twk,#pud .tri,#pud.wait .hd,#pud.off .tri{animation:none}#pud.ok .flash,#pud.ok .live,#pud.ok .glow{animation:none}#pud.ok .chk .a,#pud.ok .chk .b{animation:none;stroke-dashoffset:0}}"
  ].join("");

  function svg(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function fetchT(url, opt, ms) {
    var c = new AbortController(), t = setTimeout(function () { c.abort(); }, ms);
    opt = Object.assign({}, opt, { signal: c.signal });
    return fetch(url, opt).finally(function () { clearTimeout(t); });
  }
  var pol = function (cx, cy, r, deg) { var a = deg * Math.PI / 180; return [cx + r * Math.sin(a), cy - r * Math.cos(a)]; };

  function staticSvg() {
    var s = svg("svg", { viewBox: "0 0 320 320", "aria-hidden": "true" });
    var d = svg("defs", {}, s);
    var g1 = svg("radialGradient", { id: "ud-outer", cx: ".5", cy: ".4", r: ".7" }, d); svg("stop", { offset: "0", "stop-color": "#0B131C" }, g1); svg("stop", { offset: "1", "stop-color": "#03070B" }, g1);
    var g2 = svg("linearGradient", { id: "ud-rim", x1: "0", y1: "0", x2: "1", y2: "1" }, d); svg("stop", { offset: "0", "stop-color": "#7C97AD", "stop-opacity": ".55" }, g2); svg("stop", { offset: ".5", "stop-color": "#1B2A38", "stop-opacity": ".3" }, g2); svg("stop", { offset: "1", "stop-color": "#4B6479", "stop-opacity": ".45" }, g2);
    var g3 = svg("linearGradient", { id: "ud-metal", x1: "0", y1: "0", x2: "1", y2: "1" }, d);
    [["0", "#E4F2FF"], [".28", "#6F8FA9"], [".55", "#2A4358"], [".78", "#9DBBD2"], ["1", "#DDF0FF"]].forEach(function (o) { svg("stop", { offset: o[0], "stop-color": o[1] }, g3); });
    var g4 = svg("radialGradient", { id: "ud-panel", cx: ".5", cy: ".36", r: ".75" }, d); svg("stop", { offset: "0", "stop-color": "#12294A" }, g4); svg("stop", { offset: ".6", "stop-color": "#0A182C" }, g4); svg("stop", { offset: "1", "stop-color": "#050C18" }, g4);
    var g5 = svg("linearGradient", { id: "ud-gloss", x1: "0", y1: "0", x2: "0", y2: "1" }, d); svg("stop", { offset: "0", "stop-color": "#BFE3FF", "stop-opacity": ".13" }, g5); svg("stop", { offset: "1", "stop-color": "#BFE3FF", "stop-opacity": "0" }, g5);
    var f = svg("filter", { id: "ud-brush", x: "0", y: "0", width: "1", height: "1" }, d);
    svg("feTurbulence", { type: "fractalNoise", baseFrequency: "0.012 0.7", numOctaves: "2", seed: "7" }, f);
    svg("feColorMatrix", { values: "0 0 0 0 .55  0 0 0 0 .7  0 0 0 0 .85  0 0 0 .5 -.12" }, f);
    var cp = svg("clipPath", { id: "ud-clip" }, d); svg("circle", { cx: CX, cy: CX, r: 150 }, cp);
    // korpus
    svg("circle", { cx: CX, cy: CX, r: 151, fill: "#010305" }, s);
    svg("circle", { cx: CX, cy: CX, r: 150, fill: "url(#ud-outer)" }, s);
    svg("rect", { x: 10, y: 10, width: 300, height: 300, filter: "url(#ud-brush)", "clip-path": "url(#ud-clip)", opacity: ".26" }, s);
    svg("circle", { cx: CX, cy: CX, r: 149.2, fill: "none", stroke: "url(#ud-rim)", "stroke-width": "1.6" }, s);
    svg("circle", { cx: CX, cy: CX, r: 128, fill: "none", stroke: "#0F2132", "stroke-width": ".8" }, s);
    // podziałki: 120 drobnych co 3 stopnie, główne co 30
    var tk = svg("g", { stroke: "#2A4358", "stroke-linecap": "round" }, s);
    for (var i = 0; i < 120; i++) {
      var maj = i % 10 === 0, mid = i % 5 === 0, a = i * 3, p1 = pol(CX, CX, maj ? 132 : mid ? 135 : 137, a), p2 = pol(CX, CX, 142, a);
      svg("line", { x1: p1[0].toFixed(2), y1: p1[1].toFixed(2), x2: p2[0].toFixed(2), y2: p2[1].toFixed(2), "stroke-width": maj ? 1.5 : mid ? 1.1 : .7, opacity: maj ? .95 : mid ? .7 : .45, stroke: maj ? "#3C5C76" : "#22374A" }, tk);
    }
    // oznaczenia 50 / 100 / 150 (skala 0-200 na pełnym obwodzie, kierunek przeciwny do ruchu wskazówek)
    [["50", 270], ["100", 180], ["150", 90]].forEach(function (m) {
      var p = pol(CX, CX, 123.5, m[1]);
      var t = svg("text", { x: p[0].toFixed(2), y: (p[1] + 3).toFixed(2), "text-anchor": "middle", "font-size": "9", "font-weight": "500", fill: "#4B6C86", "letter-spacing": ".06em" }, s); t.textContent = m[0];
    });
    // tor postępu z krawędziami
    svg("circle", { cx: CX, cy: CX, r: 117.6, fill: "none", stroke: "#1A2E42", "stroke-width": ".8", opacity: ".8" }, s);
    svg("circle", { cx: CX, cy: CX, r: R, fill: "none", stroke: "#08121C", "stroke-width": "10" }, s);
    svg("circle", { cx: CX, cy: CX, r: 106.4, fill: "none", stroke: "#1A2E42", "stroke-width": ".8", opacity: ".8" }, s);
    // pierścień wewnętrzny: metal
    svg("circle", { cx: CX, cy: CX, r: 100.5, fill: "none", stroke: "#02050A", "stroke-width": "4" }, s);
    svg("circle", { cx: CX, cy: CX, r: 98, fill: "none", stroke: "url(#ud-metal)", "stroke-width": "3" }, s);
    svg("circle", { cx: CX, cy: CX, r: 95.6, fill: "none", stroke: "#8FB2CC", "stroke-width": ".6", opacity: ".45" }, s);
    // panel centralny
    svg("circle", { cx: CX, cy: CX, r: 94, fill: "#02060C" }, s);
    svg("circle", { cx: CX, cy: CX, r: 92, fill: "url(#ud-panel)" }, s);
    svg("path", { d: "M" + (CX - 80) + " " + (CX - 40) + " A 92 92 0 0 1 " + (CX + 80) + " " + (CX - 40) + " A 130 90 0 0 0 " + (CX - 80) + " " + (CX - 40) + " Z", fill: "url(#ud-gloss)" }, s);
    svg("circle", { cx: CX, cy: CX, r: 92, fill: "none", stroke: "#0E2036", "stroke-width": "1.2" }, s);
    // wcięcia kierunku w panelu (dyskretne)
    [0, 90, 180, 270].forEach(function (a) { var p1 = pol(CX, CX, 86, a), p2 = pol(CX, CX, 90, a); svg("line", { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], stroke: "#1B3550", "stroke-width": "1.2", "stroke-linecap": "round" }, s); });
    return s;
  }

  function liveSvg() {
    var s = svg("svg", { viewBox: "0 0 320 320", "aria-hidden": "true" });
    var d = svg("defs", {}, s);
    var gp = svg("linearGradient", { id: "ud-prog", gradientUnits: "userSpaceOnUse", x1: "60", y1: "270", x2: "260", y2: "50" }, d);
    var st1 = svg("stop", { offset: "0", style: "stop-color:var(--c1)" }, gp), st2 = svg("stop", { offset: "1", style: "stop-color:var(--c2)" }, gp);
    var gh = svg("radialGradient", { id: "ud-head" }, d);
    svg("stop", { offset: "0", "stop-color": "#F4FFFF", "stop-opacity": "1" }, gh); svg("stop", { offset: ".25", style: "stop-color:var(--c2)", "stop-opacity": ".85" }, gh); svg("stop", { offset: "1", style: "stop-color:var(--c1)", "stop-opacity": "0" }, gh);
    var gt = svg("radialGradient", { id: "ud-tg" }, d); svg("stop", { offset: "0", "stop-color": "#52F2E2", "stop-opacity": ".7" }, gt); svg("stop", { offset: "1", "stop-color": "#52F2E2", "stop-opacity": "0" }, gt);
    var live = svg("g", { class: "live" }, s);
    // punkty świetlne na zewnętrznym obwodzie
    [[18, 0], [64, 1.1], [112, 2.0], [168, .6], [214, 1.7], [262, 2.6], [318, .3]].forEach(function (o) {
      var p = pol(CX, CX, 146, o[0]); var c = svg("circle", { cx: p[0].toFixed(2), cy: p[1].toFixed(2), r: "1.5", fill: "#46C8F2", class: "twk" }, live); c.style.animationDelay = o[1] + "s";
    });
    var flip = "translate(320 0) scale(-1 1) rotate(-90 160 160)", prog = svg("g", { class: "glow" }, live), arcs = [];
    [[26, 0.05], [19, 0.09], [14, 0.16]].forEach(function (w) { arcs.push(svg("circle", { cx: CX, cy: CX, r: R, fill: "none", stroke: "var(--c1)", "stroke-width": w[0], "stroke-opacity": w[1], "stroke-linecap": "round", transform: flip, "stroke-dasharray": CIRC.toFixed(2), "stroke-dashoffset": CIRC.toFixed(2), class: "arc" }, prog)); });
    var main = svg("circle", { cx: CX, cy: CX, r: R, fill: "none", stroke: "url(#ud-prog)", "stroke-width": "8.5", "stroke-linecap": "round", transform: flip, "stroke-dasharray": CIRC.toFixed(2), "stroke-dashoffset": CIRC.toFixed(2), class: "arc" }, live);
    var core = svg("circle", { cx: CX, cy: CX, r: R, fill: "none", stroke: "var(--c3)", "stroke-width": "2.2", "stroke-opacity": ".9", "stroke-linecap": "round", transform: flip, "stroke-dasharray": CIRC.toFixed(2), "stroke-dashoffset": CIRC.toFixed(2), class: "arc" }, live);
    arcs.push(main, core);
    var head = svg("g", { class: "head" }, live), hd = svg("g", { class: "hd" }, head);
    svg("circle", { r: "17", fill: "url(#ud-head)", opacity: ".85" }, hd); svg("circle", { r: "4.4", fill: "#F2FFFF" }, hd); svg("circle", { r: "7.2", fill: "none", stroke: "var(--c3)", "stroke-width": ".7", "stroke-opacity": ".55" }, hd);
    var flash = svg("circle", { cx: CX, cy: CX, r: R, fill: "none", stroke: "var(--c3)", "stroke-width": "5", class: "flash" }, live);
    // trójkątny wskaźnik
    var tri = svg("g", { class: "tri" }, live);
    svg("circle", { cx: CX, cy: 125, r: "15", fill: "url(#ud-tg)" }, tri);
    svg("polygon", { points: "160,117 152.5,130 167.5,130", fill: "#3FE6D2" }, tri);
    // znak CHECK: dwie kreski
    var chk = svg("g", { class: "chk" }, live);
    [["glow", 15, ".12"], ["glow", 10, ".22"], ["core", 5.6, "1"]].forEach(function (w) {
      var col = w[0] === "core" ? "#6FFBEA" : "#2EE6D0";
      var a = svg("path", { d: "M130 165 L149 184", class: "a", stroke: col, "stroke-width": w[1], opacity: w[2] }, chk); a.style.setProperty("--l", "27");
      var b = svg("path", { d: "M149 184 L192 136", class: "b", stroke: col, "stroke-width": w[1], opacity: w[2] }, chk); b.style.setProperty("--l", "65");
    });
    return { svg: s, arcs: arcs, head: head, tri: tri };
  }

  var dlg = null, UI = null;
  function build() {
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    dlg = document.createElement("dialog"); dlg.id = "pud"; dlg.setAttribute("aria-label", "Aktualizacja aplikacji");
    dlg.innerHTML = '<div class="bg"></div><div class="col"><div class="dial"></div><div class="wrap" role="status" aria-live="polite"><div class="st"></div><div class="sb"></div></div><div class="btns"><button type="button" class="pri" data-a="retry" hidden>Spróbuj ponownie</button><button type="button" data-a="close">Anuluj</button></div></div><div class="tst" hidden></div>';
    document.body.appendChild(dlg);
    var dial = dlg.querySelector(".dial"), ss = staticSvg(), lv = liveSvg();
    [ss, lv.svg].forEach(function (x) { dial.appendChild(x); });
    Array.prototype.forEach.call(ss.children, function () {});
    var pct = document.createElement("div"); pct.className = "pct"; pct.innerHTML = '<span class="n">0</span><small>%</small>'; dial.appendChild(pct);
    // warstwy wejścia: korpus, pierścienie, metal, panel
    ss.classList.add("L"); ss.style.setProperty("--i", 0); lv.svg.classList.add("L"); lv.svg.style.setProperty("--i", 2);
    UI = { dial: dial, pct: pct.querySelector(".n"), st: dlg.querySelector(".st"), sb: dlg.querySelector(".sb"), arcs: lv.arcs, head: lv.head, btns: dlg.querySelector(".btns"), tst: dlg.querySelector(".tst"), retry: dlg.querySelector('[data-a="retry"]') };
    dlg.addEventListener("cancel", function (e) { if (S.mode === "done") e.preventDefault(); else stop(); });
    dlg.addEventListener("close", function () { stop(); cancelAnimationFrame(S.raf); S.raf = 0; });
    dlg.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.dataset.a === "close") { stop(); dlg.close(); }
      else if (b.dataset.a === "retry") startReal();
      else if (b.dataset.t) testMode(b.dataset.t);
    });
  }

  // ---------- stan ----------
  var S = { mode: "idle", target: 0, disp: 0, run: 0, raf: 0, last: 0, lastData: 0, pending: false, phase: "init", onDone: null, shown: "", shownSub: "" };
  var reduce = function () { return matchMedia("(prefers-reduced-motion: reduce)").matches; };

  function statusKey() {
    if (S.mode === "done") return "done";
    if (S.mode === "offline") return "offline";
    if (S.mode === "error") return "error";
    if (S.phase === "init") return "init";
    var p = S.disp;
    if (p < 0.05) return "connect";
    if (p < 0.45) return "download";
    if (p < 0.85) return "transfer";
    if (p < 0.95) return "verify";
    return "install";
  }
  function setText(el, txt, key) {
    if (S[key] === txt) return; S[key] = txt;
    if (reduce()) { el.textContent = txt; return; }
    el.classList.add("fade");
    setTimeout(function () { el.textContent = txt; el.classList.remove("fade"); }, 240);
  }
  function setStatus(extraSub) {
    var k = statusKey(), txt = (S.msg && (S.mode === "error")) ? STATUS.error : STATUS[k];
    setText(UI.st, txt, "shown");
    setText(UI.sb, extraSub != null ? extraSub : (S.sub || ""), "shownSub");
  }
  function paint() {
    var p = Math.max(0, Math.min(1, S.disp)), off = (CIRC * (1 - p)).toFixed(2), vis = p < 0.002 ? 0 : 1;
    UI.arcs.forEach(function (a) { a.setAttribute("stroke-dashoffset", off); a.style.display = vis ? "" : "none"; });
    var th = 2 * Math.PI * p, x = CX - R * Math.sin(th), y = CX - R * Math.cos(th);
    UI.head.setAttribute("transform", "translate(" + x.toFixed(2) + " " + y.toFixed(2) + ")");
    UI.dial.parentNode.parentNode.style.setProperty("--gi", (0.45 + 0.55 * p).toFixed(3));
    var n = p >= 0.9995 ? 100 : Math.floor(p * 100 + 1e-6);
    if (UI.pct.textContent !== String(n)) UI.pct.textContent = n;
  }
  function wake() { if (!S.raf) { S.last = performance.now(); S.raf = requestAnimationFrame(loop); } }
  function loop(ts) {
    S.raf = 0;
    var dt = Math.min(0.05, (ts - S.last) / 1000 || 0.016); S.last = ts;
    var diff = S.target - S.disp;
    if (reduce()) S.disp = S.target;
    else if (Math.abs(diff) < 0.0004) S.disp = S.target;
    else { var sp = Math.max(0.03, Math.min(0.4, Math.abs(diff) * 3.2)); S.disp += Math.sign(diff) * Math.min(Math.abs(diff), sp * dt); }
    paint(); setStatus();
    if (S.disp !== S.target) { wake(); return; }
    if (S.pending && S.disp >= 1 && S.mode === "run") success();
  }
  function setTarget(p, manual) { S.target = manual ? p : Math.max(S.target, p); S.lastData = performance.now(); dlg.classList.remove("wait"); wake(); }
  function mode(m) { S.mode = m; dlg.classList.toggle("off", m === "offline"); dlg.classList.toggle("err", m === "error"); }

  function success() {
    S.pending = false; S.mode = "done"; S.phase = "done"; S.sub = ""; setStatus("");
    dlg.classList.remove("wait"); dlg.classList.add("ok"); UI.btns.style.visibility = "hidden";
    setTimeout(function () { if (S.mode === "done" && S.onDone && !S.manual) S.onDone(); }, reduce() ? 900 : 2600);
  }
  function fail(msg) {
    stop(true); mode("error"); S.msg = msg; S.sub = msg; setStatus(msg); UI.retry.hidden = false; UI.btns.style.visibility = ""; wake();
  }
  function stop(keep) { S.run++; S.pending = false; if (!keep) { clearInterval(S.watch); } }

  function reset() {
    stop(); cancelAnimationFrame(S.raf); S.raf = 0; S.target = 0; S.disp = 0; S.pending = false; S.phase = "init"; S.sub = ""; S.msg = ""; S.shown = ""; S.shownSub = "";
    dlg.classList.remove("ok", "err", "off", "wait", "go"); UI.retry.hidden = true; UI.btns.style.visibility = ""; mode("run");
    UI.st.textContent = ""; UI.sb.textContent = ""; paint();
  }
  function intro() {
    reset(); void dlg.offsetWidth; dlg.classList.add("go");
    setStatus(""); return sleep(reduce() ? 100 : 900);
  }

  // ---------- prawdziwy proces ----------
  async function startReal() {
    var id; await intro(); id = S.run; if (!dlg.open) return;
    var dead = function () { return id !== S.run || !dlg.open; };
    clearInterval(S.watch);
    S.watch = setInterval(function () { if (S.mode === "run" && S.disp >= S.target && S.target < 1 && performance.now() - S.lastData > 4000) { dlg.classList.add("wait"); S.sub = "Oczekiwanie na dane…"; } }, 1000);
    try {
      S.phase = "connect"; setStatus("");
      var ver = null;
      for (;;) {
        try { var r = await fetchT("version.json", { cache: "no-store" }, 6000); if (!r.ok) throw new Error("HTTP " + r.status); ver = await r.json(); break; }
        catch (e) {
          if (dead()) return;
          mode("offline"); S.sub = "Próbuję ponownie…"; setStatus(); wake();
          await sleep(3000); if (dead()) return;
        }
      }
      mode("run"); S.sub = ""; setTarget(0.05);
      S.phase = "download";
      var items = await Promise.all(ASSETS.map(async function (u) {
        var r = await fetchT(u, { cache: "reload" }, 15000);
        if (!r.ok) throw new Error(u + " (HTTP " + r.status + ")");
        return { u: u, r: r, len: +r.headers.get("content-length") || 0, n: 0, parts: [] };
      }));
      if (dead()) return;
      var known = items.filter(function (i) { return i.len > 0; }), avg = known.length ? known.reduce(function (a, i) { return a + i.len; }, 0) / known.length : 1;
      var total = items.reduce(function (a, i) { return a + (i.len || avg); }, 0), loaded = 0;
      await Promise.all(items.map(async function (it) {
        var rd = it.r.body.getReader();
        for (;;) {
          var x = await rd.read(); if (x.done) break; if (dead()) { rd.cancel(); return; }
          it.parts.push(x.value); it.n += x.value.length; loaded += x.value.length;
          setTarget(0.05 + 0.8 * Math.min(1, loaded / total)); S.sub = Math.round(loaded / 1024) + " / " + Math.round(total / 1024) + " KB";
        }
      }));
      if (dead()) return;
      setTarget(0.85); S.phase = "verify"; S.sub = "";
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.len && it.n !== it.len) throw new Error("Niezgodny rozmiar pliku: " + it.u);
        if (/\.js$|version\.json$/.test(it.u)) {
          var txt = await new Blob(it.parts).text();
          if (/version\.json$/.test(it.u)) JSON.parse(txt); else new Function(txt);
        }
        setTarget(0.85 + 0.1 * (i + 1) / items.length); await sleep(35); if (dead()) return;
      }
      S.phase = "install"; setTarget(0.97);
      try { localStorage.setItem("pilot-installed-version", String(ver.version)); } catch (e) {}
      await sleep(180); if (dead()) return;
      setTarget(1); S.pending = true; wake();
    } catch (e) { if (!dead()) fail(e && e.message ? e.message : "Nieznany błąd"); }
  }

  // ---------- stany testowe (tylko w trybie testowym) ----------
  function testMode(t) {
    if (t === "real") { S.manual = false; startReal(); return; }
    S.manual = true;
    stop(); clearInterval(S.watch); cancelAnimationFrame(S.raf); S.raf = 0;
    dlg.classList.remove("ok", "err", "off", "wait"); UI.retry.hidden = true; UI.btns.style.visibility = ""; S.msg = ""; S.pending = false;
    dlg.classList.add("go"); mode("run");
    if (t === "error") { S.target = S.disp = 0.62; paint(); S.phase = "transfer"; fail("Test: symulowany błąd pobierania"); return; }
    if (t === "offline") { S.target = S.disp = 0.0; paint(); S.phase = "connect"; mode("offline"); S.sub = "Próbuję ponownie…"; setStatus(); return; }
    var p = +t / 100; S.phase = p < 0.05 ? "connect" : p < 0.85 ? "download" : p < 0.95 ? "verify" : "install"; S.sub = "Stan testowy: " + t + "%";
    S.mode = "run"; setTarget(p, true); if (p >= 1) { S.pending = true; S.sub = ""; } wake();
  }

  window.PilotUpdater = {
    open: function (opt) {
      opt = opt || {}; if (!dlg) build();
      S.onDone = opt.onDone || null;
      UI.tst.hidden = !opt.test;
      if (opt.test && !UI.tst.childElementCount) UI.tst.innerHTML = '<b>Test</b>' + ["0", "25", "50", "75", "99", "100"].map(function (v) { return '<button data-t="' + v + '">' + v + '%</button>'; }).join("") + '<button data-t="error">Błąd</button><button data-t="offline">Brak łączności</button><button data-t="real">Prawdziwe pobranie</button>';
      if (!dlg.open) dlg.showModal();
      S.manual = false; startReal();
    }
  };
})();

/* Pilot Marantz: tryb demo (/demo). Atrapa amplitunera w przegladarce: nic nie jest wysylane do sieci,
   mozna sprawdzic cala aplikacje bez wzmacniacza. Wlaczany tylko na stronie /demo. */
(function () {
  "use strict";
  const M = {
    main: { power: true, volume: -42, mute: false, source: "NET/USB", surround: "STEREO" },
    zone2: { power: false, volume: -55, mute: false, source: "CD", surround: "" },
    sources: [["CD", "CD", 1], ["NET/USB", "Radio", 1], ["TV", "TV", 1], ["DVD", "DVD", 1], ["TUNER", "Tuner", 1], ["GAME", "Gra", 0]].map(a => ({ code: a[0], name: a[1], used: !!a[2] })),
    surrounds: [["AUTO", "Auto"], ["STEREO", "Stereo"], ["DIRECT", "Direct"], ["PURE DIRECT", "Pure Direct"], ["DOLBY DIGITAL", "Dolby Digital"], ["DTS SURROUND", "DTS Surround"], ["MCH STEREO", "Multi CH Stereo"], ["VIRTUAL", "Virtual"]].map(a => ({ code: a[0], name: a[1] })),
    stations: ["Jazz Radio", "Classic Rock FM", "Chillout Lounge", "News 24", "Kids Stories"],
    now: { station: "Jazz Radio", track: "Demo: wymyślony utwór", info: "128kbps" },
    scenes: [{ id: "s1", name: "Wieczór" }, { id: "s2", name: "Radio rano" }], seq: 3,
    sound: { ok: true, tone: false, bass: 0, treble: 0, sleep: 0, dynvol: "OFF", dyneq: false },
    tuner: { ok: true, band: "FM", freq: "96.00", preset: "A1", power: true }
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const PRESETS = { A1: "96.00", A2: "89.10", A3: "101.50", A4: "104.90" }, KEYS = Object.keys(PRESETS);
  async function api(path, body) {
    await sleep(60);
    if (path === "api/state") return { ok: true, main: M.main, zone2: M.zone2, sources: M.sources, surrounds: M.surrounds };
    if (path === "api/radio" && body === undefined) return { stations: M.stations, station: M.now.station, now: M.now };
    if (path === "api/radio") { await sleep(1800); M[body.zone].source = "NET/USB"; M.now = { station: body.name, track: "Demo: wymyślony utwór", info: "128kbps" }; return { ok: true }; }
    if (path === "api/cmd") {
      const z = M[body.zone] || M.main, c = body.cmd;
      if (c === "volume") z.volume = body.value; else if (c === "volstep") z.volume += body.value; else if (c === "power") z.power = !!body.value;
      else if (c === "mute") z.mute = !!body.value; else if (c === "source") z.source = body.value; else if (c === "surround") z.surround = body.value;
      else if (c === "standby") { M.main.power = false; M.zone2.power = false; }
      return { ok: true };
    }
    if (path === "api/scenes" && body === undefined) return M.scenes.slice();
    if (path === "api/scenes") { M.scenes.push({ id: "s" + M.seq++, name: body.name }); return { ok: true }; }
    if (path === "api/scenes/apply") { await sleep(400); return { ok: true }; }
    if (path === "api/scenes/delete") { M.scenes = M.scenes.filter(x => x.id !== body.id); return { ok: true }; }
    if (path === "api/sound") { if (body !== undefined) M.sound[body.cmd] = body.value; return Object.assign({}, M.sound); }
    if (path === "api/tuner") {
      const t = M.tuner;
      if (body !== undefined) {
        if (body.cmd === "on") M.main.source = "TUNER";
        else if (body.cmd === "freq_up" || body.cmd === "freq_down") { t.freq = (+t.freq + (body.cmd === "freq_up" ? 0.1 : -0.1)).toFixed(2); t.preset = "OFF"; }
        else { const i = Math.max(0, KEYS.indexOf(t.preset)), j = (i + (body.cmd === "preset_up" ? 1 : KEYS.length - 1)) % KEYS.length; t.preset = KEYS[j]; t.freq = PRESETS[KEYS[j]]; }
      }
      return Object.assign({ active: M.main.source === "TUNER" }, t);
    }
    throw new Error("demo: nieznana ścieżka " + path);
  }
  window.PilotDemo = { api };
})();

#!/usr/bin/env python3
"""Pilot Marantz NR1602: backend (stdlib) - proxy HTTP do amplitunera, stan, sceny.
Nasluch tylko na 127.0.0.1 (nginx proxy /marantz/)."""
import json, os, re, socket, sys, time, threading, urllib.request, urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

AMP = os.environ.get("AMP_HOST", "").strip()
if not AMP:
    sys.exit("Ustaw adres amplitunera, np.: AMP_HOST=192.168.1.50 python3 server.py  (set AMP_HOST to your receiver's IP)")
PORT = int(os.environ.get("PILOT_PORT", "8135"))
BIND = os.environ.get("PILOT_BIND", "127.0.0.1")
DATA = os.environ.get("PILOT_DATA", os.path.join(os.path.dirname(os.path.abspath(__file__)), "data"))
HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.environ.get("AMP_BASE") or f"http://{AMP}/goform"
AMP_LOCK = threading.Lock()        # serwer WWW amplitunera jest delikatny: jedno zapytanie naraz
STATE_LOCK = threading.Lock()
_cache = {"t": 0, "data": None}
_lists = {"t": 0, "data": None}
CSRF = "marantz-pilot"
# wejscie, na ktore przelaczamy strefe glowna tuz przed jej wylaczeniem (np. DVD); puste = bez przelaczania
OFF_SOURCE = os.environ.get("PILOT_OFF_SOURCE", "").strip()

SI_CANDIDATES = {
    "TUNER": ["TUNER"], "CD": ["CD"], "M-XPORT": ["M-XPORT", "MXPORT"],
    "NET/USB": ["NET", "NET/USB", "NETWORK"], "DVD": ["DVD"], "BD": ["BD"], "TV": ["TV"],
    "SAT": ["SAT/CBL", "SAT", "CBL/SAT"], "GAME": ["GAME"],
}
SURROUNDS = {  # klucz amplitunera -> etykieta
    "AUTO": "Auto", "STEREO": "Stereo", "DIRECT": "Direct", "PURE DIRECT": "Pure Direct",
    "DOLBY DIGITAL": "Dolby Digital", "DTS SURROUND": "DTS Surround",
    "MCH STEREO": "Multi CH Stereo", "VIRTUAL": "Virtual",
}

def log(*a):
    print(time.strftime("%H:%M:%S"), *a, file=sys.stderr, flush=True)

def amp_get(path, timeout=5):
    with AMP_LOCK:
        with urllib.request.urlopen(f"{BASE}/{path}", timeout=timeout) as r:
            return r.read().decode("utf-8", "replace")

def amp_cmd(cmd):
    amp_get("formiPhoneAppDirect.xml?" + urllib.parse.quote(cmd, safe=""))

def val(xml, tag, default=""):
    m = re.search(rf"<{tag}>\s*<value>([^<]*)</value>", xml)
    return m.group(1).strip() if m else default

def vals(xml, tag):
    m = re.search(rf"<{tag}>(.*?)</{tag}>", xml, re.S)
    return [v for v in re.findall(r"<value>([^<]*)</value>", m.group(1))] if m else []

def num(s):
    try:
        return float(s)
    except ValueError:
        return None

# gdy gra siec/radio, amplituner podaje jako wejscie nazwe uslugi (np. "Favorites"), a nie "NET/USB"
NET_SOURCES = {"FAVORITES", "INTERNET RADIO", "IRADIO", "MEDIA SERVER", "SERVER", "FLICKR", "LAST.FM", "NAPSTER",
               "PANDORA", "SIRIUSXM", "SIRIUS", "RHAPSODY", "USB", "USB/IPOD", "IPOD", "NETWORK", "NET", "SPOTIFY", "AIRPLAY"}

def norm_source(src):
    return "NET/USB" if src.strip().upper() in NET_SOURCES else src

def read_zone(xml):
    return {
        "power": val(xml, "Power").upper() == "ON",
        "volume": num(val(xml, "MasterVolume")),
        "mute": val(xml, "Mute").lower() == "on",
        "source": norm_source(val(xml, "InputFuncSelect")),
        "surround": val(xml, "SurrMode"),
    }

def read_lists(force=False):
    if not force and _lists["data"] and time.time() - _lists["t"] < 60:
        return _lists["data"]
    xml = amp_get("formMainZone_MainZoneXml.xml")
    codes, names, flags = vals(xml, "InputFuncList"), vals(xml, "RenameSource"), vals(xml, "SourceDelete")
    sources = []
    for i, code in enumerate(codes):
        if code.upper() == "SOURCE":
            continue
        name = names[i].strip() if i < len(names) and names[i].strip() else code
        used = (flags[i].strip().upper() == "USE") if i < len(flags) else True
        sources.append({"code": code, "name": name, "used": used})
    surr = re.findall(r"<value index='([^']*)'", xml)
    data = {
        "sources": sources,
        "surrounds": [{"code": s, "name": SURROUNDS.get(s, s.title())} for s in surr if s],
        "devicePower": val(xml, "Power").upper() == "ON",
    }
    _lists.update(t=time.time(), data=data)
    return data

def get_state(max_age=0.8):
    with STATE_LOCK:
        if _cache["data"] and time.time() - _cache["t"] < max_age:
            return _cache["data"]
        try:
            main = read_zone(amp_get("formMainZone_MainZoneXmlStatus.xml"))
            z2 = read_zone(amp_get("formZone2_Zone2XmlStatus.xml"))
            lists = read_lists()
            data = {"ok": True, "ts": int(time.time()), "main": main, "zone2": z2,
                    "sources": lists["sources"], "surrounds": lists["surrounds"],
                    "devicePower": lists["devicePower"], "host": AMP}
        except Exception as e:
            data = dict(_cache["data"] or {})
            data.update(ok=False, error=f"Brak odpowiedzi amplitunera: {e}", ts=int(time.time()))
        _cache.update(t=time.time(), data=data)
        return data

# ---------- komendy ----------
def vol_code(db, prefix):
    a = max(0.0, min(98.0, round((db + 80.0) * 2) / 2))
    s = "%02d" % int(a)
    if a != int(a):
        s += "5"
    return prefix + s

def learned_load():
    try:
        return json.load(open(os.path.join(DATA, "learned.json")))
    except Exception:
        return {}

def learned_save(d):
    try:
        os.makedirs(DATA, exist_ok=True)
        json.dump(d, open(os.path.join(DATA, "learned.json"), "w"))
    except Exception as e:
        log("learned_save", e)

def set_source(zone, target):
    prefix = "SI" if zone == "main" else "Z2"
    cands = list(SI_CANDIDATES.get(target, [target]))
    learned = learned_load()
    key = f"{zone}:{target}"
    if key in learned and learned[key] in cands:
        cands.remove(learned[key]); cands.insert(0, learned[key])
    for c in cands:
        amp_cmd(prefix + c)
        time.sleep(0.7)
        st = get_state(max_age=0)
        if st.get(zone, {}).get("source", "").upper() == target.upper():
            if learned.get(key) != c:
                learned[key] = c; learned_save(learned)
                log("zapamietano kod", key, c)
            return True
    return False

def run_cmd(c):
    zone = c.get("zone", "main")
    cmd = c.get("cmd")
    value = c.get("value")
    if zone not in ("main", "zone2"):
        return 400, {"error": "zła strefa"}
    st = get_state(max_age=0.3)
    z = st.get(zone, {})
    pz = "" if zone == "main" else "Z2"
    if cmd == "standby":
        amp_cmd("PWSTANDBY"); _cache["t"] = 0
        return 200, {"ok": True}
    if cmd == "power":
        on = bool(value)
        if zone == "main" and not on and OFF_SOURCE and z.get("power") and z.get("source", "").upper() != OFF_SOURCE.upper():
            if not set_source("main", OFF_SOURCE):   # przed wylaczeniem ustaw wejscie z PILOT_OFF_SOURCE
                log("wylaczanie: nie udalo sie przelaczyc na", OFF_SOURCE)
        amp_cmd(("ZMON" if on else "ZMOFF") if zone == "main" else ("Z2ON" if on else "Z2OFF"))
        time.sleep(0.8 if on else 0.3); _cache["t"] = 0
        return 200, {"ok": True}
    if not st.get("ok"):
        return 502, {"error": st.get("error", "amplituner nie odpowiada")}
    if not z.get("power"):
        return 409, {"error": "Strefa jest wyłączona. Włącz ją najpierw."}
    if cmd == "volume":
        v = num(str(value))
        if v is None:
            return 400, {"error": "zła głośność"}
        amp_cmd(vol_code(v, "MV" if zone == "main" else "Z2"))
    elif cmd == "volstep":
        v = num(str(value))
        cur = z.get("volume")
        if v is None or cur is None:
            return 400, {"error": "zły krok"}
        amp_cmd(vol_code(cur + v, "MV" if zone == "main" else "Z2"))
    elif cmd == "mute":
        amp_cmd(("MUON" if value else "MUOFF") if zone == "main" else ("Z2MUON" if value else "Z2MUOFF"))
    elif cmd == "source":
        if not isinstance(value, str) or value not in {s["code"] for s in st.get("sources", [])}:
            return 400, {"error": "nieznane wejście"}
        if not set_source(zone, value):
            return 502, {"error": "Amplituner nie przełączył wejścia (żaden kod nie zadziałał)."}
    elif cmd == "surround" and zone == "main":
        if value not in {s["code"] for s in st.get("surrounds", [])}:
            return 400, {"error": "nieznany tryb"}
        amp_cmd("MS" + value)
    else:
        return 400, {"error": "nieznane polecenie"}
    time.sleep(0.25); _cache["t"] = 0
    return 200, {"ok": True}

# ---------- radio (ulubione z menu NET amplitunera) ----------
# Panel WWW amplitunera ma polecenia kursora (CurLeft/CurDown/CurEnter), ktorych nie ma w API iPhone.
# SIFVP i NS9x nie nadaja sie: SIFVP zawsze wlacza pierwsza stacje, a NS9x z ekranu "Now Playing" nic nie robia.
ROOT = BASE.rsplit("/goform", 1)[0]
RADIO_LOCK = threading.Lock()
# nazwy ulubionych z menu NET amplitunera (Favorites), po przecinku; po pierwszym odtworzeniu lista odswieza sie z amplitunera
DEFAULT_STATIONS = [x.strip() for x in os.environ.get("PILOT_STATIONS", "").split(",") if x.strip()]
_radio = {"station": None, "t": 0}

def clean_line(s):
    return s.replace("\u00ef\u00bb\u00bf", "").replace("\ufeff", "").strip()

def net_put(cmd):
    d = urllib.parse.urlencode({"cmd0": "PutNetAudioCommand/" + cmd, "ZoneName": "MAIN ZONE"}).encode()
    req = urllib.request.Request(ROOT + "/NetAudio/index.put.asp", d, {"Cookie": "ZoneName=MAIN ZONE"})
    with AMP_LOCK:
        with urllib.request.urlopen(req, timeout=5) as r:
            r.read()

def net_screen():
    x = amp_get("formNetAudio_StatusXml.xml")
    m = re.search(r"<chFlag>(.*?)</chFlag>", x, re.S)
    fl = [int(v) for v in re.findall(r"\d+", m.group(1))] if m else []
    m = re.search(r"<szLine>(.*?)</szLine>", x, re.S)
    ln = [clean_line(v) for v in re.findall(r"<value>(.*?)</value>", m.group(1), re.S)] if m else []
    ln += [""] * (9 - len(ln))
    return fl, ln

def net_cursor(fl):
    for i, f in enumerate(fl[:9]):
        if f in (8, 9):
            return i
    return None

def net_wait(pred, t=8.0):
    t0 = time.time(); ln = []
    while time.time() - t0 < t:
        fl, ln = net_screen()
        if pred(fl, ln):
            return fl, ln
        time.sleep(0.15)
    raise RuntimeError("amplituner nie pokazał oczekiwanego ekranu: " + " / ".join(x for x in ln[:4] if x))

def radio_play(name):
    for _ in range(6):                           # wroc do menu glownego
        fl, ln = net_screen()
        if ln[0].startswith("marantz:"):
            break
        net_put("CurLeft"); time.sleep(0.4)
    else:
        raise RuntimeError("nie udało się wejść do menu radia")
    fl, ln = net_wait(lambda f, l: l[0].startswith("marantz:") and l[1] == "Favorites")
    for _ in range(6):
        if net_cursor(fl) == 1:
            break
        net_put("CurUp"); time.sleep(0.3); fl, ln = net_screen()
    net_put("CurEnter")
    fl, ln = net_wait(lambda f, l: l[0] == "Favorites" and l[1] != "")
    items = [x for x in ln[1:7] if x]
    if name not in items:
        raise RuntimeError("nie ma takiej stacji w ulubionych")
    want = 1 + items.index(name)
    for _ in range(14):
        fl, ln = net_screen(); c = net_cursor(fl)
        if c == want:
            break
        net_put("CurDown" if (c is None or c < want) else "CurUp"); time.sleep(0.3)
    else:
        raise RuntimeError("nie udało się ustawić kursora")
    net_put("CurEnter")
    net_wait(lambda f, l: l[0] == "Now Playing")
    return items

def radio_info():
    """Lista stacji z pliku (po udanym odtworzeniu odswiezana z amplitunera) + co teraz gra."""
    stations = DEFAULT_STATIONS
    try:
        stations = json.load(open(os.path.join(DATA, "radio.json"), encoding="utf-8"))["stations"] or stations
    except Exception:
        pass
    now = None
    try:
        fl, ln = net_screen()
        if ln[0] == "Now Playing":
            now = {"track": ln[1], "station": ln[2] or _radio["station"], "info": ln[3]}
    except Exception:
        pass
    return {"stations": stations, "station": _radio["station"], "now": now}

def radio_cmd(d):
    zone = d.get("zone", "main"); name = d.get("name")
    if zone not in ("main", "zone2") or not isinstance(name, str):
        return 400, {"error": "złe dane"}
    st = get_state(max_age=0.3)
    if not st.get("ok"):
        return 502, {"error": st.get("error", "amplituner nie odpowiada")}
    if not st.get(zone, {}).get("power"):
        return 409, {"error": "Strefa jest wyłączona. Włącz ją najpierw."}
    with RADIO_LOCK:
        if st[zone].get("source") != "NET/USB":
            if not set_source(zone, "NET/USB"):
                return 502, {"error": "Amplituner nie przełączył wejścia na radio."}
            time.sleep(1.0)
        items = radio_play(name)
        _radio["station"] = name
        try:
            os.makedirs(DATA, exist_ok=True)
            json.dump({"stations": items}, open(os.path.join(DATA, "radio.json"), "w", encoding="utf-8"), ensure_ascii=False)
        except Exception as e:
            log("radio_save", e)
    _cache["t"] = 0
    return 200, {"ok": True, "station": name}

# ---------- dzwiek (odczyt przez port 23 amplitunera, zapis jak reszta komend) ----------
SOUND_QUERIES = ["PSTONE CTRL ?", "PSBAS ?", "PSTRE ?", "SLP?", "PSDYNVOL ?", "PSDYNEQ ?"]
def tn_lines(cmds, quiet=0.25):
    out = []
    with AMP_LOCK:
        s = None
        for i in range(4):                       # amplituner przyjmuje jedno polaczenie naraz
            try:
                s = socket.create_connection((AMP, 23), timeout=3); break
            except OSError:
                if i == 3:
                    raise
                time.sleep(0.5)
        try:
            s.settimeout(quiet)
            for c in cmds:
                s.sendall((c + "\r").encode())
                time.sleep(0.12)
                try:
                    while True:
                        b = s.recv(4096)
                        if not b:
                            break
                        out += b.decode("ascii", "replace").replace("\n", "\r").split("\r")
                except socket.timeout:
                    pass
        finally:
            s.close()
    return [x.strip() for x in out if x.strip()]

def read_sound():
    ln = tn_lines(SOUND_QUERIES)
    def pick(prefix):
        for x in ln:
            if x.startswith(prefix):
                return x[len(prefix):].strip()
        return None
    sl = pick("SLP")
    bas, tre = pick("PSBAS "), pick("PSTRE ")
    return {"ok": True,
            "tone": (pick("PSTONE CTRL ") or "OFF").upper() == "ON",
            "bass": (int(bas) - 50) if bas and bas.isdigit() else 0,
            "treble": (int(tre) - 50) if tre and tre.isdigit() else 0,
            "sleep": int(sl) if sl and sl.isdigit() else 0,
            "dynvol": (pick("PSDYNVOL ") or "OFF").upper(),
            "dyneq": (pick("PSDYNEQ ") or "OFF").upper() == "ON"}

def sound_cmd(d):
    cmd, v = d.get("cmd"), d.get("value")
    st = get_state(max_age=0.5)
    if not st.get("ok"):
        return 502, {"error": st.get("error", "amplituner nie odpowiada")}
    if not st.get("main", {}).get("power"):
        return 409, {"error": "Strefa główna jest wyłączona. Włącz ją najpierw."}
    if cmd == "tone" and isinstance(v, bool):
        code = "PSTONE CTRL " + ("ON" if v else "OFF")
    elif cmd in ("bass", "treble") and isinstance(v, int) and -6 <= v <= 6:
        code = ("PSBAS " if cmd == "bass" else "PSTRE ") + "%02d" % (50 + v)
    elif cmd == "sleep" and isinstance(v, int) and 0 <= v <= 120:
        code = "SLPOFF" if v == 0 else "SLP%03d" % v
    elif cmd == "dynvol" and v in ("OFF", "LIT", "MED", "HEV"):
        code = "PSDYNVOL " + v
    elif cmd == "dyneq" and isinstance(v, bool):
        code = "PSDYNEQ " + ("ON" if v else "OFF")
    else:
        return 400, {"error": "złe polecenie dźwięku"}
    amp_cmd(code); time.sleep(0.3)
    return 200, dict(read_sound(), sent=code)

# ---------- tuner FM ----------
def tuner_info():
    x = amp_get("formTuner_TunerXml.xml")
    st = get_state(max_age=1.0)
    return {"ok": True, "band": val(x, "Band"), "freq": val(x, "Frequency"), "preset": val(x, "Preset"),
            "active": st.get("main", {}).get("source", "").upper() == "TUNER", "power": bool(st.get("main", {}).get("power"))}

TUNER_CMDS = {"freq_up": "TFANUP", "freq_down": "TFANDOWN", "preset_up": "TPANUP", "preset_down": "TPANDOWN"}
def tuner_cmd(d):
    cmd = d.get("cmd")
    st = get_state(max_age=0.5)
    if not st.get("ok"):
        return 502, {"error": st.get("error", "amplituner nie odpowiada")}
    if not st.get("main", {}).get("power"):
        return 409, {"error": "Strefa główna jest wyłączona. Włącz ją najpierw."}
    if cmd == "on":
        if st["main"].get("source", "").upper() != "TUNER" and not set_source("main", "TUNER"):
            return 502, {"error": "Amplituner nie przełączył wejścia na tuner. Prawdopodobnie jest ukryty w Setup → Source Select."}
    elif cmd in TUNER_CMDS:
        if st["main"].get("source", "").upper() != "TUNER":
            return 409, {"error": "Najpierw włącz tuner."}
        amp_cmd(TUNER_CMDS[cmd])
    else:
        return 400, {"error": "złe polecenie tunera"}
    time.sleep(1.1); _cache["t"] = 0       # XML tunera odswieza sie z opoznieniem
    return 200, tuner_info()

# ---------- sceny ----------
SC_LOCK = threading.Lock()
def scenes_path():
    return os.path.join(DATA, "scenes.json")

def scenes_read():
    try:
        d = json.load(open(scenes_path()))
        return d if isinstance(d, list) else []
    except Exception:
        return []

def scenes_write(items):
    os.makedirs(DATA, exist_ok=True)
    tmp = scenes_path() + ".tmp"
    json.dump(items, open(tmp, "w"), ensure_ascii=False, indent=1)
    os.replace(tmp, scenes_path())

def apply_scene(sc):
    for zone in ("main", "zone2"):
        z = sc.get(zone)
        if not z:
            continue
        run_cmd({"zone": zone, "cmd": "power", "value": bool(z.get("power"))})
        if not z.get("power"):
            continue
        if z.get("source"):
            run_cmd({"zone": zone, "cmd": "source", "value": z["source"]})
        if z.get("volume") is not None:
            run_cmd({"zone": zone, "cmd": "volume", "value": z["volume"]})
        if zone == "main" and z.get("surround"):
            run_cmd({"zone": zone, "cmd": "surround", "value": z["surround"]})
        run_cmd({"zone": zone, "cmd": "mute", "value": bool(z.get("mute"))})

# ---------- pliki statyczne (tylko z listy) ----------
IMMUTABLE = "public, max-age=2592000"
STATIC_FILES = {
    "/demo.js": ("preview/demo.js", "application/javascript; charset=utf-8", "no-cache"),
    "/updater.js": ("preview/updater.js", "application/javascript; charset=utf-8", "no-cache"),
    "/menu-a.js": ("preview/menu-a.js", "application/javascript; charset=utf-8", "no-cache"),
    "/version.json": ("version.json", "application/json; charset=utf-8", "no-store"),
    "/manifest.webmanifest": ("manifest.webmanifest", "application/manifest+json; charset=utf-8", "no-cache"),
    "/favicon.ico": ("icons/favicon.ico", "image/x-icon", "no-cache"),
    "/icons/apple-touch-icon.png": ("icons/apple-touch-icon.png", "image/png", "no-cache"),
    "/icons/icon-192.png": ("icons/icon-192.png", "image/png", "no-cache"),
    "/icons/icon-512.png": ("icons/icon-512.png", "image/png", "no-cache"),
    "/icons/favicon-32.png": ("icons/favicon-32.png", "image/png", "no-cache"),
    "/fonts/ibm-plex-sans-latin-wght-normal.woff2": ("fonts/ibm-plex-sans-latin-wght-normal.woff2", "font/woff2", IMMUTABLE),
    "/fonts/ibm-plex-sans-latin-ext-wght-normal.woff2": ("fonts/ibm-plex-sans-latin-ext-wght-normal.woff2", "font/woff2", IMMUTABLE),
}

# ---------- HTTP ----------
class H(BaseHTTPRequestHandler):
    server_version = "marantz-pilot"
    def log_message(self, *a):
        pass

    def send_json(self, code, obj):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > 65536:
            raise ValueError("za duże")
        return json.loads(self.rfile.read(n) or b"{}")

    def csrf_ok(self):
        return self.headers.get("X-Requested-With") == CSRF

    def do_GET(self):
        p = self.path.split("?")[0]
        if p == "/api/state":
            return self.send_json(200, get_state())
        if p == "/api/scenes":
            return self.send_json(200, scenes_read())
        if p == "/api/radio":
            return self.send_json(200, radio_info())
        if p == "/api/sound":
            try:
                return self.send_json(200, read_sound())
            except Exception as e:
                return self.send_json(502, {"error": f"Brak odczytu dźwięku: {e}"})
        if p == "/api/tuner":
            try:
                return self.send_json(200, tuner_info())
            except Exception as e:
                return self.send_json(502, {"error": f"Brak odczytu tunera: {e}"})
        if p in STATIC_FILES:
            rel, ctype, cache = STATIC_FILES[p]
            try:
                b = open(os.path.join(HERE, "static", rel), "rb").read()
            except OSError:
                return self.send_json(404, {"error": "nie ma"})
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Cache-Control", cache)
            self.send_header("Content-Length", str(len(b)))
            self.end_headers()
            self.wfile.write(b)
            return
        if p in ("/", "/index.html", "/demo"):
            b = open(os.path.join(HERE, "index.html"), "rb").read()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Content-Length", str(len(b)))
            self.end_headers()
            self.wfile.write(b)
            return
        self.send_json(404, {"error": "nie ma"})

    def do_POST(self):
        p = self.path.split("?")[0]
        if not self.csrf_ok():
            return self.send_json(403, {"error": "brak nagłówka"})
        try:
            d = self.body()
        except Exception:
            return self.send_json(400, {"error": "zły JSON"})
        try:
            if p == "/api/cmd":
                code, obj = run_cmd(d)
                return self.send_json(code, obj)
            if p == "/api/radio":
                code, obj = radio_cmd(d)
                return self.send_json(code, obj)
            if p == "/api/sound":
                code, obj = sound_cmd(d)
                return self.send_json(code, obj)
            if p == "/api/tuner":
                code, obj = tuner_cmd(d)
                return self.send_json(code, obj)
            if p == "/api/scenes":
                name = str(d.get("name", "")).strip()[:40]
                if not name:
                    return self.send_json(400, {"error": "podaj nazwę"})
                st = get_state(max_age=0.5)
                sc = {"id": str(int(time.time() * 1000)), "name": name}
                for zone in ("main", "zone2"):
                    if d.get("zones", {}).get(zone, True) and st.get(zone):
                        z = st[zone]
                        sc[zone] = {"power": z["power"], "source": z["source"], "volume": z["volume"], "mute": z["mute"]}
                        if zone == "main":
                            sc[zone]["surround"] = z.get("surround")
                with SC_LOCK:
                    items = scenes_read(); items.append(sc); scenes_write(items)
                return self.send_json(200, sc)
            if p == "/api/scenes/apply":
                sc = next((s for s in scenes_read() if s["id"] == d.get("id")), None)
                if not sc:
                    return self.send_json(404, {"error": "nie ma sceny"})
                apply_scene(sc); _cache["t"] = 0
                return self.send_json(200, {"ok": True})
            if p == "/api/scenes/delete":
                with SC_LOCK:
                    items = [s for s in scenes_read() if s["id"] != d.get("id")]
                    scenes_write(items)
                return self.send_json(200, {"ok": True})
        except Exception as e:
            log("blad", p, repr(e))
            return self.send_json(502, {"error": f"Błąd: {e}"})
        self.send_json(404, {"error": "nie ma"})

if __name__ == "__main__":
    os.makedirs(DATA, exist_ok=True)
    srv = ThreadingHTTPServer((BIND, PORT), H)
    log("Pilot Marantz na %s:%d, amplituner %s" % (BIND, PORT, AMP))
    srv.serve_forever()

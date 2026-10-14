"""Static checks for the public site shell (Phase 11-05). Stdlib only."""
import re
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent / "site"
INDEX = SITE / "index.html"
MAIN = SITE / "js" / "app" / "main.js"

IMPORT_RE = re.compile(r"""(?:import\s[^'"]*?from\s*|import\s*|import\(\s*)['"]([^'"]+)['"]""")
FETCH_RE = re.compile(r"""fetch\(\s*(?:['"]([^'"]+)['"]|[A-Za-z_]+)""")
CONST_URL_RE = re.compile(r"""const\s+DATA_URL\s*=\s*['"]([^'"]+)['"]""")


def _strip_comments(src: str) -> str:
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    return re.sub(r"(?m)^\s*//.*$", "", src)


def _is_relative(url: str) -> bool:
    return not url.startswith("/") and "://" not in url and not url.startswith("//")


def test_index_shell():
    html = INDEX.read_text(encoding="utf-8")
    assert '<html lang="pt-BR">' in html
    assert '<meta charset="utf-8">' in html
    assert '<meta name="viewport"' in html
    assert '<script type="module" src="js/app/main.js">' in html


def test_index_urls_relative_and_resolve():
    html = INDEX.read_text(encoding="utf-8")
    urls = re.findall(r"""(?:src|href)=["']([^"']+)["']""", html)
    assert urls
    for u in urls:
        assert _is_relative(u), u
        assert (SITE / u).is_file(), u


def test_module_graph_resolves_and_relative():
    seen, todo = set(), [MAIN]
    while todo:
        f = todo.pop()
        if f in seen:
            continue
        seen.add(f)
        assert f.is_file(), f
        src = _strip_comments(f.read_text(encoding="utf-8"))
        for spec in IMPORT_RE.findall(src):
            assert spec.startswith("."), f"{f}: non-relative import {spec}"
            target = (f.parent / spec).resolve()
            assert target.is_file(), f"{f}: missing {spec}"
            todo.append(target)
    for js in (SITE / "js").rglob("*.js"):
        src = _strip_comments(js.read_text(encoding="utf-8"))
        for u in FETCH_RE.findall(src) + CONST_URL_RE.findall(src):
            if u:
                assert _is_relative(u), f"{js}: {u}"


def test_main_fetches_existing_data():
    src = _strip_comments(MAIN.read_text(encoding="utf-8"))
    urls = CONST_URL_RE.findall(src)
    assert urls and urls[0].startswith("data/")
    assert (SITE / urls[0]).is_file()
    assert "fetch(" in src


def test_core_is_pure():
    for js in (SITE / "js" / "core").rglob("*.js"):
        src = _strip_comments(js.read_text(encoding="utf-8"))
        assert not re.search(r"\b(document|window)\b", src), js


def test_info_button_is_accessible_and_dependency_free():
    src = (SITE / "js" / "app" / "info.js").read_text(encoding="utf-8")
    assert "aria-expanded" in src and "aria-controls" in src
    assert "Escape" in src
    assert 'type: \'button\'' in src
    assert not re.search(r"innerHTML", src)


def test_no_english_ui_words_in_html():
    html = INDEX.read_text(encoding="utf-8")
    html = re.sub(r"<script.*?</script>|<style.*?</style>", "", html, flags=re.S)
    text = re.sub(r"<[^>]+>", " ", html)
    for word in ("Loading", "Filters", "Reset", "Threshold", "Error", "Overview"):
        assert word not in text, word


VENDOR = SITE / "vendor"
VENDOR_FILES = [
    "uplot/uPlot.iife.min.js", "uplot/uPlot.min.css",
    "leaflet/leaflet.js", "leaflet/leaflet.css",
    "leaflet-heat/leaflet-heat.js",
]


def test_vendor_files_present_and_pinned():
    for rel in VENDOR_FILES:
        f = VENDOR / rel
        assert f.is_file() and f.stat().st_size > 0, rel
    readme = (VENDOR / "README.md").read_text(encoding="utf-8")
    for ver in ("1.6.32", "1.9.4", "0.2.0"):
        assert ver in readme
    for lib in ("uplot", "leaflet", "leaflet-heat"):
        assert (VENDOR / lib / "LICENSE").is_file(), lib


def test_vendor_scripts_load_before_module():
    html = INDEX.read_text(encoding="utf-8")
    pos = lambda s: html.index(s)
    assert pos("vendor/leaflet/leaflet.js") < pos("vendor/leaflet-heat/leaflet-heat.js") < pos("js/app/main.js")
    assert pos("vendor/uplot/uPlot.iife.min.js") < pos("js/app/main.js")
    assert pos("vendor/leaflet/leaflet.css") < pos("css/app.css")
    assert pos("vendor/uplot/uPlot.min.css") < pos("css/app.css")


def test_section_order():
    html = INDEX.read_text(encoding="utf-8")
    ids = ["overview", "map", "charts", "matrix", "ranking", "classes", "stats", "quality"]
    positions = [html.index(f'<section id="{i}"') for i in ids]
    assert positions == sorted(positions)


def test_no_cdn():
    html = INDEX.read_text(encoding="utf-8")
    for url in re.findall(r"""(?:src|href)=["']([^"']+)["']""", html):
        assert "://" not in url and not url.startswith("//"), url


def test_panels_do_not_use_innerhtml():
    for f in (SITE / "js" / "app").rglob("*.js"):
        assert "innerHTML" not in _strip_comments(f.read_text(encoding="utf-8")), f


def test_charts_panel_contract():
    charts = _strip_comments((SITE / "js" / "app" / "panels" / "charts.js").read_text(encoding="utf-8"))
    assert "SYNC_KEY" in charts
    assert re.search(r"setData\([^)]*,\s*false\)", charts)
    assert "h('details'" in charts
    details_call = charts[charts.index("h('details'"):].split("\n")[0]
    assert "open:" not in details_call and "'open'" not in details_call
    assert "getComputedStyle" in charts
    assert "innerHTML" not in charts
    main = _strip_comments(MAIN.read_text(encoding="utf-8"))
    assert "mountCharts(" in main
    assert "charts.render(ctx)" in main


def test_map_panel_contract():
    mp = _strip_comments((SITE / "js" / "app" / "panels" / "map.js").read_text(encoding="utf-8"))
    for needle in ("tile.openstreetmap.org", "OpenStreetMap", "maxZoom: 0", "bindPopup(", "link.select(", "link.onHover("):
        assert needle in mp, needle
    assert "innerHTML" not in mp
    assert mp.count("fitBounds") == 1
    assert mp.count("setView(") == 1
    fi = mp.index("function focus(")
    assert "setView(" in mp[fi:mp.index("\n  }", fi)]
    assert "setUi(" in mp
    assert "ctx.run" in mp
    assert "flyTo(" not in mp
    main = _strip_comments(MAIN.read_text(encoding="utf-8"))
    assert "mountMap(" in main
    assert "map.render(ctx)" in main
    assert "applyGpsFilter(" in main
    assert "map.focus(" in main
    i18n = (SITE / "js" / "app" / "i18n.js").read_text(encoding="utf-8")
    assert "Ainda sem efeito" not in i18n
    assert "próxima etapa" not in i18n


def test_map_routes_static_and_no_gps_track():
    import json
    routes = SITE / "data" / "routes"
    expected = {(1, 6667528, 6667529), (2, 7064052, 7064053), (3, 9453118, 9453119), (4, 19644242, 19644243)}
    for line, r1, r2 in expected:
        for sentido, rid in ((1, r1), (2, r2)):
            f = json.loads((routes / f"linha-{line}-sentido-{sentido}.geojson").read_text(encoding="utf-8"))
            p = f["properties"]
            assert (p["line"], p["sentido"], p["relation"]) == (line, sentido, rid)
            assert p["name"] and "→" in p["name"]
            assert f["geometry"]["type"] == "MultiLineString" and f["geometry"]["coordinates"]
            for seg in f["geometry"]["coordinates"]:
                assert len(seg) >= 2
                lon, lat = seg[0]
                assert -44 < lon < -42 and -24 < lat < -22
    mp = _strip_comments((SITE / "js" / "app" / "panels" / "map.js").read_text(encoding="utf-8"))
    for dead in ("trackSegments", "nearestFix", "fixMatched", "drawTrack", "polyline"):
        assert dead not in mp, dead
    assert "data/routes/" in mp


def test_share_wiring():
    main = _strip_comments(MAIN.read_text(encoding="utf-8"))
    for needle in ("parseHash(", "serialize(", "replaceState(", "hashchange", "mountShare("):
        assert needle in main, needle
    assert "pushState(" not in main
    sh = (SITE / "js" / "app" / "panels" / "share.js").read_text(encoding="utf-8")
    assert "clipboard" in sh and "execCommand" in sh
    html = (SITE / "index.html").read_text(encoding="utf-8")
    assert 'id="share"' in html and 'id="notice"' in html

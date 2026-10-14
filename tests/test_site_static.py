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
    ids = ["overview", "map", "charts", "classes", "stats", "quality"]
    positions = [html.index(f'<section id="{i}"') for i in ids]
    assert positions == sorted(positions)


def test_no_cdn():
    html = INDEX.read_text(encoding="utf-8")
    for url in re.findall(r"""(?:src|href)=["']([^"']+)["']""", html):
        assert "://" not in url and not url.startswith("//"), url


def test_panels_do_not_use_innerhtml():
    for f in (SITE / "js" / "app").rglob("*.js"):
        assert "innerHTML" not in _strip_comments(f.read_text(encoding="utf-8")), f

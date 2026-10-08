"""REPO-01 regression: .gitignore keeps private/bulky files out of git."""
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]

pytestmark = pytest.mark.skipif(
    shutil.which("git") is None or not (REPO_ROOT / ".git").exists(),
    reason="git not available",
)


def _git(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", *args], cwd=REPO_ROOT, capture_output=True, text=True
    )


def _ignored(path: str) -> bool:
    return _git("check-ignore", "--no-index", "-q", path).returncode == 0


IGNORED = [
    "Results_1st.Run/raw/2. PXV-TIG.csv",
    "Results_1st.Run/treated/Final - Monitoramento de Sapata coletora - Linha 04.xlsx",
    "data/wtvb01_20260521_134925.csv",
    "logs/wtvb01.log",
    "logs/wtvb01.log.1",
    "WTVB01 documents/manual.pdf",
    "WTVB01_Manual_Usuario.docx",
    "WTVB01_Guia_Instalacao.docx",
    "__pycache__/x.cpython-313.pyc",
    "src/__pycache__/sensor.cpython-313.pyc",
    "tests/__pycache__/x.pyc",
    "tools/dashboard_converter/__pycache__/cli.cpython-313.pyc",
    ".pytest_cache/v/cache/lastfailed",
]

NOT_IGNORED = [
    "site/data/run-2026-10-02-l4-t102.json",
    "logs/.gitkeep",
    "Stations_GEO/Line4_Stat_geo.txt",
    "gerar_manual.py",
    "gerar_guia_instalacao.py",
    "tools/dashboard_converter/cli.py",
    "tests/fixtures/golden_run1.json",
    "requirements-dashboard.txt",
    "site/index.html",
]


@pytest.mark.parametrize("path", IGNORED)
def test_private_and_bulky_paths_are_ignored(path):
    assert _ignored(path), f"{path} should be ignored"


@pytest.mark.parametrize("path", NOT_IGNORED)
def test_publishable_paths_are_not_ignored(path):
    assert not _ignored(path), f"{path} must not be ignored"


def test_station_files_and_generators_tracked():
    out = _git("ls-files", "Stations_GEO", "gerar_manual.py", "gerar_guia_instalacao.py").stdout
    tracked = set(out.split("\n"))
    for n in range(1, 5):
        assert f"Stations_GEO/Line{n}_Stat_geo.txt" in tracked
    assert "gerar_manual.py" in tracked
    assert "gerar_guia_instalacao.py" in tracked


def test_gitignore_commit_precedes_converter_commits():
    added = _git("log", "--diff-filter=A", "--format=%H", "--", ".gitignore").stdout.split()
    assert added, ".gitignore has no adding commit"
    gi = added[-1]
    later = _git("log", "--format=%H", "--", "tools", "site").stdout.split()
    for commit in later:
        r = _git("merge-base", "--is-ancestor", gi, commit)
        assert r.returncode == 0, f"{commit} predates .gitignore commit"

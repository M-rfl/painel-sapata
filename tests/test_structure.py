# tests/test_structure.py
"""Structure tests: required files exist and src package is importable.

These tests satisfy UTIL-03 (project structure) and are intentionally
kept dependency-free so they pass before any module implementation.
"""
from __future__ import annotations

from pathlib import Path


def test_requirements_txt_exists() -> None:
    """requirements.txt must exist at project root."""
    assert Path("requirements.txt").exists(), "requirements.txt not found"


def test_requirements_txt_contains_pymodbus_pin() -> None:
    """requirements.txt must contain the exact pymodbus==3.13.0 pin."""
    content = Path("requirements.txt").read_text(encoding="utf-8")
    assert "pymodbus==3.13.0" in content, "pymodbus==3.13.0 pin missing from requirements.txt"


def test_src_package_marker_exists() -> None:
    """src/__init__.py must exist to make src/ a Python package."""
    assert Path("src/__init__.py").exists(), "src/__init__.py not found"


def test_src_is_importable() -> None:
    """'import src' must succeed — src/ must be a valid package."""
    import src  # noqa: F401


def test_sensor_stub_exists() -> None:
    """src/sensor.py stub must exist (Phase 2 will implement it)."""
    assert Path("src/sensor.py").exists(), "src/sensor.py stub not found"


def test_csv_logger_stub_exists() -> None:
    """src/csv_logger.py stub must exist (Phase 3 will implement it)."""
    assert Path("src/csv_logger.py").exists(), "src/csv_logger.py stub not found"


def test_logs_directory_exists() -> None:
    """logs/ directory (or .gitkeep placeholder) must exist."""
    assert Path("logs").exists() or Path("logs/.gitkeep").exists(), \
        "logs/ directory not found"

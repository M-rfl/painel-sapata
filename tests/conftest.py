# tests/conftest.py
"""Shared pytest fixtures for Phase 1 tests."""
from __future__ import annotations

import pytest
from pathlib import Path


@pytest.fixture
def minimal_config_yaml(tmp_path: Path) -> Path:
    """Write a minimal valid config.yaml (serial_port only) and return its path."""
    cfg = tmp_path / "config.yaml"
    cfg.write_text("serial_port: COM3\n", encoding="utf-8")
    return cfg


@pytest.fixture(autouse=True)
def reset_logging_handlers():
    """Remove all root logger handlers between tests to avoid cross-test pollution."""
    import logging
    yield
    root = logging.getLogger()
    for handler in root.handlers[:]:
        handler.close()
        root.removeHandler(handler)

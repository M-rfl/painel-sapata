# tests/test_config_loader.py
"""Unit tests for src/config_loader.py.

Covers CFG-01 (all fields), CFG-02 (validation errors exit 1),
CFG-03 (defaults applied when optional fields omitted).
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

from src.config_loader import AppConfig, load_config


# ---------------------------------------------------------------------------
# CFG-03: Default values applied for all optional fields
# ---------------------------------------------------------------------------

def test_defaults_applied_when_only_serial_port_set(tmp_path: Path) -> None:
    """Minimal config (serial_port only) must apply all CFG-03 defaults."""
    cfg_file = tmp_path / "config.yaml"
    cfg_file.write_text("serial_port: COM3\n", encoding="utf-8")
    cfg = load_config(cfg_file)
    assert cfg.baudrate == 9600
    assert cfg.slave_id == 80
    assert cfg.sample_interval_seconds == 0.1
    assert cfg.output_folder == "data"
    assert cfg.csv_filename_prefix == "wtvb01"
    assert cfg.serial_port == "COM3"


def test_user_values_override_defaults(tmp_path: Path) -> None:
    """User-supplied values must override all defaults they specify."""
    cfg_file = tmp_path / "config.yaml"
    cfg_file.write_text(
        "serial_port: COM5\nbaudrate: 19200\nslave_id: 1\n",
        encoding="utf-8",
    )
    cfg = load_config(cfg_file)
    assert cfg.baudrate == 19200
    assert cfg.slave_id == 1
    assert cfg.serial_port == "COM5"


def test_all_fields_accepted(tmp_path: Path) -> None:
    """Full config.yaml with all six fields must load without error."""
    cfg_file = tmp_path / "config.yaml"
    cfg_file.write_text(
        "serial_port: COM3\n"
        "baudrate: 9600\n"
        "slave_id: 80\n"
        "sample_interval_seconds: 0.5\n"
        "output_folder: output\n"
        "csv_filename_prefix: sensor\n",
        encoding="utf-8",
    )
    cfg = load_config(cfg_file)
    assert cfg.sample_interval_seconds == 0.5
    assert cfg.output_folder == "output"
    assert cfg.csv_filename_prefix == "sensor"


# ---------------------------------------------------------------------------
# CFG-02: Validation errors produce human-readable output and exit code 1
# ---------------------------------------------------------------------------

def test_missing_serial_port_exits_1(tmp_path: Path) -> None:
    """Config without serial_port must exit with code 1."""
    cfg_file = tmp_path / "config.yaml"
    cfg_file.write_text("baudrate: 9600\n", encoding="utf-8")
    with pytest.raises(SystemExit) as exc:
        load_config(cfg_file)
    assert exc.value.code == 1


def test_missing_config_file_exits_1(tmp_path: Path) -> None:
    """Non-existent config file path must exit with code 1."""
    missing = tmp_path / "nonexistent.yaml"
    with pytest.raises(SystemExit) as exc:
        load_config(missing)
    assert exc.value.code == 1


def test_invalid_baudrate_type_exits_1(tmp_path: Path) -> None:
    """String baudrate ('9600') must exit with code 1 — type error."""
    cfg_file = tmp_path / "config.yaml"
    cfg_file.write_text("serial_port: COM3\nbaudrate: '9600'\n", encoding="utf-8")
    with pytest.raises(SystemExit) as exc:
        load_config(cfg_file)
    assert exc.value.code == 1


def test_slave_id_out_of_range_exits_1(tmp_path: Path) -> None:
    """slave_id=300 (>247) must exit with code 1 — range error."""
    cfg_file = tmp_path / "config.yaml"
    cfg_file.write_text("serial_port: COM3\nslave_id: 300\n", encoding="utf-8")
    with pytest.raises(SystemExit) as exc:
        load_config(cfg_file)
    assert exc.value.code == 1


def test_negative_sample_interval_exits_1(tmp_path: Path) -> None:
    """sample_interval_seconds <= 0 must exit with code 1."""
    cfg_file = tmp_path / "config.yaml"
    cfg_file.write_text(
        "serial_port: COM3\nsample_interval_seconds: -1\n", encoding="utf-8"
    )
    with pytest.raises(SystemExit) as exc:
        load_config(cfg_file)
    assert exc.value.code == 1

# src/config_loader.py
"""Configuration loader for WTVB01 Notebook Logger.

Loads config.yaml with yaml.safe_load(), applies DEFAULTS for optional fields,
validates all values, and returns a typed AppConfig dataclass. Exits with code 1
and a human-readable error message on any validation failure.

Usage:
    from src.config_loader import load_config
    config = load_config()  # reads config.yaml in current directory
"""
from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List

import yaml

from src.utils import deep_merge

# ---------------------------------------------------------------------------
# Defaults — all optional fields; serial_port has no default (required)
# ---------------------------------------------------------------------------

DEFAULTS: Dict[str, Any] = {
    "serial_port": None,                # REQUIRED — no default
    "baudrate": 9600,                   # WTVB01-485 factory default
    "slave_id": 80,                     # 0x50 hex = 80 decimal (WitMotion factory)
    "sample_interval_seconds": 0.1,     # 10 Hz; min effective ~0.02s on Windows
    "output_folder": "data",
    "csv_filename_prefix": "wtvb01",
    "log_level": "WARNING",
}

_VALID_BAUDRATES = (1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200)


# ---------------------------------------------------------------------------
# AppConfig dataclass — field names MUST match DEFAULTS keys exactly
# ---------------------------------------------------------------------------

@dataclass
class AppConfig:
    """Typed configuration container. Populated by load_config()."""
    serial_port: str
    baudrate: int
    slave_id: int
    sample_interval_seconds: float
    output_folder: str
    csv_filename_prefix: str
    log_level: str


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def load_config(path: Path = Path("config.yaml")) -> AppConfig:
    """Load, merge with defaults, validate, and return AppConfig.

    Args:
        path: Path to config.yaml. If the file does not exist, exits with
              code 1 and a human-readable error message.

    Returns:
        AppConfig dataclass with all fields populated.

    Raises:
        SystemExit(1): On any validation error. Prints human-readable message
                       before exiting. Never raises ValueError or TypeError to
                       the caller.
    """
    raw: Dict[str, Any] = {}

    path = Path(path)
    if not path.exists():
        print(f"[config error] Config file not found: {path}")
        print("  Create config.yaml with at least: serial_port: COMx")
        sys.exit(1)

    with open(path, "r", encoding="utf-8") as f:
        loaded = yaml.safe_load(f)
        if loaded is not None:
            raw = loaded

    merged = deep_merge(DEFAULTS, raw)
    _validate(merged, path)
    return AppConfig(**{k: merged[k] for k in AppConfig.__dataclass_fields__})


# ---------------------------------------------------------------------------
# Validation — prints ALL errors then exits once
# ---------------------------------------------------------------------------

def _validate(cfg: Dict[str, Any], path: Path) -> None:
    """Validate merged config dict. Prints errors and calls sys.exit(1) if any.

    Checks:
    - serial_port is present and non-empty
    - baudrate is an int in the supported set
    - slave_id is an int in range 1–247
    - sample_interval_seconds is a positive number
    """
    errors: List[str] = []

    # serial_port — required, no default
    if not cfg.get("serial_port"):
        errors.append(
            "serial_port is required — edit config.yaml and set your COM port.\n"
            "  Example (Windows): serial_port: COM3\n"
            "  Example (Linux):   serial_port: /dev/ttyUSB0\n"
            "  Run 'python list_serial_ports.py' to discover available ports."
        )

    # baudrate — must be int and in supported set
    baud = cfg.get("baudrate")
    if not isinstance(baud, int) or baud not in _VALID_BAUDRATES:
        errors.append(
            f"baudrate must be one of {_VALID_BAUDRATES}, got: {baud!r}\n"
            "  WTVB01-485 factory default is 9600. Do not change unless reconfigured."
        )

    # slave_id — must be int in Modbus range 1–247
    sid = cfg.get("slave_id")
    if not isinstance(sid, int) or not (1 <= sid <= 247):
        errors.append(
            f"slave_id must be an integer between 1 and 247, got: {sid!r}\n"
            "  WTVB01-485 factory default is 80 (decimal) = 0x50 (hex).\n"
            "  Use slave_id: 80 in config.yaml (not '0x50' in quotes)."
        )

    # sample_interval_seconds — must be positive number
    interval = cfg.get("sample_interval_seconds")
    if not isinstance(interval, (int, float)) or interval <= 0:
        errors.append(
            f"sample_interval_seconds must be a positive number, got: {interval!r}\n"
            "  Minimum effective rate on Windows is ~0.02 seconds."
        )

    if errors:
        print(f"[config error] {path} has {len(errors)} problem(s):\n")
        for i, err in enumerate(errors, 1):
            print(f"  {i}. {err}\n")
        sys.exit(1)

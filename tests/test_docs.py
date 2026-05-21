# tests/test_docs.py
"""TDD Wave 0 — Phase 4 Documentation & Hardening tests.

All 9 tests are written before any README.md or code change.  They assert
DOC-01, DOC-02, and DOC-03 acceptance criteria.

Expected RED-phase results:
  FAILED : test_readme_exists
  SKIPPED: test_readme_ch340_driver
  SKIPPED: test_readme_serial_port_os_coverage
  SKIPPED: test_readme_list_serial_ports
  SKIPPED: test_readme_troubleshooting_count
  FAILED : test_reg_count_arithmetic
  PASSED : test_no_naive_datetime         (src/ already compliant — acceptable)
  PASSED : test_csv_flush_present         (csv_logger.py already has flush())
  PASSED : test_signed16_on_signed_channels (sensor.py already correct)
"""
from pathlib import Path

import pytest

# ---------------------------------------------------------------------------
# Path helpers
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).parent.parent

_README = PROJECT_ROOT / "README.md"


def _read_readme() -> str:
    """Return README.md text, or skip the test if the file does not exist yet."""
    if not _README.exists():
        pytest.skip("README.md not created yet")
    return _README.read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# DOC-01: README.md exists and contains required sections
# ---------------------------------------------------------------------------


def test_readme_exists():
    """README.md must be present in the project root."""
    assert _README.exists(), "README.md not found — create it in project root"


def test_readme_ch340_driver():
    """README.md must contain the CH340 driver URL."""
    text = _read_readme()
    assert "wch-ic.com/products/CH340.html" in text.lower() or \
           "wch-ic.com/products/CH340.html" in text, \
        "README.md missing CH340 driver URL (wch-ic.com/products/CH340.html)"


def test_readme_serial_port_os_coverage():
    """README.md must cover Windows, Linux, and macOS serial port paths."""
    text = _read_readme()
    assert "Device Manager" in text, \
        "README.md missing Windows serial port guidance (Device Manager)"
    assert "/dev/ttyUSB" in text, \
        "README.md missing Linux serial port guidance (/dev/ttyUSB)"
    assert "/dev/tty.usbserial" in text, \
        "README.md missing macOS serial port guidance (/dev/tty.usbserial)"


def test_readme_list_serial_ports():
    """README.md must mention the list_serial_ports.py helper script."""
    text = _read_readme()
    assert "list_serial_ports.py" in text, \
        "README.md must document the list_serial_ports.py helper script"


def test_readme_troubleshooting_count():
    """README.md must contain at least 12 '### Scenario' troubleshooting entries."""
    text = _read_readme()
    n = text.count("### Scenario")
    assert n >= 12, f"Found {n} troubleshooting scenarios, need 12"


# ---------------------------------------------------------------------------
# DOC-02: Code hardening — register count expressed as arithmetic
# ---------------------------------------------------------------------------


def test_reg_count_arithmetic():
    """sensor.py must express _REG_COUNT as 0x46 - 0x34 + 1, not a bare literal."""
    sensor_text = (PROJECT_ROOT / "src" / "sensor.py").read_text(encoding="utf-8")
    assert "0x46 - 0x34 + 1" in sensor_text, \
        "_REG_COUNT must be expressed as 0x46 - 0x34 + 1, not a bare literal"


# ---------------------------------------------------------------------------
# DOC-03: Code hardening — runtime correctness checks
# ---------------------------------------------------------------------------


def test_no_naive_datetime():
    """No src/*.py file may call datetime.now() without tz= keyword argument."""
    violations = []
    src_dir = PROJECT_ROOT / "src"
    for py_file in sorted(src_dir.rglob("*.py")):
        lines = py_file.read_text(encoding="utf-8").splitlines()
        for lineno, line in enumerate(lines, start=1):
            if "datetime.now(" in line and "tz=" not in line:
                violations.append(f"{py_file.relative_to(PROJECT_ROOT)}:{lineno}")
    assert len(violations) == 0, \
        "Naive datetime.now() found in:\n" + "\n".join(violations)


def test_csv_flush_present():
    """csv_logger.py must call .flush() after every writerow()."""
    csv_text = (PROJECT_ROOT / "src" / "csv_logger.py").read_text(encoding="utf-8")
    assert ".flush()" in csv_text, \
        "csv_logger.py must call .flush() after every writerow()"


def test_signed16_on_signed_channels():
    """sensor.py must apply to_signed16() to acceleration and temperature registers."""
    sensor_text = (PROJECT_ROOT / "src" / "sensor.py").read_text(encoding="utf-8")
    assert "to_signed16(regs[0]) * SCALE_ACC" in sensor_text, \
        "sensor.py: ax_g must use to_signed16(regs[0]) * SCALE_ACC"
    assert "to_signed16(regs[1]) * SCALE_ACC" in sensor_text, \
        "sensor.py: ay_g must use to_signed16(regs[1]) * SCALE_ACC"
    assert "to_signed16(regs[2]) * SCALE_ACC" in sensor_text, \
        "sensor.py: az_g must use to_signed16(regs[2]) * SCALE_ACC"
    assert "to_signed16(regs[12]) * SCALE_TEMP" in sensor_text, \
        "sensor.py: temperature_c must use to_signed16(regs[12]) * SCALE_TEMP"

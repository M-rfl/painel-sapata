import matplotlib
matplotlib.use("Agg")   # MUST be first matplotlib statement — before any visualizer import

import pytest
from src.visualizer import PlotManager, MAX_POINTS, INTERVAL_MS
from src.utils import SensorReading


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def pm():
    """PlotManager instance for structure tests (tasks 1-5, 8)."""
    return PlotManager()


@pytest.fixture
def mock_reading():
    """A fully-populated SensorReading for data/animation tests."""
    return SensorReading(
        timestamp="t", sensor_id="mock",
        ax_g=1.5, ay_g=2.0, az_g=0.5,
        vx_mm_s=10.0, vy_mm_s=8.0, vz_mm_s=6.0,
        angle_x=None, angle_y=None, angle_z=None,
        temperature_c=25.3,
        dx_um=100.0, dy_um=80.0, dz_um=60.0,
        freq_x_hz=10.0, freq_y_hz=12.0, freq_z_hz=8.0,
    )


# ---------------------------------------------------------------------------
# VIZ-02 — 5 subplots
# ---------------------------------------------------------------------------

def test_five_subplots_created(pm):
    """VIZ-02: PlotManager creates exactly 5 subplot axes."""
    assert len(pm._axes) == 5


# ---------------------------------------------------------------------------
# VIZ-03 — line counts and legends
# ---------------------------------------------------------------------------

def test_line_count_per_subplot(pm):
    """VIZ-03: First 4 axes have 3 lines each; Temperature axis has 1 line."""
    for i, ax in enumerate(pm._axes[:4]):
        assert len(ax.get_lines()) == 3, f"Axis {i} should have 3 lines"
    assert len(pm._axes[4].get_lines()) == 1, "Temperature axis should have 1 line"


def test_subplot_legends(pm):
    """VIZ-03: Every subplot has a legend."""
    for i, ax in enumerate(pm._axes):
        assert ax.get_legend() is not None, f"Axis {i} is missing a legend"


# ---------------------------------------------------------------------------
# VIZ-06 — axis labels
# ---------------------------------------------------------------------------

def test_ylabel_units(pm):
    """VIZ-06: Each subplot y-label matches the expected unit string."""
    expected = [
        "Acceleration (g)",
        "Velocity (mm/s)",
        "Displacement (µm)",
        "Frequency (Hz)",
        "Temperature (°C)",
    ]
    for i, ax in enumerate(pm._axes):
        assert ax.get_ylabel() == expected[i], (
            f"Axis {i} ylabel: got {ax.get_ylabel()!r}, expected {expected[i]!r}"
        )


def test_xlabel_time(pm):
    """VIZ-06: The bottom subplot x-label is 'Time (s)'."""
    for i, ax in enumerate(pm._axes):
        assert ax.get_xlabel() == "Time (s)", (
            f"Axis {i} xlabel: got {ax.get_xlabel()!r}"
        )


# ---------------------------------------------------------------------------
# VIZ-04 — data buffer (update_data / maxlen)
# ---------------------------------------------------------------------------

def test_update_data_appends(mock_reading):
    """VIZ-04: update_data() appends values to channel buffers and timestamp buffer."""
    manager = PlotManager()
    manager.update_data(mock_reading)
    assert manager._channel_bufs["ax_g"][-1] == pytest.approx(1.5)
    assert len(manager._t_buf) == 1


def test_buffer_maxlen_enforced(mock_reading):
    """VIZ-04: Buffers are capped at MAX_POINTS — oldest data is dropped."""
    manager = PlotManager()
    for _ in range(350):
        manager.update_data(mock_reading)
    assert len(manager._t_buf) == MAX_POINTS
    assert len(manager._channel_bufs["temperature_c"]) == MAX_POINTS


# ---------------------------------------------------------------------------
# VIZ-05 — animation interval
# ---------------------------------------------------------------------------

def test_animation_interval(pm):
    """VIZ-05: FuncAnimation interval matches INTERVAL_MS constant."""
    assert pm._ani.event_source.interval == INTERVAL_MS


# ---------------------------------------------------------------------------
# VIZ-04 — _animate updates line data
# ---------------------------------------------------------------------------

def test_animate_sets_line_data(mock_reading):
    """VIZ-04: After update_data + _animate, all lines carry the buffered data."""
    manager = PlotManager()
    manager.update_data(mock_reading)
    manager._animate(0)
    for _attr, line in manager._lines:
        assert len(line.get_xdata()) == 1, (
            f"Line for {_attr!r} should have 1 x-data point after one update"
        )


# ---------------------------------------------------------------------------
# VIZ-03 — temperature subplot has exactly one line
# ---------------------------------------------------------------------------

def test_temperature_subplot_one_line(mock_reading):
    """VIZ-03: The temperature line carries the correct y-value after update_data."""
    manager = PlotManager()
    manager.update_data(mock_reading)
    manager._animate(0)
    # Find the temperature line in _lines
    temp_line = None
    for attr, line in manager._lines:
        if attr == "temperature_c":
            temp_line = line
            break
    assert temp_line is not None, "No line registered for 'temperature_c'"
    assert temp_line.get_ydata()[-1] == pytest.approx(25.3)

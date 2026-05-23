"""Live sensor data visualizer — 5-subplot animated display for WTVB01."""

import matplotlib
matplotlib.use("TkAgg")  # Windows: Tk bundled with Python; must precede pyplot import

import matplotlib.pyplot as plt
import matplotlib.animation as animation
from collections import deque
import time
from typing import Optional

from src.utils import SensorReading

# ---------------------------------------------------------------------------
# Module-level constants
# ---------------------------------------------------------------------------

MAX_POINTS = 300    # deque maxlen: 30 s at 10 Hz (VIZ-04)
INTERVAL_MS = 1000  # FuncAnimation interval ms: 1 Hz animation (VIZ-05)

# ---------------------------------------------------------------------------
# Subplot definitions — (ylabel, [(attr, legend_label, color), ...])
# ---------------------------------------------------------------------------

_SUBPLOT_DEFS = [
    ("Acceleration (g)",  [("ax_g", "ax", "tab:blue"), ("ay_g", "ay", "tab:green"), ("az_g", "az", "tab:red")]),
    ("Velocity (mm/s)",   [("vx_mm_s", "vib_x", "tab:blue"), ("vy_mm_s", "vib_y", "tab:green"), ("vz_mm_s", "vib_z", "tab:red")]),
    ("Displacement (µm)", [("dx_um", "disp_x", "tab:blue"), ("dy_um", "disp_y", "tab:green"), ("dz_um", "disp_z", "tab:red")]),
    ("Frequency (Hz)",    [("freq_x_hz", "freq_x", "tab:blue"), ("freq_y_hz", "freq_y", "tab:green"), ("freq_z_hz", "freq_z", "tab:red")]),
    ("Temperature (°C)",  [("temperature_c", "temp_c", "tab:orange")]),
]


# ---------------------------------------------------------------------------
# PlotManager
# ---------------------------------------------------------------------------

class PlotManager:
    """Manages a 5-subplot matplotlib figure with live-updating deque buffers.

    Designed to run on the main thread with acquisition feeding update_data()
    from a background thread (CPython GIL makes deque.append thread-safe).
    Call start() to block on plt.show() — do not call from a background thread.
    """

    def __init__(self) -> None:
        self._t_buf: deque = deque(maxlen=MAX_POINTS)
        self._t_start: float = time.monotonic()
        self._channel_bufs: dict = {}
        self._lines: list = []

        self._fig, self._axes = plt.subplots(
            5, 1, figsize=(12, 10), constrained_layout=True
        )

        try:
            self._fig.canvas.manager.set_window_title("WTVB01 Live Sensor Data")
        except AttributeError:
            pass  # Agg backend has no manager / window

        for ax, (ylabel, channels) in zip(self._axes, _SUBPLOT_DEFS):
            ax.set_ylabel(ylabel)
            ax.set_xlabel("Time (s)")
            ax.grid(True, alpha=0.3)

            for attr, label, color in channels:
                self._channel_bufs[attr] = deque(maxlen=MAX_POINTS)
                line, = ax.plot([0], [0], color=color, label=label, linewidth=0.8)
                self._lines.append((attr, line))

            ax.legend(loc="upper left", fontsize="small")

        self._ani = animation.FuncAnimation(
            self._fig,
            self._animate,
            interval=INTERVAL_MS,
            blit=False,
            cache_frame_data=False,
        )

    def update_data(self, reading: SensorReading) -> None:
        """Append one sensor reading to all channel buffers.

        Thread-safe in CPython: deque.append is atomic under the GIL.
        """
        elapsed = time.monotonic() - self._t_start
        self._t_buf.append(elapsed)
        for attr, _line in self._lines:
            value = getattr(reading, attr, None)
            self._channel_bufs[attr].append(value if value is not None else float("nan"))

    def _animate(self, frame) -> None:
        """FuncAnimation callback — snapshot buffers and update all lines."""
        t_snap = list(self._t_buf)
        for attr, line in self._lines:
            y_snap = list(self._channel_bufs[attr])
            line.set_data(t_snap, y_snap)
            line.axes.relim()
            line.axes.autoscale_view()

    def start(self) -> None:
        """Block until window is closed. Call on main thread only (VIZ-01)."""
        plt.show()


# ---------------------------------------------------------------------------
# Standalone mock mode (VIZ-01)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import math
    import threading

    pm = PlotManager()

    def _mock_loop():
        elapsed = time.monotonic() - pm._t_start
        reading = SensorReading(
            timestamp="mock", sensor_id="mock",
            ax_g=0.01 * math.sin(2 * math.pi * elapsed),
            ay_g=0.01 * math.sin(2 * math.pi * elapsed + 1.0),
            az_g=1.0 + 0.005 * math.sin(2 * math.pi * 0.5 * elapsed),
            vx_mm_s=abs(5.0 * math.sin(2 * math.pi * 10.0 * elapsed)),
            vy_mm_s=abs(3.0 * math.sin(2 * math.pi * 12.0 * elapsed)),
            vz_mm_s=abs(2.0 * math.sin(2 * math.pi * 8.0 * elapsed)),
            angle_x=None, angle_y=None, angle_z=None,
            temperature_c=25.0 + 0.1 * math.sin(0.1 * elapsed),
            dx_um=100.0 * abs(math.sin(2 * math.pi * 10.0 * elapsed)),
            dy_um=80.0 * abs(math.sin(2 * math.pi * 12.0 * elapsed)),
            dz_um=60.0 * abs(math.sin(2 * math.pi * 8.0 * elapsed)),
            freq_x_hz=10.0 + math.sin(elapsed),
            freq_y_hz=12.0 + math.sin(elapsed + 1),
            freq_z_hz=8.0 + math.sin(elapsed + 2),
        )
        pm.update_data(reading)
        threading.Timer(0.1, _mock_loop).start()  # 10 Hz mock feed

    _mock_loop()
    pm.start()  # blocks on main thread — Tk event loop (VIZ-01)

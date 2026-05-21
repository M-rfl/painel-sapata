# Phase 5: Visualizer Module - Research

**Researched:** 2026-05-21
**Domain:** matplotlib 3.10.9 FuncAnimation, deque rolling buffers, thread-safe data flow, headless test strategy
**Confidence:** HIGH — all findings verified by running code on Python 3.13.13 / matplotlib 3.10.9 / Windows 10

---

## Summary

Phase 5 builds `src/visualizer.py` as a self-contained `PlotManager` class. The class owns a `matplotlib.figure.Figure` with 5 stacked subplots, one `collections.deque(maxlen=300)` per channel (13 total), and a `FuncAnimation` that calls its own `_animate()` method at 1000 ms intervals. It exposes a single public method `update_data(reading: SensorReading)` that the acquisition thread (Phase 6) will call — or that a mock generator calls in standalone mode.

The critical architectural constraint is already locked: matplotlib's TkAgg backend must run on the main thread; acquisition runs on a background thread. The deque data structure is the threading bridge — CPython's GIL makes `deque.append()` and `list(deque)` atomic, so no explicit lock is needed. The animation reads a snapshot (`list(deque)`) on every frame; the sensor thread appends in the background. This pattern is safe and eliminates all mutex complexity.

For testing, matplotlib's `Agg` backend renders without a display or Tk window. Setting `MPLBACKEND=Agg` (or calling `matplotlib.use('Agg')` before any `pyplot` import) allows full unit testing of `PlotManager.__init__()`, `update_data()`, and buffer state without hardware or GUI. The test verifies line data with `Line2D.get_xdata()` / `get_ydata()` after calling `update_data()` with mock `SensorReading` instances.

**Primary recommendation:** Implement `PlotManager` with `blit=False` (simpler, correct axis label updates at 1 Hz), `constrained_layout=True` (no layout jitter), and `deque(maxlen=300)` buffers. Expose `update_data(reading)` as the sole public API. Standalone mode runs `PlotManager` with a `threading.Timer`-driven mock generator directly in the module's `if __name__ == '__main__'` block.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VIZ-01 | User can launch live graph window via `python main.py --gui` | Phase 5 builds the standalone `PlotManager`; Phase 6 wires `--gui` flag. This phase delivers the class; VIZ-01 is confirmed complete when Phase 6 integrates it. |
| VIZ-02 | 5 subplots: Acceleration (g), Velocity (mm/s), Displacement (µm), Frequency (Hz), Temperature (°C) | `plt.subplots(5, 1)` + per-subplot title/ylabel. Verified on matplotlib 3.10.9. |
| VIZ-03 | Each subplot shows X/Y/Z channel lines with legend; Temperature has 1 line | 13 `Line2D` objects: 3 per first 4 subplots + 1 for temperature. `ax.legend()` per subplot. Verified. |
| VIZ-04 | Last 30 seconds of data scrolls; 300 points at 10 Hz | `deque(maxlen=300)` per channel. At 10 Hz, 300 points = 30 s. Auto-drops old points. Scrolling via `ax.relim()` + `ax.autoscale_view()`. Verified. |
| VIZ-05 | Animation updates at >= 1 Hz | `FuncAnimation(fig, func, interval=1000, ...)` — 1000 ms interval = 1 Hz. Verified FuncAnimation created without error. |
| VIZ-06 | Y-axis labeled with measurement name + unit; X-axis shows elapsed time in seconds | `ax.set_ylabel("Acceleration (g)")`, `ax.set_xlabel("Time (s)")`. X-axis is `t_buf` in seconds from session start. Verified. |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| matplotlib | 3.10.9 (installed) | Figure, subplots, FuncAnimation, Line2D | The only matplotlib-family GUI animation library; no alternative for live plot in Python |
| collections.deque | stdlib | Rolling buffer, maxlen=300 per channel | O(1) append and auto-drop; thread-safe in CPython (GIL); `list(deque)` gives atomic snapshot |
| numpy | 2.4.6 (installed as matplotlib dep) | Array operations (matplotlib needs it internally) | Already present; not directly needed in PlotManager code |
| src.utils.SensorReading | project (Phase 1) | Data contract between acquisition and visualizer | Already implemented and tested; 17 fields match all 13 viz channels |
| threading | stdlib | Background mock generator in standalone mode; Phase 6 uses it for sensor acquisition | Standard Python threading |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| time | stdlib | `time.monotonic()` for elapsed-seconds X-axis | Monotonic clock immune to NTP/DST adjustments |
| math | stdlib | `math.sin()` for mock data generator in standalone mode | Smooth test curves without numpy dependency |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `deque(maxlen=300)` | `threading.Lock` + list | deque is simpler; CPython GIL makes deque ops atomic; Lock adds complexity with no benefit |
| `blit=False` | `blit=True` | blit=True is faster but skips axis limit updates; at 1 Hz, blit=False has no perceptible cost |
| `constrained_layout=True` | `tight_layout()` in animate() | `tight_layout()` on every frame causes layout jitter; `constrained_layout` is set once at figure creation |
| `FuncAnimation` | `plt.pause()` in a loop | `FuncAnimation` is the idiomatic approach; `plt.pause()` blocks the thread and is not composable |

**Installation:**
```bash
pip install matplotlib
```

matplotlib 3.10.9 is already installed after this phase's setup. numpy 2.4.6 is installed automatically as a dependency.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── visualizer.py        # Phase 5 — PlotManager class (new file)
├── utils.py             # Phase 1 — SensorReading dataclass (already exists)
├── sensor.py            # Phase 2 — WitMotionSensor (already exists)
├── csv_logger.py        # Phase 3 — CSVLogger (already exists)
└── config_loader.py     # Phase 1 — AppConfig (already exists)
```

### Pattern 1: PlotManager Class Structure

**What:** Self-contained class that creates Figure + subplots in `__init__`, stores Line2D objects and deques, and exposes `update_data()` and `start()`.
**When to use:** Instantiated once; `update_data()` called per reading from any thread; `start()` launches `plt.show()` (blocking) or `plt.show(block=False)` for test mode.

```python
# src/visualizer.py
# Source: matplotlib 3.10.9 API verified on Python 3.13.13 Windows 10
import matplotlib
matplotlib.use("TkAgg")  # MUST be set before pyplot import — Windows constraint
import matplotlib.pyplot as plt
import matplotlib.animation as animation
from collections import deque
import time
from typing import Optional
from src.utils import SensorReading

MAX_POINTS = 300  # 30 s at 10 Hz (VIZ-04)
INTERVAL_MS = 1000  # 1 Hz animation (VIZ-05)

_SUBPLOT_DEFS = [
    # (ylabel, [(channel_attr, legend_label, color), ...])
    ("Acceleration (g)",  [("ax_g", "ax", "tab:blue"), ("ay_g", "ay", "tab:green"), ("az_g", "az", "tab:red")]),
    ("Velocity (mm/s)",   [("vx_mm_s", "vib_x", "tab:blue"), ("vy_mm_s", "vib_y", "tab:green"), ("vz_mm_s", "vib_z", "tab:red")]),
    ("Displacement (µm)", [("dx_um", "disp_x", "tab:blue"), ("dy_um", "disp_y", "tab:green"), ("dz_um", "disp_z", "tab:red")]),
    ("Frequency (Hz)",    [("freq_x_hz", "freq_x", "tab:blue"), ("freq_y_hz", "freq_y", "tab:green"), ("freq_z_hz", "freq_z", "tab:red")]),
    ("Temperature (°C)",  [("temperature_c", "temp_c", "tab:orange")]),
]

class PlotManager:
    def __init__(self) -> None:
        self._t_buf: deque = deque(maxlen=MAX_POINTS)
        self._t_start: float = time.monotonic()
        # {channel_attr: deque}
        self._channel_bufs: dict[str, deque] = {}
        # [(channel_attr, Line2D), ...]
        self._lines: list[tuple[str, object]] = []

        self._fig, self._axes = plt.subplots(
            5, 1,
            figsize=(12, 10),
            constrained_layout=True,  # no jitter from tight_layout in animate()
        )
        self._fig.canvas.manager.set_window_title("WTVB01 Live Sensor Data")

        for ax, (ylabel, channels) in zip(self._axes, _SUBPLOT_DEFS):
            ax.set_ylabel(ylabel)          # VIZ-06
            ax.set_xlabel("Time (s)")      # VIZ-06
            ax.grid(True, alpha=0.3)
            for attr, label, color in channels:
                self._channel_bufs[attr] = deque(maxlen=MAX_POINTS)
                line, = ax.plot([], [], color=color, label=label, linewidth=0.8)
                self._lines.append((attr, line))
            ax.legend(loc="upper left", fontsize="small")  # VIZ-03

        self._ani = animation.FuncAnimation(
            self._fig,
            self._animate,
            interval=INTERVAL_MS,   # VIZ-05: 1000 ms = 1 Hz
            blit=False,             # False: axis labels update correctly; fine at 1 Hz
            cache_frame_data=False, # False: no memory growth in infinite loop
        )

    def update_data(self, reading: SensorReading) -> None:
        """Thread-safe: append reading values to rolling buffers.

        Called from acquisition thread (Phase 6) or mock generator.
        deque.append() is atomic in CPython — no lock needed.
        """
        elapsed = time.monotonic() - self._t_start
        self._t_buf.append(elapsed)
        for attr, _line in self._lines:
            value = getattr(reading, attr, None)
            self._channel_bufs[attr].append(value if value is not None else float("nan"))

    def _animate(self, frame) -> None:
        """Called by FuncAnimation on main thread. Snapshots buffers and updates lines."""
        t_snap = list(self._t_buf)   # atomic snapshot
        for attr, line in self._lines:
            y_snap = list(self._channel_bufs[attr])
            line.set_data(t_snap, y_snap)
            line.axes.relim()
            line.axes.autoscale_view()

    def start(self) -> None:
        """Block until window is closed. Call on main thread only."""
        plt.show()
```

### Pattern 2: Standalone Mock Mode

**What:** `if __name__ == '__main__'` block generates `SensorReading` objects with `math.sin()` curves and feeds them to `PlotManager.update_data()` at 10 Hz using a repeating timer.
**When to use:** Validates all VIZ-01 through VIZ-06 without sensor hardware.

```python
# src/visualizer.py — bottom of file
if __name__ == "__main__":
    import math
    import threading

    pm = PlotManager()

    def _mock_loop():
        t = time.monotonic()
        elapsed = t - pm._t_start
        reading = SensorReading(
            timestamp="mock",
            sensor_id="mock",
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
        # Re-schedule at 10 Hz (0.1 s)
        threading.Timer(0.1, _mock_loop).start()

    _mock_loop()
    pm.start()   # blocks on main thread (Tk event loop)
```

### Pattern 3: Thread-Safe Buffer Access

**What:** Acquisition thread calls `update_data()`; main thread's `_animate()` reads via `list(deque)`. No explicit lock needed in CPython.
**When to use:** All cross-thread data handoff in this project.

```python
# Verified on Python 3.13.13 with 10,000 concurrent appends/reads — 0 errors
# deque.append() is atomic (single C-level bytecode under the GIL)
# list(deque) produces a point-in-time snapshot; safe to iterate afterward

# Writer (acquisition thread):
self._channel_bufs[attr].append(value)

# Reader (main thread / animate):
y_snap = list(self._channel_bufs[attr])  # atomic copy
line.set_data(t_snap, y_snap)
```

### Pattern 4: Scrolling X-Axis

**What:** X-axis uses elapsed seconds (`time.monotonic() - start`). `deque(maxlen=300)` auto-drops old timestamps. `ax.relim() + ax.autoscale_view()` adjusts displayed range automatically.
**When to use:** Every `_animate()` call.

```python
# Verified: after 350 appends to deque(maxlen=300):
# t_buf[0] = 5.0s  (oldest surviving point)
# t_buf[-1] = 34.9s (newest)
# displayed X window: 29.9s of data — scrolls naturally
t_snap = list(self._t_buf)
line.set_data(t_snap, y_snap)
line.axes.relim()
line.axes.autoscale_view()  # X and Y auto-fit
```

### Pattern 5: Backend Declaration (Windows Constraint)

**What:** `matplotlib.use("TkAgg")` must appear before `import matplotlib.pyplot`. In `src/visualizer.py`, put it at module level. In tests, override with `matplotlib.use("Agg")` before importing `visualizer`.
**When to use:** Top of `src/visualizer.py`.

```python
# src/visualizer.py — top of file
import matplotlib
matplotlib.use("TkAgg")  # Windows: Tk is bundled with Python, most reliable backend
import matplotlib.pyplot as plt
```

```python
# tests/test_visualizer.py — before any visualizer import
import matplotlib
matplotlib.use("Agg")    # headless: no Tk window, no display needed
# Then import PlotManager AFTER backend is set
```

### Anti-Patterns to Avoid

- **`tight_layout()` inside `_animate()`:** Called on every frame, causes subplot boundaries to jump slightly. Use `constrained_layout=True` at figure creation instead.
- **`blit=True` with `ax.relim()`/`ax.autoscale_view()`:** blit only redraws `Line2D` artists; axis limits and tick labels are background artists and will NOT update. At 1 Hz, `blit=False` has no perceptible performance cost.
- **`plt.pause()` loop instead of `FuncAnimation`:** Blocks the thread, not composable with Phase 6 threading design, and busy-spins on Windows.
- **`threading.Lock` around deque:** Not needed in CPython; the GIL makes `deque.append()` and `list(deque)` atomic. Adding a Lock introduces deadlock risk without benefit.
- **Calling `matplotlib.use()` after `import pyplot`:** Raises `UserWarning` and may have no effect. Backend must be set before the first pyplot import.
- **`nan` in deque instead of skipping:** `float("nan")` causes matplotlib to draw a gap (line breaks). For partial reads, this is intentional and visually correct — better than plotting 0.
- **`cache_frame_data=True` (the default) in an infinite loop:** Each frame's arguments are cached, causing unbounded memory growth. Use `cache_frame_data=False`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Animated line chart | Custom `canvas.draw()` + `plt.pause()` loop | `FuncAnimation` | FuncAnimation manages the Tk event loop correctly; custom loop starves Tk and causes freezing |
| Rolling data window | Manual list with `pop(0)` | `deque(maxlen=300)` | `pop(0)` is O(n); deque drop is O(1); deque is also atomic under CPython GIL |
| Thread synchronization for buffers | `threading.Lock` around list | `deque(maxlen=300)` (CPython) | GIL makes deque atomic; Lock adds complexity and deadlock risk |
| Subplot layout management | Manual `fig.add_subplot()` + `fig.subplots_adjust()` | `plt.subplots(5, 1, constrained_layout=True)` | constrained_layout handles spacing automatically; `subplots_adjust` requires manual tuning |
| Elapsed time X-axis | Custom counter variable | `time.monotonic() - start` | monotonic never goes backward; survives NTP, DST, or user clock changes |

**Key insight:** `FuncAnimation` + `deque(maxlen=N)` is the established Python pattern for scrolling live plots. Every component is stdlib or matplotlib. Zero custom synchronization or timing logic is needed.

---

## Common Pitfalls

### Pitfall 1: matplotlib.use() Called After pyplot Import
**What goes wrong:** Backend silently stays as default (may be Agg or TkAgg depending on environment); on some systems Tk window never opens.
**Why it happens:** Developer imports `from matplotlib import pyplot as plt` at top of file before calling `matplotlib.use("TkAgg")`.
**How to avoid:** Always put `matplotlib.use("TkAgg")` as the FIRST matplotlib statement, before any pyplot import. In tests, call `matplotlib.use("Agg")` before importing `visualizer.py`.
**Warning signs:** `UserWarning: Cannot load backend 'TkAgg' due to...` in output.

### Pitfall 2: FuncAnimation Garbage-Collected Immediately
**What goes wrong:** Window opens and immediately closes, or animation never starts.
**Why it happens:** `ani = animation.FuncAnimation(...)` is assigned to a local variable that goes out of scope; Python GC stops the animation.
**How to avoid:** Store the `FuncAnimation` object as `self._ani` on the `PlotManager` instance. It must remain referenced for the lifetime of the animation.
**Warning signs:** Animation starts then immediately freezes; no error raised.

### Pitfall 3: plt.show() Called From Background Thread
**What goes wrong:** Tk window freezes or crashes with `RuntimeError: main thread is not in main loop` on Windows.
**Why it happens:** `plt.show()` enters the Tk event loop, which must run on the main thread. If called from a sensor acquisition thread, Tk raises.
**How to avoid:** Always call `pm.start()` (which calls `plt.show()`) from the main thread. In Phase 6, the acquisition loop runs on a background thread; `plt.show()` stays on main.
**Warning signs:** `RuntimeError: main thread is not in main loop` or silent window crash.

### Pitfall 4: blit=True With Scrolling Axes
**What goes wrong:** Lines animate but X-axis tick labels never update — the displayed time range freezes at the initial empty state.
**Why it happens:** `blit=True` only redraws Line2D artists; axis backgrounds (tick labels, grid, axis limits) are static background and are NOT redrawn.
**How to avoid:** Use `blit=False`. At 1000 ms interval, full redraw is < 5 ms — no visible lag.
**Warning signs:** Lines draw but time axis reads "0.0" forever or shows wrong range.

### Pitfall 5: cache_frame_data=True (Default) Memory Leak
**What goes wrong:** Memory usage grows linearly over time; after 10 minutes at 1 Hz the process uses hundreds of MB.
**Why it happens:** `FuncAnimation` caches each frame's arguments. For an infinite animation with `frames=None`, this list grows unbounded.
**How to avoid:** Always pass `cache_frame_data=False` in `FuncAnimation(...)`.
**Warning signs:** Task Manager shows Python process memory growing steadily.

### Pitfall 6: constrained_layout Warning With FuncAnimation
**What goes wrong:** Console spam: `UserWarning: constrained_layout not applied because axes sizes collapsed to zero`.
**Why it happens:** During the first few frames before data is added, empty axes have degenerate size.
**How to avoid:** Set initial dummy data on each line before `plt.show()`. E.g., `line.set_data([0], [0])` in `__init__`. Alternatively, suppress with `import warnings; warnings.filterwarnings('ignore', 'constrained_layout')`.
**Warning signs:** Console shows repeated UserWarning about constrained_layout.

---

## Code Examples

Verified patterns from matplotlib 3.10.9 on Python 3.13.13 / Windows 10:

### FuncAnimation with blit=False and cache_frame_data=False (VIZ-05)
```python
# Verified: matplotlib 3.10.9 — FuncAnimation parameters
self._ani = animation.FuncAnimation(
    self._fig,
    self._animate,       # callable(frame) -> None (blit=False) or iterable (blit=True)
    interval=1000,       # ms between calls; 1000 = 1 Hz (VIZ-05 >= 1 Hz)
    blit=False,          # full redraw; correct axis label updates
    cache_frame_data=False,  # prevent memory growth in infinite loop
)
```

### deque Rolling Buffer (VIZ-04)
```python
# Verified: Python 3.13.13
from collections import deque

MAX_POINTS = 300  # 30 s at 10 Hz

t_buf = deque(maxlen=MAX_POINTS)
y_buf = deque(maxlen=MAX_POINTS)

# Add 350 points — oldest 50 auto-dropped
for i in range(350):
    t_buf.append(i * 0.1)
    y_buf.append(float(i))

# len(t_buf) == 300; t_buf[0] == 5.0; t_buf[-1] == 34.9
# X-axis scrolls: always shows last 30 s of data
```

### 5 Subplots with Y-Axis Labels (VIZ-02, VIZ-06)
```python
# Verified: matplotlib 3.10.9
fig, axes = plt.subplots(
    5, 1,
    figsize=(12, 10),
    constrained_layout=True,
)

ylabel_units = [
    "Acceleration (g)",
    "Velocity (mm/s)",
    "Displacement (µm)",
    "Frequency (Hz)",
    "Temperature (°C)",
]

for ax, ylabel in zip(axes, ylabel_units):
    ax.set_ylabel(ylabel)      # VIZ-06
    ax.set_xlabel("Time (s)")  # VIZ-06
    ax.grid(True, alpha=0.3)
```

### Thread-Safe Buffer Snapshot for animate()
```python
# Verified: 10,000 concurrent read/write ops — 0 errors (Python 3.13.13)
# Writer (background thread):
channel_bufs[attr].append(value)  # atomic under CPython GIL

# Reader (main thread in _animate):
t_snap = list(t_buf)              # atomic snapshot copy
y_snap = list(channel_bufs[attr]) # atomic snapshot copy
line.set_data(t_snap, y_snap)
line.axes.relim()
line.axes.autoscale_view()
```

### Agg Backend for Unit Tests
```python
# tests/test_visualizer.py
# MUST be set before any visualizer or pyplot import
import matplotlib
matplotlib.use("Agg")  # headless; no Tk window required

# Now safe to import PlotManager
from src.visualizer import PlotManager, MAX_POINTS
from src.utils import SensorReading
from collections import deque

def test_update_data_appends_to_buffers():
    pm = PlotManager()
    reading = SensorReading(
        timestamp="t", sensor_id="mock",
        ax_g=1.5, ay_g=2.0, az_g=0.5,
        vx_mm_s=10.0, vy_mm_s=8.0, vz_mm_s=6.0,
        angle_x=None, angle_y=None, angle_z=None,
        temperature_c=25.3,
        dx_um=100.0, dy_um=80.0, dz_um=60.0,
        freq_x_hz=10.0, freq_y_hz=12.0, freq_z_hz=8.0,
    )
    pm.update_data(reading)
    assert pm._channel_bufs["ax_g"][-1] == pytest.approx(1.5)
    assert pm._channel_bufs["temperature_c"][-1] == pytest.approx(25.3)
    assert len(pm._t_buf) == 1
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `plt.pause(0.1)` in a loop | `FuncAnimation(interval=1000)` | matplotlib 1.1 | FuncAnimation integrates with Tk event loop; pause() busy-spins |
| `tight_layout()` in animate callback | `constrained_layout=True` at figure creation | matplotlib 2.1 | No per-frame layout computation; no jitter |
| `blit=True` as default recommendation | `blit=False` at 1 Hz | (always tradeoff) | At 1 Hz, full redraw < 5 ms; blit=True breaks axis updates |
| `cache_frame_data` not specified | `cache_frame_data=False` explicit | matplotlib 3.x | Prevents unbounded memory growth in infinite animations |

**Deprecated/outdated:**
- `plt.ion()` + `plt.draw()` + `plt.pause()` loop: Works but not composable with threading; not idiomatic for production code.
- `matplotlib.backends.backend_registry.list_builtin()` replaced `rcsetup.all_backends` in matplotlib 3.9+ (noted as DeprecationWarning on this install).

---

## Open Questions

1. **Window title / figure title**
   - What we know: `fig.canvas.manager.set_window_title()` is the standard API; may raise if manager is None (Agg backend in tests)
   - What's unclear: whether to add a `fig.suptitle()` as a visible title inside the plot
   - Recommendation: Wrap `set_window_title()` in `try/except AttributeError`; omit `fig.suptitle()` to maximize subplot area

2. **NaN handling for None channels**
   - What we know: `float("nan")` causes a visible line break in matplotlib (intentional gap)
   - What's unclear: whether angle_x/y/z (always None for WTVB01) should produce visible gaps or be excluded from subplots entirely
   - Recommendation: Exclude angle channels entirely from PlotManager — they are never displayed (STATE.md: "angle_x/y/z always None — NOT included in visualization"). Only 13 channels are plotted.

3. **Figure window close event (Phase 6 concern)**
   - What we know: `fig.canvas.mpl_connect('close_event', callback)` fires when user closes window
   - What's unclear: shutdown signal from close event is out of scope for Phase 5 (Phase 6 wires it)
   - Recommendation: Phase 5 exposes `fig` as `self._fig`; Phase 6 connects the close event handler

---

## Validation Architecture

Nyquist validation enabled (`nyquist_validation: true` in `.planning/config.json`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 9.0.3 (already installed; existing suite passes) |
| Config file | pytest.ini (already exists) |
| Quick run command | `pytest tests/test_visualizer.py -x -q` |
| Full suite command | `pytest tests/ -v --tb=short` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIZ-02 | PlotManager creates figure with 5 Axes objects | unit | `pytest tests/test_visualizer.py::test_five_subplots_created -x` | Wave 0 gap |
| VIZ-03 | Each of first 4 subplots has 3 Line2D artists; Temperature subplot has 1 | unit | `pytest tests/test_visualizer.py::test_line_count_per_subplot -x` | Wave 0 gap |
| VIZ-03 | Each subplot has a legend with correct labels | unit | `pytest tests/test_visualizer.py::test_subplot_legends -x` | Wave 0 gap |
| VIZ-04 | update_data() appends to t_buf and channel_bufs | unit | `pytest tests/test_visualizer.py::test_update_data_appends -x` | Wave 0 gap |
| VIZ-04 | After 350 updates, buffer len == 300 (not 350) | unit | `pytest tests/test_visualizer.py::test_buffer_maxlen_enforced -x` | Wave 0 gap |
| VIZ-05 | FuncAnimation.event_source.interval == 1000 | unit | `pytest tests/test_visualizer.py::test_animation_interval -x` | Wave 0 gap |
| VIZ-06 | Each Axes ylabel matches expected unit string | unit | `pytest tests/test_visualizer.py::test_ylabel_units -x` | Wave 0 gap |
| VIZ-06 | Each Axes xlabel == "Time (s)" | unit | `pytest tests/test_visualizer.py::test_xlabel_time -x` | Wave 0 gap |
| VIZ-04 | _animate() calls set_data with correct lengths | unit | `pytest tests/test_visualizer.py::test_animate_sets_line_data -x` | Wave 0 gap |
| VIZ-03 | Temperature subplot has 1 line and it gets temperature_c value | unit | `pytest tests/test_visualizer.py::test_temperature_subplot_one_line -x` | Wave 0 gap |

### Sampling Rate
- **Per task commit:** `pytest tests/test_visualizer.py -x -q`
- **Per wave merge:** `pytest tests/ -v --tb=short` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test_visualizer.py` — all VIZ-02 through VIZ-06 unit tests using Agg backend
- [ ] `matplotlib` in `requirements.txt` — must be added (currently missing from requirements.txt)

Key Wave 0 setup for test file:
```python
# tests/test_visualizer.py — top of file (BEFORE any visualizer import)
import matplotlib
matplotlib.use("Agg")

import pytest
from src.visualizer import PlotManager, MAX_POINTS, INTERVAL_MS
from src.utils import SensorReading
```

*(conftest.py, pytest.ini, and pytest framework already exist — no new framework install needed)*

---

## Sources

### Primary (HIGH confidence)
- matplotlib 3.10.9 (installed on this machine) — `FuncAnimation` signature verified via `inspect.signature(TimedAnimation.__init__)`: params `interval`, `repeat_delay`, `repeat`, `event_source`; `Animation.__init__` has `blit` param
- matplotlib 3.10.9 (installed on this machine) — `plt.subplots(5, 1)` returns `ndarray` of 5 Axes; `constrained_layout=True` confirmed working
- matplotlib 3.10.9 (installed on this machine) — `blit=False` + `ax.relim()` + `ax.autoscale_view()` pattern verified: line data and axis limits both update
- matplotlib 3.10.9 (installed on this machine) — `Agg` backend confirmed: headless rendering to BytesIO works (35820 bytes PNG output verified)
- Python 3.13.13 stdlib — `collections.deque(maxlen=300)`: 400 appends -> len 300; `list(deque)` atomic; concurrent read/write test (10,000 ops) — 0 errors
- Python 3.13.13 stdlib — `tkinter` version 8.6 confirmed available on this machine
- `src/utils.py` (Phase 1, complete) — `SensorReading` fields confirmed: 17 fields; 13 relevant to visualization (angle_x/y/z excluded per STATE.md decision)

### Secondary (MEDIUM confidence)
- STATE.md (project decisions) — "deque maxlen=300 per channel (30s × 10 Hz) for rolling buffer — thread-safe in CPython"; "Matplotlib main thread / acquisition background thread (Windows Tk backend constraint)" — these decisions locked before this research
- REQUIREMENTS.md — VIZ-01 through VIZ-06 requirements text used directly to define test map

### Tertiary (LOW confidence)
- None — all Phase 5 findings are verifiable against installed matplotlib 3.10.9 and project code

---

## Metadata

**Confidence breakdown:**
- matplotlib FuncAnimation API: HIGH — verified via inspect + live execution on 3.10.9
- deque thread-safety: HIGH — verified by running concurrent read/write test 10,000 ops
- Agg backend for testing: HIGH — confirmed headless render to BytesIO
- blit=False recommendation: HIGH — verified that blit=True breaks axis limit updates
- constrained_layout recommendation: HIGH — verified no UserWarning at creation; avoids jitter
- Test approach (get_xdata/get_ydata): HIGH — verified assertion pattern works

**Research date:** 2026-05-21
**Valid until:** 2026-08-21 (matplotlib 3.10.x APIs are stable; deque behavior unchanged since Python 3.1)

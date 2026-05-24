# src/gps_reader.py
"""GPSReader: Windows Location API wrapper for WTVB01 Notebook Logger.

Provides non-blocking access to GPS position via get_location().
All exceptions are caught internally — callers always receive a tuple.

Status values:
  "unavailable" — winsdk not installed or GPS hardware absent
  "denied"      — Windows location permission denied by user
  "no_fix"      — API available but no position fix yet
  "ok"          — fix acquired, coordinates valid

Requirements: GPS-01, GPS-02, GPS-08, GPS-09
"""
from __future__ import annotations

import asyncio
import logging

logger = logging.getLogger(__name__)

# Import guard: winsdk may not be installed (GPS-08)
try:
    import winsdk.windows.devices.geolocation as _wdg
    _WINSDK_AVAILABLE = True
except ImportError:
    _wdg = None  # type: ignore[assignment]
    _WINSDK_AVAILABLE = False


class GPSReader:
    """Read GPS position from Windows Location API.

    Thread-safe: get_location() is synchronous and can be called from
    any thread. Uses asyncio.run() per call — acceptable for 1 Hz GPS
    poll rate; no event loop contention with the sensor acquisition thread.

    Usage::

        reader = GPSReader()
        lat, lon, speed = reader.get_location()  # (float, float, float) or (None, None, None)
        print(reader.status)                      # "ok", "no_fix", "denied", "unavailable"
    """

    def __init__(self) -> None:
        if not _WINSDK_AVAILABLE:
            self.status: str = "unavailable"
        else:
            self.status = "no_fix"

    def get_location(self) -> tuple[float | None, float | None, float | None]:
        """Return current GPS fix as (lat, lon, speed_mps) or (None, None, None).

        Never raises. Sets self.status as a side effect:
          - "ok"          on successful fix with valid coordinates
          - "no_fix"      on API available but no fix, or hardware absent
          - "denied"      when Windows location permission is denied
          - "unavailable" when winsdk import failed (set at construction, unchanged here)

        Returns:
            Tuple of (latitude, longitude, speed_mps) as floats, or
            (None, None, None) on any failure or unavailability.
        """
        if not _WINSDK_AVAILABLE:
            return (None, None, None)

        try:
            lat, lon, speed = asyncio.run(self._fetch())
            if lat is None or lon is None:
                self.status = "no_fix"
                return (None, None, None)
            self.status = "ok"
            return (lat, lon, speed)
        except PermissionError:
            self.status = "denied"
            return (None, None, None)
        except Exception as exc:
            logger.debug("GPS fetch failed: %s", exc)
            self.status = "no_fix"
            return (None, None, None)

    async def _fetch(self) -> tuple[float | None, float | None, float]:
        """Async helper that calls the Windows Location API.

        Returns:
            (latitude, longitude, speed_mps) — lat/lon may be None if no fix.

        Raises:
            PermissionError: when Windows denies location access.
            Exception: on any other API failure (caller catches generically).
        """
        locator = _wdg.Geolocator()
        pos = await locator.get_geoposition_async()
        coord = pos.coordinate
        speed = float(coord.speed) if coord.speed is not None else 0.0
        return coord.latitude, coord.longitude, speed

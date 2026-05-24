# src/gps_reader.py
"""GPSReader: Windows Location API wrapper for WTVB01 Notebook Logger.

Provides non-blocking access to GPS position via a poll/cache pattern:
  - poll()        — fetches from Windows Location API (called by background thread at ~1 Hz)
  - get_location() — returns last cached value instantly (called by 10 Hz acquisition loop)

All exceptions are caught internally — callers always receive a tuple.

Status values:
  "unavailable" — winsdk not installed or GPS hardware absent
  "denied"      — Windows location permission denied by user
  "no_fix"      — API available but no position fix yet
  "ok"          — fix acquired, coordinates valid

Requirements: GPS-01, GPS-02, GPS-03, GPS-08, GPS-09
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
    """Read GPS position from Windows Location API using a poll/cache pattern.

    Thread-safe: get_location() returns a cached tuple without any I/O and
    can be called from any thread at 10 Hz with zero blocking.
    poll() does the real async fetch and is called by a background thread at ~1 Hz.

    Usage::

        reader = GPSReader()
        reader.poll()                             # initial fetch (establishes status)
        lat, lon, speed = reader.get_location()   # instant cache read
        print(reader.status)                      # "ok", "no_fix", "denied", "unavailable"
    """

    def __init__(self) -> None:
        if not _WINSDK_AVAILABLE:
            self.status: str = "unavailable"
        else:
            self.status = "no_fix"
        self._cache: tuple[float | None, float | None, float | None] = (None, None, None)

    def get_location(self) -> tuple[float | None, float | None, float | None]:
        """Return last cached GPS fix. Never raises. Background thread keeps cache fresh.

        Returns:
            Tuple of (latitude, longitude, speed_mps) as floats, or
            (None, None, None) when unavailable, no fix, or permission denied.
        """
        return self._cache

    def poll(self) -> None:
        """Fetch from Windows Location API and update cache.

        Called by background thread at ~1 Hz. Sets self.status and self._cache.
        Never raises — all exceptions are caught and result in no_fix status.
        """
        if not _WINSDK_AVAILABLE:
            return
        try:
            lat, lon, speed = asyncio.run(self._fetch())
            if lat is None or lon is None:
                self.status = "no_fix"
                self._cache = (None, None, None)
            else:
                self.status = "ok"
                self._cache = (lat, lon, speed)
        except PermissionError:
            self.status = "denied"
            self._cache = (None, None, None)
        except Exception as exc:
            logger.debug("GPS poll failed: %s", exc)
            self.status = "no_fix"
            self._cache = (None, None, None)

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

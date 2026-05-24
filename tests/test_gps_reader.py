# tests/test_gps_reader.py
"""Unit tests for GPSReader — Windows Location API wrapper.

Tests cover: normal fix, no-fix exception, missing winsdk, permission denied,
status property, speed=None edge case, and poll/cache split.

Requirements: GPS-01, GPS-02, GPS-03, GPS-08, GPS-09
"""
from __future__ import annotations

import sys
import types
import unittest.mock as mock
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Helper: build a fake winsdk module tree so tests work without real winsdk
# ---------------------------------------------------------------------------

def _make_fake_winsdk_module() -> types.ModuleType:
    """Create a minimal fake winsdk package with geolocation submodule."""
    winsdk_mod = types.ModuleType("winsdk")
    winsdk_windows = types.ModuleType("winsdk.windows")
    winsdk_windows_devices = types.ModuleType("winsdk.windows.devices")
    winsdk_windows_devices_geolocation = types.ModuleType(
        "winsdk.windows.devices.geolocation"
    )
    winsdk_mod.windows = winsdk_windows
    winsdk_windows.devices = winsdk_windows_devices
    winsdk_windows_devices.geolocation = winsdk_windows_devices_geolocation
    return winsdk_mod


def _make_fake_position(lat: float, lon: float, speed: float | None) -> MagicMock:
    """Return a mock Geoposition with the given coordinate values."""
    coord = MagicMock()
    coord.latitude = lat
    coord.longitude = lon
    coord.speed = speed

    pos = MagicMock()
    pos.coordinate = coord
    return pos


# ---------------------------------------------------------------------------
# Test 1: poll() updates cache on successful fix
# ---------------------------------------------------------------------------

def test_get_location_returns_tuple_on_fix() -> None:
    """poll() fetches GPS and updates cache; get_location() returns (lat, lon, speed_mps)."""
    fake_winsdk = _make_fake_winsdk_module()
    fake_pos = _make_fake_position(lat=1.23, lon=4.56, speed=2.78)

    mock_locator = MagicMock()
    mock_locator.get_geoposition_async = AsyncMock(return_value=fake_pos)
    fake_winsdk.windows.devices.geolocation.Geolocator = MagicMock(
        return_value=mock_locator
    )

    with patch.dict(
        sys.modules,
        {
            "winsdk": fake_winsdk,
            "winsdk.windows": fake_winsdk.windows,
            "winsdk.windows.devices": fake_winsdk.windows.devices,
            "winsdk.windows.devices.geolocation": fake_winsdk.windows.devices.geolocation,
        },
    ):
        # Force re-import with fake winsdk available
        if "src.gps_reader" in sys.modules:
            del sys.modules["src.gps_reader"]
        if "gps_reader" in sys.modules:
            del sys.modules["gps_reader"]

        from src.gps_reader import GPSReader

        reader = GPSReader()
        reader.poll()
        result = reader.get_location()

    assert result == pytest.approx((1.23, 4.56, 2.78))


# ---------------------------------------------------------------------------
# Test 2: poll() sets no_fix when _fetch raises generic exception
# ---------------------------------------------------------------------------

def test_get_location_returns_none_tuple_on_no_fix() -> None:
    """poll() returns silently on exception; get_location() returns (None, None, None)."""
    fake_winsdk = _make_fake_winsdk_module()

    mock_locator = MagicMock()
    mock_locator.get_geoposition_async = AsyncMock(
        side_effect=Exception("no fix available")
    )
    fake_winsdk.windows.devices.geolocation.Geolocator = MagicMock(
        return_value=mock_locator
    )

    with patch.dict(
        sys.modules,
        {
            "winsdk": fake_winsdk,
            "winsdk.windows": fake_winsdk.windows,
            "winsdk.windows.devices": fake_winsdk.windows.devices,
            "winsdk.windows.devices.geolocation": fake_winsdk.windows.devices.geolocation,
        },
    ):
        if "src.gps_reader" in sys.modules:
            del sys.modules["src.gps_reader"]
        if "gps_reader" in sys.modules:
            del sys.modules["gps_reader"]

        from src.gps_reader import GPSReader

        reader = GPSReader()
        reader.poll()
        result = reader.get_location()

    assert result == (None, None, None)


# ---------------------------------------------------------------------------
# Test 3: GPSReader works when winsdk is not installed
# ---------------------------------------------------------------------------

def test_get_location_returns_none_when_winsdk_unavailable() -> None:
    """GPSReader instantiates without error when winsdk absent; get_location returns (None, None, None)."""
    # Patch sys.modules to simulate ImportError on winsdk import
    blocked_modules = {
        "winsdk": None,
        "winsdk.windows": None,
        "winsdk.windows.devices": None,
        "winsdk.windows.devices.geolocation": None,
    }

    with patch.dict(sys.modules, blocked_modules):
        if "src.gps_reader" in sys.modules:
            del sys.modules["src.gps_reader"]
        if "gps_reader" in sys.modules:
            del sys.modules["gps_reader"]

        from src.gps_reader import GPSReader

        reader = GPSReader()  # Must not raise
        result = reader.get_location()

    assert result == (None, None, None)


# ---------------------------------------------------------------------------
# Test 4: Permission denied sets gps_reader.status == "denied"
# ---------------------------------------------------------------------------

def test_permission_denied_sets_status() -> None:
    """When Windows denies location permission, poll() sets status == 'denied' and cache to (None,None,None)."""
    fake_winsdk = _make_fake_winsdk_module()

    mock_locator = MagicMock()
    mock_locator.get_geoposition_async = AsyncMock(
        side_effect=PermissionError("location access denied")
    )
    fake_winsdk.windows.devices.geolocation.Geolocator = MagicMock(
        return_value=mock_locator
    )

    with patch.dict(
        sys.modules,
        {
            "winsdk": fake_winsdk,
            "winsdk.windows": fake_winsdk.windows,
            "winsdk.windows.devices": fake_winsdk.windows.devices,
            "winsdk.windows.devices.geolocation": fake_winsdk.windows.devices.geolocation,
        },
    ):
        if "src.gps_reader" in sys.modules:
            del sys.modules["src.gps_reader"]
        if "gps_reader" in sys.modules:
            del sys.modules["gps_reader"]

        from src.gps_reader import GPSReader

        reader = GPSReader()
        reader.poll()
        result = reader.get_location()

    assert result == (None, None, None)
    assert reader.status == "denied"


# ---------------------------------------------------------------------------
# Test 5: status == "ok" after successful poll
# ---------------------------------------------------------------------------

def test_status_is_ok_on_successful_fix() -> None:
    """After a successful poll() call, status == 'ok'."""
    fake_winsdk = _make_fake_winsdk_module()
    fake_pos = _make_fake_position(lat=-23.5505, lon=-46.6333, speed=0.5)

    mock_locator = MagicMock()
    mock_locator.get_geoposition_async = AsyncMock(return_value=fake_pos)
    fake_winsdk.windows.devices.geolocation.Geolocator = MagicMock(
        return_value=mock_locator
    )

    with patch.dict(
        sys.modules,
        {
            "winsdk": fake_winsdk,
            "winsdk.windows": fake_winsdk.windows,
            "winsdk.windows.devices": fake_winsdk.windows.devices,
            "winsdk.windows.devices.geolocation": fake_winsdk.windows.devices.geolocation,
        },
    ):
        if "src.gps_reader" in sys.modules:
            del sys.modules["src.gps_reader"]
        if "gps_reader" in sys.modules:
            del sys.modules["gps_reader"]

        from src.gps_reader import GPSReader

        reader = GPSReader()
        reader.poll()

    assert reader.status == "ok"


# ---------------------------------------------------------------------------
# Test 6: status == "unavailable" immediately after construction (no winsdk)
# ---------------------------------------------------------------------------

def test_status_is_unavailable_when_winsdk_missing() -> None:
    """When winsdk is absent, status is 'unavailable' right after construction."""
    blocked_modules = {
        "winsdk": None,
        "winsdk.windows": None,
        "winsdk.windows.devices": None,
        "winsdk.windows.devices.geolocation": None,
    }

    with patch.dict(sys.modules, blocked_modules):
        if "src.gps_reader" in sys.modules:
            del sys.modules["src.gps_reader"]
        if "gps_reader" in sys.modules:
            del sys.modules["gps_reader"]

        from src.gps_reader import GPSReader

        reader = GPSReader()

    assert reader.status == "unavailable"


# ---------------------------------------------------------------------------
# Test 7 (edge case): coord.speed is None → treated as 0.0
# ---------------------------------------------------------------------------

def test_speed_none_is_treated_as_zero() -> None:
    """When coord.speed is None (Windows returns None when speed unavailable), speed_mps == 0.0."""
    fake_winsdk = _make_fake_winsdk_module()
    fake_pos = _make_fake_position(lat=10.0, lon=20.0, speed=None)  # speed=None

    mock_locator = MagicMock()
    mock_locator.get_geoposition_async = AsyncMock(return_value=fake_pos)
    fake_winsdk.windows.devices.geolocation.Geolocator = MagicMock(
        return_value=mock_locator
    )

    with patch.dict(
        sys.modules,
        {
            "winsdk": fake_winsdk,
            "winsdk.windows": fake_winsdk.windows,
            "winsdk.windows.devices": fake_winsdk.windows.devices,
            "winsdk.windows.devices.geolocation": fake_winsdk.windows.devices.geolocation,
        },
    ):
        if "src.gps_reader" in sys.modules:
            del sys.modules["src.gps_reader"]
        if "gps_reader" in sys.modules:
            del sys.modules["gps_reader"]

        from src.gps_reader import GPSReader

        reader = GPSReader()
        reader.poll()
        lat, lon, speed = reader.get_location()

    assert lat == pytest.approx(10.0)
    assert lon == pytest.approx(20.0)
    assert speed == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# Test 8 (edge case): coord.latitude or longitude is None → (None, None, None)
# ---------------------------------------------------------------------------

def test_none_coordinates_return_none_tuple() -> None:
    """When lat or lon is None despite a 'fix', poll() sets no_fix; get_location() returns (None, None, None)."""
    fake_winsdk = _make_fake_winsdk_module()
    fake_pos = _make_fake_position(lat=None, lon=None, speed=0.0)  # no actual coords

    mock_locator = MagicMock()
    mock_locator.get_geoposition_async = AsyncMock(return_value=fake_pos)
    fake_winsdk.windows.devices.geolocation.Geolocator = MagicMock(
        return_value=mock_locator
    )

    with patch.dict(
        sys.modules,
        {
            "winsdk": fake_winsdk,
            "winsdk.windows": fake_winsdk.windows,
            "winsdk.windows.devices": fake_winsdk.windows.devices,
            "winsdk.windows.devices.geolocation": fake_winsdk.windows.devices.geolocation,
        },
    ):
        if "src.gps_reader" in sys.modules:
            del sys.modules["src.gps_reader"]
        if "gps_reader" in sys.modules:
            del sys.modules["gps_reader"]

        from src.gps_reader import GPSReader

        reader = GPSReader()
        reader.poll()
        result = reader.get_location()

    assert result == (None, None, None)


# ---------------------------------------------------------------------------
# Test 9: get_location() returns cache without calling _fetch
# ---------------------------------------------------------------------------

def test_get_location_returns_cache() -> None:
    """get_location() returns self._cache immediately — poll() updates it, _fetch is not called by get_location."""
    fake_winsdk = _make_fake_winsdk_module()
    fake_pos = _make_fake_position(lat=5.0, lon=6.0, speed=1.0)

    mock_locator = MagicMock()
    mock_locator.get_geoposition_async = AsyncMock(return_value=fake_pos)
    fake_winsdk.windows.devices.geolocation.Geolocator = MagicMock(
        return_value=mock_locator
    )

    with patch.dict(
        sys.modules,
        {
            "winsdk": fake_winsdk,
            "winsdk.windows": fake_winsdk.windows,
            "winsdk.windows.devices": fake_winsdk.windows.devices,
            "winsdk.windows.devices.geolocation": fake_winsdk.windows.devices.geolocation,
        },
    ):
        if "src.gps_reader" in sys.modules:
            del sys.modules["src.gps_reader"]
        if "gps_reader" in sys.modules:
            del sys.modules["gps_reader"]

        from src.gps_reader import GPSReader

        reader = GPSReader()

        # Before poll: cache is (None, None, None)
        assert reader.get_location() == (None, None, None)

        # After poll: cache is updated
        reader.poll()
        result = reader.get_location()

    assert result == pytest.approx((5.0, 6.0, 1.0))

    # get_location() should NOT have triggered additional _fetch calls beyond poll()
    # (poll called once → get_geoposition_async called exactly once)
    assert mock_locator.get_geoposition_async.call_count == 1

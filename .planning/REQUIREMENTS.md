# Requirements: WTVB01 Notebook Logger

**Defined:** 2026-05-24
**Milestone:** v1.2 GPS Data Integration
**Core Value:** O sensor deve conectar, ler e salvar dados confiáveis em CSV — se isso não funcionar, nada mais importa.

## v1.2 Requirements

### GPS Reader

- [ ] **GPS-01**: System reads latitude, longitude, and speed from Windows Location API via `src/gps_reader.py`
- [ ] **GPS-02**: `GPSReader.get_location()` returns `(lat, lon, speed_mps)` or `(None, None, None)` when no GPS fix
- [ ] **GPS-03**: GPS polling is non-blocking — does not delay the 10 Hz sensor acquisition loop (runs in background thread)
- [ ] **GPS-04**: Terminal shows GPS status at startup: "GPS: fix acquired" or "GPS: no fix — CSV columns will be empty"

### Data Model

- [ ] **GPS-05**: `SensorReading` dataclass (in `utils.py`) gains `gps_lat`, `gps_lon`, `gps_speed_mps` fields (`float | None`)

### CSV Integration

- [ ] **GPS-06**: CSV header always includes `gps_lat`, `gps_lon`, `gps_speed_mps` as the last 3 columns
- [ ] **GPS-07**: Each CSV row contains current GPS values; `None` written as empty string (same pattern as angle RESERVED registers)

### Resilience

- [ ] **GPS-08**: If Windows Location API is unavailable (no GPS hardware, API import error) — app starts normally, GPS columns remain empty, no crash or exception propagated
- [ ] **GPS-09**: If Windows location permission is denied, terminal shows actionable message: "GPS: location access denied — enable in Windows Settings › Privacy › Location"

## v2 Requirements (Deferred)

### GPS Extended

- **GPS-EXT-01**: Altitude column (`gps_alt_m`) added to CSV
- **GPS-EXT-02**: GPS accuracy/HDOP column for post-processing quality filter
- **GPS-EXT-03**: GPS fix quality indicator (fix type: none / 2D / 3D)
- **GPS-EXT-04**: Configurable GPS poll rate separate from sensor acquisition rate

### Visualization

- **VIZ-07**: Configurable time window via `config.yaml` (`plot_window_seconds`)
- **VIZ-08**: Selective channel display (show/hide individual subplots)
- **VIZ-09**: Peak detection annotations on acceleration subplot
- **VIZ-10**: Dark mode / light mode toggle

## Out of Scope

| Feature | Reason |
|---------|--------|
| External USB GPS receiver (NMEA serial) | Windows Location API covers built-in GPS; external NMEA adds serial port complexity |
| Altitude in v1.2 | Not requested; deferred to v2 |
| IP-based geolocation fallback | Inaccurate for field measurements; misleading in CSV |
| `--gps` opt-in flag | User chose always-on; columns always present for consistency |
| GPS in GUI visualization subplots | GPS is position data, not time-series vibration — display scope different |

## Traceability

Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| GPS-01 | Phase 7 | Pending |
| GPS-02 | Phase 7 | Pending |
| GPS-03 | Phase 7 | Pending |
| GPS-04 | Phase 7 | Pending |
| GPS-05 | Phase 7 | Pending |
| GPS-06 | Phase 8 | Pending |
| GPS-07 | Phase 8 | Pending |
| GPS-08 | Phase 7 | Pending |
| GPS-09 | Phase 7 | Pending |

**Coverage:**
- v1.2 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-24*
*Last updated: 2026-05-24 after initial definition*

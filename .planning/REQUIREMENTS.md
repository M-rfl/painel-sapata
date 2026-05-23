# Requirements: WTVB01 Notebook Logger

**Defined:** 2026-05-21
**Core Value:** O sensor deve conectar, ler e salvar dados confiáveis em CSV — se isso não funcionar, nada mais importa.

## v1.1 Requirements

### VIZ — Visualization

- [x] **VIZ-01**: User can launch a live graph window alongside normal acquisition using `python main.py --gui`
- [x] **VIZ-02**: Visualization window shows 5 subplots: Acceleration (g), Velocity (mm/s), Displacement (µm), Frequency (Hz), Temperature (°C)
- [x] **VIZ-03**: Each subplot shows X, Y, Z channel lines with a legend (Temperature subplot: 1 line only)
- [x] **VIZ-04**: Each subplot displays the last 30 seconds of data as a scrolling window (300 points at 10 Hz)
- [x] **VIZ-05**: Graph animation updates at ≥ 1 Hz so the user sees measurements changing live
- [x] **VIZ-06**: Each subplot Y-axis is labeled with measurement name and physical unit; X-axis shows elapsed time in seconds

### INTG — Integration

- [ ] **INTG-01**: Running `python main.py` without `--gui` behaves identically to v1.0 (zero regression)
- [ ] **INTG-02**: CSV logging writes every reading to file when `--gui` is active (no data loss)
- [ ] **INTG-03**: Sensor acquisition runs in a background thread when `--gui` is active; matplotlib animation runs on main thread
- [ ] **INTG-04**: Closing the graph window triggers graceful shutdown with terminal session summary (equivalent to Ctrl+C)

## v1.2+ Requirements (Deferred)

### Visualization Enhancements

- **VIZ-07**: Configurable time window via `config.yaml` (`plot_window_seconds`)
- **VIZ-08**: Selective channel display (show/hide individual subplots)
- **VIZ-09**: Peak detection annotations on acceleration subplot
- **VIZ-10**: Dark mode / light mode toggle

## Out of Scope

| Feature | Reason |
|---------|--------|
| Pause/resume button in graph | Complexity without clear benefit for bench monitoring |
| Zoom/pan in live plot | Conflicts with FuncAnimation scroll mode |
| Save plot as image | Not requested; CSV already archives all data |
| Multiple sensor visualization | Still 1 sensor per session (v1.0 constraint) |
| Graph-only mode (no CSV) | CSV is core value — always logged |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| VIZ-01 | Phase 5 | Complete |
| VIZ-02 | Phase 5 | Complete |
| VIZ-03 | Phase 5 | Complete |
| VIZ-04 | Phase 5 | Complete |
| VIZ-05 | Phase 5 | Complete |
| VIZ-06 | Phase 5 | Complete |
| INTG-01 | Phase 6 | Pending |
| INTG-02 | Phase 6 | Pending |
| INTG-03 | Phase 6 | Pending |
| INTG-04 | Phase 6 | Pending |

**Coverage:**
- v1.1 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-21*
*Last updated: 2026-05-21 — traceability filled (roadmap created)*

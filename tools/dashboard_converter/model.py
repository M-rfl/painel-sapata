"""Shared dataclass contracts for every converter module."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal

ACCEL_PER_G = 2048
FLAG_SEM_GPS = 1            # sample has no coordinate
FLAG_EDGE = 2               # before first / after last station seen in its segment
FLAG_INFERRED_STATION = 4   # sample's trecho starts or ends at an inferred (not hit) station
GPS_STATUS_ORIGINAL = 0
GPS_STATUS_RECOVERED = 1    # coordinate recovered from a mangled pt-BR cell


class StructuralError(Exception):
    """Missing columns, unreadable file, empty run, row-count mismatch: abort the run."""


@dataclass
class ValueIssue:
    """A single cell that could not be recovered (or was resolved by rule)."""
    file: str
    line: int                 # 1-based physical line in the source file
    column: str
    raw: str
    reason: str               # 'unrecoverable' | 'off_grid' | 'out_of_range' | 'out_of_envelope' | 'no_neighbours' | 'ambiguous_resolved_by_rule'
    value: float | None = None  # value kept (only for 'ambiguous_resolved_by_rule'), else None


@dataclass
class SourceFile:
    name: str
    sha256: str
    rows: int
    delimiter: str            # ',' or ';'
    mode: str                 # 'plain' (comma file) | 'ptbr' (';' Excel re-save, recovery enabled)


@dataclass
class RunData:
    sources: list[SourceFile]
    timestamps: list[datetime]               # tz-aware, ascending (stable sort)
    origin: list[tuple[int, int]]            # (index into sources, 1-based line number)
    ax: list[int | None]                     # accel LSB counts, 1/2048 g
    ay: list[int | None]
    az: list[int | None]
    vel: dict[str, list[float | None]]       # keys 'x','y','z'; mm/s
    disp: dict[str, list[float | None]]      # keys 'x','y','z'; um
    freq: dict[str, list[float | None]]      # keys 'x','y','z'; Hz
    temp: list[float | None]                 # deg C
    lat: list[Decimal | None]
    lon: list[Decimal | None]
    gps_status: list[int]                    # GPS_STATUS_*; only meaningful where lat is not None
    sensor_id: str
    issues: list[ValueIssue] = field(default_factory=list)
    recovery_stats: dict[str, int] = field(default_factory=dict)

    @property
    def n(self) -> int:
        return len(self.timestamps)


@dataclass(frozen=True)
class Station:
    code: str
    name: str                 # name as written in the station file (e.g. 'PRAÇA XV')
    lat: float
    lon: float


@dataclass(frozen=True)
class Direction:
    line_id: int
    index: int                # 0 = first direction block in the file (-> "Sentido 1")
    stations: tuple[Station, ...]

    @property
    def from_code(self) -> str:
        return self.stations[0].code

    @property
    def to_code(self) -> str:
        return self.stations[-1].code

    @property
    def codes(self) -> tuple[str, ...]:
        return tuple(s.code for s in self.stations)


@dataclass
class LineDef:
    line_id: int              # from the FILE NAME digits (Line2 file has a wrong 'LINHA 4:' banner)
    name: str                 # 'Linha <id>'
    source_file: str
    directions: list[Direction]

    @property
    def codes(self) -> set[str]:
        return {c for d in self.directions for c in d.codes}

    @property
    def terminals(self) -> set[str]:
        return {c for d in self.directions for c in (d.from_code, d.to_code)}


@dataclass
class StationWarning:
    kind: str                 # 'identical_coordinates' | 'conflicting_coordinates' | 'geofence_overlap' | 'unparsed_line' | 'duplicate_code_in_direction' | 'header_mismatch'
    message: str
    file: str | None = None
    line_no: int | None = None


@dataclass
class SentidoDef:
    code: str                 # e.g. 'TIG-PXV'
    name: str                 # e.g. 'Sentido 1 — Terminal Gentileza → Praça XV'
    direction_index: int


@dataclass
class TrechoDef:
    id: str                   # station-code key, e.g. 'COT-SAR'
    name: str                 # workbook display name
    sentido: int              # index into Assignment.sentidos
    order: int                # 1-based route order across both sentidos
    from_code: str
    to_code: str


@dataclass
class LineScore:
    line_id: int
    score: float
    in_line: int
    off_line: int
    terminals: int


@dataclass
class StationPassage:
    sentido: int
    segment: int              # 0-based sentido segment number in the run timeline
    code: str
    status: str               # 'hit' | 'inferred' | 'not_reached'
    min_dist_m: float | None
    boundary_idx: int | None  # sample index where the trecho leaving this station starts


@dataclass
class Turnaround:
    index: int                # first sample of the new sentido
    method: str               # 'terminal' | 'reversal'
    terminal_code: str
    gap_s: float | None       # largest inter-sample gap inside the turnaround window (reported, not used)


@dataclass
class Assignment:
    line_id: int
    line_scores: list[LineScore]
    ambiguous: bool
    sentidos: list[SentidoDef]
    trechos: list[TrechoDef]
    sentido_runs: list[tuple[int, int]]      # (start_index, sentido index), first start = 0
    trecho_runs: list[tuple[int, int]]       # (start_index, trecho index), first start = 0
    flag_runs: list[tuple[int, int]]         # (start_index, FLAG_* bitmask), first start = 0
    passages: list[StationPassage]
    stations_not_hit: list[tuple[int, str, float | None]]   # (sentido, code, min_dist_m)
    turnarounds: list[Turnaround]
    notes: list[str]


@dataclass
class GpsFixes:
    lat: list[float]                         # one entry per contiguous 6-dp coordinate run
    lon: list[float]
    loc: list[int]                           # loc id per fix; equal 6-dp key -> equal id
    loc_keys: list[str]                      # loc id -> 'lat6,lon6' key string
    speed_kmh: list[float | None]
    status: list[int]                        # GPS_STATUS_* (1 if any sample in the run was recovered)
    fix_runs: list[tuple[int, int]]          # (start_index, fix index or -1 = sem GPS), first start = 0
    sample_key: list[str | None]             # per-sample 'lat6,lon6' key or None

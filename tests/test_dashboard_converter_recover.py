from decimal import Decimal

import pytest

from tools.dashboard_converter.recover import (
    alternative_accel_reading,
    is_thousands_shaped,
    parse_plain,
    recover_accel,
    recover_gps,
    resolve_scaled,
    scaled_candidates,
)


@pytest.mark.parametrize(
    "text,expected",
    [
        ("0.05419921875", (111, "plain")),
        ("0.375", (768, "plain")),
        ("-0.125", (-256, "plain")),
        ("-10.625", (-2176, "k")),
        ("-103.125", (-2112, "k")),
        ("-12.578.125", (-2576, "k")),
        ("-1.037.109.375", (-2124, "k")),
        ("1.016.357.421.875", (20815, "k-1")),
        ("1.125", (2304, "k")),
        ("", (None, "empty")),
        ("1.234.567", (None, "off_grid")),
        ("abc", (None, "unrecoverable")),
    ],
)
def test_recover_accel(text, expected):
    assert recover_accel(text) == expected


def test_accel_decimal_comma_in_ptbr():
    assert recover_accel("0,375", ptbr=True) == (768, "plain")


def test_accel_plain_mode_no_thousands_recovery():
    assert recover_accel("-10.625", ptbr=False) == (-21760, "plain")


def test_accel_out_of_range():
    assert recover_accel("20.0")[0] is None
    assert recover_accel("20.0")[1] == "out_of_range"


def test_gps():
    assert recover_gps("-2.289.879.276.454.220", "lat") == (Decimal("-22.89879276454220"), "recovered")
    assert recover_gps("-4.321.121.748.034.330", "lon") == (Decimal("-43.21121748034330"), "recovered")
    assert recover_gps("-22.902.445", "lat") == (Decimal("-22.902445"), "recovered")
    assert recover_gps("-22.902445757162067", "lat") == (Decimal("-22.902445757162067"), "plain")
    assert recover_gps("-2.389.879.276.454.220", "lat") == (None, "out_of_envelope")
    assert recover_gps("", "lat") == (None, "empty")
    assert recover_gps("zzz", "lat") == (None, "unrecoverable")


def test_scaled_candidates():
    assert scaled_candidates("21.650.000.000.000.000") == [2.165, 21.65, 216.5]
    assert scaled_candidates("-19.000.000.000.000.000") == [-1.9, -19.0, -190.0]


def test_is_thousands_shaped():
    assert is_thousands_shaped("-10.625")
    assert not is_thousands_shaped("0.375")
    assert not is_thousands_shaped("22.28")


def test_resolve_scaled():
    assert resolve_scaled("21.650.000.000.000.000", "temp", [21.71, 21.7]) == (21.65, "neighbour")
    assert resolve_scaled("19.000.000.000.000.000", "freq", [2.0, 1.8]) == (1.9, "neighbour")
    assert resolve_scaled("16.500.000.000.000.000", "vel", [1.5]) == (1.65, "neighbour")
    assert resolve_scaled("21.650.000.000.000.000", "temp", [], column_median=21.7) == (21.65, "column_median")
    assert resolve_scaled("21.650.000.000.000.000", "temp", []) == (None, "no_neighbours")


def test_resolve_scaled_out_of_range():
    assert resolve_scaled("-19.000.000.000.000.000", "vel", [1.9]) == (None, "out_of_range")


def test_parse_plain():
    assert parse_plain("22.28") == 22.28
    assert parse_plain("") is None
    assert parse_plain("2,5", ptbr=True) == 2.5
    with pytest.raises(ValueError):
        parse_plain("x")


def test_alternative_reading():
    assert alternative_accel_reading("-1.037.109.375") == -21240
    assert alternative_accel_reading("0.375") is None

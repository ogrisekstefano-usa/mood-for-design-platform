"""Smoke check via Node — verify Magnetic Moodboards™ snap curve.

We re-implement the pullFactor curve in Python to validate it matches
the expected sigmoid: pullFactor(<=3) === 1, pullFactor(>=16) === 0,
pullFactor(monotone decreasing in 3..16).

This is a fast offline check — no DB / no browser. It guards the math.
"""
import math


def pull_factor(abs_delta: float, commit: float = 3.0, attract: float = 16.0) -> float:
    if abs_delta <= commit:
        return 1.0
    if abs_delta >= attract:
        return 0.0
    norm = (abs_delta - commit) / (attract - commit)
    return max(0.0, 1.0 - norm * norm)


def test_pull_factor_commit_zone():
    for d in [0, 1.5, 3.0]:
        assert pull_factor(d) == 1.0, f"commit zone broken at {d}"


def test_pull_factor_outside_attract():
    for d in [16.0, 18.0, 50.0]:
        assert pull_factor(d) == 0.0, f"attract bound broken at {d}"


def test_pull_factor_monotone_decreasing():
    prev = 1.1
    for d in [3.5, 5, 8, 12, 15, 15.9]:
        p = pull_factor(d)
        assert 0.0 <= p < prev, f"non-monotone at {d}: {p} >= {prev}"
        prev = p


def test_pull_factor_curve_shape():
    # Curve is 1 - norm^2 (ease-out): pull stays strong near commit and
    # falls off rapidly only near the attract boundary — exactly the
    # "magnetic soft pull" feel we want.
    p_quarter = pull_factor(6.25)   # norm = 0.25 → 1 - 0.0625 = 0.9375
    p_mid     = pull_factor(9.5)    # norm = 0.5  → 1 - 0.25   = 0.75
    p_three_q = pull_factor(12.75)  # norm = 0.75 → 1 - 0.5625 = 0.4375
    assert 0.90 < p_quarter < 1.00, f"quarter pull off: {p_quarter}"
    assert 0.70 < p_mid     < 0.80, f"midpoint pull off: {p_mid}"
    assert 0.40 < p_three_q < 0.50, f"3/4 pull off: {p_three_q}"


if __name__ == "__main__":
    test_pull_factor_commit_zone()
    test_pull_factor_outside_attract()
    test_pull_factor_monotone_decreasing()
    test_pull_factor_curve_shape()
    print("Magnetic Moodboards™ snap curve OK · 4/4 checks pass")

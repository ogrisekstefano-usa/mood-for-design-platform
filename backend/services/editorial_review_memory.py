"""ITER136 · Editorial Review Memory — persistent approve/lock/version layer.

Stores every reviewed rewrite the studio approves or locks, plus its
revision chain. Backed by SQLite (`runtime_leaks.db` reused as the
single governance DB).

Schema:

    editorial_reviews(
        id          TEXT PRIMARY KEY,    -- sha1(key|target|source|variant|atelier)
        registry_key TEXT,
        target_locale TEXT,
        source_text  TEXT,
        source_locale TEXT,
        rewrite_text TEXT,
        atelier_id   TEXT,
        variant      TEXT,
        status       TEXT,                -- 'pending' | 'approved' | 'rejected' | 'locked'
        rationale    TEXT,
        model        TEXT,
        created_at   TEXT,
        updated_at   TEXT,
        created_by   TEXT,
        version      INTEGER DEFAULT 1
    )
    editorial_review_versions(
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        review_id    TEXT,
        rewrite_text TEXT,
        status       TEXT,
        atelier_id   TEXT,
        variant      TEXT,
        ts           TEXT,
        actor        TEXT,
        FOREIGN KEY (review_id) REFERENCES editorial_reviews(id)
    )
"""
from __future__ import annotations

import hashlib
import json
import sqlite3
import time
from pathlib import Path
from typing import Optional

DB_PATH = Path("/app/governance/runtime_leaks.db")


def _conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), timeout=5)
    conn.row_factory = sqlite3.Row
    return conn


def init_schema() -> None:
    with _conn() as conn:
        conn.execute("""
          CREATE TABLE IF NOT EXISTS editorial_reviews (
            id TEXT PRIMARY KEY,
            registry_key TEXT,
            target_locale TEXT,
            source_text TEXT,
            source_locale TEXT,
            rewrite_text TEXT,
            atelier_id TEXT,
            variant TEXT,
            status TEXT,
            rationale TEXT,
            model TEXT,
            created_at TEXT,
            updated_at TEXT,
            created_by TEXT,
            version INTEGER DEFAULT 1
          )
        """)
        conn.execute("""
          CREATE TABLE IF NOT EXISTS editorial_review_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            review_id TEXT,
            rewrite_text TEXT,
            status TEXT,
            atelier_id TEXT,
            variant TEXT,
            ts TEXT,
            actor TEXT
          )
        """)
        conn.execute("""
          CREATE INDEX IF NOT EXISTS ix_editorial_reviews_key
          ON editorial_reviews(registry_key, target_locale)
        """)
        conn.commit()


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _id(key: str, target_locale: str, source_text: str,
        atelier_id: str = "", variant: str = "") -> str:
    raw = f"{key}|{target_locale}|{source_text}|{atelier_id}|{variant}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


# ────────── Public API ────────────────────────────────────────────────
def upsert_review(
    *, registry_key: str, target_locale: str, source_text: str,
    source_locale: str, rewrite_text: str,
    atelier_id: str = "", variant: str = "",
    rationale: Optional[str] = None, model: Optional[str] = None,
    status: str = "pending", actor: str = "system",
) -> dict:
    init_schema()
    rid = _id(registry_key, target_locale, source_text, atelier_id, variant)
    now = _now()
    with _conn() as conn:
        row = conn.execute(
            "SELECT version, status FROM editorial_reviews WHERE id=?", (rid,)
        ).fetchone()
        if row:
            new_version = (row["version"] or 1) + 1
            conn.execute("""
              UPDATE editorial_reviews SET
                rewrite_text=?, status=?, rationale=?, model=?,
                updated_at=?, version=?
              WHERE id=?
            """, (rewrite_text, status, rationale, model, now, new_version, rid))
        else:
            new_version = 1
            conn.execute("""
              INSERT INTO editorial_reviews
                (id, registry_key, target_locale, source_text, source_locale,
                 rewrite_text, atelier_id, variant, status, rationale, model,
                 created_at, updated_at, created_by, version)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            """, (rid, registry_key, target_locale, source_text, source_locale,
                  rewrite_text, atelier_id, variant, status, rationale, model,
                  now, now, actor))
        conn.execute("""
          INSERT INTO editorial_review_versions
            (review_id, rewrite_text, status, atelier_id, variant, ts, actor)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (rid, rewrite_text, status, atelier_id, variant, now, actor))
        conn.commit()
    return get_review(rid)


def set_status(review_id: str, status: str, actor: str = "system") -> dict:
    if status not in ("pending", "approved", "rejected", "locked"):
        raise ValueError(f"invalid status: {status}")
    init_schema()
    now = _now()
    with _conn() as conn:
        cur = conn.execute(
            "UPDATE editorial_reviews SET status=?, updated_at=? WHERE id=?",
            (status, now, review_id),
        )
        if cur.rowcount == 0:
            return {}
        # Read fresh row to insert version snapshot.
        row = conn.execute(
            "SELECT rewrite_text, atelier_id, variant FROM editorial_reviews WHERE id=?",
            (review_id,)
        ).fetchone()
        conn.execute("""
          INSERT INTO editorial_review_versions
            (review_id, rewrite_text, status, atelier_id, variant, ts, actor)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (review_id, row["rewrite_text"], status,
              row["atelier_id"], row["variant"], now, actor))
        conn.commit()
    return get_review(review_id)


def get_review(review_id: str) -> dict:
    init_schema()
    with _conn() as conn:
        row = conn.execute(
            "SELECT * FROM editorial_reviews WHERE id=?", (review_id,)
        ).fetchone()
    return dict(row) if row else {}


def list_reviews(
    *, registry_key: Optional[str] = None,
    target_locale: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 200,
) -> list[dict]:
    init_schema()
    where, params = [], []
    if registry_key:
        where.append("registry_key = ?")
        params.append(registry_key)
    if target_locale:
        where.append("target_locale = ?")
        params.append(target_locale)
    if status:
        where.append("status = ?")
        params.append(status)
    sql = "SELECT * FROM editorial_reviews"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY updated_at DESC LIMIT ?"
    params.append(limit)
    with _conn() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [dict(r) for r in rows]


def list_versions(review_id: str) -> list[dict]:
    init_schema()
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM editorial_review_versions "
            "WHERE review_id=? ORDER BY ts DESC",
            (review_id,)
        ).fetchall()
    return [dict(r) for r in rows]

#!/usr/bin/env python3
"""
Export only teams + players from the local SQLite DB into a SQL seed file.

Usage:
  python scripts/export_seed.py --db fpl_auction.db --out seeds/teams_players_seed.sql
"""

from __future__ import annotations

import argparse
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


TABLES_TO_EXPORT = ("team", "player")


def sql_literal(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return repr(value)
    if isinstance(value, bytes):
        return "X'" + value.hex() + "'"
    text = str(value).replace("'", "''")
    return f"'{text}'"


def get_table_columns(conn: sqlite3.Connection, table: str) -> list[str]:
    cur = conn.execute(f"PRAGMA table_info({table})")
    return [row[1] for row in cur.fetchall()]


def table_exists(conn: sqlite3.Connection, table: str) -> bool:
    cur = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?",
        (table,),
    )
    return cur.fetchone() is not None


def fetch_rows(conn: sqlite3.Connection, table: str, columns: Iterable[str]) -> list[sqlite3.Row]:
    col_list = ", ".join(columns)
    order_clause = "id" if "id" in columns else "rowid"
    cur = conn.execute(f"SELECT {col_list} FROM {table} ORDER BY {order_clause}")
    return cur.fetchall()


def render_insert(table: str, columns: list[str], row: sqlite3.Row) -> str:
    col_sql = ", ".join(columns)
    value_sql = ", ".join(sql_literal(row[col]) for col in columns)
    return f"INSERT INTO {table} ({col_sql}) VALUES ({value_sql});"


def build_seed_sql(conn: sqlite3.Connection) -> tuple[str, dict[str, int]]:
    lines: list[str] = []
    counts: dict[str, int] = {}

    now = datetime.now(timezone.utc).isoformat()
    lines.append("-- FPL Auction teams+players seed")
    lines.append(f"-- Generated at: {now}")
    lines.append("PRAGMA foreign_keys = OFF;")
    lines.append("BEGIN TRANSACTION;")
    lines.append("")
    lines.append("-- Reset exported tables")
    lines.append("DELETE FROM player;")
    lines.append("DELETE FROM team;")
    lines.append("DELETE FROM sqlite_sequence WHERE name IN ('player', 'team');")
    lines.append("")

    for table in TABLES_TO_EXPORT:
        if not table_exists(conn, table):
            counts[table] = 0
            lines.append(f"-- Skipped missing table: {table}")
            continue

        columns = get_table_columns(conn, table)
        rows = fetch_rows(conn, table, columns)
        counts[table] = len(rows)

        lines.append(f"-- {table} rows: {len(rows)}")
        for row in rows:
            lines.append(render_insert(table, columns, row))
        lines.append("")

    lines.append("COMMIT;")
    lines.append("PRAGMA foreign_keys = ON;")
    lines.append("")
    return ("\n".join(lines), counts)


def main() -> None:
    parser = argparse.ArgumentParser(description="Export teams/players SQL seed from SQLite DB.")
    parser.add_argument("--db", default="fpl_auction.db", help="Path to sqlite db file.")
    parser.add_argument(
        "--out",
        default="seeds/teams_players_seed.sql",
        help="Output SQL seed file path.",
    )
    args = parser.parse_args()

    db_path = Path(args.db)
    out_path = Path(args.out)

    if not db_path.exists():
        raise FileNotFoundError(f"Database file not found: {db_path}")

    out_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        sql, counts = build_seed_sql(conn)
    finally:
        conn.close()

    out_path.write_text(sql, encoding="utf-8")
    print(f"Wrote seed SQL: {out_path}")
    for table in TABLES_TO_EXPORT:
        print(f"  {table}: {counts.get(table, 0)} rows")


if __name__ == "__main__":
    main()

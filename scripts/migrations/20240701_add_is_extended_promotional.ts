#!/usr/bin/env bun
import Database from "better-sqlite3";

// Migration to add is_extended_promotional flag based on preferred=1 AND basic=0
const db = new Database("./db.sqlite3");
const tables = [
  "resistor",
  // TODO: extend to other derived tables as needed
];
for (const table of tables) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!info.some(col => col.name === "is_extended_promotional")) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN is_extended_promotional INTEGER NOT NULL DEFAULT 0`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_${table}_is_extended_promotional ON ${table}(is_extended_promotional)`).run();
    // Backfill: set 1 where preferred=1 AND basic=0
    db.prepare(`UPDATE ${table} SET is_extended_promotional = 1 WHERE is_preferred = 1 AND is_basic = 0`).run();
  }
}
db.close();

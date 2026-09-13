import { createClient } from '@libsql/client'
import crypto from 'node:crypto'

const url = process.env.DATABASE_URL || 'file:./fasalyn-production.db'
export const db = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN })
export const id = () => crypto.randomUUID()
export const now = () => new Date().toISOString()

export async function initDb() {
  await db.batch([
    'PRAGMA foreign_keys = ON',
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('FARMER','OFFICER','EXPERT','ADMIN')), created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS farms (id TEXT PRIMARY KEY, farmer_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, latitude REAL, longitude REAL, polygon_geometry TEXT, area_square_meters REAL, area_unit TEXT DEFAULT 'square metres', crop TEXT, variety TEXT, planting_date TEXT, growth_stage TEXT, monitoring_mode TEXT NOT NULL DEFAULT 'QUICK_DETECTION', created_at TEXT NOT NULL, updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS plots (id TEXT PRIMARY KEY, farm_id TEXT NOT NULL REFERENCES farms(id), name TEXT NOT NULL, crop TEXT NOT NULL, crop_stage TEXT, polygon_geometry TEXT, area_square_meters REAL, area_unit TEXT DEFAULT 'square metres', variety TEXT, planting_date TEXT, created_at TEXT NOT NULL, updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS scans (id TEXT PRIMARY KEY, plot_id TEXT NOT NULL REFERENCES plots(id), user_id TEXT NOT NULL REFERENCES users(id), image_key TEXT NOT NULL, mime_type TEXT NOT NULL, status TEXT NOT NULL, model_id TEXT, result_json TEXT, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS trap_observations (id TEXT PRIMARY KEY, plot_id TEXT NOT NULL REFERENCES plots(id), user_id TEXT NOT NULL REFERENCES users(id), trap_type TEXT NOT NULL, pest TEXT NOT NULL, count INTEGER NOT NULL CHECK(count >= 0), observed_at TEXT NOT NULL, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS risk_assessments (id TEXT PRIMARY KEY, plot_id TEXT NOT NULL REFERENCES plots(id), scan_id TEXT REFERENCES scans(id), score INTEGER, level TEXT NOT NULL, factors_json TEXT NOT NULL, forecast_json TEXT NOT NULL, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS officer_cases (id TEXT PRIMARY KEY, scan_id TEXT NOT NULL UNIQUE REFERENCES scans(id), status TEXT NOT NULL, severity TEXT, assigned_to TEXT REFERENCES users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES officer_cases(id), reviewer_id TEXT NOT NULL REFERENCES users(id), decision TEXT NOT NULL, notes TEXT, created_at TEXT NOT NULL)`
    ,'CREATE INDEX IF NOT EXISTS idx_farms_farmer ON farms(farmer_id)'
    ,'CREATE INDEX IF NOT EXISTS idx_plots_farm ON plots(farm_id)'
    ,'CREATE INDEX IF NOT EXISTS idx_scans_plot_created ON scans(plot_id,created_at)'
    ,'CREATE INDEX IF NOT EXISTS idx_traps_plot_observed ON trap_observations(plot_id,observed_at)'
    ,'CREATE INDEX IF NOT EXISTS idx_risk_plot_created ON risk_assessments(plot_id,created_at)'
    ,'CREATE INDEX IF NOT EXISTS idx_cases_status ON officer_cases(status,updated_at)'
  ], 'write')
  await ensureColumn('farms', 'polygon_geometry', 'TEXT')
  await ensureColumn('farms', 'area_square_meters', 'REAL')
  await ensureColumn('farms', 'area_unit', "TEXT DEFAULT 'square metres'")
  await ensureColumn('farms', 'crop', 'TEXT')
  await ensureColumn('farms', 'variety', 'TEXT')
  await ensureColumn('farms', 'planting_date', 'TEXT')
  await ensureColumn('farms', 'growth_stage', 'TEXT')
  await ensureColumn('farms', 'monitoring_mode', "TEXT NOT NULL DEFAULT 'QUICK_DETECTION'")
  await ensureColumn('farms', 'updated_at', 'TEXT')
  await ensureColumn('plots', 'polygon_geometry', 'TEXT')
  await ensureColumn('plots', 'area_square_meters', 'REAL')
  await ensureColumn('plots', 'area_unit', "TEXT DEFAULT 'square metres'")
  await ensureColumn('plots', 'variety', 'TEXT')
  await ensureColumn('plots', 'planting_date', 'TEXT')
  await ensureColumn('plots', 'updated_at', 'TEXT')
}

async function ensureColumn(table, column, definition) {
  const columns = await db.execute(`PRAGMA table_info(${table})`)
  if (!columns.rows.some(row => row.name === column)) await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}

export async function one(sql, args = []) { const result = await db.execute({ sql, args }); return result.rows[0] || null }
export async function many(sql, args = []) { const result = await db.execute({ sql, args }); return result.rows }
export async function run(sql, args = []) { return db.execute({ sql, args }) }

'use strict';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config');
const { pool } = require('./pool');

const SCHEMA_FILE = path.join(__dirname, '..', '..', 'db', 'schema.sql');

/** Espera a que MySQL acepte conexiones (útil al arrancar con Docker). */
async function waitForDb(retries = 30) {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      if (i === retries) throw err;
      console.log(`[db] esperando a MySQL (${i}/${retries}): ${err.code || err.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

/** Crea las tablas y catálogos si no existen. */
async function ensureSchema() {
  const sql = fs.readFileSync(SCHEMA_FILE, 'utf8');
  const conn = await mysql.createConnection({
    ...config.db,
    multipleStatements: true,
    charset: 'utf8mb4',
  });
  try {
    await conn.query(sql);
  } finally {
    await conn.end();
  }
}

async function isEmpty() {
  const [rows] = await pool.query('SELECT COUNT(*) AS n FROM usuarios');
  return rows[0].n === 0;
}

async function initDatabase() {
  await waitForDb();
  await ensureSchema();
  if (config.seedDemo && (await isEmpty())) {
    const { seed } = require('./seed');
    await seed();
  }
}

module.exports = { initDatabase, ensureSchema, waitForDb };

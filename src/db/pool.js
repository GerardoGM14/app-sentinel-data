'use strict';

const mysql = require('mysql2/promise');
const config = require('../config');

// Todas las consultas de la aplicación usan sentencias preparadas
// (pool.execute / pool.query con parámetros "?"), nunca concatenación.
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  timezone: 'local',
  dateStrings: false,
  decimalNumbers: true,
});

/** Ejecuta fn(conn) dentro de una transacción. */
async function transaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Devuelve la primera fila o null. */
async function one(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
}

async function all(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

module.exports = { pool, transaction, one, all };

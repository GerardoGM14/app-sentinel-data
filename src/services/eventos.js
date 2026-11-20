'use strict';

const { pool } = require('../db/pool');
const catalogos = require('./catalogos');
const resumen = require('./resumen');
const tiempoReal = require('./tiempoReal');

/** IP del cliente normalizada (sin el prefijo IPv4-mapeado de IPv6). */
function ipDe(req) {
  const ip = (req && (req.ip || req.socket?.remoteAddress)) || '0.0.0.0';
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

function userAgentDe(req) {
  const ua = (req && req.get && req.get('user-agent')) || '';
  return ua.slice(0, 255) || null;
}

/**
 * Registra un evento de acceso (RF-12), actualiza el resumen agregado
 * y lo publica en vivo a los administradores conectados.
 * @param {string} codigo  LOGIN_OK, LOGIN_FALLIDO, LOGOUT, CUENTA_BLOQUEADA, ...
 * @param {object} opts    { req, usuarioId, email, fecha }
 */
async function registrar(codigo, { req, usuarioId = null, email = null, fecha = new Date() } = {}) {
  const c = catalogos.get();
  const tipoId = c.tipoEventoId[codigo];
  if (!tipoId) throw new Error(`Tipo de evento desconocido: ${codigo}`);
  const ip = ipDe(req);
  const ua = userAgentDe(req);
  const emailNorm = email ? String(email).trim().toLowerCase().slice(0, 190) : null;

  const [r] = await pool.execute(
    `INSERT INTO eventos_acceso (tipo_evento_id, usuario_id, email_intentado, ip, user_agent, creado_en)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [tipoId, usuarioId, emailNorm, ip, ua, fecha]
  );
  try {
    await resumen.incrementar(pool, tipoId, fecha);
  } catch (err) {
    // El resumen es un dato derivado: si falla se puede reconstruir (npm run resumen:reconstruir).
    console.error('[resumen] no se pudo actualizar:', err.message);
  }

  tiempoReal.aAdmins('evento:nuevo', {
    id: r.insertId,
    codigo,
    evento: c.tiposEvento.find((t) => t.id === tipoId).descripcion,
    email: emailNorm,
    ip,
    userAgent: ua,
    fecha: fecha.toISOString(),
  });
  return { id: r.insertId, ip, fecha };
}

module.exports = { registrar, ipDe, userAgentDe };

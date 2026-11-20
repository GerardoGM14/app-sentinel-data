'use strict';

// Verificación de credenciales compartida por el formulario web (POST /login)
// y la API REST (POST /api/v1/auth/token): mismo bloqueo por intentos,
// mismas reglas de detección y mismo registro de eventos.

const bcrypt = require('bcryptjs');
const config = require('../config');
const { pool, one } = require('../db/pool');
const eventos = require('./eventos');
const deteccion = require('./deteccion');
const tiempoReal = require('./tiempoReal');

// Hash de referencia para comparar cuando el correo no existe y así
// igualar el tiempo de respuesta (evita enumerar cuentas por tiempo).
const HASH_FICTICIO = bcrypt.hashSync('no-es-una-clave-real', config.security.bcryptCost);

const MSG_LOGIN = 'Correo o contraseña incorrectos.';
const minutosRestantes = (hasta) => Math.max(1, Math.ceil((new Date(hasta) - Date.now()) / 60000));

/**
 * @returns {Promise<{ok: true, usuario: object} | {ok: false, status: number, mensaje: string}>}
 */
async function autenticar(email, password, req) {
  email = String(email || '').trim().toLowerCase();
  password = String(password || '');

  const u = await one(
    `SELECT u.id, u.nombre, u.apellido, u.email, u.password_hash, u.activo, u.intentos_fallidos,
            u.bloqueado_hasta, u.area_id, r.nombre AS rol
       FROM usuarios u JOIN roles r ON r.id = u.rol_id
      WHERE u.email = ?`,
    [email]
  );
  const ip = eventos.ipDe(req);

  // Cuenta bloqueada: se rechaza aunque la contraseña sea correcta (CP-04).
  if (u && u.bloqueado_hasta && new Date(u.bloqueado_hasta) > new Date()) {
    await eventos.registrar('LOGIN_FALLIDO', { req, usuarioId: u.id, email });
    await deteccion.evaluarIpSospechosa(ip);
    return {
      ok: false,
      status: 423,
      mensaje: `La cuenta está bloqueada temporalmente por intentos fallidos. Inténtalo en ${minutosRestantes(u.bloqueado_hasta)} min o recupera tu contraseña.`,
    };
  }

  const ok = await bcrypt.compare(password, u ? u.password_hash : HASH_FICTICIO);

  if (!u || !ok || !u.activo) {
    await eventos.registrar('LOGIN_FALLIDO', { req, usuarioId: u ? u.id : null, email });
    let bloqueada = false;
    if (u && !ok) {
      const intentos = u.intentos_fallidos + 1;
      if (intentos >= config.security.maxIntentos) {
        const hasta = new Date(Date.now() + config.security.bloqueoMinutos * 60000);
        await pool.execute('UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = ? WHERE id = ?', [hasta, u.id]);
        await eventos.registrar('CUENTA_BLOQUEADA', { req, usuarioId: u.id, email });
        await deteccion.alertaFuerzaBruta(u, ip);
        tiempoReal.aAdmins('cuenta:bloqueada', { email: u.email, hasta: hasta.toISOString() });
        bloqueada = true;
      } else {
        await pool.execute('UPDATE usuarios SET intentos_fallidos = ? WHERE id = ?', [intentos, u.id]);
      }
    }
    await deteccion.evaluarIpSospechosa(ip);
    if (bloqueada) {
      return {
        ok: false,
        status: 423,
        mensaje: `La cuenta fue bloqueada por ${config.security.bloqueoMinutos} minutos tras ${config.security.maxIntentos} intentos fallidos.`,
      };
    }
    return { ok: false, status: 401, mensaje: MSG_LOGIN };
  }

  // Éxito: las reglas de IP nueva y horario se evalúan antes de registrar el evento.
  const ahora = new Date();
  await deteccion.evaluarIpNueva(u, ip, ahora);
  await deteccion.evaluarFueraHorario(u, ip, ahora);
  await pool.execute(
    'UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_login = ? WHERE id = ?',
    [ahora, u.id]
  );
  await eventos.registrar('LOGIN_OK', { req, usuarioId: u.id, email, fecha: ahora });

  return {
    ok: true,
    usuario: { id: u.id, nombre: u.nombre, apellido: u.apellido, email: u.email, rol: u.rol, areaId: u.area_id },
  };
}

module.exports = { autenticar, MSG_LOGIN };

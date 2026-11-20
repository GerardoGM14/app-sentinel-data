'use strict';

const formato = require('../utils/formato');

/** Mensajes flash simples guardados en la sesión. */
function flash(req, tipo, texto) {
  req.session.flash = req.session.flash || [];
  req.session.flash.push({ tipo, texto });
}

function locals(req, res, next) {
  res.locals.user = req.session.user || null;
  res.locals.esAdmin = req.session.user?.rol === 'Administrador';
  res.locals.flash = req.session.flash || [];
  delete req.session.flash;
  res.locals.path = req.path;
  res.locals.f = formato;
  res.locals.errores = {};
  res.locals.valores = {};
  next();
}

module.exports = { locals, flash };

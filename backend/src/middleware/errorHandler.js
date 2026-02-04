import { logger } from '../config/logger.js';

export const errorHandler = (err, req, res, next) => {
  logger.error(`Erro capturado (rid=${req.id || '-'})`, err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      message: 'Erro de validação',
      errors,
      requestId: req.id
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(400).json({
      success: false,
      message: `${field} já está em uso.`,
      requestId: req.id
    });
  }

  // Mongoose cast error (ID inválido)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'ID inválido fornecido.',
      requestId: req.id
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token inválido.',
      requestId: req.id
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expirado.',
      requestId: req.id
    });
  }

  // Default error
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Erro no servidor';

  res.status(statusCode).json({
    success: false,
    message,
    requestId: req.id,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

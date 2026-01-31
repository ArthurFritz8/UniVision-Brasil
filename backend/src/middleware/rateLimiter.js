import rateLimit from 'express-rate-limit';

// Rate limiter geral
export const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || 100),
  message: {
    success: false,
    message: 'Muitas requisições. Tente novamente mais tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter para autenticação (mais restritivo)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
  }
});

// Rate limiter para cadastro
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // 3 cadastros por hora por IP
  message: {
    success: false,
    message: 'Muitos cadastros realizados. Tente novamente em 1 hora.'
  }
});

// Rate limiter para streaming (mais permissivo)
export const streamLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 60, // 60 requisições por minuto
  message: {
    success: false,
    message: 'Limite de streaming atingido. Aguarde um momento.'
  }
});

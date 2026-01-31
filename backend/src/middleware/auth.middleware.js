import jwt from 'jsonwebtoken';
import { logger } from '../config/logger.js';
import User from '../models/User.model.js';

export const protect = async (req, res, next) => {
  try {
    let token;

    // Verifica token no header Authorization
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Não autorizado. Token não fornecido.'
      });
    }

    try {
      // Verifica token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Busca usuário
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não encontrado.'
        });
      }

      if (!req.user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Conta desativada.'
        });
      }

      next();
    } catch (error) {
      logger.error('Token inválido:', error);
      return res.status(401).json({
        success: false,
        message: 'Token inválido ou expirado.'
      });
    }
  } catch (error) {
    logger.error('Erro no middleware de autenticação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro no servidor.'
    });
  }
};

// Middleware para verificar roles específicas
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Acesso negado. Função ${req.user.role} não autorizada.`
      });
    }
    next();
  };
};

// Middleware opcional de autenticação (não bloqueia se não tiver token)
export const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select('-password');
      } catch (error) {
        // Token inválido, mas não bloqueia
        logger.warn('Token opcional inválido:', error.message);
      }
    }

    next();
  } catch (error) {
    logger.error('Erro no middleware de autenticação opcional:', error);
    next();
  }
};

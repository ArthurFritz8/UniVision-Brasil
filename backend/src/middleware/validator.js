import { body, param, query, validationResult } from 'express-validator';

// Middleware para processar resultados de validação
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Erro de validação',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

// Validações de autenticação
export const registerValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Nome é obrigatório')
    .isLength({ min: 2, max: 100 }).withMessage('Nome deve ter entre 2 e 100 caracteres'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email é obrigatório')
    .isEmail().withMessage('Email inválido')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Senha é obrigatória')
    .isLength({ min: 6 }).withMessage('Senha deve ter no mínimo 6 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Senha deve conter letra maiúscula, minúscula e número'),
  validate
];

export const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email é obrigatório')
    .isEmail().withMessage('Email inválido')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Senha é obrigatória'),
  validate
];

// Validações de ID
export const idValidation = [
  param('id')
    .isMongoId().withMessage('ID inválido'),
  validate
];

// Validações de paginação
export const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Página deve ser um número maior que 0')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limite deve estar entre 1 e 100')
    .toInt(),
  validate
];

// Validações de busca
export const searchValidation = [
  query('q')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 }).withMessage('Termo de busca deve ter entre 1 e 100 caracteres'),
  ...paginationValidation
];

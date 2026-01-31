import User from '../models/User.model.js';
import jwt from 'jsonwebtoken';
import { logger } from '../config/logger.js';
import { cacheDel } from '../config/redis.js';

// Gerar JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Gerar Refresh Token
const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d'
  });
};

// @desc    Registrar novo usuário
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Verifica se usuário já existe
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'Email já cadastrado'
      });
    }

    // Cria usuário
    const user = await User.create({
      name,
      email,
      password
    });

    // Gera tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    logger.info(`Novo usuário registrado: ${email}`);

    res.status(201).json({
      success: true,
      message: 'Usuário registrado com sucesso',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        token,
        refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login de usuário
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Busca usuário com senha
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
    }

    // Verifica senha
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
    }

    // Verifica se conta está ativa
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Conta desativada'
      });
    }

    // Atualiza último login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    // Gera tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    logger.info(`Login bem-sucedido: ${email}`);

    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          preferences: user.preferences,
          subscription: user.subscription
        },
        token,
        refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout de usuário
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res, next) => {
  try {
    // Limpa cache do usuário se necessário
    await cacheDel(`user:${req.user._id}`);

    logger.info(`Logout: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Logout realizado com sucesso'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Obter usuário atual
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Atualizar perfil
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (req, res, next) => {
  try {
    const { name, avatar, preferences } = req.body;

    const user = await User.findById(req.user._id);

    if (name) user.name = name;
    if (avatar) user.avatar = avatar;
    if (preferences) user.preferences = { ...user.preferences, ...preferences };

    await user.save();

    // Limpa cache
    await cacheDel(`user:${user._id}`);

    logger.info(`Perfil atualizado: ${user.email}`);

    res.json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Alterar senha
// @route   PUT /api/auth/change-password
// @access  Private
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');

    // Verifica senha atual
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Senha atual incorreta'
      });
    }

    // Atualiza senha
    user.password = newPassword;
    await user.save();

    logger.info(`Senha alterada: ${user.email}`);

    res.json({
      success: true,
      message: 'Senha alterada com sucesso'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Refresh token
// @route   POST /api/auth/refresh
// @access  Public
export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token não fornecido'
      });
    }

    // Verifica refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Busca usuário
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Usuário inválido'
      });
    }

    // Gera novos tokens
    const newToken = generateToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    res.json({
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Refresh token inválido ou expirado'
    });
  }
};

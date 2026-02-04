import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { connectDB } from './config/database.js';
import { connectRedis } from './config/redis.js';
import { logger, morganMiddleware } from './config/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';

// Rotas
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import channelRoutes from './routes/channel.routes.js';
import contentRoutes from './routes/content.routes.js';
import categoryRoutes from './routes/category.routes.js';
import favoriteRoutes from './routes/favorite.routes.js';
import epgRoutes from './routes/epg.routes.js';
import streamRoutes from './routes/stream.routes.js';
import proxyRoutes from './routes/proxy.routes.js';
import searchRoutes from './routes/search.routes.js';
import historyRoutes from './routes/history.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.set('trust proxy', 1);

// Request ID para correlacionar logs e respostas
app.use((req, res, next) => {
  req.id = randomUUID();
  res.set('x-request-id', req.id);
  next();
});

// Middlewares de segurança e performance
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morganMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/epg', epgRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api/proxy', proxyRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/history', historyRoutes);

// 404 e Error Handler
app.use(notFound);
app.use(errorHandler);

// Inicialização do servidor
const startServer = async () => {
  try {
    // Conecta ao MongoDB
    await connectDB();
    logger.info('✅ MongoDB conectado');

    // Conecta ao Redis
    await connectRedis();
    logger.info('✅ Redis conectado');

    // Inicia servidor
    app.listen(PORT, () => {
      logger.info(`🚀 Servidor rodando na porta ${PORT}`);
      logger.info(`🌍 Ambiente: ${process.env.NODE_ENV}`);
      logger.info(`📡 API URL: http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
};

// Tratamento de erros não capturados
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! 💥 Encerrando...');
  logger.error(err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Encerrando...');
  logger.error(err);
  process.exit(1);
});

startServer();

export default app;

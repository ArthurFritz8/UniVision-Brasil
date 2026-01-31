import mongoose from 'mongoose';
import { logger } from './logger.js';

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info(`MongoDB conectado: ${conn.connection.host}`);

    // Event listeners
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB erro:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB desconectado');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconectado');
    });

    return conn;
  } catch (error) {
    logger.error('Erro ao conectar MongoDB:', error);
    process.exit(1);
  }
};

export const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB desconectado com sucesso');
  } catch (error) {
    logger.error('Erro ao desconectar MongoDB:', error);
  }
};

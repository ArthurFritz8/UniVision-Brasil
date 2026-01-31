import { createClient } from 'redis';
import { logger } from './logger.js';

// TTL padrões otimizados por tipo de conteúdo
export const CACHE_TTL = {
  CATEGORIES: 3600,      // 1 hora (categorias mudam raramente)
  CHANNELS: 1800,        // 30 minutos (canais atualizam periodiamente)
  CONTENT: 1800,         // 30 minutos (filmes/séries são estáveis)
  EPG: 900,              // 15 minutos (EPG atualiza frequentemente)
  USER: 300,             // 5 minutos (dados de usuário precisam estar atualizados)
  SEARCH: 600,           // 10 minutos (buscas podem ser cacheadas temporariamente)
  SHORT: 60,             // 1 minuto (dados muito voláteis)
};

let redisClient;

export const connectRedis = async () => {
  try {
    redisClient = createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
      },
      password: process.env.REDIS_PASSWORD || undefined,
      legacyMode: false
    });

    redisClient.on('error', (err) => {
      logger.error('Redis erro:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis conectando...');
    });

    redisClient.on('ready', () => {
      logger.info('Redis pronto para uso');
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis reconectando...');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    logger.error('Erro ao conectar Redis:', error);
    // Não encerra o app se Redis falhar (degrada gracefully)
    return null;
  }
};

export const getRedisClient = () => redisClient;

// Helper functions otimizadas
export const cacheSet = async (key, value, ttl = CACHE_TTL.CONTENT) => {
  if (!redisClient?.isReady) return false;
  try {
    await redisClient.setEx(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    logger.error('Erro ao salvar no cache:', error);
    return false;
  }
};

export const cacheGet = async (key) => {
  if (!redisClient?.isReady) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Erro ao ler do cache:', error);
    return null;
  }
};

export const cacheDel = async (key) => {
  if (!redisClient?.isReady) return false;
  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    logger.error('Erro ao deletar do cache:', error);
    return false;
  }
};

// Limpar padrão de chaves (ex: 'channels:*')
export const cacheDelPattern = async (pattern) => {
  if (!redisClient?.isReady) return false;
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
    return true;
  } catch (error) {
    logger.error(`Erro ao deletar padrão ${pattern}:`, error);
    return false;
  }
};

// Multi-get otimizado para buscar vários itens de uma vez
export const cacheMultiGet = async (keys) => {
  if (!redisClient?.isReady) return {};
  try {
    const values = await redisClient.mGet(keys);
    const result = {};
    keys.forEach((key, index) => {
      result[key] = values[index] ? JSON.parse(values[index]) : null;
    });
    return result;
  } catch (error) {
    logger.error('Erro ao ler múltiplos do cache:', error);
    return {};
  }
};

// Multi-set otimizado para salvar vários itens de uma vez
export const cacheMultiSet = async (keyValuePairs, ttl = CACHE_TTL.CONTENT) => {
  if (!redisClient?.isReady) return false;
  try {
    const pipeline = redisClient.multi();
    Object.entries(keyValuePairs).forEach(([key, value]) => {
      pipeline.setEx(key, ttl, JSON.stringify(value));
    });
    await pipeline.exec();
    return true;
  } catch (error) {
    logger.error('Erro ao salvar múltiplos no cache:', error);
    return false;
  }
};

export const cacheFlush = async () => {
  if (!redisClient?.isReady) return false;
  try {
    await redisClient.flushAll();
    return true;
  } catch (error) {
    logger.error('Erro ao limpar cache:', error);
    return false;
  }
};

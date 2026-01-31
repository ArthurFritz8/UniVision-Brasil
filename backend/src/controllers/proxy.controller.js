import axios from 'axios';
import { logger } from '../config/logger.js';

export const proxyRequest = async (req, res, next) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL não fornecida'
      });
    }

    // Validação básica de segurança
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return res.status(400).json({
        success: false,
        message: 'URL inválida'
      });
    }

    logger.info(`Proxy request: ${url}`);

    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 30000,
      headers: {
        'User-Agent': 'UniVision Brasil/2.0'
      }
    });

    // Copia headers relevantes
    const allowedHeaders = [
      'content-type',
      'content-length',
      'content-disposition',
      'cache-control',
      'expires',
      'etag'
    ];

    allowedHeaders.forEach(header => {
      if (response.headers[header]) {
        res.setHeader(header, response.headers[header]);
      }
    });

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    // Stream da resposta
    response.data.pipe(res);
  } catch (error) {
    logger.error('Erro no proxy:', error);
    
    if (error.response) {
      res.status(error.response.status).json({
        success: false,
        message: 'Erro ao acessar URL'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Erro no servidor proxy'
      });
    }
  }
};

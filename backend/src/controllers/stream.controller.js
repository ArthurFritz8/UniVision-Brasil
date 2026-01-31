import Channel from '../models/Channel.model.js';
import Content from '../models/Content.model.js';
import { logger } from '../config/logger.js';

export const getStreamUrl = async (req, res, next) => {
  try {
    const { type, id } = req.params;

    let item;
    if (type === 'channel') {
      item = await Channel.findById(id);
    } else if (type === 'content') {
      item = await Content.findById(id);
    }

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item não encontrado'
      });
    }

    if (!item.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Item não está disponível'
      });
    }

    // Verifica se usuário tem permissão (premium)
    if (item.isPremium && req.user) {
      if (!['premium', 'vip', 'admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Conteúdo premium requer assinatura'
        });
      }
    }

    logger.info(`Stream solicitado: ${type}/${id} - ${item.title}`);

    res.json({
      success: true,
      data: {
        streamUrl: item.streamUrl,
        streamType: item.streamType,
        title: item.title,
        thumbnail: item.thumbnail || item.poster
      }
    });
  } catch (error) {
    next(error);
  }
};

export const validateStream = async (req, res, next) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL não fornecida'
      });
    }

    // Aqui você pode implementar validação de URL
    // Por exemplo, testar se o stream está acessível
    
    res.json({
      success: true,
      data: {
        valid: true,
        type: url.includes('.m3u8') ? 'hls' : 'mp4'
      }
    });
  } catch (error) {
    next(error);
  }
};

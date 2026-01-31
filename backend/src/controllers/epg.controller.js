import axios from 'axios';
import { cacheGet, cacheSet } from '../config/redis.js';
import { logger } from '../config/logger.js';

const CACHE_TTL = 3600; // 1 hora

export const getEPG = async (req, res, next) => {
  try {
    const { channelId, date } = req.query;

    if (!channelId) {
      return res.status(400).json({
        success: false,
        message: 'ID do canal é obrigatório'
      });
    }

    const targetDate = date ? new Date(date) : new Date();
    const cacheKey = `epg:${channelId}:${targetDate.toISOString().split('T')[0]}`;

    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({ success: true, cached: true, ...cached });
    }

    // Aqui você implementaria a lógica de buscar EPG real
    // Por enquanto, retorna dados mockados
    const epgData = {
      channelId,
      date: targetDate,
      programs: [
        {
          title: 'Jornal da Manhã',
          start: '06:00',
          end: '08:00',
          description: 'Notícias e informações para começar o dia'
        },
        {
          title: 'Programa de Variedades',
          start: '08:00',
          end: '10:00',
          description: 'Entretenimento e diversão'
        },
        {
          title: 'Novela das 10h',
          start: '10:00',
          end: '11:00',
          description: 'Capítulo de hoje'
        }
      ]
    };

    const result = { data: epgData };
    await cacheSet(cacheKey, result, CACHE_TTL);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

export const getEPGWeek = async (req, res, next) => {
  try {
    const { channelId } = req.query;

    if (!channelId) {
      return res.status(400).json({
        success: false,
        message: 'ID do canal é obrigatório'
      });
    }

    const cacheKey = `epg:week:${channelId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({ success: true, cached: true, ...cached });
    }

    // Mock de dados da semana
    const weekData = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      weekData.push({
        date: date.toISOString().split('T')[0],
        programs: [
          { title: 'Programa Matinal', start: '06:00', end: '09:00' },
          { title: 'Show de Meio-dia', start: '12:00', end: '14:00' },
          { title: 'Jornal Nacional', start: '20:00', end: '21:00' }
        ]
      });
    }

    const result = { data: { channelId, week: weekData } };
    await cacheSet(cacheKey, result, CACHE_TTL);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

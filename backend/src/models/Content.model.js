import mongoose from 'mongoose';

const contentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Título é obrigatório'],
    trim: true,
    index: true
  },
  originalTitle: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  synopsis: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['movie', 'series', 'episode'],
    required: true,
    index: true
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
    index: true
  },
  streamUrl: {
    type: String,
    required: [true, 'URL do stream é obrigatória']
  },
  streamType: {
    type: String,
    enum: ['hls', 'mp4', 'mkv', 'dash'],
    default: 'mp4'
  },
  thumbnail: String,
  poster: String,
  backdrop: String,
  trailer: String,
  duration: Number, // em minutos
  releaseDate: Date,
  year: Number,
  country: String,
  language: {
    type: String,
    default: 'pt'
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isPremium: {
    type: Boolean,
    default: false
  },
  quality: {
    type: String,
    enum: ['SD', 'HD', 'FHD', '4K'],
    default: 'HD'
  },
  metadata: {
    genre: [String],
    cast: [String],
    director: [String],
    writer: [String],
    studio: String,
    rating: {
      imdb: Number,
      tmdb: Number,
      own: Number
    },
    votes: {
      type: Number,
      default: 0
    },
    views: {
      type: Number,
      default: 0
    },
    favorites: {
      type: Number,
      default: 0
    }
  },
  // Para séries
  seriesInfo: {
    seriesId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Content'
    },
    season: Number,
    episode: Number,
    totalSeasons: Number,
    totalEpisodes: Number
  },
  // Xtream Codes
  xtreamData: {
    streamId: String,
    categoryId: String,
    containerExtension: String
  },
  // Subtitles
  subtitles: [{
    language: String,
    url: String
  }],
  // Audio tracks
  audioTracks: [{
    language: String,
    codec: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para busca otimizada
contentSchema.index({ title: 'text', description: 'text', synopsis: 'text' });
contentSchema.index({ type: 1, categoryId: 1, isActive: 1 });
contentSchema.index({ isFeatured: 1, isActive: 1 });
contentSchema.index({ 'metadata.genre': 1 });
contentSchema.index({ releaseDate: -1 });

export default mongoose.model('Content', contentSchema);

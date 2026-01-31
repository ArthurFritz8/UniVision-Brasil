import mongoose from 'mongoose';

const channelSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Título é obrigatório'],
    trim: true,
    index: true
  },
  description: {
    type: String,
    trim: true
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
    enum: ['hls', 'mp4', 'rtmp', 'dash'],
    default: 'hls'
  },
  thumbnail: {
    type: String,
    default: null
  },
  logo: {
    type: String,
    default: null
  },
  backdrop: {
    type: String,
    default: null
  },
  epgId: {
    type: String,
    trim: true
  },
  epgUrl: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    default: 'BR'
  },
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
  order: {
    type: Number,
    default: 0
  },
  metadata: {
    genre: [String],
    rating: Number,
    views: {
      type: Number,
      default: 0
    },
    favorites: {
      type: Number,
      default: 0
    }
  },
  xtreamData: {
    streamId: String,
    categoryId: String,
    containerExtension: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices compostos para busca otimizada
channelSchema.index({ title: 'text', description: 'text' });
channelSchema.index({ categoryId: 1, isActive: 1 });
channelSchema.index({ isFeatured: 1, isActive: 1 });

export default mongoose.model('Channel', channelSchema);

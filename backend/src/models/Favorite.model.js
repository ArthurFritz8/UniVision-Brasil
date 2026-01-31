import mongoose from 'mongoose';

const favoriteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  itemType: {
    type: String,
    enum: ['channel', 'content'],
    required: true
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'itemType',
    required: true
  },
  addedAt: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Índice composto para evitar duplicatas
favoriteSchema.index({ userId: 1, itemType: 1, itemId: 1 }, { unique: true });

export default mongoose.model('Favorite', favoriteSchema);

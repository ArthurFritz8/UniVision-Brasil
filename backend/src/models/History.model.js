import mongoose from 'mongoose';

const historySchema = new mongoose.Schema({
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
  watchedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  duration: Number, // duração total em segundos
  position: Number, // posição de parada em segundos
  completed: {
    type: Boolean,
    default: false
  },
  device: {
    type: String,
    enum: ['web', 'roku', 'mobile', 'tv', 'other'],
    default: 'web'
  }
}, {
  timestamps: true
});

// Índices compostos
historySchema.index({ userId: 1, watchedAt: -1 });
historySchema.index({ userId: 1, itemId: 1, itemType: 1 });

export default mongoose.model('History', historySchema);

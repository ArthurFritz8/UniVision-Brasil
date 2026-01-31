import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Nome é obrigatório'],
    trim: true,
    unique: true,
    index: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['live', 'vod', 'series'],
    required: true,
    index: true
  },
  description: {
    type: String,
    trim: true
  },
  icon: {
    type: String,
    default: null
  },
  image: {
    type: String,
    default: null
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isPremium: {
    type: Boolean,
    default: false
  },
  metadata: {
    color: String,
    itemCount: {
      type: Number,
      default: 0
    }
  },
  xtreamData: {
    categoryId: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual para subcategorias
categorySchema.virtual('subcategories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parentId'
});

// Índice composto
categorySchema.index({ type: 1, isActive: 1, order: 1 });

export default mongoose.model('Category', categorySchema);

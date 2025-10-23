const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const commentSchema = require('./comment.model').schema;

const perfumeSchema = new Schema({
  perfumeName: { type: String, required: true },
  uri: { type: String, required: true },
  price: { type: Number, required: true },
  concentration: { type: String, required: true },
  description: { type: String, required: true },
  ingredients: { type: String, required: true },
  volume: { type: Number, required: true },
  targetAudience: { type: String, required: true },
  imageUrl: { type: String, default: '' },
  category: { type: String, default: '' },
  releaseYear: { type: Number, default: null },
  comments: [commentSchema],
  brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Perfume', perfumeSchema);

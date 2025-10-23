const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const commentSchema = new Schema({
  rating: { type: Number, min: 1, max: 5, required: true },
  content: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Comment', commentSchema);

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const brandSchema = new Schema({
  brandName: { type: String },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Brand', brandSchema);

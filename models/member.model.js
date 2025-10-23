const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const Schema = mongoose.Schema;

const memberSchema = new Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: function() { return !this.googleId; } },
  name: { type: String },
  YOB: { type: Number },
  gender: { type: Boolean },
  isAdmin: { type: Boolean, default: false },
  isBlocked: { type: Boolean, default: false },
  blockedAt: { type: Date, default: null },
  blockedBy: { type: Schema.Types.ObjectId, ref: 'Member', default: null },
  blockReason: { type: String, default: null },
  googleId: { type: String, unique: true, sparse: true },
  photoURL: { type: String }
}, { timestamps: true });

// Hash password before save (skip for Google users)
memberSchema.pre('save', async function (next) {
  const member = this;
  if (!member.isModified('password') || !member.password || member.googleId) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(member.password, salt);
    member.password = hash;
    next();
  } catch (err) {
    next(err);
  }
});

memberSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Member', memberSchema);

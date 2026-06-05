const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Number, default: Date.now },
  accumulatedBonusPoints: { type: Number, default: 0 },
  discord: {
    id: String,
    username: String,
    avatar: String
  }
});

module.exports = mongoose.model('User', userSchema);

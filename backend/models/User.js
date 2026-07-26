const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Number, default: Date.now },
  country: { type: String, default: 'UNKNOWN' },
  discord: {
    id: String,
    username: String,
    avatar: String
  },
  role: { type: String, enum: ['user', 'moderator', 'admin'], default: 'user' },
  mutedUntil: { type: Number, default: null },
  bannedUntil: { type: Number, default: null },
  recoveryKey: { type: String },
  email: { type: String, sparse: true, unique: true },
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  emailVerificationTokenExpires: { type: Number },
  redeemedCodes: { type: [String], default: [] },
  friends: { type: [String], default: [] },
  friendRequests: { type: [String], default: [] },
  homeRegion: { type: String, default: 'asia' },
  initialLat: { type: Number, default: null },
  initialLon: { type: Number, default: null },
  initialCountry: { type: String, default: null },

  money: { type: Number, default: 0 },
  incomePerMinute: { type: Number, default: 1 },
  totalEarned: { type: Number, default: 0 },
  upgrades: { type: Map, of: Number, default: {} },
  investments: { type: Map, of: {
    type: String,
    amount: Number,
    startTime: Number,
    lockUntil: Number
  }, default: {} },
  companyId: { type: String, default: null },
  contracts: { type: [String], default: [] }
});

userSchema.index({ 'discord.id': 1 });
userSchema.index({ homeRegion: 1 });
userSchema.index({ money: -1 });

module.exports = mongoose.model('User', userSchema);

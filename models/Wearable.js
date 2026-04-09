const mongoose = require('mongoose');

const wearableSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  image: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  originalPrice: {
    type: Number
  },
  category: {
    type: String,
    required: true,
    enum: ['watch', 'band', 'ring', 'patch', 'monitor']
  },
  features: [{
    type: String,
    required: true
  }],
  metrics: [{
    type: String,
    required: true
  }],
  batteryLife: {
    type: String,
    required: true
  },
  waterResistance: {
    type: String,
    required: true
  },
  connectivity: [{
    type: String,
    required: true
  }],
  compatibility: [{
    type: String,
    required: true
  }],
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  reviews: {
    type: Number,
    default: 0
  },
  inStock: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Wearable', wearableSchema);
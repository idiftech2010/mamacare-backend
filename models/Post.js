const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  excerpt: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['nutrition', 'exercise', 'symptoms', 'development', 'health', 'tips']
  },
  image: {
    type: String,
    required: true
  },
  author: {
    type: String,
    required: true
  },
  readTime: {
    type: Number,
    required: true
  },
  tags: [{
    type: String
  }],
  published: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Post', postSchema);
const mongoose = require('mongoose');

const riskResultSchema = new mongoose.Schema({
  level: {
    type: String,
    enum: ['low', 'medium', 'high'],
    required: true
  },
  score: {
    type: Number,
    required: true
  },
  confidence: {
    type: Number,
    required: true
  },
  factors: [{
    type: String,
    required: true
  }],
  recommendations: [{
    type: String,
    required: true
  }]
});

const riskAssessmentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  vitals: {
    age: {
      type: Number,
      required: true
    },
    systolicBP: {
      type: Number,
      required: true
    },
    diastolicBP: {
      type: Number,
      required: true
    },
    bloodSugar: {
      type: Number,
      required: true
    },
    bodyTemp: {
      type: Number,
      required: true
    },
    heartRate: {
      type: Number,
      required: true
    }
  },
  pregnancyWeek: {
    type: Number
  },
  symptoms: [{
    type: String
  }],
  notes: {
    type: String,
    default: ''
  },
  result: {
    type: riskResultSchema,
    required: true
  }
});

module.exports = mongoose.model('RiskAssessment', riskAssessmentSchema);
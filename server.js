// MamaCare Backend - Production Ready
// Supports both local development and cloud deployment

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { buildRiskAssessment, validatePreviousPregnancyHistory, validateSymptoms } = require('./riskAssessment');

const app = express();

// Use PORT from environment (for cloud) or fallback to 5000 (for local)
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'mamacare_demo_secret_key_2025';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

// ==================== FILE-BASED STORAGE UTILITIES ====================
const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const readDB = (collection) => {
  const filePath = path.join(dbDir, `${collection}.json`);
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`Error reading ${collection}:`, error.message);
  }
  return [];
};

const writeDB = (collection, data) => {
  const filePath = path.join(dbDir, `${collection}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error(`Error writing ${collection}:`, error.message);
  }
};

const average = (values) => {
  const measuredValues = values.filter((value) => typeof value === 'number' && Number.isFinite(value));
  return measuredValues.length
    ? measuredValues.reduce((total, value) => total + value, 0) / measuredValues.length
    : 0;
};

// Initialize default users in file storage if not present
const initDefaultUsersFile = () => {
  const users = readDB('users');
  if (users.length === 0) {
    const defaultUsers = [
      {
        id: uuidv4(),
        email: 'superadmin@mamacare.app',
        password: 'superadmin123',
        name: 'Super Admin',
        phone: '+234 800 000 0000',
        authProvider: 'email',
        role: 'superadmin',
        profile: {
          age: 35,
          bloodType: 'O+',
        },
        createdAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        email: 'admin@mamacare.app',
        password: 'admin123',
        name: 'Admin User',
        phone: '+234 800 000 0001',
        authProvider: 'email',
        role: 'admin',
        profile: {
          age: 30,
          bloodType: 'A+',
        },
        createdAt: new Date().toISOString(),
      },
    ];
    writeDB('users', defaultUsers);
    console.log('✓ Default users initialized in file storage');
  }
};

// Initialize default doctors in file storage if not present
const initDefaultDoctorsFile = () => {
  const doctors = readDB('doctors');
  if (doctors.length === 0) {
    const defaultDoctors = [
      {
        id: uuidv4(),
        name: 'Dr. Amara Okafor',
        specialty: 'Obstetrics & Gynecology',
        image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=400&fit=crop',
        bio: 'Experienced obstetrician with over 15 years in maternal healthcare',
        languages: ['English', 'Yoruba'],
        rating: 4.8,
        reviews: 156,
        available: true,
        nextAvailable: 'Today, 2:00 PM',
        ethnicity: 'black',
        email: 'amara.okafor@mamacare.app',
        phone: '+234 803 123 4567',
        education: 'University of Lagos Medical School',
        certifications: ['FWACS', 'FRCOG'],
      },
      {
        id: uuidv4(),
        name: 'Dr. Ngozi Ademola',
        specialty: 'Maternal-Fetal Medicine',
        image: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&h=400&fit=crop',
        bio: 'Specialist in high-risk pregnancies and fetal medicine',
        languages: ['English', 'Yoruba'],
        rating: 4.7,
        reviews: 84,
        available: false,
        nextAvailable: 'Monday, 9:00 AM',
        ethnicity: 'black',
        email: 'ngozi.adeyemi@mamacare.app',
        phone: '+234 804 567 8901',
        education: 'University of Ibadan Medical School',
        certifications: ['FWACS', 'FRCOG'],
      },
      {
        id: uuidv4(),
        name: 'Dr. Aisha Hassan',
        specialty: 'Midwifery & Natural Birth',
        image: 'https://images.unsplash.com/photo-1651008376811-b90baee60c1f?w=400&h=400&fit=crop',
        bio: 'Advocate for natural childbirth methods',
        languages: ['English', 'Hausa', 'Arabic'],
        rating: 4.8,
        reviews: 112,
        available: true,
        nextAvailable: 'Today, 6:00 PM',
        ethnicity: 'arab',
        email: 'aisha.hassan@mamacare.app',
        phone: '+234 805 678 9012',
        education: 'Ahmadu Bello University',
        certifications: ['RM', 'BSc Midwifery'],
      },
      {
        id: uuidv4(),
        name: 'Dr. Emily Johnson',
        specialty: 'Pediatric Obstetrics',
        image: 'https://images.unsplash.com/photo-1527613426441-4da17471b66d?w=400&h=400&fit=crop',
        bio: 'Focused on teen pregnancy and education',
        languages: ['English'],
        rating: 4.9,
        reviews: 143,
        available: true,
        nextAvailable: 'Tomorrow, 11:30 AM',
        ethnicity: 'white',
        email: 'emily.johnson@mamacare.app',
        phone: '+234 806 789 0123',
        education: 'Harvard Medical School',
        certifications: ['FACOG', 'MPH'],
      },
    ];
    writeDB('doctors', defaultDoctors);
    console.log('✓ Default doctors initialized in file storage');
  }
};

initDefaultUsersFile();
initDefaultDoctorsFile();

const ensurePatientIds = () => {
  const users = readDB('users');
  let changed = false;
  users.forEach(user => {
    if (user.role === 'user' && !user.patientId) {
      user.patientId = createPatientId();
      changed = true;
    }
  });
  if (changed) writeDB('users', users);
};

ensurePatientIds();

// Initialize default records file if missing so assessments are always stored reliably
const initDefaultRecordsFile = () => {
  const records = readDB('records');
  if (records.length === 0) {
    writeDB('records', []);
    console.log('✓ Default records file initialized in file storage');
  }
};

initDefaultRecordsFile();

// CORS - Allow requests from deployed frontend and localhost
const allowedOrigins = [
  'https://swlo76a2ti7h2.ok.kimi.link',  // Your deployed frontend
  'http://localhost:5173',                // Vite dev server
  'http://localhost:3000',                // Alternative dev port
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      // For production, you might want to be stricter
      // For now, we'll allow all origins in development
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json());

// Health check endpoint (for monitoring)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Authentication middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Admin middleware - allows both admin and superadmin
const adminMiddleware = (req, res, next) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Superadmin middleware - only superadmin
const superadminMiddleware = (req, res, next) => {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Superadmin access required' });
  }
  next();
};

const clinicalMiddleware = (req, res, next) => {
  if (!['clinician', 'data_entry', 'admin', 'superadmin'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Clinical access required' });
  }
  next();
};

const createPatientId = () => `MC-${uuidv4().replace(/-/g, '').slice(0, 10).toUpperCase()}`;

// ==================== AUTH ROUTES ====================

// Register
app.post('/api/auth/register', (req, res) => {
  const { email, password, name, phone, authProvider = 'email' } = req.body;

  const users = readDB('users');
  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    return res.status(400).json({ error: 'User already exists' });
  }

  const newUser = {
    id: uuidv4(),
    patientId: createPatientId(),
    email,
    password: authProvider === 'email' ? password : null,
    name,
    phone,
    authProvider,
    role: 'user',
    profile: {
      age: null,
      dueDate: null,
      bloodType: null,
      allergies: [],
      medications: [],
    },
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  writeDB('users', users);

  const token = jwt.sign(
    { userId: newUser.id, email: newUser.email, role: newUser.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: { ...newUser, password: undefined },
  });
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, password, authProvider } = req.body;

  const normalizedEmail = (email || '').trim().toLowerCase();

  const users = readDB('users');
  const user = users.find(u => u.email?.trim().toLowerCase() === normalizedEmail);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (authProvider === 'email' && user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  user.lastLogin = new Date().toISOString();
  const userIndex = users.findIndex(u => u.email === email);
  users[userIndex] = user;
  writeDB('users', users);

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: { ...user, password: undefined },
  });
});

// Google Auth
app.post('/api/auth/google', (req, res) => {
  const { email, name, googleId } = req.body;

  const users = readDB('users');
  let user = users.find(u => u.email === email);

  if (!user) {
    user = {
      id: uuidv4(),
      patientId: createPatientId(),
      email,
      name,
      password: null,
      authProvider: 'google',
      googleId,
      role: 'user',
      profile: {
        age: null,
        dueDate: null,
        bloodType: null,
      },
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    writeDB('users', users);
  } else {
    user.lastLogin = new Date().toISOString();
    const userIndex = users.findIndex(u => u.email === email);
    users[userIndex] = user;
    writeDB('users', users);
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: { ...user, password: undefined },
  });
});

// Get current user
app.get('/api/auth/me', authMiddleware, (req, res) => {
  const users = readDB('users');
  const user = users.find(u => u.id === req.user.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ ...user, password: undefined });
});

// Update user profile
app.put('/api/auth/me', authMiddleware, (req, res) => {
  const users = readDB('users');
  const userIndex = users.findIndex(u => u.id === req.user.userId);

  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  const updatedUser = {
    ...users[userIndex],
    ...req.body,
    updatedAt: new Date().toISOString(),
  };

  users[userIndex] = updatedUser;
  writeDB('users', users);

  res.json({ ...updatedUser, password: undefined });
});

// ==================== RISK ASSESSMENT ROUTES ====================

// Submit risk assessment
app.post('/api/risk-assessment', authMiddleware, (req, res) => {
  const { age, systolicBP, diastolicBP, bloodSugar, bloodSugarUnit, bodyTemp, heartRate, pregnancyWeek, symptoms, notes, patientId, previousPregnancyHistory } = req.body;
  const historyValidation = validatePreviousPregnancyHistory(previousPregnancyHistory);
  if (historyValidation.error) return res.status(400).json({ error: historyValidation.error });
  const symptomsValidation = validateSymptoms(symptoms);
  if (symptomsValidation.error) return res.status(400).json({ error: symptomsValidation.error });
  const users = readDB('users');
  const requestedPatient = req.user.role === 'data_entry' && patientId ? patientId : req.user.userId;
  const targetUser = users.find(user => user.id === requestedPatient || (patientId && user.patientId === patientId));
  const assessmentUserId = targetUser?.id || req.user.userId;
  if (bodyTemp > 43 || bodyTemp < 34) {
    return res.status(400).json({ error: 'Invalid data: Out of physiological range' });
  }
  const pregnancyWeekNum = pregnancyWeek ? parseInt(pregnancyWeek, 10) : undefined;
  const records = readDB('records');
  if (!targetUser) {
    return res.status(404).json({ error: 'Patient not found' });
  }
  const previousAssessment = records
    .filter(record => record.userId === assessmentUserId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  // Risk calculation logic (same as before)
  let riskScore = 0;
  const factors = [];
  
  // Blood Sugar
  if (bloodSugar > 10) {
    riskScore += 35;
    factors.push('Elevated blood sugar');
  } else if (bloodSugar > 8) {
    riskScore += 20;
    factors.push('Higher than optimal blood sugar');
  }
  
  // Age
  if (age > 35) {
    riskScore += 25;
    factors.push('Advanced maternal age');
  } else if (age < 18) {
    riskScore += 20;
    factors.push('Young maternal age');
  }
  
  // Pregnancy Week
  if (pregnancyWeekNum) {
    if (pregnancyWeekNum < 12) {
      riskScore += 15;
      factors.push('Early pregnancy (higher risk period)');
    } else if (pregnancyWeekNum > 37) {
      riskScore += 10;
      factors.push('Late pregnancy (monitor closely)');
    }
  }
  
  // Heart Rate
  if (heartRate > 100) {
    riskScore += 20;
    factors.push('Elevated heart rate');
  } else if (heartRate < 60) {
    riskScore += 15;
    factors.push('Low heart rate');
  }
  
  // Blood Pressure
  if (systolicBP > 140 || diastolicBP > 90) {
    riskScore += 25;
    factors.push('High blood pressure');
  } else if (systolicBP > 130 || diastolicBP > 85) {
    riskScore += 15;
    factors.push('Elevated blood pressure');
  }
  
  // Body Temperature
  if (bodyTemp > 38) {
    riskScore += 10;
    factors.push('Fever detected');
  }
  
  // Symptoms
  if (symptoms && symptoms.length > 0) {
    const highRiskSymptoms = ['Vaginal Bleeding', 'Severe Swelling', 'Reduced Fetal Movement', 'Difficulty Breathing'];
    const mediumRiskSymptoms = ['Headache', 'Blurred Vision', 'Abdominal Pain', 'Fever'];
    
    symptoms.forEach(symptom => {
      if (highRiskSymptoms.includes(symptom)) {
        riskScore += 15;
        factors.push(`High-risk symptom: ${symptom}`);
      } else if (mediumRiskSymptoms.includes(symptom)) {
        riskScore += 8;
        factors.push(`Symptom: ${symptom}`);
      }
    });
  }

  const modelStartTime = process.hrtime.bigint();
  const modelStartMemory = process.memoryUsage().heapUsed;
  const modelResult = buildRiskAssessment({
    age, systolicBP, diastolicBP, bloodSugar, bloodSugarUnit, bodyTemp, heartRate,
    pregnancyWeek: pregnancyWeekNum,
    symptoms: symptomsValidation.symptoms,
    previousPregnancyHistory: historyValidation.history,
    previousRisk: previousAssessment?.riskState ?? previousAssessment?.result?.riskState,
  });
  const modelEndMemory = process.memoryUsage().heapUsed;
  const computationalPerformance = {
    executionTimeMs: Number(process.hrtime.bigint() - modelStartTime) / 1e6,
    memoryUtilizationMb: Math.max(0, modelEndMemory - modelStartMemory) / 1024 / 1024,
  };
  
  // Determine risk level
  let level, recommendations;
  
  if (modelResult.score >= 60) {
    level = 'high';
    recommendations = [
      'Schedule immediate consultation with your healthcare provider',
      'Monitor vitals every 4 hours',
      'Rest and avoid strenuous activities',
      'Stay hydrated and maintain healthy diet',
      'Contact emergency services if symptoms worsen',
    ];
  } else if (modelResult.score >= 30) {
    level = 'medium';
    recommendations = [
      'Schedule a check-up within the next week',
      'Monitor your blood pressure daily',
      'Maintain a balanced diet low in sugar and salt',
      'Ensure adequate rest and light exercise',
      'Track your symptoms and report changes',
    ];
  } else {
    level = 'low';
    recommendations = [
      'Continue regular prenatal checkups',
      'Maintain healthy lifestyle habits',
      'Stay active with moderate exercise',
      'Keep monitoring your vitals weekly',
      'Enjoy your pregnancy journey!',
    ];
  }
  if (modelResult.urgentSymptoms.length) recommendations.unshift('Seek immediate professional medical care for the selected urgent symptom(s), regardless of this screening score');
  
  const assessment = {
    id: uuidv4(),
    userId: assessmentUserId,
    enteredBy: req.user.userId,
    vitals: { age, systolicBP, diastolicBP, bloodSugar, bodyTemp, heartRate },
    pregnancyWeek: pregnancyWeekNum,
    symptoms: symptomsValidation.symptoms,
    previousPregnancyHistory: historyValidation.history,
    previousPregnancyOutcomeCode: historyValidation.history.previousPregnancyOutcomeCode,
    notes: notes || '',
    result: { ...modelResult, recommendations, computationalPerformance },
    riskState: modelResult.level === 'high' ? 2 : modelResult.level === 'medium' ? 1 : 0,
    timestamp: new Date().toISOString(),
  };

  records.push(assessment);
  writeDB('records', records);

  res.json(assessment);
});
app.get('/api/risk-assessment/history', authMiddleware, (req, res) => {
  const records = readDB('records');
  const userAssessments = records
    .filter(r => r.userId === req.user.userId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  res.json(userAssessments);
});

// Chat support route
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  const text = (message || '').toString().trim();

  if (!text) {
    return res.status(400).json({ response: 'Please type your question so MamaCare can help.' });
  }

  if (!openai) {
    return res.status(500).json({ response: 'AI service is not configured. Please contact support.' });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are MamaCare AI, a helpful maternal health assistant. Provide accurate, supportive information about pregnancy, nutrition, symptoms, and maternal care. Always advise consulting healthcare professionals for medical advice. Keep responses concise and caring.'
        },
        {
          role: 'user',
          content: text
        }
      ],
      max_tokens: 500,
    });

    const response = completion.choices[0].message.content || 'I apologize, but I cannot provide a response at this time. Please try again.';
    res.json({ response });
  } catch (error) {
    console.error('OpenAI API error:', error);
    res.status(500).json({ response: 'I apologize, but I cannot process your request at this time. Please ensure you have a stable internet connection and try again.' });
  }
});

// ==================== DOCTOR ROUTES ====================

// Get all doctors
app.get('/api/doctors', (req, res) => {
  const doctors = readDB('doctors');
  res.json(doctors);
});

// Get doctor by ID
app.get('/api/doctors/:id', (req, res) => {
  const doctors = readDB('doctors');
  const doctor = doctors.find(d => d.id === req.params.id);
  if (!doctor) {
    return res.status(404).json({ error: 'Doctor not found' });
  }
  res.json(doctor);
});

// ==================== ADMIN ROUTES ====================

// Get all users (admin only)
app.get('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
  const users = readDB('users');
  res.json(users.map(u => ({ ...u, password: undefined })));
});

// Assign admin role (superadmin only)
app.put('/api/admin/users/:id/role', authMiddleware, superadminMiddleware, (req, res) => {
  const { role } = req.body;

  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be user or admin' });
  }

  const user = users.find(u => u.id === req.params.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  user.role = role;
  user.updatedAt = new Date().toISOString();
  writeDB('users', users);

  res.json({ ...user, password: undefined });
});

// Get all records (admin only)
app.get('/api/admin/records', authMiddleware, adminMiddleware, (req, res) => {
  const records = readDB('records');
  res.json(records);
});

// Add/Update doctor (admin only)
app.post('/api/admin/doctors', authMiddleware, adminMiddleware, (req, res) => {
  const doctorData = req.body;
  const doctors = readDB('doctors');
  
  if (doctorData.id) {
    const index = doctors.findIndex(d => d.id === doctorData.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    doctors[index] = { ...doctors[index], ...doctorData, updatedAt: new Date().toISOString() };
  } else {
    const newDoctor = {
      id: uuidv4(),
      ...doctorData,
      createdAt: new Date().toISOString(),
    };
    doctors.push(newDoctor);
  }
  
  writeDB('doctors', doctors);
  res.json(doctors.find(d => d.id === (doctorData.id || doctors[doctors.length - 1].id)));
});

// Delete doctor (admin only)
app.delete('/api/admin/doctors/:id', authMiddleware, adminMiddleware, (req, res) => {
  const doctors = readDB('doctors');
  const filtered = doctors.filter(d => d.id !== req.params.id);
  writeDB('doctors', filtered);
  res.json({ message: 'Doctor deleted' });
});

// Content management endpoints (admin only)
app.get('/api/admin/posts', authMiddleware, adminMiddleware, (req, res) => {
  const posts = readDB('posts');
  res.json(posts);
});

app.post('/api/admin/posts', authMiddleware, adminMiddleware, (req, res) => {
  const posts = readDB('posts');
  const postData = req.body;
  if (postData.id) {
    const index = posts.findIndex((p) => p.id === postData.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Post not found' });
    }
    posts[index] = { ...posts[index], ...postData, updatedAt: new Date().toISOString() };
    writeDB('posts', posts);
    return res.json(posts[index]);
  }
  const newPost = {
    id: uuidv4(),
    title: postData.title || 'Untitled Post',
    excerpt: postData.excerpt || '',
    content: postData.content || '',
    image: postData.image || '',
    createdAt: new Date().toISOString(),
  };
  posts.push(newPost);
  writeDB('posts', posts);
  res.json(newPost);
});

app.delete('/api/admin/posts/:id', authMiddleware, adminMiddleware, (req, res) => {
  const posts = readDB('posts');
  const filtered = posts.filter((post) => post.id !== req.params.id);
  writeDB('posts', filtered);
  res.json({ message: 'Post deleted' });
});

app.get('/api/admin/gallery', authMiddleware, adminMiddleware, (req, res) => {
  const gallery = readDB('gallery');
  res.json(gallery);
});

app.post('/api/admin/gallery', authMiddleware, adminMiddleware, (req, res) => {
  const gallery = readDB('gallery');
  const { id, title, image, caption } = req.body;
  if (id) {
    const index = gallery.findIndex((item) => item.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Gallery item not found' });
    }
    gallery[index] = {
      ...gallery[index],
      title: title || gallery[index].title,
      image: image || gallery[index].image,
      caption: caption || gallery[index].caption,
      updatedAt: new Date().toISOString(),
    };
    writeDB('gallery', gallery);
    return res.json(gallery[index]);
  }
  const newItem = {
    id: uuidv4(),
    title: title || 'Gallery Item',
    image: image || '',
    caption: caption || '',
    createdAt: new Date().toISOString(),
  };
  gallery.push(newItem);
  writeDB('gallery', gallery);
  res.json(newItem);
});

app.delete('/api/admin/gallery/:id', authMiddleware, adminMiddleware, (req, res) => {
  const gallery = readDB('gallery');
  const filtered = gallery.filter((item) => item.id !== req.params.id);
  writeDB('gallery', filtered);
  res.json({ message: 'Gallery item deleted' });
});

app.get('/api/admin/wearables', authMiddleware, adminMiddleware, (req, res) => {
  const wearables = readDB('wearables');
  res.json(wearables);
});

app.post('/api/admin/wearables', authMiddleware, adminMiddleware, (req, res) => {
  const wearables = readDB('wearables');
  const wearableData = req.body;
  if (wearableData.id) {
    const index = wearables.findIndex((w) => w.id === wearableData.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Wearable device not found' });
    }
    wearables[index] = { ...wearables[index], ...wearableData, updatedAt: new Date().toISOString() };
    writeDB('wearables', wearables);
    return res.json(wearables[index]);
  }
  const newDevice = {
    id: uuidv4(),
    name: wearableData.name || 'New Wearable',
    description: wearableData.description || '',
    price: wearableData.price || 0,
    image: wearableData.image || '',
    specs: wearableData.specs || '',
    available: wearableData.available ?? true,
    createdAt: new Date().toISOString(),
  };
  wearables.push(newDevice);
  writeDB('wearables', wearables);
  res.json(newDevice);
});

app.delete('/api/admin/wearables/:id', authMiddleware, adminMiddleware, (req, res) => {
  const wearables = readDB('wearables');
  const filtered = wearables.filter((device) => device.id !== req.params.id);
  writeDB('wearables', filtered);
  res.json({ message: 'Wearable deleted' });
});

// Get dashboard stats (admin only)
app.get('/api/admin/stats', authMiddleware, adminMiddleware, (req, res) => {
  const users = readDB('users');
  const records = readDB('records');
  const doctors = readDB('doctors');
  const sessions = readDB('sessions');
  
  const stats = {
    totalUsers: users.length,
    totalAssessments: records.length,
    totalDoctors: doctors.length,
    totalAppointments: sessions.length,
    riskDistribution: {
      low: records.filter(r => r.result.level === 'low').length,
      medium: records.filter(r => r.result.level === 'medium').length,
      high: records.filter(r => r.result.level === 'high').length,
    },
    computationalPerformance: {
      measuredAssessments: records.filter(r => r.result?.computationalPerformance).length,
      averageExecutionTimeMs: average(records.map(r => r.result?.computationalPerformance?.executionTimeMs)),
      averageMemoryUtilizationMb: average(records.map(r => r.result?.computationalPerformance?.memoryUtilizationMb)),
    },
    recentUsers: users.slice(-5).reverse(),
    recentAssessments: records.slice(-5).reverse(),
  };
  
  res.json(stats);
});

// Search patients by email, phone, or ID (for clinic access)
app.get('/api/admin/search-patients', authMiddleware, adminMiddleware, (req, res) => {
  const query = (req.query.query || '').toLowerCase();
  
  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }
  
  const users = readDB('users');
  const results = users.filter(user => {
    const matchesEmail = user.email && user.email.toLowerCase().includes(query);
    const matchesPhone = user.phone && user.phone.toLowerCase().includes(query);
    const matchesId = (user.patientId || user.id) && (user.patientId || user.id).toLowerCase().includes(query);
    const matchesName = user.name && user.name.toLowerCase().includes(query);
    
    return matchesEmail || matchesPhone || matchesId || matchesName;
  });
  
  // Return user data without passwords
  const safeResults = results.map(user => ({
    id: user.id,
    patientId: user.patientId || user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin,
  }));
  
  res.json(safeResults);
});

app.get('/api/admin/clinicians', authMiddleware, superadminMiddleware, (req, res) => {
  const users = readDB('users');
  res.json(users.filter(user => ['clinician', 'data_entry'].includes(user.role)).map(user => ({ ...user, password: undefined })));
});

app.post('/api/admin/clinicians', authMiddleware, superadminMiddleware, (req, res) => {
  const { name, email, password, phone, clinicianType = 'clinician', specialty = '' } = req.body;
  if (!name || !email || !password || !['clinician', 'data_entry'].includes(clinicianType)) {
    return res.status(400).json({ error: 'Name, email, password, and a valid clinician type are required' });
  }
  const users = readDB('users');
  if (users.some(user => user.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: 'A user with this email already exists' });
  }
  const clinician = { id: uuidv4(), email: email.toLowerCase(), password, name, phone: phone || '', specialty, authProvider: 'email', role: clinicianType, createdAt: new Date().toISOString() };
  users.push(clinician);
  writeDB('users', users);
  res.status(201).json({ ...clinician, password: undefined });
});

app.get('/api/clinical/stats', authMiddleware, clinicalMiddleware, (req, res) => {
  const users = readDB('users').filter(user => user.role === 'user');
  const records = readDB('records');
  res.json({ totalPatients: users.length, totalAssessments: records.length, highRisk: records.filter(record => record.result?.level === 'high').length });
});

app.get('/api/clinical/patients', authMiddleware, clinicalMiddleware, (req, res) => {
  const users = readDB('users').filter(user => user.role === 'user');
  const records = readDB('records');
  res.json(users.map(user => ({ ...user, patientId: user.patientId || user.id, password: undefined, assessmentCount: records.filter(record => record.userId === user.id).length })));
});

app.get('/api/clinical/records', authMiddleware, clinicalMiddleware, (req, res) => {
  const records = readDB('records');
  const visibleRecords = ['admin', 'superadmin'].includes(req.user.role)
    ? records
    : records.filter(record => record.enteredBy === req.user.userId);
  res.json(visibleRecords);
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('  MamaCare Backend Server');
  console.log('='.repeat(60));
  console.log(`  Server running on port: ${PORT}`);
  console.log(`  API URL: http://localhost:${PORT}/api`);
  console.log(`  Health Check: http://localhost:${PORT}/health`);
  console.log('='.repeat(60));
  console.log('  Default Credentials:');
  console.log('    Superadmin: superadmin@mamacare.app / superadmin123');
  console.log('    Admin: admin@mamacare.app / admin123');
  console.log('='.repeat(60));
});

module.exports = app;

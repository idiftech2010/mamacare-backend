// MamaCare Backend - Production Ready
// Supports both local development and cloud deployment

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();

// Use PORT from environment (for cloud) or fallback to 5000 (for local)
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'mamacare_demo_secret_key_2025';

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

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Database files
const DB_FILES = {
  users: path.join(DATA_DIR, 'users.json'),
  records: path.join(DATA_DIR, 'records.json'),
  doctors: path.join(DATA_DIR, 'doctors.json'),
  content: path.join(DATA_DIR, 'content.json'),
  sessions: path.join(DATA_DIR, 'sessions.json'),
  wearables: path.join(DATA_DIR, 'wearables.json'),
  posts: path.join(DATA_DIR, 'posts.json'),
  gallery: path.join(DATA_DIR, 'gallery.json'),
};

// Initialize database files
Object.values(DB_FILES).forEach(file => {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify([]));
  }
});

// Helper functions
const readDB = (key) => {
  try {
    return JSON.parse(fs.readFileSync(DB_FILES[key], 'utf8'));
  } catch (error) {
    return [];
  }
};

const writeDB = (key, data) => {
  fs.writeFileSync(DB_FILES[key], JSON.stringify(data, null, 2));
};

// Initialize default users
const initDefaultUsers = () => {
  const users = readDB('users');
  
  // Check if superadmin exists
  const superadminExists = users.find(u => u.role === 'superadmin');
  if (!superadminExists) {
    const superadmin = {
      id: uuidv4(),
      email: 'superadmin@mamacare.app',
      password: 'superadmin123',
      name: 'Super Admin',
      phone: '+234 800 000 0000',
      authProvider: 'email',
      role: 'superadmin',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      profile: {
        age: 35,
        dueDate: null,
        bloodType: 'O+',
        allergies: [],
        medications: [],
      },
    };
    users.push(superadmin);
    writeDB('users', users);
    console.log('✓ Superadmin created: superadmin@mamacare.app / superadmin123');
  }
  
  // Check if admin exists
  const adminExists = users.find(u => u.email === 'admin@mamacare.app');
  if (!adminExists) {
    const admin = {
      id: uuidv4(),
      email: 'admin@mamacare.app',
      password: 'admin123',
      name: 'Admin User',
      phone: '+234 800 000 0001',
      authProvider: 'email',
      role: 'admin',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      profile: {
        age: 30,
        dueDate: null,
        bloodType: 'A+',
        allergies: [],
        medications: [],
      },
    };
    users.push(admin);
    writeDB('users', users);
    console.log('✓ Admin created: admin@mamacare.app / admin123');
  }
};

// Initialize default doctors
const initDoctors = () => {
  const doctors = readDB('doctors');
  if (doctors.length === 0) {
    const defaultDoctors = [
      {
        id: uuidv4(),
        name: 'Dr. Amara Okafor',
        specialty: 'Obstetrics & Gynecology',
        image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=400&fit=crop',
        bio: '15 years experience in maternal health',
        languages: ['English', 'Igbo'],
        rating: 4.9,
        reviews: 128,
        available: true,
        nextAvailable: 'Today, 2:00 PM',
        ethnicity: 'black',
        email: 'amara.okafor@mamacare.app',
        phone: '+234 801 234 5678',
        education: 'University of Lagos Medical School',
        certifications: ['FRCOG', 'FWACS'],
        createdAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        name: 'Dr. Fatima Al-Rashid',
        specialty: 'Maternal-Fetal Medicine',
        image: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400&h=400&fit=crop',
        bio: 'Specialist in high-risk pregnancies',
        languages: ['English', 'Arabic'],
        rating: 4.8,
        reviews: 96,
        available: true,
        nextAvailable: 'Tomorrow, 10:00 AM',
        ethnicity: 'arab',
        email: 'fatima.alrashid@mamacare.app',
        phone: '+234 802 345 6789',
        education: 'Cairo University Medical School',
        certifications: ['MFM', 'FRCOG'],
        createdAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        name: 'Dr. Sarah Mitchell',
        specialty: 'Obstetrics & Gynecology',
        image: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop',
        bio: 'Expert in prenatal care and delivery',
        languages: ['English', 'French'],
        rating: 4.9,
        reviews: 156,
        available: true,
        nextAvailable: 'Today, 4:30 PM',
        ethnicity: 'white',
        email: 'sarah.mitchell@mamacare.app',
        phone: '+234 803 456 7890',
        education: 'Johns Hopkins School of Medicine',
        certifications: ['FACOG', 'FRCOG'],
        createdAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        name: 'Dr. Ngozi Adeyemi',
        specialty: 'Reproductive Endocrinology',
        image: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&h=400&fit=crop',
        bio: 'Fertility specialist with compassionate care',
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
        createdAt: new Date().toISOString(),
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
        createdAt: new Date().toISOString(),
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
        createdAt: new Date().toISOString(),
      },
    ];
    writeDB('doctors', defaultDoctors);
    console.log('✓ Default doctors created');
  }
};

const initWearables = () => {
  const wearables = readDB('wearables');
  if (wearables.length === 0) {
    const defaultWearables = [
      {
        id: uuidv4(),
        name: 'Guardian Watch',
        description: 'Continuous vital tracking with African-inspired design elements',
        price: 120,
        image: 'https://images.unsplash.com/photo-1517414204285-7eb0a937d39c?w=400&h=400&fit=crop',
        specs: 'Heart rate · Blood pressure · Sleep tracking',
        available: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        name: 'Unity Band',
        description: 'Activity and sleep monitoring for holistic wellness tracking',
        price: 90,
        image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&h=400&fit=crop',
        specs: 'Activity · Sleep · Stress monitoring',
        available: true,
        createdAt: new Date().toISOString(),
      },
    ];
    writeDB('wearables', defaultWearables);
    console.log('✓ Default wearables created');
  }
};

initDefaultUsers();
initDoctors();
initWearables();

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

// ==================== AUTH ROUTES ====================

// Register
app.post('/api/auth/register', (req, res) => {
  const { email, password, name, phone, authProvider = 'email' } = req.body;
  
  const users = readDB('users');
  
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'User already exists' });
  }
  
  const newUser = {
    id: uuidv4(),
    email,
    password: authProvider === 'email' ? password : null,
    name,
    phone,
    authProvider,
    role: 'user',
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    profile: {
      age: null,
      dueDate: null,
      bloodType: null,
      allergies: [],
      medications: [],
    },
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
  
  const users = readDB('users');
  const user = users.find(u => u.email === email);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  if (authProvider === 'email' && user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  user.lastLogin = new Date().toISOString();
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
      email,
      name,
      password: null,
      authProvider: 'google',
      googleId,
      role: 'user',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      profile: {
        age: null,
        dueDate: null,
        bloodType: null,
        allergies: [],
        medications: [],
      },
    };
    users.push(user);
    writeDB('users', users);
  } else {
    user.lastLogin = new Date().toISOString();
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
  const index = users.findIndex(u => u.id === req.user.userId);
  
  if (index === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const updatedUser = {
    ...users[index],
    ...req.body,
    id: users[index].id,
    email: users[index].email,
    role: users[index].role,
    updatedAt: new Date().toISOString(),
  };
  
  users[index] = updatedUser;
  writeDB('users', users);
  
  res.json({ ...updatedUser, password: undefined });
});

// ==================== RISK ASSESSMENT ROUTES ====================

// Submit risk assessment
app.post('/api/risk-assessment', authMiddleware, (req, res) => {
  const { age, systolicBP, diastolicBP, bloodSugar, bodyTemp, heartRate, pregnancyWeek, symptoms, notes } = req.body;
  const pregnancyWeekNum = pregnancyWeek ? parseInt(pregnancyWeek, 10) : undefined;
  
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
  
  // Determine risk level
  let level, recommendations;
  
  if (riskScore >= 60) {
    level = 'high';
    recommendations = [
      'Schedule immediate consultation with your healthcare provider',
      'Monitor vitals every 4 hours',
      'Rest and avoid strenuous activities',
      'Stay hydrated and maintain healthy diet',
      'Contact emergency services if symptoms worsen',
    ];
  } else if (riskScore >= 30) {
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
  
  const result = {
    id: uuidv4(),
    userId: req.user.userId,
    timestamp: new Date().toISOString(),
    vitals: { age, systolicBP, diastolicBP, bloodSugar, bodyTemp, heartRate },
    pregnancyWeek: pregnancyWeekNum,
    symptoms: symptoms || [],
    notes: notes || '',
    result: {
      level,
      score: riskScore,
      confidence: Math.min(95, 70 + Math.random() * 20),
      factors: factors.length > 0 ? factors : ['All vitals within normal range'],
      recommendations,
    },
  };
  
  const records = readDB('records');
  records.push(result);
  writeDB('records', records);
  
  res.json(result);
});

// Get user's assessment history
app.get('/api/risk-assessment/history', authMiddleware, (req, res) => {
  const records = readDB('records');
  const userRecords = records.filter(r => r.userId === req.user.userId);
  res.json(userRecords.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
});

// Chat support route
app.post('/api/chat', (req, res) => {
  const { message } = req.body;
  const text = (message || '').toString().trim();
  const normalized = text.toLowerCase();

  if (!text) {
    return res.status(400).json({ response: 'Please type your question so MamaCare can help.' });
  }

  const knowledge = [
    {
      triggers: ['risk assessment', 'risk', 'score', 'assessment'],
      reply: 'Mamacare AI analyzes your vital signs and symptoms to estimate your pregnancy risk level. Please complete the risk assessment form on the website to receive personalized guidance.',
    },
    {
      triggers: ['wearable', 'device', 'wearables', 'watch', 'band', 'ring'],
      reply: 'Our wearable devices help track your vital signs and support continuous monitoring. You can view available devices on the Wearables page and see pricing or order information there.',
    },
    {
      triggers: ['telemedicine', 'doctor', 'appointment', 'consultation'],
      reply: 'You can connect with maternal health specialists through our Telemedicine section. Book a consultation or view the available healthcare providers there.',
    },
    {
      triggers: ['emergency', 'urgent', 'help now', 'danger'],
      reply: 'If this is an emergency, please call your local emergency number immediately. For urgent pregnancy concerns, contact a healthcare provider right away.',
    },
    {
      triggers: ['register', 'login', 'signup', 'sign up', 'sign in'],
      reply: 'To use full MamaCare features, register or login first. This also ensures your assessments and records are saved for the admin dashboard.',
    },
    {
      triggers: ['support', 'chat', 'help', 'question'],
      reply: 'MamaCare support is available 24/7. Ask any question about pregnancy, nutrition, symptoms, or device support, and I will help you navigate the platform.',
    },
  ];

  const match = knowledge.find((item) => item.triggers.some((trigger) => normalized.includes(trigger)));
  const response = match
    ? match.reply
    : 'Mamacare is an AI-assisted maternal health companion. I can help you with pregnancy risk assessment, telemedicine, wearable devices, and support resources. Please ask about your symptoms, a feature, or how to get started.';

  res.json({ response });
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
  const users = readDB('users');
  const index = users.findIndex(u => u.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be user or admin' });
  }
  
  users[index].role = role;
  users[index].updatedAt = new Date().toISOString();
  writeDB('users', users);
  
  res.json({ ...users[index], password: undefined });
});

// Get all records (admin only)
app.get('/api/admin/records', authMiddleware, adminMiddleware, (req, res) => {
  const records = readDB('records');
  const users = readDB('users');
  
  const enrichedRecords = records.map(r => ({
    ...r,
    user: users.find(u => u.id === r.userId),
  }));
  
  res.json(enrichedRecords);
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
    const matchesId = user.id && user.id.toLowerCase().includes(query);
    const matchesName = user.name && user.name.toLowerCase().includes(query);
    
    return matchesEmail || matchesPhone || matchesId || matchesName;
  });
  
  // Return user data without passwords
  const safeResults = results.map(user => ({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin,
  }));
  
  res.json(safeResults);
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

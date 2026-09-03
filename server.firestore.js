// MamaCare Backend - Firestore Persistence
// Uses Firebase Admin SDK for permanent production storage

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { buildRiskAssessment } = require('./riskAssessment');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'mamacare_demo_secret_key_2025';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const initializeFirebaseAdmin = () => {
  if (admin.apps.length > 0) return admin.app();

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    return admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }

  console.error('Missing Firebase service account credentials.');
  console.error('Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS in environment variables.');
  process.exit(1);
};

initializeFirebaseAdmin();
const db = admin.firestore();

const collectionRef = (name) => db.collection(name);
const mapDoc = (snap) => ({ id: snap.id, ...snap.data() });

const average = (values) => {
  const measuredValues = values.filter((value) => typeof value === 'number' && Number.isFinite(value));
  return measuredValues.length
    ? measuredValues.reduce((total, value) => total + value, 0) / measuredValues.length
    : 0;
};

const getAllDocs = async (collection) => {
  const snapshot = await collectionRef(collection).get();
  return snapshot.docs.map(mapDoc);
};

const getDocById = async (collection, id) => {
  const snap = await collectionRef(collection).doc(id).get();
  return snap.exists ? mapDoc(snap) : null;
};

const getDocByField = async (collection, field, value) => {
  const snapshot = await collectionRef(collection)
    .where(field, '==', value)
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  return mapDoc(snapshot.docs[0]);
};

const saveDoc = async (collection, id, data) => {
  const payload = { ...data, id };
  await collectionRef(collection).doc(id).set(payload, { merge: true });
  return await getDocById(collection, id);
};

const createDoc = async (collection, data) => {
  const id = data.id || uuidv4();
  const payload = { ...data, id };
  await collectionRef(collection).doc(id).set(payload);
  return payload;
};

const deleteDoc = async (collection, id) => {
  await collectionRef(collection).doc(id).delete();
};

const readJSONFile = (collection) => {
  const filePath = path.join(__dirname, 'db', `${collection}.json`);
  if (!fs.existsSync(filePath)) return [];
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Unable to parse ${collection}.json`, error.message);
    return [];
  }
};

const migrateJSONCollection = async (collection, defaultItems = []) => {
  const existingDocs = await getAllDocs(collection);
  if (existingDocs.length > 0) return;

  const jsonItems = readJSONFile(collection);
  const itemsToWrite = jsonItems.length > 0 ? jsonItems : defaultItems;

  if (itemsToWrite.length === 0) return;

  for (const item of itemsToWrite) {
    const id = item.id || uuidv4();
    await collectionRef(collection).doc(id).set({ ...item, id });
  }
};

const initDefaultUsers = () => [
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

const initDefaultDoctors = () => [
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
    createdAt: new Date().toISOString(),
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

const initDefaultFeaturedTopics = () => [
  {
    id: uuidv4(),
    title: 'Nutrition & Diet',
    description: 'Essential nutrients for a healthy pregnancy',
    category: 'nutrition',
    body: 'A balanced pregnancy diet should include lean protein, whole grains, fruits, vegetables, healthy fats, iron-rich foods, folate, and adequate hydration. Avoid raw fish, unpasteurized cheese, and excessive caffeine.',
    createdAt: new Date().toISOString(),
  },
  {
    id: uuidv4(),
    title: 'Exercise & Fitness',
    description: 'Safe exercises during each trimester',
    category: 'exercise',
    body: 'Gentle activities like walking, swimming, prenatal yoga, and stretching are generally safe during pregnancy. Always get approval from your healthcare provider before starting a new exercise routine.',
    createdAt: new Date().toISOString(),
  },
  {
    id: uuidv4(),
    title: 'Mental Health',
    description: 'Managing pregnancy anxiety and stress',
    category: 'mental-health',
    body: 'Pregnancy can bring strong emotions. Practice mindfulness, rest frequently, talk with your support network, and seek professional care if you feel overwhelmed or depressed.',
    createdAt: new Date().toISOString(),
  },
];

const initializeFirestore = async () => {
  await migrateJSONCollection('users', initDefaultUsers());
  await migrateJSONCollection('doctors', initDefaultDoctors());
  await migrateJSONCollection('posts');
  await migrateJSONCollection('gallery');
  await migrateJSONCollection('wearables');
  await migrateJSONCollection('records');
  await migrateJSONCollection('featuredTopics', initDefaultFeaturedTopics());
  const users = await getAllDocs('users');
  await Promise.all(users.filter(user => user.role === 'user' && !user.patientId).map(user => saveDoc('users', user.id, { patientId: createPatientId() })));
  console.log('✓ Firestore data initialization complete');
};

initializeFirestore().catch((error) => {
  console.error('Firestore initialization failed:', error);
  process.exit(1);
});

const allowedOrigins = [
  'https://swlo76a2ti7h2.ok.kimi.link',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    return callback(null, true);
  },
  credentials: true,
}));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

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

const createToken = (user) => jwt.sign(
  { userId: user.id, email: user.email, role: user.role },
  JWT_SECRET,
  { expiresIn: '7d' }
);

const safeUser = (user) => {
  const { password, ...rest } = user;
  return rest;
};

app.post('/api/auth/register', async (req, res) => {
  const { email, password, name, phone } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }

  const existingUser = await getDocByField('users', 'email', email);
  if (existingUser) {
    return res.status(400).json({ error: 'User already exists' });
  }

  const newUser = {
    id: uuidv4(),
    patientId: createPatientId(),
    email,
    password,
    name,
    phone: phone || '',
    authProvider: 'email',
    role: 'user',
    profile: {
      age: null,
      dueDate: null,
      bloodType: null,
      allergies: [],
      medications: [],
    },
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  };

  await createDoc('users', newUser);
  const token = createToken(newUser);
  res.json({ token, user: safeUser(newUser) });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const users = await getAllDocs('users');
  const user = users.find((candidate) => candidate.email?.trim().toLowerCase() === email.trim().toLowerCase());
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  await saveDoc('users', user.id, { ...user, lastLogin: new Date().toISOString() });
  const token = createToken(user);
  res.json({ token, user: safeUser(user) });
});

app.post('/api/auth/google', async (req, res) => {
  const { email, name, googleId } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required for Google sign-in' });
  }

  let user = await getDocByField('users', 'email', email);

  if (!user) {
    user = {
      id: uuidv4(),
      patientId: createPatientId(),
      email,
      name: name || email.split('@')[0],
      password: null,
      authProvider: 'google',
      googleId: googleId || null,
      role: 'user',
      profile: { age: null, dueDate: null, bloodType: null },
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };
    await createDoc('users', user);
  } else {
    await saveDoc('users', user.id, { ...user, name: user.name || name, googleId: googleId || user.googleId, lastLogin: new Date().toISOString() });
  }

  const token = createToken(user);
  res.json({ token, user: safeUser(user) });
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const user = await getDocById('users', req.user.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(safeUser(user));
});

app.put('/api/auth/me', authMiddleware, async (req, res) => {
  const user = await getDocById('users', req.user.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const updates = {
    ...req.body,
    updatedAt: new Date().toISOString(),
  };
  const updatedUser = await saveDoc('users', user.id, { ...user, ...updates });
  res.json(safeUser(updatedUser));
});

app.post('/api/risk-assessment', authMiddleware, async (req, res) => {
  const { age, systolicBP, diastolicBP, bloodSugar, bloodSugarUnit, bodyTemp, heartRate, pregnancyWeek, symptoms, notes, patientId } = req.body;
  const assessmentUserId = req.user.role === 'data_entry' && patientId ? patientId : req.user.userId;
  if (bodyTemp > 43 || bodyTemp < 34) {
    return res.status(400).json({ error: 'Invalid data: Out of physiological range' });
  }
  const pregnancyWeekNum = pregnancyWeek ? parseInt(pregnancyWeek, 10) : undefined;
  const users = await getAllDocs('users');
  const targetUser = users.find(user => user.id === assessmentUserId || user.patientId === assessmentUserId);
  if (!targetUser) return res.status(404).json({ error: 'Patient not found' });
  const previousSnapshot = await collectionRef('records')
    .where('userId', '==', targetUser.id)
    .orderBy('timestamp', 'desc')
    .limit(1)
    .get();
  const previousAssessment = previousSnapshot.empty ? null : mapDoc(previousSnapshot.docs[0]);

  let riskScore = 0;
  const factors = [];

  if (bloodSugar > 10) {
    riskScore += 35;
    factors.push('Elevated blood sugar');
  } else if (bloodSugar > 8) {
    riskScore += 20;
    factors.push('Higher than optimal blood sugar');
  }

  if (age > 35) {
    riskScore += 25;
    factors.push('Advanced maternal age');
  } else if (age < 18) {
    riskScore += 20;
    factors.push('Young maternal age');
  }

  if (pregnancyWeekNum) {
    if (pregnancyWeekNum < 12) {
      riskScore += 15;
      factors.push('Early pregnancy (higher risk period)');
    } else if (pregnancyWeekNum > 37) {
      riskScore += 10;
      factors.push('Late pregnancy (monitor closely)');
    }
  }

  if (heartRate > 100) {
    riskScore += 20;
    factors.push('Elevated heart rate');
  } else if (heartRate < 60) {
    riskScore += 15;
    factors.push('Low heart rate');
  }

  if (systolicBP > 140 || diastolicBP > 90) {
    riskScore += 25;
    factors.push('High blood pressure');
  } else if (systolicBP > 130 || diastolicBP > 85) {
    riskScore += 15;
    factors.push('Elevated blood pressure');
  }

  if (bodyTemp > 38) {
    riskScore += 10;
    factors.push('Fever detected');
  }

  if (symptoms && Array.isArray(symptoms)) {
    const highRiskSymptoms = ['Vaginal Bleeding', 'Severe Swelling', 'Reduced Fetal Movement', 'Difficulty Breathing'];
    const mediumRiskSymptoms = ['Headache', 'Blurred Vision', 'Abdominal Pain', 'Fever'];
    symptoms.forEach((symptom) => {
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
    symptoms: Array.isArray(symptoms) ? symptoms : [],
    previousRisk: previousAssessment?.riskState ?? previousAssessment?.result?.riskState,
  });
  const modelEndMemory = process.memoryUsage().heapUsed;
  const computationalPerformance = {
    executionTimeMs: Number(process.hrtime.bigint() - modelStartTime) / 1e6,
    memoryUtilizationMb: Math.max(0, modelEndMemory - modelStartMemory) / 1024 / 1024,
  };

  let level;
  let recommendations;

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

  const assessment = {
    id: uuidv4(),
    userId: targetUser.id,
    enteredBy: req.user.userId,
    vitals: { age, systolicBP, diastolicBP, bloodSugar, bodyTemp, heartRate },
    pregnancyWeek: pregnancyWeekNum,
    symptoms: Array.isArray(symptoms) ? symptoms : [],
    notes: notes || '',
    result: { ...modelResult, recommendations, computationalPerformance },
    riskState: modelResult.level === 'high' ? 2 : modelResult.level === 'medium' ? 1 : 0,
    timestamp: new Date().toISOString(),
  };

  await createDoc('records', assessment);
  res.json(assessment);
});

app.get('/api/risk-assessment/history', authMiddleware, async (req, res) => {
  const snapshot = await collectionRef('records')
    .where('userId', '==', req.user.userId)
    .orderBy('timestamp', 'desc')
    .get();
  const assessments = snapshot.docs.map(mapDoc);
  res.json(assessments);
});

const knowledgeBase = [
  {
    keywords: ['risk assessment', 'risk', 'score', 'assessment'],
    reply: 'Mamacare AI analyzes your vital signs and symptoms to estimate your pregnancy risk level. Please complete the risk assessment form to receive personalized guidance.',
  },
  {
    keywords: ['pregnancy', 'pregnant', 'trimester', 'gestation', 'due date'],
    reply: 'Pregnancy care includes regular prenatal visits, balanced nutrition, safe exercise, and monitoring for warning signs. If you have questions about symptoms, diet, fetal movement, or trimester changes, I can help explain what to look for.',
  },
  {
    keywords: ['morning sickness', 'nausea', 'vomiting', 'food aversion', 'cravings'],
    reply: 'Morning sickness is common in early pregnancy. Try small, frequent meals, ginger tea, and staying hydrated. If you have severe nausea or cannot keep fluids down, contact your healthcare provider.',
  },
  {
    keywords: ['bleeding', 'spotting', 'abdominal pain', 'cramps', 'contractions'],
    reply: 'Any bleeding, severe cramps, or regular contractions during pregnancy should be evaluated promptly. Contact your healthcare provider or emergency services immediately for guidance.',
  },
  {
    keywords: ['wearable', 'device', 'wearables', 'watch', 'band', 'ring'],
    reply: 'Our wearable devices help track your vital signs and support continuous monitoring. You can view available devices on the Wearables page and see pricing or order information there.',
  },
  {
    keywords: ['telemedicine', 'doctor', 'appointment', 'consultation'],
    reply: 'You can connect with maternal health specialists through our Telemedicine section. Book a consultation or view the available healthcare providers there.',
  },
  {
    keywords: ['nutrition', 'diet', 'food', 'calories', 'iron', 'folate'],
    reply: 'A healthy pregnancy diet includes protein, whole grains, fruits, vegetables, and plenty of fluids. Focus on iron, folate, calcium, and fiber. Avoid unpasteurized dairy, raw fish, and excessive caffeine.',
  },
  {
    keywords: ['emergency', 'urgent', 'help now', 'danger', 'fainting'],
    reply: 'If this is an emergency, please call your local emergency number immediately. For urgent pregnancy concerns, contact a healthcare provider right away.',
  },
  {
    keywords: ['register', 'login', 'signup', 'sign up', 'sign in'],
    reply: 'To use full MamaCare features, register or login first. This also ensures your assessments and records are saved for the admin dashboard.',
  },
  {
    keywords: ['support', 'chat', 'help', 'question'],
    reply: 'MamaCare support is available 24/7. Ask any question about pregnancy, nutrition, symptoms, or device support, and I will help you navigate the platform.',
  },
];

const findTopicMatch = (message, topics) => {
  const normalized = message.toLowerCase();
  return topics.find((topic) => {
    const combined = `${topic.title} ${topic.description} ${topic.body}`.toLowerCase();
    return normalized.includes(topic.title.toLowerCase()) || normalized.includes(topic.description.toLowerCase()) || combined.includes(normalized);
  });
};

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  const text = (message || '').toString().trim();
  if (!text) return res.status(400).json({ response: 'Please type your question so MamaCare can help.' });

  const topics = await getAllDocs('featuredTopics');
  const topicMatch = findTopicMatch(text, topics);

  if (topicMatch) {
    return res.json({ response: `${topicMatch.title}: ${topicMatch.description} ${topicMatch.body || ''}` });
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

app.get('/api/doctors', async (req, res) => {
  const doctors = await getAllDocs('doctors');
  res.json(doctors);
});

app.get('/api/doctors/:id', async (req, res) => {
  const doctor = await getDocById('doctors', req.params.id);
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
  res.json(doctor);
});

app.get('/api/featured-topics', async (req, res) => {
  const topics = await getAllDocs('featuredTopics');
  res.json(topics);
});

app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  const users = await getAllDocs('users');
  res.json(users.map(safeUser));
});

app.put('/api/admin/users/:id/role', authMiddleware, superadminMiddleware, async (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role. Must be user or admin' });

  const user = await getDocById('users', req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const updated = await saveDoc('users', user.id, { ...user, role, updatedAt: new Date().toISOString() });
  res.json(safeUser(updated));
});

app.get('/api/admin/records', authMiddleware, adminMiddleware, async (req, res) => {
  const records = await getAllDocs('records');
  res.json(records);
});

app.post('/api/admin/doctors', authMiddleware, adminMiddleware, async (req, res) => {
  const doctorData = req.body;
  if (doctorData.id) {
    const existing = await getDocById('doctors', doctorData.id);
    if (!existing) return res.status(404).json({ error: 'Doctor not found' });
    const updated = await saveDoc('doctors', doctorData.id, { ...existing, ...doctorData, updatedAt: new Date().toISOString() });
    return res.json(updated);
  }
  const newDoctor = {
    id: uuidv4(),
    ...doctorData,
    createdAt: new Date().toISOString(),
  };
  const created = await createDoc('doctors', newDoctor);
  res.json(created);
});

app.delete('/api/admin/doctors/:id', authMiddleware, adminMiddleware, async (req, res) => {
  await deleteDoc('doctors', req.params.id);
  res.json({ message: 'Doctor deleted' });
});

app.get('/api/admin/posts', authMiddleware, adminMiddleware, async (req, res) => {
  const posts = await getAllDocs('posts');
  res.json(posts);
});

app.post('/api/admin/posts', authMiddleware, adminMiddleware, async (req, res) => {
  const postData = req.body;
  if (postData.id) {
    const existing = await getDocById('posts', postData.id);
    if (!existing) return res.status(404).json({ error: 'Post not found' });
    const updated = await saveDoc('posts', postData.id, { ...existing, ...postData, updatedAt: new Date().toISOString() });
    return res.json(updated);
  }
  const newPost = {
    id: uuidv4(),
    title: postData.title || 'Untitled Post',
    excerpt: postData.excerpt || '',
    content: postData.content || '',
    image: postData.image || '',
    createdAt: new Date().toISOString(),
  };
  const created = await createDoc('posts', newPost);
  res.json(created);
});

app.delete('/api/admin/posts/:id', authMiddleware, adminMiddleware, async (req, res) => {
  await deleteDoc('posts', req.params.id);
  res.json({ message: 'Post deleted' });
});

app.get('/api/admin/gallery', authMiddleware, adminMiddleware, async (req, res) => {
  const gallery = await getAllDocs('gallery');
  res.json(gallery);
});

app.post('/api/admin/gallery', authMiddleware, adminMiddleware, async (req, res) => {
  const itemData = req.body;
  if (itemData.id) {
    const existing = await getDocById('gallery', itemData.id);
    if (!existing) return res.status(404).json({ error: 'Gallery item not found' });
    const updated = await saveDoc('gallery', itemData.id, { ...existing, ...itemData, updatedAt: new Date().toISOString() });
    return res.json(updated);
  }
  const newItem = {
    id: uuidv4(),
    title: itemData.title || 'Gallery Item',
    image: itemData.image || '',
    caption: itemData.caption || '',
    createdAt: new Date().toISOString(),
  };
  const created = await createDoc('gallery', newItem);
  res.json(created);
});

app.delete('/api/admin/gallery/:id', authMiddleware, adminMiddleware, async (req, res) => {
  await deleteDoc('gallery', req.params.id);
  res.json({ message: 'Gallery item deleted' });
});

app.get('/api/admin/wearables', authMiddleware, adminMiddleware, async (req, res) => {
  const wearables = await getAllDocs('wearables');
  res.json(wearables);
});

app.post('/api/admin/wearables', authMiddleware, adminMiddleware, async (req, res) => {
  const wearableData = req.body;
  if (wearableData.id) {
    const existing = await getDocById('wearables', wearableData.id);
    if (!existing) return res.status(404).json({ error: 'Wearable device not found' });
    const updated = await saveDoc('wearables', wearableData.id, { ...existing, ...wearableData, updatedAt: new Date().toISOString() });
    return res.json(updated);
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
  const created = await createDoc('wearables', newDevice);
  res.json(created);
});

app.delete('/api/admin/wearables/:id', authMiddleware, adminMiddleware, async (req, res) => {
  await deleteDoc('wearables', req.params.id);
  res.json({ message: 'Wearable deleted' });
});

app.get('/api/admin/featured-topics', authMiddleware, adminMiddleware, async (req, res) => {
  const topics = await getAllDocs('featuredTopics');
  res.json(topics);
});

app.post('/api/admin/featured-topics', authMiddleware, adminMiddleware, async (req, res) => {
  const topicData = req.body;
  const newTopic = {
    id: uuidv4(),
    title: topicData.title || 'Untitled Topic',
    description: topicData.description || '',
    category: topicData.category || 'general',
    body: topicData.body || '',
    createdAt: new Date().toISOString(),
  };
  const created = await createDoc('featuredTopics', newTopic);
  res.json(created);
});

app.put('/api/admin/featured-topics/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const existing = await getDocById('featuredTopics', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Topic not found' });
  const updated = await saveDoc('featuredTopics', req.params.id, { ...existing, ...req.body, updatedAt: new Date().toISOString() });
  res.json(updated);
});

app.delete('/api/admin/featured-topics/:id', authMiddleware, adminMiddleware, async (req, res) => {
  await deleteDoc('featuredTopics', req.params.id);
  res.json({ message: 'Featured topic deleted' });
});

app.get('/api/admin/stats', authMiddleware, adminMiddleware, async (req, res) => {
  const [users, records, doctors, sessions] = await Promise.all([
    getAllDocs('users'),
    getAllDocs('records'),
    getAllDocs('doctors'),
    getAllDocs('sessions'),
  ]);

  const stats = {
    totalUsers: users.length,
    totalAssessments: records.length,
    totalDoctors: doctors.length,
    totalAppointments: sessions.length,
    riskDistribution: {
      low: records.filter((r) => r.result?.level === 'low').length,
      medium: records.filter((r) => r.result?.level === 'medium').length,
      high: records.filter((r) => r.result?.level === 'high').length,
    },
    computationalPerformance: {
      measuredAssessments: records.filter((r) => r.result?.computationalPerformance).length,
      averageExecutionTimeMs: average(records.map((r) => r.result?.computationalPerformance?.executionTimeMs)),
      averageMemoryUtilizationMb: average(records.map((r) => r.result?.computationalPerformance?.memoryUtilizationMb)),
    },
    recentUsers: users.slice(-5).reverse(),
    recentAssessments: records.slice(-5).reverse(),
  };
  res.json(stats);
});

app.get('/api/admin/search-patients', authMiddleware, adminMiddleware, async (req, res) => {
  const queryValue = (req.query.query || '').toString().toLowerCase();
  if (!queryValue) return res.status(400).json({ error: 'Search query is required' });

  const users = await getAllDocs('users');
  const results = users.filter((user) => {
    const email = user.email?.toLowerCase() || '';
    const phone = user.phone?.toLowerCase() || '';
    const name = user.name?.toLowerCase() || '';
    const id = user.id?.toLowerCase() || '';
    const patientId = user.patientId?.toLowerCase() || '';
    return email.includes(queryValue) || phone.includes(queryValue) || name.includes(queryValue) || id.includes(queryValue) || patientId.includes(queryValue);
  });

  const safeResults = results.map((user) => ({
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

app.get('/api/admin/clinicians', authMiddleware, superadminMiddleware, async (req, res) => {
  const users = await getAllDocs('users');
  res.json(users.filter(user => ['clinician', 'data_entry'].includes(user.role)).map(safeUser));
});

app.post('/api/admin/clinicians', authMiddleware, superadminMiddleware, async (req, res) => {
  const { name, email, password, phone, clinicianType = 'clinician', specialty = '' } = req.body;
  if (!name || !email || !password || !['clinician', 'data_entry'].includes(clinicianType)) {
    return res.status(400).json({ error: 'Name, email, password, and a valid clinician type are required' });
  }
  if (await getDocByField('users', 'email', email.toLowerCase())) {
    return res.status(400).json({ error: 'A user with this email already exists' });
  }
  const clinician = { id: uuidv4(), email: email.toLowerCase(), password, name, phone: phone || '', specialty, authProvider: 'email', role: clinicianType, createdAt: new Date().toISOString() };
  await createDoc('users', clinician);
  res.status(201).json(safeUser(clinician));
});

app.get('/api/clinical/stats', authMiddleware, clinicalMiddleware, async (req, res) => {
  const [users, records] = await Promise.all([getAllDocs('users'), getAllDocs('records')]);
  res.json({ totalPatients: users.filter(user => user.role === 'user').length, totalAssessments: records.length, highRisk: records.filter(record => record.result?.level === 'high').length });
});

app.get('/api/clinical/patients', authMiddleware, clinicalMiddleware, async (req, res) => {
  const [users, records] = await Promise.all([getAllDocs('users'), getAllDocs('records')]);
  res.json(users.filter(user => user.role === 'user').map(user => ({ ...safeUser(user), patientId: user.patientId || user.id, assessmentCount: records.filter(record => record.userId === user.id).length })));
});

app.get('/api/clinical/records', authMiddleware, clinicalMiddleware, async (req, res) => {
  const records = await getAllDocs('records');
  const visibleRecords = ['admin', 'superadmin'].includes(req.user.role)
    ? records
    : records.filter(record => record.enteredBy === req.user.userId);
  res.json(visibleRecords);
});

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('  MamaCare Backend Server (Firestore)');
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

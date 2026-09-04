const vitalDefinitions = [
  { key: 'bloodSugar', label: 'Blood sugar (mmol/L)', evaluate: value => value > 8 ? { contribution: value > 10 ? 35 : 20, reason: value > 10 ? 'Elevated blood sugar' : 'Higher than optimal blood sugar' } : null },
  { key: 'age', label: 'Maternal age (years)', evaluate: value => value > 35 ? { contribution: 25, reason: 'Advanced maternal age' } : value < 18 ? { contribution: 20, reason: 'Young maternal age' } : null },
  { key: 'heartRate', label: 'Heart rate (bpm)', evaluate: value => value > 100 ? { contribution: 20, reason: 'Elevated heart rate' } : value < 60 ? { contribution: 15, reason: 'Low heart rate' } : null },
  { key: 'systolicBP', label: 'Systolic blood pressure (mmHg)', evaluate: value => value > 140 ? { contribution: 25, reason: 'High blood pressure' } : value > 130 ? { contribution: 15, reason: 'Elevated blood pressure' } : null },
  { key: 'diastolicBP', label: 'Diastolic blood pressure (mmHg)', evaluate: value => value > 90 ? { contribution: 25, reason: 'High blood pressure' } : value > 85 ? { contribution: 15, reason: 'Elevated blood pressure' } : null },
  { key: 'bodyTemp', label: 'Body temperature (°C)', evaluate: value => value > 38 ? { contribution: 10, reason: 'Fever detected' } : null },
];

const highRiskSymptoms = ['Vaginal Bleeding', 'Severe Swelling', 'Reduced Fetal Movement', 'Difficulty Breathing'];
const mediumRiskSymptoms = ['Headache', 'Blurred Vision', 'Abdominal Pain', 'Fever'];
const historyRiskRules = [
  { value: 'pre-eclampsia', label: 'Previous pre-eclampsia', contribution: 12 },
  { value: 'eclampsia', label: 'Previous eclampsia', contribution: 15 },
  { value: 'gestational hypertension', label: 'Previous gestational hypertension', contribution: 8 },
  { value: 'gestational diabetes', label: 'Previous gestational diabetes', contribution: 8 },
  { value: 'postpartum haemorrhage', label: 'Previous postpartum haemorrhage', contribution: 8 },
  { value: 'preterm birth', label: 'Previous preterm birth', contribution: 10 },
  { value: 'recurrent miscarriage', label: 'Previous recurrent miscarriage', contribution: 8 },
  { value: 'Miscarriage', label: 'Previous pregnancy loss', contribution: 5 },
  { value: 'stillbirth', label: 'Previous stillbirth', contribution: 10 },
  { value: 'ectopic pregnancy', label: 'Previous ectopic pregnancy', contribution: 8 },
  { value: 'Caesarean section', label: 'Previous Caesarean section', contribution: 3 },
  { value: 'Emergency Caesarean section', label: 'Previous emergency Caesarean section', contribution: 5 },
];

const emptyPregnancyHistory = () => ({
  gravida: null,
  para: null,
  liveBirths: null,
  pregnancyLosses: null,
  previousCesareanSections: null,
  previousMultiplePregnancy: null,
  outcomes: [],
  deliveryMethods: [],
  complications: [],
  unknown: false,
});

function normalizePreviousPregnancyHistory(history) {
  if (!history || typeof history !== 'object') return emptyPregnancyHistory();
  const normalized = emptyPregnancyHistory();
  ['gravida', 'para', 'liveBirths', 'pregnancyLosses', 'previousCesareanSections'].forEach((key) => {
    if (history[key] !== null && history[key] !== undefined && history[key] !== '') normalized[key] = Number(history[key]);
  });
  normalized.previousMultiplePregnancy = history.previousMultiplePregnancy === true ? true : history.previousMultiplePregnancy === false ? false : null;
  normalized.outcomes = Array.isArray(history.outcomes) ? [...new Set(history.outcomes.map(String))] : [];
  normalized.deliveryMethods = Array.isArray(history.deliveryMethods) ? [...new Set(history.deliveryMethods.map(String))] : [];
  normalized.complications = Array.isArray(history.complications) ? [...new Set(history.complications.map(String))] : [];
  normalized.unknown = history.unknown === true;
  return normalized;
}

function validatePreviousPregnancyHistory(history) {
  const normalized = normalizePreviousPregnancyHistory(history);
  const counts = ['gravida', 'para', 'liveBirths', 'pregnancyLosses', 'previousCesareanSections'];
  for (const key of counts) {
    if (normalized[key] !== null && (!Number.isInteger(normalized[key]) || normalized[key] < 0)) {
      return { error: `${key} must be a non-negative whole number` };
    }
  }
  if (normalized.gravida !== null && normalized.para !== null && normalized.para > normalized.gravida) {
    return { error: 'Para cannot exceed Gravida' };
  }
  if (normalized.gravida !== null) {
    for (const key of ['liveBirths', 'pregnancyLosses', 'previousCesareanSections']) {
      if (normalized[key] !== null && normalized[key] > normalized.gravida) return { error: `${key} cannot exceed Gravida` };
    }
  }
  const noPrevious = normalized.outcomes.includes('No previous pregnancy');
  const hasPreviousData = normalized.outcomes.some((item) => !['No previous pregnancy', 'Previous pregnancy outcome unknown'].includes(item))
    || normalized.deliveryMethods.length > 0 || normalized.complications.some((item) => !['No known previous complication'].includes(item))
    || counts.some((key) => normalized[key] !== null && normalized[key] > 0)
    || normalized.previousMultiplePregnancy === true;
  if (noPrevious && hasPreviousData) return { error: 'No previous pregnancy cannot be combined with previous outcomes, deliveries, complications, or positive counts' };
  if (normalized.unknown && hasPreviousData && !normalized.complications.every((item) => item === 'Unknown previous pregnancy history') && !normalized.outcomes.every((item) => item === 'Previous pregnancy outcome unknown')) return { error: 'Unknown previous pregnancy history cannot be combined with recorded history' };
  return { history: normalized };
}

function validateSymptoms(symptoms) {
  if (!Array.isArray(symptoms)) return { symptoms: [] };
  const normalized = [...new Set(symptoms.map(String))];
  if (normalized.includes('None') && normalized.length > 1) return { error: 'None cannot be combined with other symptoms' };
  return { symptoms: normalized.filter((symptom) => symptom !== 'None') };
}

function buildExpandedFeatureVector({ age, systolicBP, diastolicBP, bloodSugar, bodyTemp, heartRate, symptoms, previousPregnancyHistory }) {
  const history = normalizePreviousPregnancyHistory(previousPregnancyHistory);
  const vector = { age, systolicBP, diastolicBP, bloodSugar, bodyTemp, heartRate };
  historyRiskRules.forEach((rule, index) => { vector[`historyRisk_${index + 1}`] = Number(history.outcomes.concat(history.complications, history.deliveryMethods).includes(rule.value)); });
  ['Headache', 'Dizziness', 'Blurred Vision', 'Abdominal Pain', 'Vaginal Bleeding', 'Severe Swelling', 'Reduced Fetal Movement', 'Fever', 'Nausea/Vomiting', 'Difficulty Breathing'].forEach((symptom) => {
    vector[`currentSymptom_${symptom.replace(/[^A-Za-z]/g, '')}`] = Number(symptoms.includes(symptom));
  });
  vector.gravida = history.gravida;
  vector.para = history.para;
  vector.liveBirths = history.liveBirths;
  vector.pregnancyLosses = history.pregnancyLosses;
  vector.previousCesareanSections = history.previousCesareanSections;
  vector.previousMultiplePregnancy = history.previousMultiplePregnancy === null ? null : Number(history.previousMultiplePregnancy);
  return vector;
}

function buildRiskAssessment({ age, systolicBP, diastolicBP, bloodSugar, bloodSugarUnit, bodyTemp, heartRate, pregnancyWeek, symptoms = [], previousRisk, previousPregnancyHistory }) {
  const history = normalizePreviousPregnancyHistory(previousPregnancyHistory);
  const vitals = { age, systolicBP, diastolicBP, bloodSugar, bodyTemp, heartRate };
  const vitalContributions = [];
  const factors = [];

  vitalDefinitions.forEach(({ key, label, evaluate }) => {
    const hasValue = vitals[key] !== undefined && vitals[key] !== null && vitals[key] !== '';
    const scoreValue = key === 'bloodSugar' && bloodSugarUnit === 'mg/dL' ? vitals[key] / 18 : vitals[key];
    const finding = hasValue && (key !== 'bloodSugar' || bloodSugarUnit) ? evaluate(scoreValue) : null;
    if (hasValue) {
      const unit = key === 'bloodSugar' ? bloodSugarUnit || 'unit required' : key === 'age' ? 'years' : key === 'systolicBP' || key === 'diastolicBP' ? 'mmHg' : key === 'heartRate' ? 'bpm' : '°C';
      vitalContributions.push({ feature: key, label, contribution: finding?.contribution || 0, reason: finding?.reason || 'Within configured threshold', value: vitals[key], unit });
      if (finding) {
      if (!factors.includes(finding.reason)) factors.push(finding.reason);
      }
    }
  });

  if (pregnancyWeek && (pregnancyWeek < 12 || pregnancyWeek > 37)) {
    const reason = pregnancyWeek < 12 ? 'Early pregnancy (higher risk period)' : 'Late pregnancy (monitor closely)';
    factors.push(reason);
  }

  const symptomContributions = symptoms.map(symptom => {
    const contribution = highRiskSymptoms.includes(symptom) ? 15 : mediumRiskSymptoms.includes(symptom) ? 8 : 0;
    if (contribution) factors.push(`${highRiskSymptoms.includes(symptom) ? 'High-risk symptom' : 'Symptom'}: ${symptom}`);
    return { symptom, contribution, reason: contribution ? (highRiskSymptoms.includes(symptom) ? 'High-risk symptom' : 'Moderate symptom signal') : 'No direct score contribution' };
  });

  const historyContributions = historyRiskRules
    .filter((rule) => history.outcomes.concat(history.complications, history.deliveryMethods).includes(rule.value))
    .map((rule) => ({ feature: rule.value, label: rule.label, contribution: rule.contribution, reason: 'Historical risk pattern to discuss with a clinician' }));
  historyContributions.forEach((item) => factors.push(item.label));

  const pregnancyContribution = pregnancyWeek && pregnancyWeek < 12 ? 15 : pregnancyWeek && pregnancyWeek > 37 ? 10 : 0;
  const urgentSymptoms = symptoms.filter((symptom) => highRiskSymptoms.includes(symptom));
  const riskScore = vitalContributions.reduce((total, item) => total + item.contribution, 0)
    + symptomContributions.reduce((total, item) => total + item.contribution, 0) + historyContributions.reduce((total, item) => total + item.contribution, 0) + pregnancyContribution;
  const level = urgentSymptoms.length || riskScore >= 60 ? 'high' : riskScore >= 30 ? 'medium' : 'low';
  const riskState = level === 'high' ? 2 : level === 'medium' ? 1 : 0;
  const deltaRisk = typeof previousRisk === 'number' ? riskState - previousRisk : null;
  const alertStatus = urgentSymptoms.length ? 'Urgent clinical review required' : level === 'high' ? 'High-Risk Alert' : deltaRisk !== null && deltaRisk > 0 ? 'Risk Escalation Alert' : 'Routine Monitoring';
  const protectiveFactors = [];
  if (!history.unknown && history.complications.includes('No known previous complication')) protectiveFactors.push('No known previous complication reported');
  if (!symptoms.length) protectiveFactors.push('No current symptoms reported');

  const correlationRules = [
    { symptoms: ['Headache', 'Blurred Vision', 'Severe Swelling'], vitals: ['systolicBP', 'diastolicBP'], explanation: 'This symptom is a warning sign to review with the blood pressure reading.' },
    { symptoms: ['Fever'], vitals: ['bodyTemp'], explanation: 'The symptom is directly compared with the body temperature reading.' },
    { symptoms: ['Difficulty Breathing'], vitals: ['heartRate'], explanation: 'The symptom is reviewed alongside the heart-rate reading; the displayed value shows whether tachycardia is present.' },
    { symptoms: ['Dizziness'], vitals: ['systolicBP', 'diastolicBP', 'heartRate'], explanation: 'The symptom is reviewed alongside cardiovascular readings.' },
    { symptoms: ['Nausea/Vomiting'], vitals: ['bloodSugar'], explanation: 'The symptom is recorded alongside the blood sugar reading for clinical review.' },
    { symptoms: ['Abdominal Pain', 'Vaginal Bleeding', 'Reduced Fetal Movement'], vitals: ['systolicBP', 'diastolicBP'], explanation: 'This symptom requires clinical review alongside the blood pressure readings.' },
  ];
  const correlations = correlationRules.flatMap(rule => symptoms.filter(symptom => rule.symptoms.includes(symptom)).flatMap(symptom => rule.vitals.filter(vital => vitals[vital] !== undefined && vitals[vital] !== null && vitals[vital] !== '').map(vital => ({ symptom, vital, vitalLabel: vitalDefinitions.find(item => item.key === vital)?.label || vital, vitalValue: vitals[vital], vitalUnit: vitalContributions.find(item => item.feature === vital)?.unit || 'unit unavailable', relationship: rule.explanation, strength: vitalContributions.some(item => item.feature === vital && item.contribution > 0) ? 'observed' : 'contextual' }))));
  const historyCorrelations = historyContributions.flatMap((historyItem) => vitalContributions
    .filter((vitalItem) => vitalItem.contribution > 0)
    .map((vitalItem) => ({
      history: historyItem.feature,
      historyLabel: historyItem.label,
      vital: vitalItem.feature,
      vitalLabel: vitalItem.label,
      vitalValue: vitalItem.value,
      vitalUnit: vitalItem.unit,
      relationship: 'Previous pregnancy history is reviewed alongside this current vital-sign risk signal.',
      strength: 'observed',
    })));

  const riskCategories = [];
  const hasHypertension = systolicBP >= 140 || diastolicBP >= 90;
  const preeclampsiaSymptoms = symptoms.filter(symptom => ['Headache', 'Blurred Vision', 'Severe Swelling', 'Abdominal Pain'].includes(symptom));
  if (hasHypertension && preeclampsiaSymptoms.length) {
    riskCategories.push({ name: 'Preeclampsia warning signs', status: 'Needs clinical evaluation', evidence: [`Blood pressure ${systolicBP}/${diastolicBP} mmHg`, `Selected symptom(s): ${preeclampsiaSymptoms.join(', ')}`], note: 'This is a screening flag, not a diagnosis.' });
  } else if (hasHypertension) {
    riskCategories.push({ name: 'Pregnancy-related hypertension risk', status: 'Needs clinical review', evidence: [`Blood pressure ${systolicBP}/${diastolicBP} mmHg`], note: 'This is a screening flag, not a diagnosis.' });
  }
  const glucoseForScoring = bloodSugarUnit === 'mg/dL' ? bloodSugar / 18 : bloodSugar;
  if (bloodSugarUnit && glucoseForScoring > 8) riskCategories.push({ name: 'Hyperglycemia risk', status: 'Needs clinical review', evidence: [`Blood sugar ${bloodSugar} ${bloodSugarUnit}`], note: 'Confirm timing and local clinical reference range before interpretation.' });
  if (bodyTemp > 38 || symptoms.includes('Fever')) riskCategories.push({ name: 'Febrile illness risk', status: 'Needs clinical review', evidence: [`Body temperature ${bodyTemp} °C`, ...(symptoms.includes('Fever') ? ['Selected symptom: Fever'] : [])], note: 'A high temperature can have infectious or non-infectious causes.' });
  if (heartRate > 100) riskCategories.push({ name: 'Tachycardia risk', status: 'Needs clinical review', evidence: [`Heart rate ${heartRate} bpm`] });
  if (heartRate < 60) riskCategories.push({ name: 'Bradycardia risk', status: 'Needs clinical review', evidence: [`Heart rate ${heartRate} bpm`] });
  if (symptoms.some(symptom => highRiskSymptoms.includes(symptom))) riskCategories.push({ name: 'Obstetric warning symptoms', status: 'Urgent clinical review', evidence: [`Selected symptom(s): ${symptoms.filter(symptom => highRiskSymptoms.includes(symptom)).join(', ')}`], note: 'Urgency depends on clinical assessment and context.' });
  if (age < 18) riskCategories.push({ name: 'Adolescent pregnancy risk factor', status: 'Needs clinical review', evidence: [`Maternal age ${age} years`] });
  if (age > 35) riskCategories.push({ name: 'Advanced maternal age risk factor', status: 'Needs clinical review', evidence: [`Maternal age ${age} years`] });

  return {
    score: riskScore,
    level,
    confidence: Math.min(95, 70 + Math.min(20, riskScore / 5)),
    factors: factors.length ? factors : ['All recorded inputs within configured thresholds'],
    vitalContributions,
    symptomContributions,
    historyContributions,
    protectiveFactors,
    previousPregnancyHistory: history,
    currentSymptoms: symptoms,
    featureVector: buildExpandedFeatureVector({ age, systolicBP, diastolicBP, bloodSugar, bodyTemp, heartRate, symptoms, previousPregnancyHistory: history }),
    modelVersion: 'rule-based-lscdm-expanded-v1',
    expandedFeatureSetUsed: true,
    shapAvailable: false,
    riskProbabilities: { low: level === 'low' ? 1 : 0, medium: level === 'medium' ? 1 : 0, high: level === 'high' ? 1 : 0 },
    urgentSymptoms,
    correlations,
    historyCorrelations,
    riskCategories,
    respiratoryRate: null,
    previousRisk: typeof previousRisk === 'number' ? previousRisk : null,
    deltaRisk,
    alertStatus,
  };
}

module.exports = { buildRiskAssessment, normalizePreviousPregnancyHistory, validatePreviousPregnancyHistory, validateSymptoms };
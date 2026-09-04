const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildRiskAssessment,
  validatePreviousPregnancyHistory,
  validateSymptoms,
} = require('./riskAssessment');

const baseHistory = {
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
};

const baseInput = {
  age: 28,
  systolicBP: 120,
  diastolicBP: 80,
  bloodSugar: 5,
  bloodSugarUnit: 'mmol/L',
  bodyTemp: 37,
  heartRate: 75,
  pregnancyWeek: 20,
  symptoms: [],
  previousPregnancyHistory: baseHistory,
};

test('accepts empty and unknown previous pregnancy history', () => {
  assert.equal(validatePreviousPregnancyHistory(undefined).history.unknown, false);
  assert.equal(validatePreviousPregnancyHistory({ ...baseHistory, unknown: true }).history.unknown, true);
});

test('rejects negative counts and invalid count relationships', () => {
  assert.match(validatePreviousPregnancyHistory({ ...baseHistory, gravida: -1 }).error, /non-negative/);
  assert.match(validatePreviousPregnancyHistory({ ...baseHistory, gravida: 1, para: 2 }).error, /Para/);
  assert.match(validatePreviousPregnancyHistory({ ...baseHistory, gravida: 1, liveBirths: 2 }).error, /liveBirths/);
});

test('rejects contradictory no-history selections', () => {
  const result = validatePreviousPregnancyHistory({ ...baseHistory, outcomes: ['No previous pregnancy'], complications: ['pre-eclampsia'] });
  assert.match(result.error, /cannot be combined/);
});

test('rejects None symptom with another symptom', () => {
  assert.match(validateSymptoms(['None', 'Headache']).error, /None/);
  assert.deepEqual(validateSymptoms(['None']).symptoms, []);
});

test('uses multiple history categories in the expanded assessment', () => {
  const result = buildRiskAssessment({
    ...baseInput,
    symptoms: ['Headache'],
    previousPregnancyHistory: { ...baseHistory, outcomes: ['Miscarriage'], complications: ['pre-eclampsia', 'preterm birth'], deliveryMethods: ['Caesarean section'] },
  });
  assert.equal(result.expandedFeatureSetUsed, true);
  assert.equal(result.shapAvailable, false);
  assert.equal(result.historyContributions.length, 4);
  assert.ok(result.featureVector.historyRisk_1 >= 0);
  assert.match(result.historyContributions[0].label, /Previous/);
});

test('urgent symptoms force urgent alert regardless of score', () => {
  const result = buildRiskAssessment({ ...baseInput, symptoms: ['Vaginal Bleeding'] });
  assert.equal(result.level, 'high');
  assert.equal(result.alertStatus, 'Urgent clinical review required');
  assert.deepEqual(result.urgentSymptoms, ['Vaginal Bleeding']);
});

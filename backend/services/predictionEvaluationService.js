const Prediction = require('../models/Prediction');
const FarmerFeedback = require('../models/FarmerFeedback');
const Harvest = require('../models/Harvest');
const SensorReading = require('../models/SensorReading');
const QualityObservation = require('../models/QualityObservation');

const MINIMUM_EVALUATION_SAMPLES = 2;
const BINARY_LABELS = ['NO_SPOILAGE', 'SPOILAGE'];

const asKey = (value) => (value == null ? null : String(value));

const actualSpoilageLabel = (feedback) => {
  if (feedback.actualSpoilageOutcome === 'No Spoilage') return 'NO_SPOILAGE';
  if (['Partial Spoilage', 'Full Spoilage'].includes(feedback.actualSpoilageOutcome)) return 'SPOILAGE';
  if (feedback.actualSaleStatus === 'Spoiled') return 'SPOILAGE';
  if (typeof feedback.spoiledQuantity === 'number' && feedback.spoiledQuantity > 0) return 'SPOILAGE';
  return null;
};

const predictedSpoilageLabel = (prediction) => {
  if (!['Low', 'Medium', 'High'].includes(prediction.spoilageRisk)) return null;
  // This evaluates a documented high-risk alert against observed spoilage occurrence.
  // It does not claim Low, Medium, and High are equivalent to outcome severity classes.
  return prediction.spoilageRisk === 'High' ? 'SPOILAGE' : 'NO_SPOILAGE';
};

const latestFeedbackByPrediction = (feedbackRecords) => feedbackRecords.reduce((result, feedback) => {
  const key = asKey(feedback.predictionId);
  if (!key) return result;
  const current = result.get(key);
  const currentTime = current ? new Date(current.observedAt || current.submittedAt || 0).getTime() : -1;
  const feedbackTime = new Date(feedback.observedAt || feedback.submittedAt || 0).getTime();
  if (!current || feedbackTime >= currentTime) result.set(key, feedback);
  return result;
}, new Map());

const calculateBinaryMetrics = (records) => {
  const evaluated = records.filter((record) => record.predictedLabel && record.actualLabel);
  const confusionMatrix = BINARY_LABELS.map((actual) => BINARY_LABELS.map((predicted) => (
    evaluated.filter((record) => record.actualLabel === actual && record.predictedLabel === predicted).length
  )));
  const actualClasses = new Set(evaluated.map((record) => record.actualLabel));
  const predictedClasses = new Set(evaluated.map((record) => record.predictedLabel));

  if (evaluated.length < MINIMUM_EVALUATION_SAMPLES || actualClasses.size < 2 || predictedClasses.size < 2) {
    return {
      available: false,
      confusionMatrix: { labels: BINARY_LABELS, matrix: confusionMatrix },
      message: 'Insufficient labeled outcomes for reliable evaluation.',
    };
  }

  const metrics = {};
  BINARY_LABELS.forEach((label, index) => {
    const truePositive = confusionMatrix[index][index];
    const falsePositive = confusionMatrix[1 - index][index];
    const falseNegative = confusionMatrix[index][1 - index];
    const precision = truePositive + falsePositive ? truePositive / (truePositive + falsePositive) : 0;
    const recall = truePositive + falseNegative ? truePositive / (truePositive + falseNegative) : 0;
    metrics[label] = {
      precision,
      recall,
      f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
      support: truePositive + falseNegative,
    };
  });

  return {
    available: true,
    evaluatedSamples: evaluated.length,
    confusionMatrix: { labels: BINARY_LABELS, matrix: confusionMatrix },
    precision: metrics.SPOILAGE.precision,
    recall: metrics.SPOILAGE.recall,
    f1: metrics.SPOILAGE.f1,
    perClass: metrics,
  };
};

const toPlain = (value) => (value && typeof value.toObject === 'function' ? value.toObject() : value);

const prepareRow = ({ prediction, harvest, sensor, feedback }) => {
  const features = toPlain(prediction.featuresUsed) || {};
  const predictionTime = new Date(prediction.predictedAt || prediction.createdAt);
  const sensorTime = sensor ? new Date(sensor.timestamp || sensor.createdAt) : null;
  const sensorIsValidForPrediction = sensorTime && !Number.isNaN(sensorTime.getTime()) && sensorTime <= predictionTime;
  const actualLabel = feedback ? actualSpoilageLabel(feedback) : null;

  return {
    harvest_id: asKey(harvest?._id || prediction.harvestId),
    prediction_id: asKey(prediction._id),
    prediction_timestamp: prediction.predictedAt || prediction.createdAt || null,
    model_version: prediction.modelVersion || null,
    model_source: prediction.source || null,
    crop: harvest?.crop || features.crop || null,
    variety: harvest?.variety || null,
    maturity_stage: harvest?.maturityStage || features.maturity_stage || null,
    harvest_timestamp: harvest?.harvestDate || null,
    storage_type: harvest?.storageType || null,
    storage_condition: harvest?.storageCondition || features.storage_condition || null,
    initial_weight: harvest?.initialWeight ?? null,
    quantity: harvest?.quantity ?? null,
    unit: harvest?.unit || null,
    sensor_observation_timestamp: sensorIsValidForPrediction ? sensor.timestamp || sensor.createdAt : null,
    temperature: sensorIsValidForPrediction ? sensor.temperature ?? features.temperature_c ?? null : features.temperature_c ?? null,
    humidity: sensorIsValidForPrediction ? sensor.humidity ?? features.humidity_percent ?? null : features.humidity_percent ?? null,
    calibrated_ethylene: null,
    voc_index: sensorIsValidForPrediction ? sensor.voc ?? features.voc_index ?? null : features.voc_index ?? null,
    co2: sensorIsValidForPrediction ? sensor.co2 ?? features.co2_ppm ?? null : features.co2_ppm ?? null,
    current_weight: sensorIsValidForPrediction ? sensor.currentWeight ?? null : null,
    actual_outcome: actualLabel,
    actual_outcome_timestamp: feedback?.observedAt || null,
    label_confidence: actualLabel ? 'farmer_reported' : null,
    censoring_status: actualLabel ? 'observed_outcome' : 'outcome_unknown',
    shelf_life_label_days: null,
    shelf_life_label_status: 'missing_no_saleable_life_endpoint',
  };
};

const evaluatePredictions = async () => {
  const [predictions, feedbackRecords] = await Promise.all([
    Prediction.find({}),
    FarmerFeedback.find({}),
  ]);
  const harvestIds = [...new Set(predictions.map((prediction) => asKey(prediction.harvestId)).filter(Boolean))];
  const predictionIds = predictions.map((prediction) => prediction._id).filter(Boolean);
  const [harvests, sensors] = await Promise.all([
    harvestIds.length ? Harvest.find({ _id: { $in: harvestIds } }) : [],
    predictionIds.length ? SensorReading.find({}) : [],
  ]);
  const harvestById = new Map(harvests.map((harvest) => [asKey(harvest._id), harvest]));
  const sensorById = new Map(sensors.map((sensor) => [asKey(sensor._id), sensor]));
  const feedbackByPrediction = latestFeedbackByPrediction(feedbackRecords);

  const records = predictions.map((prediction) => {
    const feedback = feedbackByPrediction.get(asKey(prediction._id));
    const harvest = harvestById.get(asKey(prediction.harvestId));
    const harvestBelongsToPrediction = harvest
      && (!harvest.farmerId || asKey(harvest.farmerId) === asKey(prediction.farmerId));
    const ownsRelationship = feedback
      && harvestBelongsToPrediction
      && asKey(feedback.farmerId) === asKey(prediction.farmerId)
      && asKey(feedback.harvestId) === asKey(prediction.harvestId);
    const usableFeedback = ownsRelationship ? feedback : null;
    return {
      predictionId: asKey(prediction._id),
      modelVersion: prediction.modelVersion || null,
      modelSource: prediction.source || null,
      predictedAt: prediction.predictedAt || prediction.createdAt || null,
      actualOutcome: usableFeedback ? actualSpoilageLabel(usableFeedback) : null,
      predictedLabel: predictedSpoilageLabel(prediction),
      feedbackLinked: Boolean(usableFeedback),
      evaluable: Boolean(usableFeedback && actualSpoilageLabel(usableFeedback) && predictedSpoilageLabel(prediction)),
      preparedRow: prepareRow({
        prediction,
        harvest,
        sensor: sensorById.get(asKey(prediction.sensorReadingId)),
        feedback: usableFeedback,
      }),
    };
  });

  const evaluatedRecords = records.filter((record) => record.evaluable);
  const sourceGroups = [...new Set(records.map((record) => record.modelSource || 'unknown'))].map((source) => {
    const group = records.filter((record) => (record.modelSource || 'unknown') === source);
    const groupMetrics = calculateBinaryMetrics(group.map((record) => ({
      predictedLabel: record.predictedLabel,
      actualLabel: record.actualOutcome,
    })));
    return {
      modelSource: source,
      modelVersions: [...new Set(group.map((record) => record.modelVersion).filter(Boolean))],
      evaluatedSamples: group.filter((record) => record.evaluable).length,
      unevaluatedSamples: group.filter((record) => !record.evaluable).length,
      metrics: groupMetrics,
    };
  });

  const metrics = calculateBinaryMetrics(records.map((record) => ({
    predictedLabel: record.predictedLabel,
    actualLabel: record.actualOutcome,
  })));

  return {
    status: metrics.available ? 'ok' : 'insufficient_data',
    evaluatedSamples: evaluatedRecords.length,
    unevaluatedSamples: records.length - evaluatedRecords.length,
    linkedFeedbackSamples: records.filter((record) => record.feedbackLinked).length,
    outcomeCoverage: records.length ? evaluatedRecords.length / records.length : 0,
    modelVersions: [...new Set(records.map((record) => record.modelVersion).filter(Boolean))],
    metrics,
    bySource: sourceGroups,
    shelfLife: {
      labelsAvailable: 0,
      labelsMissing: records.length,
      reason: 'Current feedback records do not establish an end-of-saleable-life timestamp.',
    },
    records,
  };
};

const getDataQualityReport = async () => {
  const result = await evaluatePredictions();
  const [harvests, feedbackRecords, sensors, qualityObservations] = await Promise.all([
    Harvest.find({}),
    FarmerFeedback.find({}),
    SensorReading.find({}),
    QualityObservation.find({}),
  ]);
  const sensorFields = ['temperature', 'humidity', 'ethylene', 'voc', 'co2', 'currentWeight'];
  const availableSensorFields = Object.fromEntries(sensorFields.map((field) => [
    field,
    sensors.filter((sensor) => sensor[field] !== null && sensor[field] !== undefined).length,
  ]));

  const harvestIdsWithRepeatedObservations = [...new Set(sensors.map((sensor) => asKey(sensor.harvestId)).filter(Boolean))].filter((harvestId) => {
    const sensorCount = sensors.filter((sensor) => asKey(sensor.harvestId) === harvestId).length;
    return sensorCount > 1;
  }).length;

  const validQualityObservations = qualityObservations.filter((observation) => {
    if (!observation?.observedAt || !observation?.saleabilityStatus) return false;
    const observed = new Date(observation.observedAt);
    return !Number.isNaN(observed.getTime()) && observed.getTime() <= Date.now();
  }).length;

  const documentedSaleabilityTransitions = qualityObservations.filter((observation) => ['SALEABLE', 'BORDERLINE', 'NOT_SALEABLE'].includes(observation.saleabilityStatus)).length;
  const validEndpoints = qualityObservations.filter((observation) => observation.isEndOfSaleableLife && observation.endOfSaleableLifeTimestamp && !Number.isNaN(new Date(observation.endOfSaleableLifeTimestamp).getTime())).length;
  const censoredBatches = harvests.filter((harvest) => harvest.status === 'Sold').length;
  const validTrainingRows = 0;
  const minimumValidTrainingRows = 30;
  const shelfLifeTrainingJustified = validTrainingRows >= minimumValidTrainingRows;

  return {
    totalHarvests: harvests.length,
    totalPredictions: result.records.length,
    totalFeedbackRecords: feedbackRecords.length,
    predictionsWithLinkedFeedback: result.linkedFeedbackSamples,
    evaluableOutcomes: result.evaluatedSamples,
    unevaluatedOutcomes: result.unevaluatedSamples,
    missingOutcomeFields: result.records.filter((record) => !record.actualOutcome).length,
    sensorRecords: sensors.length,
    repeatedObservationHarvests: harvestIdsWithRepeatedObservations,
    validQualityObservations,
    documentedSaleabilityTransitions,
    validEndOfSaleableLifeTimestamps: validEndpoints,
    availableSensorFields,
    availableShelfLifeLabels: result.shelfLife.labelsAvailable,
    missingShelfLifeLabels: result.shelfLife.labelsMissing,
    validShelfLifeTrainingRows: validTrainingRows,
    censoredHarvests: censoredBatches,
    minimumValidTrainingRows,
    shelfLifeRegressionTrainingJustified: shelfLifeTrainingJustified,
    readinessStatus: shelfLifeTrainingJustified
      ? 'ready_for_regression_training'
      : 'Shelf-life regression training is not yet justified.',
    modelVersions: result.modelVersions,
    predictionsBySource: result.bySource.map((group) => ({ modelSource: group.modelSource, count: group.evaluatedSamples + group.unevaluatedSamples })),
    shelfLifeReason: result.shelfLife.reason,
  };
};

const prepareMlData = async () => {
  const result = await evaluatePredictions();
  return {
    status: 'ok',
    methodology: 'Rows retain only prediction-time inputs and explicit farmer-reported outcomes; no PII or farmer identifiers are included.',
    splitStrategy: 'Keep all rows from one harvest_id in one split; prefer time-aware validation and reserve unseen final harvest batches.',
    records: result.records.map((record) => record.preparedRow),
    dataQuality: await getDataQualityReport(),
  };
};

module.exports = {
  actualSpoilageLabel,
  predictedSpoilageLabel,
  calculateBinaryMetrics,
  evaluatePredictions,
  getDataQualityReport,
  prepareMlData,
};
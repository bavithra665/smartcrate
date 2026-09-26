const Prediction = require('../models/Prediction');
const FarmerFeedback = require('../models/FarmerFeedback');
const Harvest = require('../models/Harvest');
const SensorReading = require('../models/SensorReading');
const QualityObservation = require('../models/QualityObservation');

const MINIMUM_EVALUATION_SAMPLES = 2;
const BINARY_LABELS = ['NO_SPOILAGE', 'SPOILAGE'];
const MINIMUM_SHELF_LIFE_VALID_ROWS = 30;
const MINIMUM_DISTINCT_SHELF_LIFE_BATCHES = 10;

const getDateValue = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getHarvestObservation = (harvest, observationTimestamp) => {
  if (!harvest?.harvestDate) return null;
  const harvestDate = getDateValue(harvest.harvestDate);
  const observationDate = getDateValue(observationTimestamp);
  if (!harvestDate || !observationDate) return null;
  const harvestTime = harvest.harvestTime || '00:00';
  const match = /^([01]\d|2[0-3]):[0-5]\d$/.test(harvestTime) ? harvestTime : '00:00';
  const harvestTimestamp = new Date(`${harvestDate.toISOString().slice(0, 10)}T${match}:00.000Z`);
  const elapsedMs = observationDate.getTime() - harvestTimestamp.getTime();
  return elapsedMs >= 0 ? elapsedMs / (1000 * 60 * 60 * 24) : null;
};

const buildBatchDisjointSplit = (rows = [], trainingShare = 0.7, validationShare = 0.15, randomSeed = 42) => {
  if (!rows.length) return { train: [], validation: [], test: [], batchAssignments: {}, random_seed: randomSeed };

  const batchIds = [...new Set(rows.map((row) => row.batch_id).filter(Boolean))];
  const seed = Number.isFinite(randomSeed) ? randomSeed : 42;
  let value = seed >>> 0;
  const pseudoRandom = () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 4294967296;
  };

  const shuffledBatches = [...batchIds]
    .map((batchId, index) => ({ batch_id: batchId, order: pseudoRandom() + index * 0.0000001 }))
    .sort((left, right) => left.order - right.order)
    .map((entry) => entry.batch_id);

  const totalBatches = shuffledBatches.length;
  const trainCount = Math.max(1, Math.floor(totalBatches * trainingShare));
  const validationCount = Math.max(1, Math.floor(totalBatches * validationShare));
  const testCount = Math.max(1, totalBatches - trainCount - validationCount);

  const assignments = {};
  shuffledBatches.forEach((batchId, index) => {
    if (index < trainCount) assignments[batchId] = 'train';
    else if (index < trainCount + validationCount) assignments[batchId] = 'validation';
    else assignments[batchId] = 'test';
  });

  return {
    train: rows.filter((row) => assignments[row.batch_id] === 'train'),
    validation: rows.filter((row) => assignments[row.batch_id] === 'validation'),
    test: rows.filter((row) => assignments[row.batch_id] === 'test'),
    batchAssignments: assignments,
    random_seed: seed,
    split_strategy: 'batch_disjoint_and_time_aware_when_available',
    train_batch_count: trainCount,
    validation_batch_count: validationCount,
    test_batch_count: testCount,
  };
};

const auditShelfLifeReadiness = ({ harvests = [], sensorReadings = [], qualityObservations = [] }) => {
  const harvestList = Array.isArray(harvests) ? harvests : [];
  const sensorList = Array.isArray(sensorReadings) ? sensorReadings : [];
  const qualityList = Array.isArray(qualityObservations) ? qualityObservations : [];

  const totalHarvestBatches = harvestList.length;
  const batchesWithRepeatedSensorObservations = [...new Set(sensorList.map((sensor) => asKey(sensor.harvestId)).filter(Boolean))].filter((harvestId) => {
    const count = sensorList.filter((sensor) => asKey(sensor.harvestId) === harvestId).length;
    return count > 1;
  }).length;

  const batchesWithQualityObservations = [...new Set(qualityList.map((observation) => asKey(observation.harvestId)).filter(Boolean))].length;
  const batchesWithDocumentedEndpoints = [...new Set(qualityList
    .filter((observation) => observation?.isEndOfSaleableLife && observation?.endOfSaleableLifeTimestamp)
    .map((observation) => asKey(observation.harvestId))
    .filter(Boolean))].length;

  const validTargetRows = [];
  const invalidTargetRows = [];
  const insufficientDataRows = [];
  const unknownEndpointBatches = new Set();
  const censoredBatches = new Set();

  for (const harvest of harvestList) {
    const harvestId = asKey(harvest?._id || harvest?.id);
    if (!harvestId) continue;

    const harvestSensors = sensorList.filter((sensor) => asKey(sensor.harvestId) === harvestId);
    const harvestQualityObservations = qualityList.filter((observation) => asKey(observation.harvestId) === harvestId);
    const validEndpoints = harvestQualityObservations.filter((observation) => {
      const endpoint = getDateValue(observation.endOfSaleableLifeTimestamp);
      const observed = getDateValue(observation.observedAt);
      return observation?.isEndOfSaleableLife && endpoint && observed && endpoint.getTime() > observed.getTime();
    });

    if (harvest.status === 'Sold') {
      censoredBatches.add(harvestId);
    }

    if (harvest.status !== 'Sold' && !validEndpoints.length && harvestQualityObservations.some((observation) => observation?.saleabilityStatus)) {
      unknownEndpointBatches.add(harvestId);
    }

    for (const observation of harvestQualityObservations) {
      const observationTime = getDateValue(observation.observedAt);
      const endpointTime = getDateValue(observation.endOfSaleableLifeTimestamp);
      if (!observationTime || !endpointTime || !observation.isEndOfSaleableLife) {
        if (observation.isEndOfSaleableLife || observation.endOfSaleableLifeTimestamp) {
          invalidTargetRows.push({ harvestId, reason: 'missing_or_invalid_endpoint' });
        }
        continue;
      }

      const targetDays = (endpointTime.getTime() - observationTime.getTime()) / (1000 * 60 * 60 * 24);
      const relevantSensor = [...harvestSensors].sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime())
        .filter((sensor) => getDateValue(sensor.timestamp) && getDateValue(sensor.timestamp).getTime() <= observationTime.getTime())
        .at(-1);

      if (targetDays <= 0 || !Number.isFinite(targetDays)) {
        invalidTargetRows.push({ harvestId, reason: 'non_positive_remaining_shelf_life' });
        continue;
      }

      if (!harvest.crop || !harvest.maturityStage || !relevantSensor) {
        insufficientDataRows.push({ harvestId, reason: 'missing_required_feature_data' });
        continue;
      }

      validTargetRows.push({
        batch_id: harvestId,
        harvest_id: harvestId,
        crop: harvest.crop,
        variety: harvest.variety || null,
        maturity_stage: harvest.maturityStage,
        storage_condition: harvest.storageCondition || null,
        observation_timestamp: observationTime.toISOString(),
        end_of_saleable_life_timestamp: endpointTime.toISOString(),
        remaining_shelf_life_days: Number(targetDays.toFixed(6)),
        temperature: relevantSensor.temperature ?? null,
        humidity: relevantSensor.humidity ?? null,
        ethylene: relevantSensor.ethylene ?? null,
        voc_index: relevantSensor.voc ?? null,
        co2: relevantSensor.co2 ?? null,
        current_weight: relevantSensor.currentWeight ?? null,
        hours_since_harvest: getHarvestObservation(harvest, observationTime.toISOString()) ?? null,
      });
    }
  }

  const distinctTrainingBatches = [...new Set(validTargetRows.map((row) => row.batch_id))].length;
  const validShelfLifeTrainingRows = validTargetRows.length;
  const minimumValidTrainingRowsReached = validShelfLifeTrainingRows >= MINIMUM_SHELF_LIFE_VALID_ROWS;
  const minimumDistinctBatchesReached = distinctTrainingBatches >= MINIMUM_DISTINCT_SHELF_LIFE_BATCHES;
  const modelReadinessStatus = minimumValidTrainingRowsReached && minimumDistinctBatchesReached
    ? 'ready_for_regression_training'
    : 'not_ready_insufficient_data';

  return {
    totalHarvestBatches,
    batchesWithRepeatedSensorObservations,
    batchesWithQualityObservations,
    batchesWithDocumentedEndpoints,
    validShelfLifeTrainingRows,
    distinctTrainingBatches,
    censoredBatches: censoredBatches.size,
    unknownEndpointBatches: unknownEndpointBatches.size,
    invalidTargetRows: invalidTargetRows.length,
    insufficientDataRows: insufficientDataRows.length,
    minimumValidTrainingRows: MINIMUM_SHELF_LIFE_VALID_ROWS,
    minimumDistinctHarvestBatches: MINIMUM_DISTINCT_SHELF_LIFE_BATCHES,
    modelReadinessStatus,
    readinessMessage: minimumValidTrainingRowsReached && minimumDistinctBatchesReached
      ? 'Shelf-life regression model prepared for training.'
      : 'Shelf-life regression training is not yet justified because the dataset does not meet the required readiness threshold.',
    validTargetRows,
    invalidTargetRowsDetailed: invalidTargetRows,
    insufficientDataRowsDetailed: insufficientDataRows,
  };
};

const prepareShelfLifeTrainingData = ({ harvests = [], sensorReadings = [], qualityObservations = [] }) => {
  const readiness = auditShelfLifeReadiness({ harvests, sensorReadings, qualityObservations });
  const validRows = readiness.validTargetRows.map((row) => ({
    batch_id: row.batch_id,
    observation_timestamp: row.observation_timestamp,
    end_of_saleable_life_timestamp: row.end_of_saleable_life_timestamp,
    crop: row.crop,
    variety: row.variety,
    maturity_stage: row.maturity_stage,
    storage_condition: row.storage_condition,
    hours_since_harvest: row.hours_since_harvest,
    temperature: row.temperature,
    humidity: row.humidity,
    ethylene: row.ethylene,
    voc_index: row.voc_index,
    co2: row.co2,
    current_weight: row.current_weight,
    remaining_shelf_life_days: row.remaining_shelf_life_days,
    feature_names: [
      'crop',
      'variety',
      'maturity_stage',
      'hours_since_harvest',
      'temperature',
      'humidity',
      'ethylene',
      'voc_index',
      'co2',
      'storage_condition',
      'current_weight',
    ],
    leakage_protected: true,
  }));

  return {
    status: readiness.modelReadinessStatus === 'ready_for_regression_training' ? 'ready' : 'not_ready',
    readiness,
    rows: validRows,
    feature_policy: {
      allowed_features: [
        'crop',
        'variety',
        'maturity_stage',
        'hours_since_harvest',
        'temperature',
        'humidity',
        'ethylene',
        'voc_index',
        'co2',
        'storage_condition',
        'current_weight',
      ],
      excluded_features: [
        'end_of_saleable_life_timestamp',
        'future_quality_observations',
        'future_sensor_readings',
        'prediction_outcome_fields',
        'farmer_identity',
        'harvest_id',
        'prediction_id',
        'recommendation_id',
        'comments',
        'sale_date',
      ],
    },
  };
};

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
  const shelfLifeAudit = auditShelfLifeReadiness({
    harvests,
    sensorReadings: sensors,
    qualityObservations,
  });
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
  const validTrainingRows = shelfLifeAudit.validShelfLifeTrainingRows;
  const minimumValidTrainingRows = shelfLifeAudit.minimumValidTrainingRows;
  const shelfLifeTrainingJustified = validTrainingRows >= minimumValidTrainingRows && shelfLifeAudit.distinctTrainingBatches >= shelfLifeAudit.minimumDistinctHarvestBatches;

  return {
    totalHarvestBatches: harvests.length,
    batchesWithRepeatedSensorObservations: shelfLifeAudit.batchesWithRepeatedSensorObservations,
    batchesWithQualityObservations: shelfLifeAudit.batchesWithQualityObservations,
    batchesWithDocumentedEndpoints: shelfLifeAudit.batchesWithDocumentedEndpoints,
    validShelfLifeTrainingRows: validTrainingRows,
    distinctTrainingBatches: shelfLifeAudit.distinctTrainingBatches,
    censoredBatches,
    unknownEndpointBatches: shelfLifeAudit.unknownEndpointBatches,
    invalidTargetRows: shelfLifeAudit.invalidTargetRows,
    insufficientDataRows: shelfLifeAudit.insufficientDataRows,
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
    censoredHarvests: censoredBatches,
    minimumValidTrainingRows,
    minimumDistinctHarvestBatches: shelfLifeAudit.minimumDistinctHarvestBatches,
    shelfLifeRegressionTrainingJustified: shelfLifeTrainingJustified,
    readinessStatus: shelfLifeTrainingJustified
      ? 'ready_for_regression_training'
      : 'Shelf-life regression training is not yet justified because the dataset does not meet the required readiness threshold.',
    modelVersions: result.modelVersions,
    predictionsBySource: result.bySource.map((group) => ({ modelSource: group.modelSource, count: group.evaluatedSamples + group.unevaluatedSamples })),
    shelfLifeReason: result.shelfLife.reason,
    shelfLifeAudit,
  };
};

const prepareMlData = async () => {
  const result = await evaluatePredictions();
  const [harvests, sensors, qualityObservations] = await Promise.all([
    Harvest.find({}),
    SensorReading.find({}),
    QualityObservation.find({}),
  ]);
  const shelfLifeReadiness = auditShelfLifeReadiness({ harvests, sensorReadings: sensors, qualityObservations });
  return {
    status: 'ok',
    methodology: 'Rows retain only prediction-time inputs and explicit farmer-reported outcomes; no PII or farmer identifiers are included.',
    splitStrategy: 'Keep all rows from one harvest_id in one split; prefer time-aware validation and reserve unseen final harvest batches.',
    records: result.records.map((record) => record.preparedRow),
    dataQuality: await getDataQualityReport(),
    shelfLifeReadiness,
  };
};

module.exports = {
  auditShelfLifeReadiness,
  buildBatchDisjointSplit,
  prepareShelfLifeTrainingData,
  actualSpoilageLabel,
  predictedSpoilageLabel,
  calculateBinaryMetrics,
  evaluatePredictions,
  getDataQualityReport,
  prepareMlData,
};
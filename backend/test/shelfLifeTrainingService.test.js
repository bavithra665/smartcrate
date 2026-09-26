const {
  auditShelfLifeReadiness,
  prepareShelfLifeTrainingData,
  buildBatchDisjointSplit,
} = require('../services/predictionEvaluationService');

describe('Phase 11 shelf-life readiness and leakage protections', () => {
  test('generates valid shelf-life targets only for documented endpoints', () => {
    const harvests = [
      { _id: 'h1', crop: 'Tomato', maturityStage: 'Fully Ripe', storageCondition: 'Cold Room', status: 'Active' },
      { _id: 'h2', crop: 'Tomato', maturityStage: 'Mature', storageCondition: 'Cool Storage', status: 'Active' },
    ];
    const sensorReadings = [
      { harvestId: 'h1', timestamp: new Date('2026-09-20T08:00:00Z'), temperature: 25, humidity: 62, voc: 1.2, co2: 450, ethylene: 0.8 },
      { harvestId: 'h1', timestamp: new Date('2026-09-22T08:00:00Z'), temperature: 24, humidity: 61, voc: 1.4, co2: 470, ethylene: 0.9 },
      { harvestId: 'h2', timestamp: new Date('2026-09-25T08:00:00Z'), temperature: 26, humidity: 60, voc: 1.1, co2: 430, ethylene: 0.7 },
    ];
    const qualityObservations = [
      { harvestId: 'h1', observedAt: new Date('2026-09-20T08:00:00Z'), isEndOfSaleableLife: true, endOfSaleableLifeTimestamp: new Date('2026-09-26T08:00:00Z'), saleabilityStatus: 'NOT_SALEABLE', labelConfidence: 'confirmed' },
      { harvestId: 'h2', observedAt: new Date('2026-09-25T08:00:00Z'), isEndOfSaleableLife: true, endOfSaleableLifeTimestamp: new Date('2026-09-28T08:00:00Z'), saleabilityStatus: 'NOT_SALEABLE', labelConfidence: 'confirmed' },
    ];

    const report = auditShelfLifeReadiness({ harvests, sensorReadings, qualityObservations });

    expect(report.validShelfLifeTrainingRows).toBe(2);
    expect(report.totalHarvestBatches).toBe(2);
    expect(report.batchesWithDocumentedEndpoints).toBe(2);
    expect(report.modelReadinessStatus).toContain('not_ready');
  });

  test('excludes censored and unknown-endpoint batches from training targets', () => {
    const harvests = [
      { _id: 'h1', crop: 'Tomato', status: 'Sold' },
      { _id: 'h2', crop: 'Onion', status: 'Active' },
    ];
    const sensorReadings = [
      { harvestId: 'h1', timestamp: new Date('2026-09-21T08:00:00Z'), temperature: 23 },
      { harvestId: 'h2', timestamp: new Date('2026-09-21T08:00:00Z'), temperature: 22 },
    ];
    const qualityObservations = [
      { harvestId: 'h1', observedAt: new Date('2026-09-21T08:00:00Z'), saleabilityStatus: 'SALEABLE', labelConfidence: 'confirmed' },
      { harvestId: 'h2', observedAt: new Date('2026-09-21T08:00:00Z'), saleabilityStatus: 'UNKNOWN', labelConfidence: 'uncertain' },
    ];

    const report = auditShelfLifeReadiness({ harvests, sensorReadings, qualityObservations });

    expect(report.censoredBatches).toBe(1);
    expect(report.unknownEndpointBatches).toBe(1);
    expect(report.validShelfLifeTrainingRows).toBe(0);
    expect(report.invalidTargetRows).toBe(0);
  });

  test('builds a batch-disjoint split without mixing observations from the same harvest', () => {
    const split = buildBatchDisjointSplit([
      { batch_id: 'h1', value: 1 },
      { batch_id: 'h1', value: 2 },
      { batch_id: 'h2', value: 3 },
      { batch_id: 'h3', value: 4 },
      { batch_id: 'h4', value: 5 },
    ], 0.6, 0.2, 42);

    expect(new Set(split.train.map((row) => row.batch_id)).size).toBeGreaterThan(0);
    expect([...new Set(split.train.map((row) => row.batch_id))].some((batch) => split.validation.map((row) => row.batch_id).includes(batch))).toBe(false);
    expect([...new Set(split.validation.map((row) => row.batch_id))].some((batch) => split.test.map((row) => row.batch_id).includes(batch))).toBe(false);
  });

  test('prevents future endpoint leakage in feature selection', () => {
    const rows = prepareShelfLifeTrainingData({
      harvests: [{ _id: 'h1', crop: 'Tomato', maturityStage: 'Fully Ripe', storageCondition: 'Cold Room' }],
      sensorReadings: [{ harvestId: 'h1', timestamp: new Date('2026-09-20T08:00:00Z'), temperature: 25, humidity: 60, voc: 1.2, co2: 450, ethylene: 0.8 }],
      qualityObservations: [{ harvestId: 'h1', observedAt: new Date('2026-09-20T08:00:00Z'), saleabilityStatus: 'NOT_SALEABLE', isEndOfSaleableLife: true, endOfSaleableLifeTimestamp: new Date('2026-09-26T08:00:00Z') }],
    }).rows;

    expect(rows[0].feature_names).not.toContain('end_of_saleable_life_timestamp');
    expect(rows[0].feature_names).not.toContain('saleabilityStatus');
    expect(rows[0].feature_names).toContain('hours_since_harvest');
  });
});

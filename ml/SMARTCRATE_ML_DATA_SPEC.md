# SmartCrate Real ML Data Collection Specification

## Status and Scope

This document defines the future real-world data required for SmartCrate machine learning. It is a collection and labeling specification, not a trained model, inference service, backend migration, or production approval.

The current exploratory Logistic Regression artifact remains a starter-dataset baseline only. It is not validated for production use. Existing CSV datasets are not modified by this specification.

## 1. Purpose

SmartCrate needs batch-level longitudinal data for two separate supervised tasks:

1. **Spoilage-risk classification**: classify the current batch state as `Low`, `Medium`, or `High` using only information available at the prediction timestamp.
2. **Remaining shelf-life regression**: predict how much saleable life remains at the prediction timestamp, eventually expressed in days.

Both tasks require repeated observations tied to a real physical batch and a documented quality outcome.

## 2. Data Entities and Relationships

The minimum logical entities are:

```text
Farmer / owner
  -> Harvest event
      -> Batch
          -> Device assignment
              -> Repeated sensor observations
          -> Repeated quality inspections
          -> Spoilage / end-of-saleable-life event
          -> Label snapshots for training
```

Recommended identifiers:

- `batch_id`: immutable identifier for one physically tracked produce batch.
- `harvest_id`: identifier for the harvest event that created the batch; it may reference the existing application harvest.
- `device_id`: identifier for the sensor device producing observations.
- `observation_id`: unique identifier for one sensor observation.
- `quality_observation_id`: unique identifier for one human or instrument quality inspection.
- `event_id`: unique identifier for an end-of-saleable-life or spoilage event.

A batch must not silently combine produce from different harvests, crop types, varieties, or storage histories. If batches are mixed, create a new batch with a recorded parent/mixing event.

Market data should remain in separate market and decision-engine tables. Join it to ML examples only when market variables are intentionally part of a documented decision model and the join uses data available at the prediction timestamp.

## 3. Field Definitions

### 3.1 Harvest and initial batch record

Create once at harvest or batch creation:

| Field | Type | Requirement | Meaning |
|---|---|---|---|
| `batch_id` | string | required | Stable physical batch identifier |
| `harvest_id` | string | required | Application harvest reference |
| `farmer_id` | string | required | Owner reference |
| `crop` | categorical | required | Crop identity |
| `variety` | categorical/string | required where known | Cultivar or recorded variety |
| `maturity_stage` | categorical | required | Controlled vocabulary with observation method |
| `harvest_timestamp` | UTC timestamp | required | Actual harvest time, not upload time |
| `storage_type` | categorical | required | Example: open shed, warehouse, cold room |
| `storage_condition` | categorical/string | required | More specific condition or storage state |
| `initial_weight` | number | required | Weight at batch start, with calibration status |
| `quantity` | number | required | Quantity represented by the batch |
| `unit` | categorical | required | `kg`, `g`, `tonne`, or controlled alternative |
| `initial_weight_timestamp` | UTC timestamp | required | Time of initial weighing |
| `location_id` | string | recommended | Storage/location reference |
| `collector_id` | string | recommended | Person/device/application that recorded the data |
| `protocol_version` | string | required | Data-collection protocol version |

`initial_weight` and `quantity` must have an explicit relationship. If they represent the same measurement, document that. If quantity is an estimate and initial weight is measured, retain both rather than silently substituting one for the other.

### 3.2 Repeated sensor observation

Append one record for every observation. Do not overwrite earlier readings.

| Field | Type | Requirement | Meaning |
|---|---|---|---|
| `observation_id` | string | required | Unique observation identifier |
| `batch_id` | string | required | Tracked physical batch |
| `harvest_id` | string | required | Source harvest reference |
| `device_id` | string | required | Device that produced the reading |
| `observation_timestamp` | UTC timestamp | required | Sensor measurement time |
| `received_timestamp` | UTC timestamp | required | Backend receipt time |
| `temperature` | number | required | Degrees Celsius, calibrated sensor |
| `humidity` | number | required | Relative humidity percentage |
| `ethylene_value` | number/null | conditional | Calibrated ethylene concentration if available |
| `ethylene_unit` | string/null | conditional | Unit such as ppm |
| `gas_measurement_type` | categorical | required | `calibrated_ethylene`, `voc_index`, `mq_raw`, or documented alternative |
| `voc` | number/null | conditional | VOC index or calibrated value with definition |
| `voc_unit` | string/null | conditional | Unit/index definition |
| `co2` | number/null | conditional | CO2 concentration |
| `co2_unit` | string/null | conditional | Usually ppm |
| `current_weight` | number/null | recommended | Current batch weight |
| `weight_unit` | string/null | conditional | Weight unit |
| `sensor_status` | categorical | required | `valid`, `suspect`, `missing`, or `calibration_due` |
| `quality_flags` | array/string | recommended | Out-of-range, offline, drift, or replacement flags |
| `firmware_version` | string | recommended | Device firmware at measurement time |
| `calibration_id` | string | required | Calibration record used for the reading |

Recommended observation frequency should be defined by an experiment protocol. A practical starting point is every 15 to 60 minutes during storage, plus an observation immediately after harvest and after material storage changes. The interval must be recorded by protocol version rather than assumed from row count.

Sensor clocks must be synchronized or corrected using `received_timestamp` and documented clock offsets.

### 3.3 Quality inspection record

Record at scheduled inspections and whenever a saleability decision is made:

| Field | Type | Requirement | Meaning |
|---|---|---|---|
| `quality_observation_id` | string | required | Unique inspection identifier |
| `batch_id` | string | required | Tracked physical batch |
| `inspection_timestamp` | UTC timestamp | required | Time of inspection |
| `inspector_id` | string | required | Person or validated instrument |
| `quality_measurement` | categorical/string | required | Protocol name, e.g. visual grade, firmness, color |
| `quality_score` | number/null | conditional | Numeric score with scale definition |
| `quality_category` | categorical/null | conditional | Controlled category such as saleable, borderline, unsaleable |
| `saleable` | boolean | required | Whether the batch is saleable under the protocol |
| `inspection_notes` | string | recommended | Evidence and exceptions |
| `measurement_protocol_version` | string | required | Rubric or instrument version |

Quality scores must use a documented rubric. A score without an interpretation scale is not a reliable target.

### 3.4 End-of-saleable-life / spoilage event

Record the event when the batch crosses the documented endpoint:

| Field | Type | Requirement | Meaning |
|---|---|---|---|
| `event_id` | string | required | Unique event identifier |
| `batch_id` | string | required | Tracked batch |
| `spoilage_observed` | boolean | required | Whether spoilage occurred |
| `spoilage_timestamp` | UTC timestamp/null | conditional | Timestamp of confirmed spoilage |
| `end_of_saleable_life_timestamp` | UTC timestamp | required | Timestamp at which the batch ceased to meet the saleability rubric |
| `end_reason` | categorical | required | `spoilage`, `quality_threshold`, `sold_before_endpoint`, `lost_to_followup`, or documented alternative |
| `final_quality_score` | number/null | conditional | Last quality score |
| `final_current_weight` | number/null | recommended | Weight at endpoint |
| `quantity_spoiled` | number/null | recommended | Quantity spoiled, with unit |
| `evidence_reference` | string | recommended | Inspection/photo/instrument record reference |
| `label_confidence` | categorical | required | `confirmed`, `probable`, or `censored` |

A batch sold before deterioration should be marked `sold_before_endpoint` and treated as right-censored for shelf-life analysis unless a valid endpoint was later observed. Do not pretend that its remaining shelf life is known.

## 4. Ground-Truth Collection Process

### At harvest

Record:

- Batch and harvest identifiers
- Crop and variety
- Maturity stage and assessment method
- Harvest timestamp
- Initial weight and quantity
- Unit
- Storage type and condition
- Device assignment
- Collection protocol and calibration references

### At each sensor observation

Record:

- Observation and received timestamps
- Batch, harvest, and device IDs
- Temperature and humidity
- Calibrated ethylene or explicitly labeled gas/VOC measurement
- VOC and CO2 values where available
- Current weight where available
- Sensor status and calibration ID
- Quality flags and device metadata

### During quality inspection

Inspect at scheduled intervals and on relevant events. Record:

- Inspection timestamp
- Quality rubric and protocol version
- Numeric score and/or quality category
- Saleability decision
- Inspector identity
- Notes and evidence

### At spoilage or end of saleable life

Record:

- Confirmed endpoint timestamp
- Whether spoilage was observed
- End reason
- Last quality result
- Final weight and spoiled quantity where available
- Evidence and label confidence

## 5. Target Definitions

### 5.1 Spoilage-risk classification

The target must be a snapshot label tied to a prediction timestamp `t`.

Required classes:

```text
Low
Medium
High
```

Recommended operational definition:

- `High`: the batch is expected to become unsaleable within the urgent action window defined by the protocol, or current quality inspection confirms a high-risk state.
- `Medium`: the batch remains saleable but is within the warning window defined by the protocol.
- `Low`: the batch remains saleable and is outside the warning window under the protocol.

The thresholds and time window must be fixed in a versioned labeling protocol before training. They must not be chosen after viewing test-set results.

A classification training row is created from the latest valid data available at timestamp `t`, joined to the label determined by the documented future outcome or inspection protocol. Future sensor readings and future quality values must not be included in the feature snapshot.

### 5.2 Remaining shelf-life regression

For a prediction timestamp `t`, define:

```text
remaining_shelf_life_days
  = (end_of_saleable_life_timestamp - t) / 24 hours
```

The endpoint is `end_of_saleable_life_timestamp`, not necessarily the first visible spoilage timestamp. It must be based on the documented saleability rubric.

If a batch is monitored from harvest until the endpoint, the final target from harvest is:

```text
total_observed_saleable_life_days
  = (end_of_saleable_life_timestamp - harvest_timestamp) / 24 hours
```

For repeated prediction snapshots, calculate remaining shelf life separately for each snapshot timestamp `t`. Do not use `spoilage_timestamp` as an input feature.

Batches sold before the endpoint or lost to follow-up are censored. They should not receive an invented exact regression target. They require survival-analysis handling or a documented exclusion policy.

## 6. Feature Definitions for the SmartCrate Contract

The future model input can contain:

- `crop`: controlled crop identity
- `variety`: recorded variety
- `maturity_stage`: protocol-controlled maturity category
- `harvest_date`: derived from `harvest_timestamp`
- `harvest_time`: derived from `harvest_timestamp`
- `storage_type`: controlled storage category
- `storage_condition`: recorded condition and protocol version
- `temperature`: latest value plus safe historical summaries available before `t`
- `humidity`: latest value plus safe historical summaries available before `t`
- `ethylene_or_calibrated_gas_measurement`: only when calibration and type are known
- `voc`: value with unit/index definition
- `co2`: value with unit definition
- `initial_weight`: fixed batch-start measurement
- `current_weight`: latest value available before `t`
- `quantity`: batch quantity and unit

Historical summaries such as rolling mean, minimum, maximum, slope, and time-above-threshold are valid only when calculated from observations at or before `t`. The feature-generation code must prevent future rows from entering those summaries.

MQ-series channels must be stored as raw channels unless a calibration study establishes a defensible conversion. A field named `ethylene_value` must not be populated from MQ readings and labeled as calibrated ethylene without that calibration.

## 7. Transformation into Training Data

### A. Spoilage classification table

Create one snapshot row per batch and prediction timestamp:

```text
batch_id
prediction_timestamp
all features available at or before prediction_timestamp
spoilage_risk
label_protocol_version
label_timestamp
```

The feature snapshot must be reproducible from append-only observations. The label may depend on a future outcome, but future outcome fields must never be present among the model features.

Avoid creating many highly correlated snapshots from one batch without accounting for batch grouping during validation.

### B. Shelf-life regression table

Create one snapshot row per batch and prediction timestamp:

```text
batch_id
prediction_timestamp
all features available at or before prediction_timestamp
remaining_shelf_life_days
end_of_saleable_life_timestamp
label_confidence
label_protocol_version
```

Rows with `censored` endpoints need survival-analysis treatment or must be excluded under a predeclared rule. Never fill an unknown endpoint with a guessed shelf-life value.

## 8. Leakage Prevention

- Do not use `spoilage_timestamp` as a feature.
- Do not use `end_of_saleable_life_timestamp` as a feature.
- Do not use future weight loss or future quality measurements.
- Do not use final batch weight when predicting an earlier state.
- Do not use post-prediction market outcomes as prediction features.
- Do not calculate rolling features with observations after the prediction timestamp.
- Do not randomly split repeated snapshots from the same batch across train and test.
- Do not let the same device/session or near-duplicate batch appear in both train and test without an explicit design.
- Keep calibration and protocol versions available for audit, but do not allow them to act as accidental batch labels.
- Exclude identifiers such as `batch_id`, `device_id`, and `observation_id` from model features unless there is a documented reason and leakage review.
- Freeze target-label thresholds before evaluating the held-out test set.

## 9. Train, Validation, and Test Strategy

Use batch-level grouping as the primary boundary:

- All snapshots from one `batch_id` belong to exactly one split.
- Prefer time-aware splitting when batches are collected over time.
- Keep a final test set of entirely unseen batches collected after the training period.
- Use validation batches for model selection and threshold decisions.
- Use the final test batches once for the final report.
- If devices or storage sites have strong effects, report a second stress test holding out devices/sites.

A suitable initial design is:

```text
training batches: earliest 60-70% of collection period
validation batches: next 15-20%
test batches: latest 15-20%
```

The exact proportions may change with the number of batches, but the split must remain batch-disjoint and documented. For classification, monitor per-class precision, recall, F1, confusion matrix, and High-class support. For regression, report MAE, median absolute error, error by crop, and error by time-to-endpoint; do not report only a single aggregate metric.

## 10. Sensor Calibration Requirements

### Temperature

- Calibrate against a traceable reference thermometer.
- Record calibration date, reference instrument, offset, range, and uncertainty.
- Recheck after sensor replacement or drift concerns.

### Humidity

- Calibrate against a reference hygrometer or controlled humidity points.
- Record operating range, offset, humidity response, and uncertainty.
- Flag condensation and out-of-range readings.

### Ethylene

- Use a dedicated calibrated ethylene sensor or a documented validated conversion.
- Record gas standard, concentration points, calibration curve, date, temperature, humidity, and uncertainty.
- Do not call a generic MQ-series output calibrated ethylene.
- If calibration is unavailable, store it as `mq_raw` or an explicitly named gas/VOC index.

### VOC / gas sensors

- Record the exact sensor model and raw channels.
- Define whether the output is an index, resistance, normalized signal, or concentration.
- Record baseline, calibration, drift, warm-up, and environmental compensation procedures.

### CO2

- Calibrate against a known reference or certified gas standard.
- Record unit, range, accuracy, calibration date, and failure flags.

### Weight

- Calibrate scales with known reference weights.
- Record scale ID, resolution, tare procedure, uncertainty, and calibration date.
- Ensure readings refer to the same physical batch and container/tare configuration.

## 11. Example Record Structure

The following is a schema illustration only. It is not a real training record and must not be used as data:

```json
{
  "batch": {
    "batch_id": "<real-batch-id>",
    "harvest_id": "<real-harvest-id>",
    "crop": "<controlled-crop>",
    "variety": "<recorded-variety>",
    "maturity_stage": "<protocol-category>",
    "harvest_timestamp": "<UTC-timestamp>",
    "storage_type": "<controlled-storage-type>",
    "storage_condition": "<documented-condition>",
    "initial_weight": 0,
    "quantity": 0,
    "unit": "<unit>",
    "device_id": "<device-id>"
  },
  "observation": {
    "observation_id": "<real-observation-id>",
    "observation_timestamp": "<UTC-timestamp>",
    "temperature": 0,
    "humidity": 0,
    "ethylene_value": null,
    "ethylene_unit": null,
    "gas_measurement_type": "<calibrated-or-raw-type>",
    "voc": null,
    "co2": null,
    "current_weight": null,
    "calibration_id": "<calibration-record-id>"
  },
  "quality_observation": {
    "quality_observation_id": "<inspection-id>",
    "inspection_timestamp": "<UTC-timestamp>",
    "quality_measurement": "<documented-rubric>",
    "quality_score": null,
    "quality_category": "<saleability-category>",
    "saleable": true
  },
  "end_event": {
    "event_id": "<real-event-id>",
    "spoilage_observed": false,
    "spoilage_timestamp": null,
    "end_of_saleable_life_timestamp": "<UTC-timestamp>",
    "end_reason": "<documented-reason>",
    "label_confidence": "<confirmed-probable-censored>"
  }
}
```

Placeholder values above are schema markers, not fabricated measurements.

## 12. Minimum Requirements Before Production ML Integration

Do not integrate a model into SmartCrate production until the data program has:

- A documented provenance and collection protocol
- Batch-level and observation-level identifiers
- Multiple observations per batch across the saleable-life period
- Confirmed timestamps with synchronized clocks
- A documented saleability and spoilage rubric
- Real endpoint labels or explicitly handled censoring
- Calibrated temperature and humidity measurements
- Calibrated ethylene measurements, or clearly separated raw gas/VOC features
- Calibrated CO2 and weight measurements where used
- Sufficient examples of all risk classes, especially High
- Batch-disjoint, time-aware validation data
- A final held-out set of unseen batches
- Data-quality checks for missingness, ranges, drift, and duplicate observations
- Reproducible feature-generation and label-generation code
- Error analysis by crop, maturity, storage condition, device, and collection period
- A review confirming that no future information enters prediction features
- A model card documenting intended use, limitations, calibration, and failure modes

The next ML phase should define the collection protocol and validation data pipeline, then perform a data audit on the first real batch cohort. It should not expose an inference API yet.

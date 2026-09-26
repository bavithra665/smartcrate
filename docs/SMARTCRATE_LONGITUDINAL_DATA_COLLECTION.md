# SmartCrate Longitudinal Data Collection and Shelf-Life Preparation

## Status

Phase 10 establishes the data-collection and labeling foundation for future shelf-life regression. It does not claim that sufficient shelf-life training data currently exists, and it does not modify the existing spoilage-risk model or its baseline training data.

## Purpose

The repository already includes a real spoilage-risk classification workflow. Phase 10 adds the missing longitudinal observation and quality labeling foundation needed before any valid shelf-life regression model can be justified.

This phase does not produce a shelf-life regression model or retrain the current model artifact.

## Core principle

The end_of_saleable_life_timestamp is a documented quality endpoint, not a sensor anomaly threshold and not a guessed value. It must be established by actual quality observations or saleability assessments recorded by a farmer or authorized observer.

## Observation model

SmartCrate reuses the existing SensorReading model for repeated environmental observations. Each measurement records a reliable timestamp, harvest association, device identity, and environmental state. This preserves compatibility with the current ESP32 and simulator ingestion pipeline.

Quality observations are tracked through the QualityObservation model. Each observation is tied to a harvest and recorded with an explicit observedAt timestamp, quality grade, saleability status, visible spoilage state, and label confidence.

## Controlled values

### saleabilityStatus

- SALEABLE
- BORDERLINE
- NOT_SALEABLE
- UNKNOWN

### qualityGrade

- Excellent
- Good
- Fair
- Poor
- Unknown

### visibleSpoilage

- NONE
- PARTIAL
- SEVERE
- UNKNOWN

### labelConfidence

- confirmed
- probable
- uncertain

## Saleability endpoint definition

A valid end_of_saleable_life_timestamp is the earliest moment at which the harvested batch is documented as no longer meeting the project saleability rubric under the recorded observation protocol.

This endpoint must be based on a quality observation or explicit saleability assessment, not on:

- first sensor anomaly
- first high-risk prediction
- a fixed date offset from harvest
- sale date
- last sensor reading
- a farmer feedback submission date unless that timestamp explicitly records the end of saleability

If a batch is sold while still saleable and the true end of saleable life is unknown, it is treated as censored/unknown rather than assigned a fabricated endpoint.

## Endpoint protocol

The data collection protocol requires a documented observation or evidence trail that supports the endpoint decision. If the observation is sparse or daily only, the resulting endpoint is known only to the resolution of the observation schedule. The system records the timestamp with the observation and preserves uncertainty instead of pretending the exact endpoint is known to the minute.

## Censoring rules

A batch is right-censored if it is sold or otherwise exited observation before a documented endpoint. In that case:

- the batch is not assigned an invented shelf-life target
- the batch is marked censored/unknown in future training preparation
- survival analysis or documented exclusion is required before any regression training

## Required metadata

For each harvest/batch, record:

- harvest registration
- initial weight
- crop and variety
- maturity stage
- storage condition
- device ID
- sensor sampling interval
- temperature and humidity
- gas/VOC index values and units where available
- calibration metadata if known
- periodic quality inspection
- saleability decision
- endpoint definition and censoring notes
- observer instructions and timestamps

## Calibration metadata

The system records calibration information only when the hardware or workflow actually provides it. If no calibration data exists, the sensor metadata remains unknown or not calibrated. MQ-series readings remain explicitly labeled as gas/VOC index values unless a valid calibration protocol exists.

## Data quality validation

The API validates:

- observation timestamp ordering relative to the harvest timestamp
- future timestamps are rejected
- no observation may be recorded after an established endpoint unless an explicit correction is performed with forceReplace=true
- negative weights are rejected
- invalid humidity values are rejected
- invalid temperature values are rejected
- invalid quality status and saleability status are rejected
- duplicate observations for the same harvest and observedAt timestamp are rejected

## Leakage protection

For any shelf-life target generation, the feature set must use values known at or before the observation timestamp. The endpoint must never appear as an input feature. This prevents leakage from future temperature, future weight, future quality grade, or actual future final outcome data.

## Future regression dataset preparation

When valid labels exist, the future export can include columns such as:

- crop
- variety
- maturity_stage
- storage_condition
- temperature
- humidity
- calibrated_ethylene
- voc_index
- co2
- initial_weight
- current_weight
- hours_since_harvest
- quality_state
- remaining_shelf_life_days

Metadata that may be retained for grouping only:

- harvest_id
- batch_id
- observation_timestamp
- label_confidence
- censoring_status

Important: identifiers are allowed for grouping and traceability only. They must not be used as predictive features.

## Minimum threshold for training

The project uses a documented minimum threshold for considering regression training:

- 30 valid shelf-life rows with a known endpoint and valid observation window
- a clean, batch-disjoint split strategy
- no leakage from future observations

If this threshold is not met, the system reports:

"Shelf-life regression training is not yet justified."

## Practical collection workflow

1. Harvest registration
2. Initial batch metadata capture
3. Device and sensor calibration metadata assignment
4. Repeated sensor observations at the configured interval
5. Periodic farmer or observer quality inspections
6. Saleability assessment and endpoint documentation
7. Explicit censoring if the batch exits before endpoint knowledge
8. Read-only reporting and data quality validation

## Current repository status

Current repository state:

- repeated sensor ingestion is active
- spoilage-risk prediction remains unchanged
- quality observation collection has been added for future shelf-life labeling
- no shelf-life regression training is triggered automatically
- no model artifacts are retrained or modified in this phase

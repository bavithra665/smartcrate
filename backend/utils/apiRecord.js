const enumValues = {
  maturityStage: { Semi_Ripe: 'Semi-Ripe', Fully_Ripe: 'Fully Ripe', Over_Ripe: 'Over-Ripe' },
  action: {
    Sell_Today: 'Sell Today',
    Wait_for_Better_Price: 'Wait for Better Price',
    Transport_to_Another_Market: 'Transport to Another Market',
    Move_Produce_to_Storage: 'Move Produce to Storage',
    Insufficient_Data: 'Insufficient Data',
  },
  actualSaleStatus: { Not_Reported: 'Not Reported', Not_Sold: 'Not Sold' },
  actualSpoilageOutcome: {
    No_Spoilage: 'No Spoilage',
    Partial_Spoilage: 'Partial Spoilage',
    Full_Spoilage: 'Full Spoilage',
    Not_Reported: 'Not Reported',
  },
  actualQuality: { Not_Reported: 'Not Reported' },
};

const toApiRecord = (record, { includeVersion = true } = {}) => {
  if (!record) return record;
  const { id, version, ...data } = record;
  for (const [field, values] of Object.entries(enumValues)) {
    if (values[data[field]]) data[field] = values[data[field]];
  }
  return { ...data, _id: id, ...(includeVersion && { __v: data.__v ?? version ?? 0 }) };
};

const toApiRecords = (records, options) => records.map((record) => toApiRecord(record, options));

const numericFields = new Set([
  'quantity', 'initialWeight', 'temperature', 'humidity', 'ethylene', 'voc', 'co2', 'currentWeight',
  'remainingShelfLife', 'shelfLifeConfidence', 'spoilageRiskConfidence', 'actualSellingPrice',
  'soldQuantity', 'spoiledQuantity', 'confidence', 'price', 'distance', 'travelTimeHours',
  'transportCost', 'minPrice', 'maxPrice', 'modalPrice', 'arrivalQuantity',
]);

const dateFields = new Set([
  'harvestDate', 'observedAt', 'timestamp', 'date', 'endOfSaleableLifeTimestamp',
  'shelfLifePredictedAt', 'predictedAt', 'generatedAt', 'submittedAt', 'joinedDate',
]);

const toPrismaData = (data) => {
  const output = { ...data };
  for (const field of numericFields) {
    if (typeof output[field] === 'string') output[field] = output[field] === '' ? null : Number(output[field]);
  }
  for (const field of dateFields) {
    if (typeof output[field] === 'string' && output[field]) output[field] = new Date(output[field]);
  }
  for (const [field, values] of Object.entries(enumValues)) {
    const prismaValue = Object.keys(values).find((key) => values[key] === output[field]);
    if (prismaValue) output[field] = prismaValue;
  }
  return output;
};

module.exports = { toApiRecord, toApiRecords, toPrismaData };
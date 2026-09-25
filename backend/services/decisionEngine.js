const MARKET_PRICE_MAX_AGE_HOURS = Number(process.env.MARKET_PRICE_MAX_AGE_HOURS || 24);

const UNIT_TO_KG = { kg: 1, quintal: 100, tonne: 1000 };

const toNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);

const normalizeQuantity = (quantity, unit = 'kg') => {
  const value = toNumber(quantity);
  const multiplier = UNIT_TO_KG[String(unit).toLowerCase()];
  if (value === null || value <= 0 || !multiplier) return null;
  return value * multiplier;
};

const normalizePricePerKg = (price, unit) => {
  const value = toNumber(price);
  const multiplier = UNIT_TO_KG[String(unit).toLowerCase()];
  if (value === null || value <= 0 || !multiplier) return null;
  return value / multiplier;
};

const isFresh = (observedAt, now = new Date()) => {
  const timestamp = new Date(observedAt).getTime();
  if (!Number.isFinite(timestamp)) return false;
  const ageHours = (new Date(now).getTime() - timestamp) / 3600000;
  return ageHours >= 0 && ageHours <= MARKET_PRICE_MAX_AGE_HOURS;
};

const availability = (market) => {
  if (market.pricePerKg === null || !market.priceFresh) return 'unavailable';
  if (market.transportCost !== null && market.distanceKm !== null && market.travelTimeMinutes !== null) return 'complete';
  return 'partial';
};

const buildReasons = ({ prediction, quantityKg, markets, shelfLife }) => {
  const reasons = [];
  const risk = prediction?.spoilageRisk;
  if (risk) reasons.push(`Spoilage risk is ${risk}.`);
  else reasons.push('Spoilage-risk information is unavailable.');
  reasons.push(quantityKg === null ? 'Harvest quantity is invalid or unavailable.' : `Harvest quantity is ${quantityKg} kg after unit normalization.`);
  if (shelfLife.available) reasons.push(`Remaining shelf-life prediction is ${shelfLife.remainingDays} days.`);
  else reasons.push('Remaining shelf-life prediction is unavailable.');

  const freshCount = markets.filter((market) => market.priceFresh && market.pricePerKg !== null).length;
  if (freshCount) reasons.push('Latest market price data is available and fresh.');
  else reasons.push('No fresh valid market price is available.');
  markets.filter((market) => market.pricePerKg !== null).forEach((market) => {
    if (!market.priceFresh) reasons.push(`${market.marketName} price is stale and was not used for the decision.`);
  });
  if (markets.some((market) => market.transportCost === null)) reasons.push('Transport cost is unavailable for one or more markets, so net return is unavailable there.');
  if (markets.some((market) => market.distanceKm === null)) reasons.push('Distance is unavailable for one or more markets.');
  if (markets.some((market) => market.travelTimeMinutes === null)) reasons.push('Travel time is unavailable for one or more markets.');
  return reasons;
};

const evaluateDecision = ({ harvest, prediction, markets, now = new Date() }) => {
  const quantityKg = normalizeQuantity(harvest?.quantity, harvest?.unit);
  const shelfLife = {
    available: toNumber(prediction?.remainingShelfLife) !== null,
    remainingDays: toNumber(prediction?.remainingShelfLife),
  };

  const candidates = markets.map(({ market, price }) => {
    const pricePerKg = normalizePricePerKg(price?.price, price?.unit);
    const marketPriceFresh = pricePerKg !== null && isFresh(price?.observedAt, now);
    const distanceKm = toNumber(market.distance);
    const travelTimeMinutes = toNumber(market.travelTimeMinutes ?? (toNumber(market.travelTimeHours) === null ? null : market.travelTimeHours * 60));
    const transportCost = toNumber(market.transportCost);
    const grossValue = quantityKg === null || pricePerKg === null ? null : quantityKg * pricePerKg;
    const netValue = grossValue !== null && transportCost !== null ? grossValue - transportCost : null;
    const candidate = {
      marketId: market._id,
      marketName: market.name,
      price: price?.price ?? null,
      unit: price?.unit ?? null,
      normalizedPricePerKg: pricePerKg,
      currency: price?.currency ?? null,
      observedAt: price?.observedAt ?? null,
      priceFresh: marketPriceFresh,
      distanceKm,
      travelTimeMinutes,
      transportCost,
      grossValue,
      netValue,
      availability: 'unavailable',
    };
    candidate.availability = availability(candidate);
    return candidate;
  });

  const usable = candidates.filter((candidate) => candidate.priceFresh && candidate.normalizedPricePerKg !== null);
  const complete = usable.filter((candidate) => candidate.netValue !== null);
  const sorted = [...complete].sort((left, right) => right.netValue - left.netValue);
  const best = sorted[0] || usable[0] || null;
  const nearest = [...complete].sort((left, right) => (left.distanceKm ?? Infinity) - (right.distanceKm ?? Infinity))[0] || null;
  const reasons = buildReasons({ prediction, quantityKg, markets: candidates, shelfLife });
  const risk = prediction?.spoilageRisk;
  let decision = 'INSUFFICIENT_DATA';
  let status = 'insufficient_data';

  if (quantityKg !== null && usable.length > 0) {
    status = 'actionable';
    if (risk === 'High') decision = 'SELL_TODAY';
    else if (best && nearest && best.marketId !== nearest.marketId && best.netValue > nearest.netValue) decision = 'MOVE_PRODUCE';
    else if (nearest && nearest.distanceKm !== null && nearest.distanceKm <= 10) decision = 'SELL_TODAY';
    else if (risk === 'Low' && shelfLife.available && shelfLife.remainingDays >= 5) decision = 'WAIT';
    else decision = 'SELL_TODAY';
  }

  if (decision === 'MOVE_PRODUCE' && best) reasons.push(`${best.marketName} has the highest calculated net value among markets with complete logistics data.`);
  if (best && best.distanceKm !== null && best.distanceKm <= 10) reasons.push('Nearest market is within 10 km, reducing the logistics burden.');
  if (best && best.transportCost === 0) {
    reasons.push('Minimal transport cost');
    reasons.push('The selected market has a lower logistics cost than alternatives.');
  }
  if (decision === 'SELL_TODAY') reasons.push(risk === 'High' ? 'High spoilage risk increases urgency to sell today.' : 'Available fresh market data supports selling today.');
  if (decision === 'WAIT') reasons.push('Low spoilage risk and at least five predicted shelf-life days allow waiting without claiming a future price increase.');
  if (decision === 'INSUFFICIENT_DATA') reasons.push('A deterministic market decision cannot be produced from the available trusted inputs.');

  return {
    decision,
    status,
    confidence: null,
    reasons,
    risk: { level: risk || null, confidence: prediction?.spoilageRiskConfidence ?? null },
    shelfLife,
    markets: candidates,
    dataQuality: {
      marketPriceFresh: usable.length > 0,
      transportCostAvailable: candidates.some((candidate) => candidate.transportCost !== null),
      distanceAvailable: candidates.some((candidate) => candidate.distanceKm !== null),
      travelTimeAvailable: candidates.some((candidate) => candidate.travelTimeMinutes !== null),
    },
    generatedAt: new Date(now).toISOString(),
  };
};

module.exports = { evaluateDecision, normalizePricePerKg, normalizeQuantity, isFresh };
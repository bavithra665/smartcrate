// ============================================================
// SmartCrate Prediction Utilities
// Replace these with Axios API calls when backend is ready:
// POST /api/prediction
// POST /api/recommendation
// ============================================================

/**
 * Mock market recommendation logic.
 * In production, replace with: GET /api/recommendation
 */
export function getRecommendation(harvest, markets) {
  const crop = harvest.crop || harvest.cropType;
  const shelfLife = harvest.remainingShelfLife || harvest.shelfLife || 3;
  const risk = harvest.spoilageRisk || harvest.risk || "Medium";

  const scored = markets.map((market) => {
    const price = market.prices[crop] || 10;
    const grossValue = price * (harvest.quantity || 100);
    const netValue = grossValue - market.transportCost;
    const travelHours = parseFloat(market.travelTime) || 0.5;
    const safeToTravel = shelfLife > travelHours / 24 + 1;

    let score = netValue;
    if (!safeToTravel) score -= 5000;
    if (risk === "High" && market.distance > 30) score -= 3000;

    return { ...market, price, grossValue, netValue, safeToTravel, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  let action = "Sell Today";
  let reason = [];

  if (risk === "High") {
    action = "Sell Today";
    reason = [
      "High spoilage risk detected",
      "Immediate sale is recommended",
      "Local market is the safest option",
    ];
  } else if (best.distance <= 10) {
    action = "Sell Today";
    reason = [
      "Local market offers a fair price",
      "Minimal transport cost",
      "Produce is ready for sale",
    ];
  } else if (shelfLife >= 3 && best.netValue > scored[scored.length - 1].netValue * 1.1) {
    action = `Transport to ${best.name}`;
    reason = [
      `Better current price at ${best.name} (₹${best.price}/kg)`,
      "Produce has sufficient remaining shelf life",
      "Travel time is within the safe selling period",
      `Expected net value is ₹${best.netValue.toLocaleString("en-IN")}`,
    ];
  } else if (shelfLife >= 5) {
    action = "Wait for a Better Price";
    reason = [
      "Produce has sufficient shelf life to wait",
      "Current prices are not optimal",
      "Monitor market prices for the next 1–2 days",
    ];
  } else {
    action = "Move Produce";
    reason = [
      "Move produce to better storage",
      "Shelf life is moderate",
      "Prepare for sale within 2 days",
    ];
  }

  return { action, reason, markets: scored, bestMarket: best };
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getRiskColor(risk) {
  if (risk === "High") return "#e53e3e";
  if (risk === "Medium") return "#dd6b20";
  return "#38a169";
}

export function getShelfLifePercent(remaining, total) {
  if (!total) return 0;
  return Math.min(100, Math.round((remaining / total) * 100));
}

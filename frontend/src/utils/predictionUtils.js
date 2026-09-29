// Formatting helpers for API-backed prediction and market views.

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

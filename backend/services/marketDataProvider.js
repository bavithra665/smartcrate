class MarketDataProvider {
  constructor({ name, source, updateFrequency, notes }) {
    this.name = name;
    this.source = source;
    this.updateFrequency = updateFrequency;
    this.notes = notes;
  }

  async fetchPrices(crop, location) {
    throw new Error('MarketDataProvider.fetchPrices must be implemented by a provider');
  }
}

module.exports = { MarketDataProvider };

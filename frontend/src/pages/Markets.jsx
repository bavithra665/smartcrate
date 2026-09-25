import React, { useEffect, useState } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import MarketCard from '../components/MarketCard';
import { FaSearch, FaSort, FaFilter } from 'react-icons/fa';
import { getMarkets, getLatestMarketPrices } from '../api/marketApi';
import './Markets.css';

const cropOptions = ['Tomato', 'Onion', 'Banana', 'Potato', 'Carrot'];

export default function Markets({ farmer, onLogout }) {
  const [search, setSearch] = useState('');
  const [filterCrop, setFilterCrop] = useState('Tomato');
  const [sortBy, setSortBy] = useState('distance');
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function fetchMarkets() {
      try {
        const [marketsRes, pricesRes] = await Promise.all([
          getMarkets(),
          getLatestMarketPrices(filterCrop),
        ]);

        if (ignore) return;

        const priceMap = new Map();
        (pricesRes.data || []).forEach((row) => {
          const marketKey = row.marketId?._id || row.marketId || row.market;
          priceMap.set(marketKey, { ...row, price: row.price ?? row.modalPrice ?? null });
        });

        const marketList = (marketsRes.data || []).map((market) => {
          const priceData = priceMap.get(market.marketId || market._id);
          return {
            ...market,
            name: market.name,
            price: priceData?.price ?? null,
            unit: priceData?.unit || 'kg',
            currency: priceData?.currency || 'INR',
            observedAt: priceData?.observedAt || null,
            source: priceData?.source || null,
            travelTime: market.travelTime || 'Unavailable',
            distance: market.distance ?? null,
            transportCost: market.transportCost ?? null,
          };
        });

        setMarkets(marketList);
      } catch (error) {
        console.error('Market fetch failed:', error);
        setMarkets([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    fetchMarkets();
    return () => { ignore = true; };
  }, [filterCrop]);

  const filtered = markets
    .filter((market) => {
      const haystack = `${market.name || ''} ${market.location || ''}`.toLowerCase();
      return haystack.includes(search.toLowerCase());
    })
    .sort((a, b) => {
      if (sortBy === 'distance') {
        const aa = a.distance ?? Number.POSITIVE_INFINITY;
        const bb = b.distance ?? Number.POSITIVE_INFINITY;
        return aa - bb;
      }
      if (sortBy === 'price') {
        const aa = a.price ?? 0;
        const bb = b.price ?? 0;
        return bb - aa;
      }
      return 0;
    });

  return (
    <DashboardLayout farmer={farmer} pageTitle="Nearby Markets" onLogout={onLogout}>
      <div className="page-content">
        <h1 className="page-title">Nearby Markets</h1>
        <p className="page-subtitle">Compare prices and distances to find the best market for your produce.</p>

        <div className="markets-filters card" style={{ marginBottom: 24 }}>
          <div className="markets-filter-row">
            <div className="markets-search">
              <FaSearch className="markets-search-icon" />
              <input
                type="text"
                className="form-input"
                placeholder="Search markets..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 36 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FaFilter style={{ color: 'var(--text-light)' }} />
                <select className="form-input" style={{ width: 'auto' }}
                  value={filterCrop} onChange={e => setFilterCrop(e.target.value)}>
                  {cropOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FaSort style={{ color: 'var(--text-light)' }} />
                <select className="form-input" style={{ width: 'auto' }}
                  value={sortBy} onChange={e => setSortBy(e.target.value)}>
                  <option value="distance">Sort by Distance</option>
                  <option value="price">Sort by Price</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="markets-price-bar card" style={{ marginBottom: 24 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-medium)', marginBottom: 12 }}>
            {filterCrop} Latest Prices
          </div>
          <div className="markets-price-list">
            {markets.length === 0 ? (
              <div style={{ color: 'var(--text-light)' }}>No market data available yet.</div>
            ) : (
              markets.map((m) => (
                <div key={m._id || m.marketId} className="markets-price-item">
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-medium)' }}>{m.name}</div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)' }}>
                    {m.price ? `₹${m.price}/${m.unit || 'kg'}` : 'Unavailable'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{m.distance ? `${m.distance} km` : 'Distance unavailable'}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <p>Loading market intelligence...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <FaSearch />
            <p>No markets found matching your search.</p>
          </div>
        ) : (
          <div className="grid-2">
            {filtered.map((market) => (
              <MarketCard
                key={market._id || market.marketId}
                market={market}
                crop={filterCrop}
                quantity={100}
                isRecommended={false}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

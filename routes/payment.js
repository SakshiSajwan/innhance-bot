import { useState, useEffect } from 'react';
import API from '../api';

const statusColors = {
  pending:  { bg: 'rgba(240,192,64,0.08)',  color: '#f0c040', border: 'rgba(240,192,64,0.25)' },
  verified: { bg: 'rgba(76,175,80,0.08)',   color: '#4caf50', border: 'rgba(76,175,80,0.25)' },
  failed:   { bg: 'rgba(244,67,54,0.08)',   color: '#f44336', border: 'rgba(244,67,54,0.25)' },
  settled:  { bg: 'rgba(91,156,246,0.08)',  color: '#5b9cf6', border: 'rgba(91,156,246,0.25)' },
};

const statusLabel = { pending: 'Pending', verified: 'Verified', failed: 'Failed', settled: 'Settled' };

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function Payments({ theme }) {
  const dark = theme === 'dark';

  const tokens = {
    bg:         dark ? '#0a0a14' : '#f4f1ea',
    card:       dark ? '#11111f' : '#ffffff',
    border:     dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)',
    text:       dark ? '#f0f0f0' : '#111827',
    subtext:    dark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.45)',
    gold:       '#c9a84c',
    inputBg:    dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
    rowHover:   dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
    tableBorder:dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)',
    codeBg:     dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    shadow:     dark ? '0 2px 20px rgba(0,0,0,0.4)' : '0 2px 12px rgba(0,0,0,0.08)',
  };

  const [payments, setPayments]       = useState([]);
  const [summary, setSummary]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState('all');
  const [settlingId, setSettlingId]   = useState(null);
  const [settleNote, setSettleNote]   = useState('');
  const [showNoteFor, setShowNoteFor] = useState(null);
  const [error, setError]             = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const res = await API.get(`/api/payments/dashboard${params}`);

      const data = res.data;
      // Map dashboard response to what the UI expects
      setPayments(data.recent || []);
      setSummary({
        totalReceived:   data.totals?.totalRevenue   || 0,
        unsettledAmount: data.totals?.unsettled      || 0,
        settledAmount:   (data.totals?.totalRevenue || 0) - (data.totals?.unsettled || 0),
        totalCount:      data.totals?.totalPayments  || 0,
        byHotel: (data.hotels || []).map(h => ({
          hotelId:   h._id,
          hotelName: h.hotelName,
          unsettled: h.pendingAmount || 0,
          count:     h.verified      || 0,
        })),
      });
    } catch {
      setError('Failed to load payments. Check your API connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filter]);

  const handleSettle = async (paymentId) => {
    setSettlingId(paymentId);
    try {
      await API.patch(`/api/payments/${paymentId}/settle`, { note: settleNote });
      setShowNoteFor(null);
      setSettleNote('');
      fetchData();
    } catch {
      alert('Failed to mark as settled.');
    } finally {
      setSettlingId(null);
    }
  };

  const statCards = [
    { label: 'Total Received',   value: fmt(summary?.totalReceived),   icon: '💰', accent: '#4caf50' },
    { label: 'Unsettled Amount', value: fmt(summary?.unsettledAmount), icon: '⏳', accent: '#f0c040' },
    { label: 'Settled Amount',   value: fmt(summary?.settledAmount),   icon: '✅', accent: '#5b9cf6' },
    { label: 'Total Payments',   value: summary?.totalCount ?? '—',    icon: '🧾', accent: '#c084fc' },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');

        .pay-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        @media (max-width: 900px) { .pay-stats { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 480px) { .pay-stats { grid-template-columns: repeat(2, 1fr); gap: 10px; } }

        .pay-stat-card {
          background: ${tokens.card};
          border: 1px solid ${tokens.border};
          border-radius: 14px;
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          box-shadow: ${tokens.shadow};
          transition: border-color 0.2s;
        }
        .pay-stat-card:hover { border-color: ${tokens.gold}44; }

        .pay-hotel-unsettled {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 24px;
        }
        .pay-hotel-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: ${tokens.card};
          border: 1px solid ${tokens.border};
          border-radius: 12px;
          padding: 14px 18px;
          box-shadow: ${tokens.shadow};
        }
        @media (max-width: 480px) {
          .pay-hotel-row { flex-direction: column; align-items: flex-start; gap: 6px; }
        }

        .pay-section {
          background: ${tokens.card};
          border: 1px solid ${tokens.border};
          border-radius: 14px;
          overflow: hidden;
          box-shadow: ${tokens.shadow};
        }
        .pay-section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid ${tokens.border};
          gap: 12px;
          flex-wrap: wrap;
        }

        .pay-filters {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .pay-filter-btn {
          padding: 5px 13px;
          border-radius: 100px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid ${tokens.border};
          background: transparent;
          color: ${tokens.subtext};
          cursor: pointer;
          transition: all 0.15s;
          font-family: 'DM Sans', sans-serif;
        }
        .pay-filter-btn:hover { color: ${tokens.text}; border-color: ${tokens.gold}55; }
        .pay-filter-btn.active {
          background: rgba(201,168,76,0.1);
          color: ${tokens.gold};
          border-color: rgba(201,168,76,0.35);
        }

        /* Table wrapper for horizontal scroll on mobile */
        .pay-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }

        .pay-table { width: 100%; border-collapse: collapse; min-width: 640px; }
        .pay-table th {
          padding: 11px 16px;
          text-align: left;
          font-size: 10px;
          font-weight: 800;
          color: ${tokens.subtext};
          text-transform: uppercase;
          letter-spacing: 0.8px;
          border-bottom: 1px solid ${tokens.border};
          background: ${tokens.inputBg};
          font-family: 'DM Sans', sans-serif;
          white-space: nowrap;
        }
        .pay-table td {
          padding: 13px 16px;
          font-size: 13px;
          color: ${tokens.text};
          border-bottom: 1px solid ${tokens.tableBorder};
          vertical-align: middle;
          font-family: 'DM Sans', sans-serif;
        }
        .pay-table tr:last-child td { border-bottom: none; }
        .pay-table tbody tr:hover td { background: ${tokens.rowHover}; }

        .pay-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px;
          border-radius: 100px;
          font-size: 11px;
          font-weight: 700;
          border: 1px solid;
          white-space: nowrap;
          font-family: 'DM Sans', sans-serif;
        }
        .pay-badge-dot { width: 6px; height: 6px; border-radius: 50%; }

        .pay-settle-btn {
          padding: 6px 14px;
          background: rgba(76,175,80,0.08);
          border: 1px solid rgba(76,175,80,0.25);
          color: #4caf50;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
          font-family: 'DM Sans', sans-serif;
        }
        .pay-settle-btn:hover { background: rgba(76,175,80,0.18); }
        .pay-settle-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Modal */
        .pay-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.65);
          display: flex; align-items: center; justify-content: center;
          z-index: 9999;
          padding: 16px;
        }
        .pay-modal {
          background: ${tokens.card};
          border: 1px solid ${tokens.border};
          border-radius: 16px;
          padding: 28px;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 24px 60px rgba(0,0,0,0.5);
          animation: fadeUp 0.2s ease forwards;
        }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)} }

        .pay-modal-textarea {
          width: 100%;
          background: ${tokens.inputBg};
          border: 1px solid ${tokens.border};
          border-radius: 10px;
          color: ${tokens.text};
          font-size: 13px;
          padding: 10px 12px;
          resize: vertical;
          min-height: 80px;
          outline: none;
          font-family: 'DM Sans', sans-serif;
          box-sizing: border-box;
          transition: border-color 0.15s;
        }
        .pay-modal-textarea:focus { border-color: rgba(201,168,76,0.4); }

        .pay-tn {
          font-size: 11px;
          color: ${tokens.subtext};
          font-family: monospace;
          background: ${tokens.codeBg};
          padding: 2px 7px;
          border-radius: 5px;
          display: inline-block;
          max-width: 160px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          vertical-align: middle;
        }

        .pay-empty {
          text-align: center;
          padding: 52px 20px;
          color: ${tokens.subtext};
          font-size: 14px;
          font-family: 'DM Sans', sans-serif;
        }

        .pay-error {
          background: rgba(244,67,54,0.08);
          border: 1px solid rgba(244,67,54,0.2);
          color: #f87171;
          border-radius: 10px;
          padding: 12px 16px;
          margin-bottom: 20px;
          font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
        }

        .pay-section-label {
          font-size: 10px;
          font-weight: 800;
          color: ${tokens.subtext};
          text-transform: uppercase;
          letter-spacing: 0.9px;
          margin-bottom: 10px;
          font-family: 'DM Sans', sans-serif;
        }

        @media (max-width: 480px) {
          .pay-section-header { padding: 12px 14px; }
          .pay-stat-card { padding: 14px; }
          .pay-table td, .pay-table th { padding: 10px 12px; }
        }
      `}</style>

      {/* Page header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: tokens.text, fontFamily: 'DM Sans, sans-serif', margin: 0, letterSpacing: '-0.3px' }}>
          💳 Payments
        </h1>
        <p style={{ fontSize: '13px', color: tokens.subtext, marginTop: '4px', fontFamily: 'DM Sans, sans-serif' }}>
          Track incoming payments per hotel and mark settlements
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="pay-error">
          <span>{error}</span>
          <button onClick={fetchData} style={{ background: 'transparent', border: 'none', color: '#5b9cf6', cursor: 'pointer', fontSize: '13px', fontWeight: '700', fontFamily: 'DM Sans, sans-serif' }}>
            Retry ↺
          </button>
        </div>
      )}

      {/* Stat cards */}
      <div className="pay-stats">
        {statCards.map((card) => (
          <div className="pay-stat-card" key={card.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', fontWeight: '800', color: tokens.subtext, textTransform: 'uppercase', letterSpacing: '0.8px', fontFamily: 'DM Sans, sans-serif' }}>
                {card.label}
              </span>
              <span style={{ fontSize: '18px' }}>{card.icon}</span>
            </div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: loading ? tokens.subtext : card.accent, fontFamily: 'DM Sans, sans-serif', letterSpacing: '-0.5px' }}>
              {loading ? '—' : card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Unsettled by hotel */}
      {!loading && summary?.byHotel?.filter(h => h.unsettled > 0).length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div className="pay-section-label">Unsettled by Hotel</div>
          <div className="pay-hotel-unsettled">
            {summary.byHotel.filter(h => h.unsettled > 0).map(h => (
              <div className="pay-hotel-row" key={h.hotelId}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: tokens.text, fontFamily: 'DM Sans, sans-serif' }}>{h.hotelName}</div>
                  <div style={{ fontSize: '12px', color: tokens.subtext, marginTop: '2px', fontFamily: 'DM Sans, sans-serif' }}>
                    {h.count} payment(s) pending settlement
                  </div>
                </div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#f0c040', fontFamily: 'DM Sans, sans-serif' }}>{fmt(h.unsettled)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payments table */}
      <div className="pay-section">
        <div className="pay-section-header">
          <span style={{ fontSize: '14px', fontWeight: '700', color: tokens.text, fontFamily: 'DM Sans, sans-serif' }}>All Payments</span>
          <div className="pay-filters">
            {['all', 'pending', 'verified', 'failed', 'settled'].map(s => (
              <button key={s} className={`pay-filter-btn ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="pay-empty">Loading payments…</div>
        ) : payments.length === 0 ? (
          <div className="pay-empty">No payments found</div>
        ) : (
          <div className="pay-table-wrap">
            <table className="pay-table">
              <thead>
                <tr>
                  <th>Hotel</th>
                  <th>Guest</th>
                  <th>Amount</th>
                  <th>Transaction Note</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => {
                  const sc = statusColors[p.status] || statusColors.pending;
                  return (
                    <tr key={p._id}>
                      <td>
                        <div style={{ fontWeight: '700', color: tokens.text }}>{p.hotelName}</div>
                        <div style={{ fontSize: '11px', color: tokens.subtext }}>{p.hotelId?.toString().slice(-6)}</div>
                      </td>
                      <td>
                        <div>{p.guestName || '—'}</div>
                        <div style={{ fontSize: '11px', color: tokens.subtext }}>{p.customerPhone || ''}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: '15px', fontWeight: '800', color: tokens.text, fontFamily: 'DM Sans, sans-serif' }}>
                          {fmt(p.amount)}
                        </span>
                      </td>
                      <td>
                        <span className="pay-tn" title={p.transactionNote}>{p.transactionNote || '—'}</span>
                      </td>
                      <td style={{ color: tokens.subtext, whiteSpace: 'nowrap' }}>
                        <div>{fmtDate(p.createdAt)}</div>
                        {p.paidAt && <div style={{ fontSize: '11px' }}>Paid: {p.paidAt}</div>}
                      </td>
                      <td>
                        <span className="pay-badge" style={{ background: sc.bg, color: sc.color, borderColor: sc.border }}>
                          <span className="pay-badge-dot" style={{ background: sc.color }} />
                          {statusLabel[p.status]}
                        </span>
                      </td>
                      <td>
                        {p.status === 'verified' ? (
                          <button className="pay-settle-btn" onClick={() => setShowNoteFor(p._id)}>
                            Mark Settled
                          </button>
                        ) : p.status === 'settled' ? (
                          <span style={{ fontSize: '12px', color: '#5b9cf6', fontStyle: 'italic', fontFamily: 'DM Sans, sans-serif' }}>
                            ✓ {p.settledNote ? p.settledNote.slice(0, 20) + '…' : 'Settled'}
                          </span>
                        ) : (
                          <span style={{ fontSize: '12px', color: tokens.subtext }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Settle modal */}
      {showNoteFor && (
        <div className="pay-overlay" onClick={() => setShowNoteFor(null)}>
          <div className="pay-modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '17px', fontWeight: '800', color: tokens.text, fontFamily: 'DM Sans, sans-serif', marginBottom: '6px' }}>
              Mark as Settled ✅
            </div>
            <div style={{ fontSize: '13px', color: tokens.subtext, fontFamily: 'DM Sans, sans-serif', marginBottom: '16px' }}>
              Add a note about how you transferred the money to this hotel.
            </div>
            <textarea
              className="pay-modal-textarea"
              placeholder="e.g. Transferred via NEFT on 31 Mar 2026"
              value={settleNote}
              onChange={e => setSettleNote(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                onClick={() => { setShowNoteFor(null); setSettleNote(''); }}
                style={{
                  padding: '9px 18px', background: 'transparent',
                  border: `1px solid ${tokens.border}`, color: tokens.subtext,
                  borderRadius: '9px', cursor: 'pointer', fontSize: '13px',
                  fontFamily: 'DM Sans, sans-serif', fontWeight: '600',
                }}
              >
                Cancel
              </button>
              <button
                disabled={settlingId !== null}
                onClick={() => handleSettle(showNoteFor)}
                style={{
                  padding: '9px 20px',
                  background: 'rgba(76,175,80,0.15)',
                  border: '1px solid rgba(76,175,80,0.35)',
                  color: '#4caf50', borderRadius: '9px',
                  cursor: settlingId ? 'not-allowed' : 'pointer',
                  fontSize: '13px', fontWeight: '800',
                  fontFamily: 'DM Sans, sans-serif',
                  opacity: settlingId ? 0.6 : 1,
                }}
              >
                {settlingId ? 'Saving…' : 'Confirm Settlement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
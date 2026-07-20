const INSIGHT_CONFIG = {
  bill_automation:     { icon: '⚙️', label: 'Bill Automation',      accent: '#A100FF', bg: '#F8F0FF', border: '#D4A3FF' },
  savings_opportunity: { icon: '💰', label: 'Savings Opportunity',  accent: '#059669', bg: '#ECFDF5', border: '#6EE7B7' },
  spending_spike:      { icon: '📊', label: 'Spending Spike',       accent: '#B45309', bg: '#FFFBEB', border: '#FCD34D' },
  anomaly:             { icon: '🚨', label: 'Anomaly Detected',     accent: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5' },
  credit_score:        { icon: '📊', label: 'Credit Score',         accent: '#A100FF', bg: '#F8F0FF', border: '#D4A3FF' },
  cash_flow:           { icon: '💡', label: 'Cash Flow',            accent: '#A100FF', bg: '#F8F0FF', border: '#D4A3FF' },
  offer:               { icon: '🎁', label: 'Pre-Approved Offer',   accent: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
};

export default function InsightCard({ payload, onCta }) {
  const type = payload.insight_type || 'cash_flow';
  const cfg = INSIGHT_CONFIG[type] || INSIGHT_CONFIG.cash_flow;

  return (
    <div style={{
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderRadius: '4px 14px 14px 14px',
      overflow: 'hidden',
      fontSize: 13,
      width: '100%',
      maxWidth: '98%',
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '10px 13px 8px',
        borderBottom: `1px solid ${cfg.border}`,
      }}>
        <span style={{ fontSize: 14 }}>{cfg.icon}</span>
        <span style={{
          fontSize: 10, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.07em',
          color: cfg.accent, flex: 1,
        }}>{cfg.label}</span>
        {payload.dismissible && (
          <button style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#AAAAAA', fontSize: 16, lineHeight: 1, padding: '0 2px',
            fontFamily: 'inherit',
          }}>×</button>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '10px 13px 4px' }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: '#000',
          lineHeight: 1.45, marginBottom: 5,
        }}>{payload.headline}</div>
        {payload.detail && (
          <div style={{
            fontSize: 12, color: '#555', lineHeight: 1.55,
          }}>{payload.detail}</div>
        )}
      </div>

      {/* Metrics */}
      {payload.metrics?.length > 0 && (
        <div style={{ display: 'flex', gap: 5, padding: '8px 13px' }}>
          {payload.metrics.map((m, i) => (
            <div key={i} style={{
              flex: 1,
              background: 'rgba(255,255,255,0.7)',
              border: `1px solid ${cfg.border}`,
              borderRadius: 8, padding: '6px 8px',
            }}>
              <div style={{ fontSize: 9, color: cfg.accent, marginBottom: 2 }}>{m.label}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#000' }}>
                {m.value}
                {m.trend === 'up' && <span style={{ color: '#DC2626', fontSize: 10, marginLeft: 2 }}>↑</span>}
                {m.trend === 'down' && <span style={{ color: '#059669', fontSize: 10, marginLeft: 2 }}>↓</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 13px 12px' }}>
        {payload.cta_label && (
          <button
            onClick={() => onCta && onCta(payload.cta_value)}
            style={{
              flex: 1, fontSize: 12, fontWeight: 600,
              fontFamily: 'inherit', padding: '8px 12px',
              borderRadius: 8, background: cfg.accent,
              color: '#fff', border: 'none', cursor: 'pointer',
              textAlign: 'center',
            }}
          >{payload.cta_label}</button>
        )}
        {payload.secondary_cta_label && (
          <button
            onClick={() => onCta && onCta(payload.secondary_cta_value)}
            style={{
              fontSize: 11, fontWeight: 500, fontFamily: 'inherit',
              color: '#AAAAAA', background: 'none', border: 'none',
              cursor: 'pointer', padding: '4px 6px', whiteSpace: 'nowrap',
            }}
          >{payload.secondary_cta_label}</button>
        )}
      </div>
    </div>
  );
}

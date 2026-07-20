export default function InsightCard({ payload, onCta }) {
  const p = payload || {};

  const metrics = (p.metrics || []).map(m => {
    if (m && m.label !== undefined) return m;
    if (m && typeof m === 'object') {
      const entries = Object.entries(m);
      if (entries.length > 0) return { label: entries[0][0], value: String(entries[0][1]) };
    }
    return { label: '', value: '' };
  }).filter(m => m.label || m.value);

  const isAnomaly = p.insight_type === 'anomaly';

  const typeColors = {
    anomaly:             { bg:'#FFF1F1', border:'#FCA5A5', tag:'#DC2626', tagBg:'#FEE2E2', headline:'#7F1D1D', detail:'#991B1B', metric:'#DC2626', metricBg:'#FEF2F2', metricBorder:'#FCA5A5', btn:'#DC2626' },
    bill_automation:     { bg:'#EEF4FF', border:'#B5D4F4', tag:'#185FA5', tagBg:'#DBEAFE', headline:'#0C447C', detail:'#185FA5', metric:'#378ADD', metricBg:'#fff',    metricBorder:'#B5D4F4', btn:'#185FA5' },
    savings_opportunity: { bg:'#F0FDF4', border:'#86EFAC', tag:'#15803D', tagBg:'#DCFCE7', headline:'#14532D', detail:'#166534', metric:'#16A34A', metricBg:'#fff',    metricBorder:'#86EFAC', btn:'#15803D' },
    spending_spike:      { bg:'#FFFBEB', border:'#FCD34D', tag:'#B45309', tagBg:'#FEF3C7', headline:'#78350F', detail:'#92400E', metric:'#D97706', metricBg:'#fff',    metricBorder:'#FCD34D', btn:'#B45309' },
    cash_flow:           { bg:'#F5F3FF', border:'#C4B5FD', tag:'#6D28D9', tagBg:'#EDE9FE', headline:'#3B0764', detail:'#5B21B6', metric:'#7C3AED', metricBg:'#fff',    metricBorder:'#C4B5FD', btn:'#6D28D9' },
    credit_score:        { bg:'#EEF4FF', border:'#B5D4F4', tag:'#185FA5', tagBg:'#DBEAFE', headline:'#0C447C', detail:'#185FA5', metric:'#378ADD', metricBg:'#fff',    metricBorder:'#B5D4F4', btn:'#185FA5' },
    offer:               { bg:'#F5EEFF', border:'#D0B0F0', tag:'#7000BB', tagBg:'#EDE9FE', headline:'#3B0764', detail:'#6D28D9', metric:'#A100FF', metricBg:'#fff',    metricBorder:'#D0B0F0', btn:'#A100FF' },
  };

  const c = typeColors[p.insight_type] || typeColors.bill_automation;

  const tagLabels = {
    anomaly:             '🚨 Alert',
    bill_automation:     '⚙️ Agent Insight',
    savings_opportunity: '💡 Agent Insight',
    spending_spike:      '📊 Agent Insight',
    cash_flow:           '💡 Agent Insight',
    credit_score:        '📊 Credit Insight',
    offer:               '🎁 Offer',
  };
  const tagLabel = tagLabels[p.insight_type] || '💡 Agent Insight';

  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 14, padding: '14px 16px',
      marginBottom: 4, maxWidth: '86%',
    }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: c.tagBg, borderRadius: 20,
        padding: '3px 10px', marginBottom: 10,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: c.tag, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {tagLabel}
        </span>
      </div>

      {p.headline && (
        <p style={{ fontSize: 14, fontWeight: 700, color: c.headline, lineHeight: 1.4, marginBottom: 8 }}>
          {p.headline}
        </p>
      )}

      {p.detail && (
        <p style={{ fontSize: 13, color: c.detail, lineHeight: 1.55, marginBottom: metrics.length ? 14 : 12 }}>
          {p.detail}
        </p>
      )}

      {metrics.length > 0 && (
        <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
          {metrics.map((m, i) => (
            <div key={i} style={{
              flex: '1 1 80px', background: c.metricBg,
              border: `0.5px solid ${c.metricBorder}`,
              borderRadius: 9, padding: '8px 10px',
            }}>
              <div style={{ fontSize: 10, color: c.metric, fontWeight: 600, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {m.label}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.headline }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {p.cta_label && (
          <button onClick={() => onCta?.(p.cta_value || p.cta_label)} style={{
            background: c.btn, color: '#fff', border: 'none',
            borderRadius: 9, padding: '9px 16px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            → {p.cta_label}
          </button>
        )}
        {p.secondary_cta_label && !isAnomaly && (
          <button onClick={() => onCta?.(p.secondary_cta_value || p.secondary_cta_label)} style={{
            background: 'transparent', color: c.tag,
            border: `1px solid ${c.border}`,
            borderRadius: 9, padding: '9px 16px',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>
            {p.secondary_cta_label}
          </button>
        )}
      </div>
    </div>
  );
}
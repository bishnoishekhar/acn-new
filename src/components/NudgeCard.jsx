export default function NudgeCard({ payload, onCta }) {
  const p = payload || {};

  const themes = {
    recurring:  { bg: '#F5F3FF', border: '#C4B5FD', icon: '🔄', text: '#5B21B6', btn: '#6D28D9' },
    savings:    { bg: '#F0FDF4', border: '#86EFAC', icon: '💰', text: '#166534', btn: '#15803D' },
    cashflow:   { bg: '#FFFBEB', border: '#FCD34D', icon: '⚠️', text: '#92400E', btn: '#B45309' },
    bill:       { bg: '#EFF6FF', border: '#BFDBFE', icon: '🧾', text: '#1E40AF', btn: '#2563EB' },
    travel:     { bg: '#F0F9FF', border: '#BAE6FD', icon: '✈️', text: '#075985', btn: '#0284C7' },
    security:   { bg: '#FFF1F2', border: '#FECDD3', icon: '🔒', text: '#9F1239', btn: '#BE123C' },
    schedule:   { bg: '#F5F3FF', border: '#C4B5FD', icon: '⚙️', text: '#5B21B6', btn: '#6D28D9' },
    default:    { bg: '#F8F9FA', border: '#E2E8F0', icon: '💡', text: '#374151', btn: '#4B5563' },
  };

  const t = themes[p.nudge_type] || themes.default;
  const icon = p.icon || t.icon;

  return (
    <div style={{
      background: t.bg,
      border: `1px solid ${t.border}`,
      borderRadius: 12,
      padding: '12px 14px',
      maxWidth: '86%',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
    }}>
      <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {p.message && (
          <p style={{
            fontSize: 13, color: t.text, lineHeight: 1.5,
            marginBottom: p.cta_label ? 10 : 0, fontWeight: 500
          }}>{p.message}</p>
        )}
        {p.cta_label && (
          <button
            onClick={() => onCta?.(p.cta_value || p.cta_label)}
            style={{
              background: t.btn, color: '#fff', border: 'none',
              borderRadius: 8, padding: '7px 14px',
              fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
            → {p.cta_label}
          </button>
        )}
      </div>
    </div>
  );
}

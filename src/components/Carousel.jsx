function fmtAmt(a, c) {
  if (a == null) return '';
  const n = parseFloat(a).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return c ? `<span class="acn-card-currency">${c}</span>\u00a0${n}` : n;
}
function badgeClass(s) {
  s = (s || '').toLowerCase();
  if (['active', 'paid'].includes(s)) return `acn-badge acn-badge-${s}`;
  if (['frozen', 'blocked'].includes(s)) return `acn-badge acn-badge-${s}`;
  if (['pending', 'processing'].includes(s)) return `acn-badge acn-badge-${s}`;
  if (s === 'available') return 'acn-badge acn-badge-available';
  if (s === 'scheduled') return 'acn-badge acn-badge-scheduled';
  return 'acn-badge acn-badge-active';
}
function cardTheme(p) {
  const n = (p.payee_name || '').toLowerCase();
  const id = (p.payment_id || '').toLowerCase();
  if (n.includes('chequing') || id.includes('chq')) return { borderLeft: '3px solid #A100FF', background: '#F5EEFF' };
  if (n.includes('saving')   || id.includes('sav')) return { borderLeft: '3px solid #1E9E50', background: '#EAFBF0' };
  if (n.includes('visa') || n.includes('card') || id.includes('card')) return { borderLeft: '3px solid #7000BB', background: '#F5EEFF' };
  if (n.includes('bill')) return { borderLeft: '3px solid #F0CC60', background: '#FFF8E8' };
  return {};
}
export default function Carousel({ data, onCta, onClose }) {
  const { title, subtitle, payments = [] } = data;
  return (
    <div className="acn-carousel-wrap">
      <div className="acn-carousel-header">
        <div>
          <div className="acn-carousel-title">{title}</div>
          {subtitle && <div className="acn-carousel-sub">{subtitle}</div>}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#6B5B8A', cursor: 'pointer' }}>
          &times;
        </button>
      </div>
      <div className="acn-cards-track">
        {payments.map((p, i) => (
          <div key={i} className="acn-card" style={cardTheme(p)}>
            <div className="acn-card-name">{p.payee_name || ''}</div>
            {p.amount != null && (
              <div className="acn-card-amount" dangerouslySetInnerHTML={{ __html: fmtAmt(p.amount, p.currency) }} />
            )}
            {p.display_date && <div className="acn-card-date">{p.display_date}</div>}
            {p.status && (
              <div className={badgeClass(p.status)}>
                {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
              </div>
            )}
            <button
              className={p.cancellable && p.cta_value ? 'acn-cta-btn acn-cta-active' : 'acn-cta-btn acn-cta-inactive'}
              disabled={!p.cancellable || !p.cta_value}
              onClick={() => p.cancellable && p.cta_value && onCta(p.cta_value)}
            >
              {p.cta_label || 'Select'}
            </button>
          </div>
        ))}
      </div>
      <div className="acn-carousel-footer">
        <div className="acn-powered-dot" />
        <span className="acn-powered-text">Powered by Accenture &times; Google GECX</span>
      </div>
    </div>
  );
}

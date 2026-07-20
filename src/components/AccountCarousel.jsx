// Renders acn-payment-carousel / acn-payee-selector payloads as a light vertical
// list. Adapts to three shapes so nothing is hidden and each row is logical:
//   • accounts     → compact balance cards with the flow's own CTA
//   • transactions → statement rows (description, date, signed amount)
//   • payees       → selectable recipient rows (name, bank/acct, tap to choose)
export default function AccountCarousel({ payload, onCta }) {
  const payees = payload?.payees || [];
  const rows = payload?.accounts || payload?.items || payload?.payments || [];
  const items = payees.length ? payees : rows;
  const ctas = payload?.ctas || payload?.actions || [];
  const title = payload?.title || 'Your Accounts';
  const subtitle = payload?.subtitle;

  const BRAND = '#A100FF';
  const isPayee = payees.length > 0 || payload?.name === 'acn-payee-selector';
  const isTxn = !isPayee && (/transaction|statement|activity/i.test(title) ||
    items.some((it) => ['debit', 'credit'].includes(String(it.status || it.type || '').toLowerCase())));

  const typeMeta = (id = '', name = '') => {
    const u = (id + ' ' + name).toUpperCase();
    if (u.includes('OFFER')) return { label: 'Pre-Approved', color: '#7C3AED' };
    if (u.includes('SCORE')) return { label: 'Credit Score', color: '#7C3AED' };
    if (u.includes('CHQ') || u.includes('CHEQ')) return { label: 'Chequing', color: '#A100FF' };
    if (u.includes('SAV')) return { label: 'Savings', color: '#059669' };
    if (u.includes('TFSA')) return { label: 'TFSA', color: '#0284C7' };
    if (u.includes('RRSP')) return { label: 'RRSP', color: '#D97706' };
    if (u.includes('CC') || u.includes('CREDIT') || u.includes('VISA')) return { label: 'Credit Card', color: '#DC2626' };
    return { label: 'Account', color: BRAND };
  };

  const fmt = (amount, currency = 'CAD') => {
    const n = Number(amount);
    if (Number.isNaN(n)) return String(amount ?? '');
    const decimals = currency ? 2 : 0;
    const formatted = n.toLocaleString('en-CA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return currency ? `${currency} ${formatted}` : formatted;
  };
  // Only show a masked number when there are real digits — avoids "••••-SAV".
  const fmtDate = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
  };
  const mask = (num) => {
    const d = String(num || '').replace(/\D/g, '');
    return d.length >= 4 ? '••••' + d.slice(-4) : '';
  };
  const send = (v) => v && onCta && onCta(v);

  const wrap = {
    background: '#fff', borderRadius: '14px', border: '1px solid #EDE5F8',
    marginBottom: '4px',
    maxWidth: '86%', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  };
  const header = (
    <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid #F0EBF8' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: '#140025' }}>{title}</div>
      <div style={{ fontSize: '11px', color: '#8A7CA8', marginTop: '2px' }}>
        {subtitle || (isPayee ? 'Choose a recipient.' : isTxn ? 'Your recent activity.' : 'Tap an account to view its transactions.')}
      </div>
    </div>
  );

  // ── Payees: selectable recipient rows ──
  if (isPayee) {
    return (
      <div style={wrap}>
        {header}
        <div style={{ padding: '6px' }}>
          {items.map((p, i) => (
            <button key={i}
              onClick={() => send(p.cta_value || p.utterance || `Send to ${p.payee_id || p.payee_name}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: '11px', width: '100%', textAlign: 'left',
                background: '#fff', border: '1px solid #EFE8FA', borderRadius: '12px',
                padding: '10px 12px', marginBottom: i < items.length - 1 ? '6px' : 0, cursor: 'pointer',
              }}
            >
              <span style={{
                width: '34px', height: '34px', flexShrink: 0, borderRadius: '9px', background: '#F5EEFF',
                color: BRAND, fontWeight: 800, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{String(p.payee_name || '?').replace(/[^A-Za-z]/g, '').slice(0, 1).toUpperCase() || '•'}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#140025', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.payee_name || 'Recipient'}
                </span>
                {p.account_number && (
                  <span style={{ display: 'block', fontSize: '11.5px', color: '#8A7CA8', marginTop: '1px' }}>{p.account_number}</span>
                )}
              </span>
              <span style={{ fontSize: '20px', color: '#C6ABE8', flexShrink: 0 }}>›</span>
            </button>
          ))}
        </div>
        {ctas.length > 0 && footerCtas(ctas, BRAND, send)}
      </div>
    );
  }

  // ── Transactions: statement list ──
  if (isTxn) {
    return (
      <div style={wrap}>
        {header}
        <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
          {items.map((t, i) => {
            const ttype = String(t.status || t.type || '').toLowerCase();
            const credit = ttype === 'credit' || ttype.includes('credit') || ttype.includes('refund') || ttype.includes('deposit') || ttype.includes('incoming');
            const name = t.payee_name || t.description || 'Transaction';
            const initials = name.replace(/[^A-Za-z\s]/g, '').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
            const logoColors = [
              { bg: '#FFF3E0', color: '#E65100' }, { bg: '#FFEBEE', color: '#C62828' },
              { bg: '#FFF8E1', color: '#F57C00' }, { bg: '#E8F5E9', color: '#2E7D32' },
              { bg: '#E3F2FD', color: '#1565C0' }, { bg: '#F3E5F5', color: '#7B1FA2' },
            ];
            const lc = logoColors[i % logoColors.length];
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px', borderTop: '1px solid #F5F0FC',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: lc.bg, color: lc.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, letterSpacing: '-0.5px',
                }}>{initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#140025', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#8A7CA8', marginTop: '1px' }}>{fmtDate(t.display_date)}</div>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', color: credit ? '#059669' : '#DC2626' }}>
                  {credit ? '+' : '-'}{fmt(t.amount, t.currency || 'CAD')}
                </div>
              </div>
            );
          })}
        </div>
        {ctas.length > 0 && footerCtas(ctas, BRAND, send)}
      </div>
    );
  }

  // ── Accounts: light balance cards ──
  return (
    <div style={wrap}>
      {header}
      <div style={{ padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map((acct, i) => {
          const id = acct.account_id || acct.id || acct.payment_id || '';
          const name = acct.account_type || acct.payee_name || '';
          const meta = typeMeta(id, name);
          const balance = acct.balance ?? acct.current_balance ?? acct.amount;
          const currency = acct.currency != null ? acct.currency : 'CAD';
          const statusStr = String(acct.status || 'Active').toLowerCase();
          const active = statusStr === 'active';
          const isPending = ['pre-approved', 'pending', 'offered'].includes(statusStr);
          const acctNum = mask(acct.account_number);
          const cta = acct.cta_value || `Show transactions for ${id || name}`;
          let ctaLabel = acct.cta_label || 'View transactions';
          if (!/[→>]\s*$/.test(ctaLabel)) ctaLabel += ' →';

          return (
            <div key={i} role="button" onClick={() => send(cta)}
              style={{
                background: '#FCFAFF', borderRadius: '12px', border: '1px solid #EFE8FA',
                borderLeft: `4px solid ${meta.color}`, padding: '11px 13px', cursor: 'pointer',
                transition: 'box-shadow .15s, transform .12s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 6px 18px ${meta.color}26`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: meta.color, background: `${meta.color}14`, padding: '2px 8px', borderRadius: '20px' }}>{meta.label}</span>
                {acctNum && <span style={{ fontSize: '10.5px', color: '#B0A4C8', letterSpacing: '0.5px' }}>{acctNum}</span>}
              </div>
              {balance != null && (
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#140025', letterSpacing: '-0.4px', marginTop: '5px', whiteSpace: 'nowrap' }}>
                  {fmt(balance, currency)}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '7px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: active ? '#1A6E3C' : isPending ? '#6D28D9' : '#8A1C1C', background: active ? '#EAFBF0' : isPending ? '#F5F3FF' : '#FFF1F1', padding: '2px 8px', borderRadius: '20px' }}>{active ? 'Active' : acct.status}</span>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: meta.color }}>{ctaLabel}</span>
              </div>
            </div>
          );
        })}
      </div>
      {ctas.length > 0 && footerCtas(ctas, BRAND, send)}
    </div>
  );
}

function footerCtas(ctas, BRAND, send) {
  return (
    <div style={{ padding: '2px 11px 11px', display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
      {ctas.map((cta, i) => (
        <button key={i}
          onClick={() => send(cta.value || cta.cta_value || cta.utterance || cta.content)}
          style={{
            flex: 1, minWidth: '110px', padding: '9px 12px',
            background: i === 0 ? BRAND : '#F5F1FB', color: i === 0 ? '#fff' : '#140025',
            border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
          }}
        >
          {cta.label || cta.content || cta.text}
        </button>
      ))}
    </div>
  );
}

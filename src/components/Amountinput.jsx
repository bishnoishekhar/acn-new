import { useState } from 'react';

export default function AmountInput({ payload, onSubmit }) {
  const {
    title, subtitle, currency = 'CAD',
    placeholder = '0.00', min_amount, max_amount,
    cta_label = 'Confirm', cta_value_prefix = 'amount',
    quick_amounts = [],
  } = payload;

  const [val, setVal] = useState('');

  const handleSubmit = () => {
    if (!val) return;
    onSubmit && onSubmit(`${cta_value_prefix} ${val}`);
  };

  return (
    <div style={{
      background: '#fff', border: '1px solid #E8E8E8',
      borderTop: '3px solid #A100FF',
      borderRadius: '4px 14px 14px 14px',
      fontSize: 13,
      maxWidth: '86%',
    }}>
      {(title || subtitle) && (
        <div style={{ padding: '10px 13px 8px', borderBottom: '1px solid #EBEBEB' }}>
          {title && <div style={{ fontSize: 13, fontWeight: 600, color: '#000' }}>{title}</div>}
          {subtitle && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{subtitle}</div>}
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: 13, borderBottom: '1px solid #F0F0F0',
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: '#555', flexShrink: 0 }}>{currency}</span>
        <input
          type="number"
          placeholder={placeholder}
          min={min_amount}
          max={max_amount}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          style={{
            flex: 1, fontSize: 22, fontWeight: 600,
            fontFamily: 'inherit', color: '#000',
            border: 'none', outline: 'none', background: 'none', minWidth: 0,
          }}
        />
      </div>

      {quick_amounts.length > 0 && (
        <div style={{ display: 'flex', gap: 6, padding: '10px 13px', flexWrap: 'wrap' }}>
          {quick_amounts.map((q, i) => (
            <button key={i}
              onClick={() => onSubmit && onSubmit(q.cta_value)}
              style={{
                fontSize: 11, fontWeight: 500, fontFamily: 'inherit',
                padding: '5px 10px', borderRadius: 100,
                border: '1px solid #D8D8D8', background: '#fff',
                color: '#333', cursor: 'pointer',
              }}
            >{q.label}</button>
          ))}
        </div>
      )}

      <div style={{ padding: '0 13px 13px' }}>
        <button
          onClick={handleSubmit}
          style={{
            width: '100%', padding: 9, borderRadius: 8,
            background: '#A100FF', color: '#fff',
            fontSize: 13, fontWeight: 600,
            fontFamily: 'inherit', border: 'none', cursor: 'pointer',
          }}
        >{cta_label}</button>
      </div>
    </div>
  );
}

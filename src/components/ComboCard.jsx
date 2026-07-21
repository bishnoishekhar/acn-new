function splitIcon(s = '') {
  const m = s.match(/^\s*(\p{Extended_Pictographic}(?:️)?)\s*(.*)$/u);
  return m ? { icon: m[1], text: m[2] } : { icon: '', text: s };
}

export default function ComboCard({ heading, subtitle, actions, onSelect, compact = false }) {
  return (
    <div className={`acn-combo-card${compact ? ' compact' : ''}`}>
      {heading && <div className="acn-combo-text">{heading}</div>}
      {subtitle && <div className="acn-combo-subtitle">{subtitle}</div>}
      <div className="acn-combo-tiles">
        {actions.map((action, i) => {
          const { icon, text } = splitIcon(action.content || '');
          const label = text || action.content || '';
          const isLast = i === actions.length - 1;
          return (
            <button key={i} className={`acn-tile${isLast ? ' last' : ''}`} onClick={() => onSelect(action)}>
              {icon && <span className="acn-tile-icon-wrap"><span className="acn-tile-icon">{icon}</span></span>}
              <span className="acn-tile-body">
                <span className="acn-tile-title">{label}</span>
                {action.description && <span className="acn-tile-desc">{action.description}</span>}
              </span>
              <span className="acn-tile-chevron">›</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
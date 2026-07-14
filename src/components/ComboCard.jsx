export default function ComboCard({ heading, actions, onSelect, compact = false }) {
  return (
    <div className={`acn-combo-card${compact ? ' compact' : ''}`}>
      {heading && <div className="acn-combo-text">{heading}</div>}
      <div className="acn-combo-tiles">
        {actions.map((action, i) => (
          <button
            key={i}
            className="acn-tile"
            onClick={() => onSelect(action)}
          >
            <span className="acn-tile-title">{action.content || ''}</span>
            {action.description && !compact && (
              <span className="acn-tile-desc">{action.description}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

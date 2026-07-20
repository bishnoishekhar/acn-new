import { useState } from "react";

const TIER_COLORS = {
  platinum: { bg: '#1A1A2E', text: '#E8D5B7', accent: '#C9A84C', badge: '#C9A84C', badgeText: '#1A1A2E' },
  gold:     { bg: '#2D1B00', text: '#FFD700', accent: '#FFD700', badge: '#FFD700', badgeText: '#2D1B00' },
  travel:   { bg: '#0A1628', text: '#7DD3FC', accent: '#38BDF8', badge: '#0EA5E9', badgeText: '#fff' },
  cashback: { bg: '#0F2417', text: '#86EFAC', accent: '#22C55E', badge: '#16A34A', badgeText: '#fff' },
  student:  { bg: '#1E1B4B', text: '#C4B5FD', accent: '#A78BFA', badge: '#7C3AED', badgeText: '#fff' },
  secured:  { bg: '#1C1917', text: '#D6D3D1', accent: '#A8A29E', badge: '#57534E', badgeText: '#fff' },
  default:  { bg: '#1A1A2E', text: '#E2E8F0', accent: '#A100FF', badge: '#A100FF', badgeText: '#fff' },
};

function getTheme(card) {
  const name = (card.card_name || '').toLowerCase();
  if (name.includes('platinum')) return TIER_COLORS.platinum;
  if (name.includes('gold'))     return TIER_COLORS.gold;
  if (name.includes('travel'))   return TIER_COLORS.travel;
  if (name.includes('cash'))     return TIER_COLORS.cashback;
  if (name.includes('student'))  return TIER_COLORS.student;
  if (name.includes('secured'))  return TIER_COLORS.secured;
  return TIER_COLORS.default;
}

function CardFace({ card }) {
  const t = getTheme(card);
  return (
    <div style={{
      background: t.bg,
      borderRadius: 14, padding: '18px 20px',
      color: t.text, position: 'relative', overflow: 'hidden',
      minHeight: 130, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    }}>
      {/* sheen */}
      <div style={{
        position: 'absolute', top: -40, right: -40, width: 120, height: 120,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${t.accent}22, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-.2px', maxWidth: '70%', lineHeight: 1.3 }}>
          {card.card_name}
        </div>
        <div style={{
          background: t.badge, color: t.badgeText,
          fontSize: 9, fontWeight: 700, padding: '3px 8px',
          borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0,
        }}>
          {card.network || 'ACN'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
        <div>
          <div style={{ fontSize: 9, opacity: .65, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Annual fee</div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {card.annual_fee === 0 ? 'No fee' : `CAD ${card.annual_fee}`}
          </div>
        </div>
        {card.welcome_bonus_value > 0 && (
          <div>
            <div style={{ fontSize: 9, opacity: .65, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Welcome offer</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.accent }}>
              {card.welcome_bonus_points ? `${Number(card.welcome_bonus_points).toLocaleString()} pts` : `CAD ${card.welcome_bonus_value}`}
            </div>
          </div>
        )}
        {card.purchase_rate && (
          <div>
            <div style={{ fontSize: 9, opacity: .65, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Purchase rate</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{card.purchase_rate}%</div>
          </div>
        )}
      </div>
    </div>
  );
}

function CardDetail({ card, onApply }) {
  const t = getTheme(card);
  const rewards  = card.rewards  || [];
  const benefits = card.benefits || [];

  return (
    <div style={{ padding: '14px 0 4px' }}>
      {/* Rewards */}
      {rewards.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Rewards</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {rewards.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.accent, flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: '#333', lineHeight: 1.4 }}>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Benefits */}
      {benefits.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Benefits</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {benefits.map((b, i) => (
              <span key={i} style={{
                background: '#F5F5F5', border: '0.5px solid #E0E0E0',
                borderRadius: 20, padding: '3px 10px',
                fontSize: 11.5, color: '#444', fontWeight: 500,
              }}>{b}</span>
            ))}
          </div>
        </div>
      )}

      {/* Eligibility */}
      {(card.min_income || card.min_credit_score) && (
        <div style={{ background: '#F8F8F8', border: '0.5px solid #EBEBEB', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Eligibility</div>
          <div style={{ display: 'flex', gap: 16 }}>
            {card.min_income && (
              <div>
                <div style={{ fontSize: 10, color: '#AAA' }}>Min. income</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>CAD {Number(card.min_income).toLocaleString()}</div>
              </div>
            )}
            {card.min_credit_score && (
              <div>
                <div style={{ fontSize: 10, color: '#AAA' }}>Min. credit score</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>{card.min_credit_score}+</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Apply button */}
      <button onClick={() => onApply(card)} style={{
        width: '100%', padding: '10px', borderRadius: 9,
        background: '#A100FF', color: '#fff', border: 'none',
        fontSize: 13, fontWeight: 700, cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background .15s',
      }}
        onMouseOver={e => e.currentTarget.style.background = '#8A00E0'}
        onMouseOut={e => e.currentTarget.style.background = '#A100FF'}
      >
        Apply for {card.card_name} →
      </button>
    </div>
  );
}

export default function CreditCardWidget({ payload, onCta }) {
  const p = payload || {};

  // Normalise — tool returns either 'cards' or 'productDetails'
  const rawCards = p.cards || p.productDetails || [];
  const cards = rawCards.map(c => ({
    card_id:              c.card_id      || c.productId   || '',
    card_name:            c.card_name    || c.title       || c.name || '',
    network:              c.network                       || 'ACN',
    annual_fee:           c.annual_fee   ?? c.annualFee   ?? null,
    purchase_rate:        c.purchase_rate || c.purchaseRate || null,
    welcome_bonus_value:  c.welcome_bonus_value  || c.welcomeBonusValue  || 0,
    welcome_bonus_points: c.welcome_bonus_points || c.welcomeBonusPoints || null,
    min_income:           c.min_income   || c.minIncome   || null,
    min_credit_score:     c.min_credit_score || c.minCreditScore || null,
    rewards:              c.rewards      || c.rewardsList || [],
    benefits:             c.benefits     || c.benefitsList || [],
    uri:                  c.uri          || c.url         || null,
    subtitle:             c.subtitle     || c.tagline     || null,
  }));
  const [activeIdx, setActiveIdx] = useState(0);

  if (!cards.length) return null;

  const activeCard = cards[activeIdx];

  return (
    <div style={{
      background: '#fff', border: '1px solid #E8E0F3',
      borderTop: '3px solid #A100FF',
      borderRadius: '4px 14px 14px 14px',
      overflow: 'hidden', maxWidth: '92%', alignSelf: 'flex-start',
    }}>
      {/* Header */}
      {(p.title || p.subtitle) && (
        <div style={{ padding: '12px 14px 8px', borderBottom: '0.5px solid #F0F0F0' }}>
          {p.title && <div style={{ fontSize: 13, fontWeight: 700, color: '#000' }}>{p.title}</div>}
          {p.subtitle && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{p.subtitle}</div>}
        </div>
      )}

      {/* Tab selector — shown when more than one card */}
      {cards.length > 1 && (
        <div style={{ display: 'flex', gap: 0, borderBottom: '0.5px solid #EBEBEB', overflowX: 'auto' }}>
          {cards.map((card, i) => (
            <button key={i} onClick={() => setActiveIdx(i)} style={{
              flex: 1, padding: '9px 12px', border: 'none', cursor: 'pointer',
              background: i === activeIdx ? '#F8F0FF' : '#fff',
              borderBottom: i === activeIdx ? '2px solid #A100FF' : '2px solid transparent',
              fontSize: 11.5, fontWeight: i === activeIdx ? 700 : 500,
              color: i === activeIdx ? '#A100FF' : '#888',
              whiteSpace: 'nowrap', fontFamily: 'inherit',
              transition: 'all .15s',
            }}>
              {card.card_name?.split(' ').slice(-1)[0] || `Card ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* Card face + detail */}
      <div style={{ padding: '14px 14px 12px' }}>
        <CardFace card={activeCard} />
        <CardDetail card={activeCard} onApply={card => onCta?.(`I want to apply for ${card.card_name}`)} />
      </div>

      {/* Powered by footer */}
      <div style={{
        padding: '6px 14px', borderTop: '0.5px solid #EBEBEB',
        background: '#FAFAFA', display: 'flex', alignItems: 'center', gap: 5,
        justifyContent: 'center',
      }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#A100FF' }} />
        <span style={{ fontSize: 9, color: '#AAA' }}>Powered by ACN Bank AI</span>
      </div>
    </div>
  );
}

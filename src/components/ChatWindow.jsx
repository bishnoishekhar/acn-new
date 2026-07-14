import { useState, useEffect, useRef, useCallback } from 'react';
import { initGecx, resetGecx, gecxSend, setResponseHandler } from './gecx';
import ComboCard from './ComboCard';
import AcnFormWidget from './AcnFormWidget';
import Carousel from './Carousel';

function stripMarkdown(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,3}\s+/gm, '')
    .trim();
}

function BotText({ text }) {
  const lines = text.split('\n').filter(Boolean);
  if (lines.length <= 1) return <>{text}</>;
  return (
    <>
      {lines.map((line, i) => (
        <span key={i} style={{ display: 'block', marginBottom: i < lines.length - 1 ? '6px' : 0 }}>
          {line}
        </span>
      ))}
    </>
  );
}

let _idCounter = 0;
const uid = () => ++_idCounter;

// Returns true if heading indicates user needs to type (compact fallback tiles)
const isFH = (h) => {
  if (!h) return false;
  const l = h.toLowerCase();
  return l.startsWith('please type') || l.startsWith('please enter') ||
         l.startsWith('type your') || l.startsWith('enter your') ||
         l.startsWith('or identify') || l.startsWith('or choose') ||
         l.startsWith('or use a') || l.startsWith('choose a different');
};

export default function ChatWindow({ isOpen, onClose, onReset, intent }) {
  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [carousel, setCarousel] = useState(null);
  const [activeForm, setActiveForm] = useState(null);
  const [voiceActive, setVoiceActive] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const msgsRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const respondingTimerRef = useRef(null);
  const lastBotTextRef = useRef(null); // buffers last addBot text for cross-event showCombo heading

  /* ── Scroll ── */
  const scrollToBottom = useCallback(() => {
    const snap = () => {
      if (!msgsRef.current) return;
      const combo = msgsRef.current.querySelector('[data-combo="true"]:last-child');
      if (combo) {
        const cb = combo.offsetTop + combo.offsetHeight;
        const vb = msgsRef.current.scrollTop + msgsRef.current.clientHeight;
        if (cb > vb) msgsRef.current.scrollTop = cb - msgsRef.current.clientHeight + 16;
      } else {
        msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
      }
    };
    snap();
    requestAnimationFrame(snap);
    setTimeout(snap, 50);
    setTimeout(snap, 200);
    setTimeout(snap, 400);
  }, []);

  /* ── Messages ── */
  const addBot = useCallback((text) => {
    const clean = stripMarkdown(text);
    if (!clean) return;
    lastBotTextRef.current = clean; // buffer for showCombo heading in next event
    setMessages((prev) => [...prev, { type: 'bot', text: clean, id: uid() }]);
  }, []);

  const addUser = useCallback((text) => {
    setMessages((prev) => [...prev, { type: 'user', text, id: uid() }]);
  }, []);

  const showTyping = useCallback(() => {
    setIsResponding(true);
    setMessages((prev) => {
      const f = prev.filter((m) => m.type !== 'typing');
      return [...f, { type: 'typing', id: uid() }];
    });
    // Safety: clear after 12s if agent never responds
    if (respondingTimerRef.current) clearTimeout(respondingTimerRef.current);
    lastBotTextRef.current = null;
    respondingTimerRef.current = setTimeout(() => {
      setIsResponding(false);
      setMessages((prev) => prev.filter((m) => m.type !== 'typing'));
    }, 12000);
  }, []);

  const removeTyping = useCallback(() => {
    if (respondingTimerRef.current) clearTimeout(respondingTimerRef.current);
    setIsResponding(false);
    setMessages((prev) => prev.filter((m) => m.type !== 'typing'));
  }, []);

  /* ── Parse tool_code quick_actions ──
     Handles: 'key':'val', key='val', "I'm" apostrophes, Safari-safe ── */
  const parseToolCode = useCallback((text) => {
    if (!text.includes('tool_code') && !text.includes('default_api.quick_actions')) return null;
    try {
      const actions = [];

      // fv: find value for key — tries double-quote first (handles apostrophes), then single
      const fv = (str, key) => {
        const QK = "['\"]" + key + "['\"]";
        let m;
        // 'key': "value"  or  'key'="value"
        m = str.match(new RegExp(QK + '\\s*[=:]\\s*"([^"]*)"'));
        if (m) return m[1];
        // 'key': 'value'  or  'key'='value'
        m = str.match(new RegExp(QK + "\\s*[=:]\\s*'([^']*)'"));
        if (m) return m[1];
        // kwargs: key='value'  (unquoted key)
        m = str.match(new RegExp('\\b' + key + "\\s*=\\s*'([^']*)'"));
        if (m) return m[1];
        // kwargs: key="value"
        m = str.match(new RegExp('\\b' + key + '\\s*=\\s*"([^"]*)"'));
        if (m) return m[1];
        return null;
      };

      // Split into per-action chunks — Safari-safe (no lookbehind)
      const marked = text.replace(/\{(\s*['"]?content['"]?\s*[=:])/g, '\x00{$1');
      const parts = marked.split(/QuickActionsPayloadActions\s*\(|\x00/);

      parts.forEach((part) => {
        const c = fv(part, 'content');
        const u = fv(part, 'utterance');
        const d = fv(part, 'description');
        if (c && u) actions.push({ content: c.trim(), description: d ? d.trim() : '', utterance: u.trim() });
      });

      const sum = fv(text, 'summary');
      return actions.length > 0 ? { actions, summary: sum ? sum.trim() : 'What can I help you with?' } : null;
    } catch (e) { return null; }
  }, []);

  /* ── Extract Say: lines ── */
  const extractSayLines = useCallback((text) => {
    const lines = [];
    const re = /Say:\s*["'](.*?)["'](?=\s*(?:Say:|tool_code:|$))/gs;
    let m;
    while ((m = re.exec(text)) !== null) lines.push(m[1].trim());
    return lines;
  }, []);

  /* ── Show combo card ──
     Absorbs last bot bubble as heading if no forcedHeading given ── */
  const showCombo = useCallback((actions, summary, forcedHeading, forcedSubtitle) => {
    // Capture ref value now (before async setState)
    const bufferedHeading = lastBotTextRef.current;
    lastBotTextRef.current = null; // consume it
    setMessages((prev) => {
      if (!forcedHeading) {
        // First try: absorb last bot bubble from state
        const li = [...prev].reverse().findIndex((m) => m.type === 'bot');
        if (li !== -1) {
          const ri = prev.length - 1 - li;
          const h = prev[ri].text;
          const without = prev.filter((_, i) => i !== ri);
          return [...without, { type: 'combo', heading: h, actions, id: uid(), compact: isFH(h) }];
        }
        // Second try: use buffered text from addBot in previous event (React batching fix)
        if (bufferedHeading) {
          return [...prev, { type: 'combo', heading: bufferedHeading, actions, id: uid(), compact: isFH(bufferedHeading) }];
        }
      }
      const h = forcedHeading || summary || 'How can I help?';
      return [...prev, { type: 'combo', heading: h, subtitle: forcedSubtitle, actions, id: uid(), compact: isFH(h) }];
    });
  }, []);

  /* ── Process GECX outputs ──
     Key rules:
     1. Skip entirely if no visible content (intermediate tool responses)
     2. Process TEXT first so bot bubbles exist before payload showCombo runs
     3. Then process PAYLOAD — showCombo finds the correct heading bubble ── */
  const processOutputs = useCallback((outputs) => {
    // Check if there is any visible content worth showing
    const hasVisible = outputs.some((o) => {
      if (o.payload) {
        return o.payload.type === 'quick_actions' ||
               o.payload.name === 'acn-form-input' ||
               o.payload.name === 'acn-payment-carousel';
      }
      if (!o.text) return false;
      const t = o.text;
      if (t.includes('narration_checkpoint')) return false;
      if (t.includes('tool_code:')) {
        return t.includes('default_api.quick_actions') || t.includes('quick_actions(');
      }
      return stripMarkdown(t).length > 0;
    });

    // Intermediate tool response (queryCustomers, orchestrate_lookup etc) — keep typing
    if (!hasVisible) return;

    removeTyping();

    // Pass 1: text outputs — renders bot bubbles BEFORE combo cards
    outputs.forEach((output) => {
      if (!output.text) return;
      const text = output.text;

      // tool_code quick_actions
      const tc = parseToolCode(text);
      if (tc) {
        const sl = extractSayLines(text);
        if (sl.length >= 2) {
          // Welcome card: first Say = heading, second Say = subtitle inside card
          setMessages((prev) => [...prev, {
            type: 'combo', heading: sl[0], subtitle: sl[1],
            actions: tc.actions, id: uid(), compact: isFH(sl[0])
          }]);
        } else if (sl.length === 1) {
          setMessages((prev) => [...prev, {
            type: 'combo', heading: sl[0],
            actions: tc.actions, id: uid(), compact: isFH(sl[0])
          }]);
        } else {
          showCombo(tc.actions, tc.summary);
        }
        return;
      }

      // Narrated quick_actions fallback (older format)
      if (text.includes('quick_actions') && text.includes('content:') && text.includes('utterance:')) {
        const acts = [];
        const re = /content:\s*["']?([^,}"'\n]+?)["']?\s*,\s*description:\s*["']?([^,}"'\n]+?)["']?\s*,\s*utterance:\s*["']?([^}"'\n\]]+?)["']?\s*\}/g;
        let m;
        while ((m = re.exec(text)) !== null) {
          acts.push({ content: m[1].trim(), description: m[2].trim(), utterance: m[3].trim() });
        }
        const sm = text.match(/summary:\s*["']?([^,}"'\]\n]+?)["']?\s*[,}]/);
        if (acts.length > 0) { showCombo(acts, sm ? sm[1].trim() : 'What can I help you with?'); return; }
      }

      // Suppress internal signals
      if (text.includes('narration_checkpoint') || text.includes('tool_code:')) return;

      addBot(text);
    });

    // Pass 2: payload outputs — bot bubbles from Pass 1 are now in state
    outputs.forEach((output) => {
      if (!output.payload) return;
      const p = output.payload;
      if (p.type === 'quick_actions' && p.actions) {
        showCombo(p.actions, p.summary);
      }
      if (p.name === 'acn-form-input' && p.fields) {
        setActiveForm({ payload: p, id: uid() });
        // Existing combo cards become compact fallback tiles
        setMessages((prev) => prev.map((m) => m.type === 'combo' ? { ...m, compact: true } : m));
      }
      if (p.name === 'acn-payment-carousel') setCarousel(p);
    });
  }, [removeTyping, addBot, showCombo, parseToolCode, extractSayLines]);

  /* ── Effects ── */
  useEffect(() => { setResponseHandler(processOutputs); }, [processOutputs]);
  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!isOpen) return;
    if (intent) {
      setTimeout(() => { addUser(intent); showTyping(); gecxSend(intent); }, 600);
    } else if (!sessionStarted) {
      setSessionStarted(true);
      showTyping();
      initGecx();
    }
    setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]); // eslint-disable-line

  /* ── Handlers ── */
  const handleTileSelect = useCallback((action, comboId) => {
    setMessages((prev) => prev.filter((m) => m.id !== comboId));
    addUser(action.content || action.utterance);
    showTyping();
    gecxSend(action.utterance || action.content);
    setTimeout(() => {
      if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
    }, 50);
  }, [addUser, showTyping]);

  const handleFormSubmit = useCallback((value, displayText) => {
    setActiveForm(null);
    // displayText is pre-masked by AcnFormWidget (e.g. "••••" for PIN/OTP)
    addUser(displayText || value.split(':').slice(1).join(':') || value);
    showTyping();
    gecxSend(value);
  }, [addUser, showTyping]);

  const sendMessage = useCallback(() => {
    const text = inputVal.trim();
    if (!text || isResponding) return;
    setInputVal('');
    addUser(text);
    showTyping();
    gecxSend(text);
  }, [inputVal, addUser, showTyping, isResponding]);

  const handleReset = useCallback(() => {
    setMessages([]);
    setCarousel(null);
    setActiveForm(null);
    setSessionStarted(false);
    setInputVal('');
    setIsResponding(false);
    if (respondingTimerRef.current) clearTimeout(respondingTimerRef.current);
    resetGecx();
    setTimeout(() => showTyping(), 600);
    onReset?.();
  }, [showTyping, onReset]);

  const toggleVoice = useCallback(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Voice input not supported in this browser.');
      return;
    }
    if (voiceActive) { recognitionRef.current?.stop(); setVoiceActive(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = 'en-CA';
    rec.interimResults = false;
    rec.onresult = (e) => { setInputVal(e.results[0][0].transcript); setTimeout(sendMessage, 100); };
    rec.onend = () => setVoiceActive(false);
    rec.start();
    recognitionRef.current = rec;
    setVoiceActive(true);
  }, [voiceActive, sendMessage]);

  const handleFileUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    addUser('📎 ' + file.name);
    showTyping();
    gecxSend('I am uploading a file: ' + file.name);
    e.target.value = '';
  }, [addUser, showTyping]);

  const handleCarouselCta = useCallback((ctaValue) => {
    setCarousel(null);
    showTyping();
    gecxSend(ctaValue);
  }, [showTyping]);

  /* ── Render ── */
  return (
    <>
      {/* Hidden GECX messenger */}
      <div style={{ position: 'fixed', bottom: 0, right: 0, visibility: 'hidden', height: 0, width: 0 }}>
        <chat-messenger
          id="gecx-messenger"
          url-allowlist="*"
          language-code="en"
          max-query-length="-1"
          style={{ visibility: 'hidden', height: 0, width: 0, display: 'block', position: 'fixed', bottom: 0, right: 0 }}
        >
          <chat-messenger-container chat-title="ACN Bank AI">
            <chat-reset-session-button slot="titlebar-actions" title-text="New conversation" />
          </chat-messenger-container>
        </chat-messenger>
      </div>

      {/* Chat window */}
      <div className={`acn-chat-window${isOpen ? '' : ' closed'}`}>

        {/* Header */}
        <div className="acn-chat-header">
          <div className="acn-chat-avatar">A</div>
          <div style={{ flex: 1 }}>
            <div className="acn-chat-title">ACN Bank AI</div>
            <div className="acn-chat-status">
              <div className={`acn-chat-status-dot${isResponding ? ' responding' : ''}`} />
              {isResponding ? 'Responding now' : 'Online · Ready'}
            </div>
          </div>
          <div className="acn-chat-header-btns">
            <button className="acn-icon-btn" onClick={handleReset} title="New conversation">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
              </svg>
            </button>
            <button className="acn-icon-btn" onClick={onClose} style={{ fontSize: 20 }}>&#x2715;</button>
          </div>
        </div>

        {/* Messages */}
        <div className="acn-messages" ref={msgsRef}>
          {messages.map((msg, idx) => {
            const isConsBot = msg.type === 'bot' && messages[idx - 1]?.type === 'bot';

            if (msg.type === 'bot') return (
              <div key={msg.id} className={`acn-bot-bubble acn-msg-enter${isConsBot ? ' acn-bot-consecutive' : ''}`}>
                <BotText text={msg.text} />
              </div>
            );

            if (msg.type === 'user') return (
              <div key={msg.id} className="acn-user-bubble acn-msg-enter">
                {msg.text}
              </div>
            );

            if (msg.type === 'typing') return (
              <div key={msg.id} className="acn-typing">
                <span /><span /><span />
              </div>
            );

            if (msg.type === 'combo') return (
              <div key={msg.id} data-combo="true">
                <ComboCard
                  heading={msg.heading}
                  subtitle={msg.subtitle}
                  actions={msg.actions}
                  onSelect={(a) => handleTileSelect(a, msg.id)}
                  compact={msg.compact === true}
                />
              </div>
            );

            return null;
          })}
        </div>

        {/* PIN / OTP form widget — above input bar */}
        {activeForm && (
          <div style={{ padding: '0 12px 8px', borderTop: '1px solid #EBEBEB', background: '#fff' }}>
            <AcnFormWidget
              key={activeForm.id}
              payload={activeForm.payload}
              onSubmit={handleFormSubmit}
            />
          </div>
        )}

        {/* Input bar */}
        <div className="acn-input-bar">
          <button
            className="acn-input-icon-btn"
            title="Attach file"
            onClick={() => document.getElementById('acn-file-input').click()}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>
          <input id="acn-file-input" type="file" style={{ display: 'none' }} onChange={handleFileUpload} />

          <input
            ref={inputRef}
            className="acn-input"
            type="text"
            placeholder="Type a message or select an option..."
            autoComplete="off"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            disabled={isResponding}
          />

          <button
            className={`acn-input-icon-btn${voiceActive ? ' active' : ''}`}
            title="Voice input"
            onClick={toggleVoice}
            disabled={isResponding}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>

          <button
            className={`acn-send-btn${isResponding ? ' disabled' : ''}`}
            onClick={sendMessage}
            disabled={isResponding}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Carousel overlay */}
      {carousel && (
        <Carousel
          data={carousel}
          onCta={handleCarouselCta}
          onClose={() => setCarousel(null)}
        />
      )}
    </>
  );
}

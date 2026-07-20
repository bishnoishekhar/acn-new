import { useState, useEffect, useRef, useCallback } from 'react';
import { initGecx, resetGecx, gecxSend, setResponseHandler } from './gecx';
import ComboCard from './ComboCard';
import AcnFormWidget from './AcnFormWidget';
import Carousel from './Carousel';
import AccountCarousel from './AccountCarousel';
import InsightCard from './InsightCard';
import AmountInput from './AmountInput';

function stripMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/```[a-z]*\n[\s\S]*?\n```/g, '')
    .replace(/\\\*\\\*(\[^\*\]+)\\\*\\\*/g, '$1')
    .replace(/\\\*(\[^\*\]+)\\\*/g, '$1')
    .replace(/^#{1,3}\\s+/gm, '')
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

const stripEmoji = (h) => h ? h.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{27FF}\u{FE00}-\u{FE0F}\s]+/gu, '') : '';

const isFH = (h) => {
  if (!h) return false;
  const l = stripEmoji(h).toLowerCase();
  return l.startsWith('please type')     || l.startsWith('please enter') ||
         l.startsWith('type your')       || l.startsWith('enter your')   ||
         l.startsWith('or identify')     || l.startsWith('or choose')    ||
         l.startsWith('or use a')        || l.startsWith('choose a different');
};

export default function ChatWindow({ isOpen, onClose, onReset, intent }) {
  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [activeForm, setActiveForm] = useState(null);
  const [voiceActive, setVoiceActive] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const msgsRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const respondingTimerRef = useRef(null);
  const finalTimerRef = useRef(null);

  const pendingHeadingRef = useRef(null);
  const pendingSubtitleRef = useRef(null);
  const comboCreatedRef = useRef(false);
  const lastProcessedRef = useRef({ time: 0, sig: '' });

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

  const addBot = useCallback((text) => {
    const clean = stripMarkdown(text);
    if (!clean) return;
    const lines = clean.split('\n').filter(Boolean);
    const firstLine = lines[0];
    const restLines = lines.slice(1).join(' ');
    if (!pendingHeadingRef.current) {
      pendingHeadingRef.current = firstLine;
      if (restLines) pendingSubtitleRef.current = restLines;
    }
    setMessages((prev) => [...prev, { type: 'bot', text: clean, id: uid() }]);
  }, []);

  const addUser = useCallback((text) => {
    setMessages((prev) => [...prev, { type: 'user', text, id: uid() }]);
  }, []);

  const showTyping = useCallback(() => {
    pendingHeadingRef.current = null;
    pendingSubtitleRef.current = null;
    comboCreatedRef.current = false;
    setIsResponding(true);
    setMessages((prev) => {
      const f = prev.filter((m) => m.type !== 'typing');
      return [...f, { type: 'typing', id: uid() }];
    });
    if (respondingTimerRef.current) clearTimeout(respondingTimerRef.current);
    respondingTimerRef.current = setTimeout(() => {
      setIsResponding(false);
      setMessages((prev) => prev.filter((m) => m.type !== 'typing'));
    }, 12000);
  }, []);

  const removeTyping = useCallback(() => {
    if (respondingTimerRef.current) clearTimeout(respondingTimerRef.current);
    if (finalTimerRef.current) clearTimeout(finalTimerRef.current);
    setIsResponding(false);
    setMessages((prev) => prev.filter((m) => m.type !== 'typing'));
  }, []);

  const clearTypingBubble = useCallback(() => {
    setMessages((prev) => prev.filter((m) => m.type !== 'typing'));
    setTimeout(() => {
      setMessages((prev) => {
        if (!prev.some((m) => m.type === 'typing')) {
          return [...prev, { type: 'typing', id: uid() }];
        }
        return prev;
      });
    }, 300);
    if (finalTimerRef.current) clearTimeout(finalTimerRef.current);
    finalTimerRef.current = setTimeout(() => {
      setIsResponding(false);
      setMessages((prev) => prev.filter((m) => m.type !== 'typing'));
    }, 10000);
  }, []);

  const parseToolCode = useCallback((text) => {
    if (!text.includes('tool_code') && !text.includes('default_api.quick_actions')) return null;
    try {
      const actions = [];
      const fv = (str, key) => {
        const QK = "['\"]" + key + "['\"]";
        let m;
        m = str.match(new RegExp(QK + '\\s*[:=]\\s*"([^"]*)"'));  if (m) return m[1];
        m = str.match(new RegExp(QK + "\\s*[:=]\\s*'([^']*)'"));  if (m) return m[1];
        m = str.match(new RegExp('\\b' + key + "\\s*=\\s*'([^']*)'"));  if (m) return m[1];
        m = str.match(new RegExp('\\b' + key + '\\s*=\\s*"([^"]*)"')); if (m) return m[1];
        return null;
      };
      const marked = text.replace(/\{(\s*['"]?content['"]?\s*[:=])/g, '\x00{$1');
      const parts = marked.split(/QuickActionsPayloadActions\s*\(|\x00/);
      parts.forEach((part) => {
        const c = fv(part, 'content'), u = fv(part, 'utterance'), d = fv(part, 'description');
        if (c && u) actions.push({ content: c.trim(), description: d ? d.trim() : '', utterance: u.trim() });
      });
      const sum = fv(text, 'summary');
      return actions.length > 0 ? { actions, summary: sum ? sum.trim() : 'What can I help you with?' } : null;
    } catch (e) { return null; }
  }, []);

  const extractSayLines = useCallback((text) => {
    const lines = [];
    const re = /Say:\s*["`'](.*?)["`'](?=\s*(?:Say:|tool_code:|$))/gs;
    let m;
    while ((m = re.exec(text)) !== null) lines.push(m[1].trim());
    return lines;
  }, []);

  const showCombo = useCallback((actions, summary, forcedHeading, forcedSubtitle) => {
    const pending = pendingHeadingRef.current;
    const pendingSub = pendingSubtitleRef.current;
    pendingHeadingRef.current = null;
    pendingSubtitleRef.current = null;
    comboCreatedRef.current = true;

    const mergeActions = (existing, incoming) => {
      const key = (a) => `${a.content || ''}|${a.utterance || ''}`;
      const seen = new Set(existing.map(key));
      return [...existing, ...incoming.filter((a) => !seen.has(key(a)))];
    };

    setMessages((prev) => {
      if (forcedHeading) {
        return [...prev, { type: 'combo', heading: forcedHeading, subtitle: forcedSubtitle, actions, id: uid(), compact: isFH(forcedHeading) }];
      }
      if (!pending) {
        const last = prev[prev.length - 1];
        if (last && last.type === 'combo') {
          const merged = { ...last, actions: mergeActions(last.actions, actions) };
          if (!merged.heading && summary) merged.heading = summary;
          return [...prev.slice(0, -1), merged];
        }
      }
      if (pending) {
        const li = [...prev].reverse().findIndex((m) => m.type === 'bot' && m.text.startsWith(pending));
        if (li !== -1) {
          const ri = prev.length - 1 - li;
          const without = prev.filter((_, i) => i !== ri);
          return [...without, { type: 'combo', heading: pending, subtitle: pendingSub, actions, id: uid(), compact: isFH(pending) }];
        }
        return [...prev, { type: 'combo', heading: pending, subtitle: pendingSub, actions, id: uid(), compact: isFH(pending) }];
      }
      const li = [...prev].reverse().findIndex((m) => m.type === 'bot');
      if (li !== -1) {
        const ri = prev.length - 1 - li;
        const h = prev[ri].text;
        const hLines = h.split('\n').filter(Boolean);
        const heading = hLines[0];
        const subtitle = hLines.slice(1).join(' ') || undefined;
        const without = prev.filter((_, i) => i !== ri);
        return [...without, { type: 'combo', heading, subtitle, actions, id: uid(), compact: isFH(heading) }];
      }
      return [...prev, { type: 'combo', heading: summary || undefined, actions, id: uid(), compact: false }];
    });
  }, []);

  const processOutputs = useCallback((outputs) => {
    const now = Date.now();
    const sig = JSON.stringify(outputs);
    if (now - lastProcessedRef.current.time < 800 && sig === lastProcessedRef.current.sig) return;
    lastProcessedRef.current = { time: now, sig };

    // Resolve widget type by name first, then by structure.
    // GECX never adds name to payloads — we must detect by field shape.
    const resolvePayloadName = (p) => {
      if (!p || typeof p !== 'object') return null;
      if (p.name) return p.name;
      if (p.type === 'quick_actions') return 'quick_actions';
      if (Array.isArray(p.actions) && p.actions.length > 0 && p.actions[0]?.utterance !== undefined) return 'quick_actions';
      if (p.insight_type != null || p.headline != null) return 'acn-insight-card';
      if (Array.isArray(p.payments) || Array.isArray(p.payees)) return 'acn-payment-carousel';
      if (Array.isArray(p.fields) && p.fields.length > 0) return 'acn-form-input';
      if (p.receipt_id != null || p.reference_number != null) return 'acn-payment-receipt';
      if (p.min_amount != null || p.max_amount != null) return 'acn-amount-input';
      return null;
    };

    const isKnownPayload = (p) => {
      const n = resolvePayloadName(p);
      return n === 'quick_actions' || n === 'acn-form-input' || n === 'acn-payment-carousel' ||
        n === 'acn-payee-selector' || n === 'acn-payment-receipt' || n === 'acn-insight-card' || n === 'acn-amount-input';
    };

    const hasVisible = outputs.some((o) => {
      if (o.payload) return isKnownPayload(o.payload);
      if (!o.text) return false;
      const t = o.text;
      if (t.includes('narration_checkpoint')) return false;
      if (t.includes('tool_code:')) return t.includes('default_api.quick_actions') || t.includes('quick_actions(');
      return stripMarkdown(t).length > 0;
    });

    if (!hasVisible) return;

    const hasFinalWidget = outputs.some(o => o.payload && isKnownPayload(o.payload));
    const hasOnlyText = outputs.every(o => o.text && !o.payload);

    if (hasFinalWidget || hasOnlyText) {
      removeTyping();
    } else if (outputs.length > 0) {
      clearTypingBubble();
    }

    // Pass 1: text
    outputs.forEach((output) => {
      if (!output.text) return;
      const text = output.text;
      const tc = parseToolCode(text);
      if (tc) {
        const sl = extractSayLines(text);
        if (sl.length >= 2) {
          comboCreatedRef.current = true;
          setMessages((prev) => [...prev, {
            type: 'combo', heading: sl[0], subtitle: sl[1],
            actions: tc.actions, id: uid(), compact: isFH(sl[0])
          }]);
        } else if (sl.length === 1) {
          comboCreatedRef.current = true;
          setMessages((prev) => [...prev, {
            type: 'combo', heading: sl[0],
            actions: tc.actions, id: uid(), compact: isFH(sl[0])
          }]);
        } else {
          showCombo(tc.actions, tc.summary);
        }
        return;
      }
      if (text.includes('quick_actions') && text.includes('content:') && text.includes('utterance:')) {
        const acts = [];
        const re = /content:\s*["']?([^,}"'\n]+?)["']?,\s*description:\s*["']?([^,}"'\n]+?)["']?,\s*utterance:\s*["']?([^}"'\n\]]+?)["']?\s*\}/g;
        let m;
        while ((m = re.exec(text)) !== null) acts.push({ content: m[1].trim(), description: m[2].trim(), utterance: m[3].trim() });
        const sm = text.match(/summary:\s*["']?([^,}"'\]\n]+?)["']?\s*[,}]/);
        if (acts.length > 0) { showCombo(acts, sm ? sm[1].trim() : 'What can I help you with?'); return; }
      }
      if (text.includes('narration_checkpoint') || text.includes('tool_code:')) return;
      addBot(text);
    });

    // Pass 2: payload — route by resolved name (works with or without name field)
    outputs.forEach((output) => {
      if (!output.payload) return;
      const p = output.payload;
      const pname = resolvePayloadName(p);
      if (pname === 'quick_actions' && p.actions) showCombo(p.actions, p.summary);
      if (pname === 'acn-form-input' && p.fields) {
        setActiveForm({ payload: p, id: uid() });
        setMessages((prev) => prev.map((m) => m.type === 'combo' ? { ...m, compact: true } : m));
      }
      if (pname === 'acn-payment-carousel' || pname === 'acn-payee-selector') {
        setMessages((prev) => {
          const lastC = [...prev].reverse().find((m) => m.type === 'carousel');
          if (lastC && p.title && lastC.payload?.title === p.title) return prev;
          return [...prev, { type: 'carousel', payload: p, id: uid() }];
        });
      }
      if (pname === 'acn-insight-card') {
        setMessages((prev) => {
          const lastI = [...prev].reverse().find((m) => m.type === 'insight');
          if (lastI && p.headline && lastI.payload?.headline === p.headline) return prev;
          return [...prev, { type: 'insight', payload: p, id: uid() }];
        });
      }
      if (pname === 'acn-amount-input') {
        setMessages((prev) => [...prev, { type: 'amount', payload: p, id: uid() }]);
      }
      if (pname === 'acn-payment-receipt') {
        setMessages((prev) => [...prev, { type: 'receipt', payload: p, id: uid() }]);
      }
    });
  }, [removeTyping, clearTypingBubble, addBot, showCombo, parseToolCode, extractSayLines]);

  const processOutputsRef = useRef(processOutputs);
  useEffect(() => { processOutputsRef.current = processOutputs; }, [processOutputs]);

  // Wire gecx.js native events (chat-response-received) to processOutputs via a
  // stable ref. This handles the initial welcome menu and simple single-widget turns.
  // Multi-widget turns (carousel + insight + quick_actions) are handled by the
  // acn-session-data listener below, which resets the dedup so it always supersedes.
  useEffect(() => { setResponseHandler((outs) => processOutputsRef.current(outs)); }, []);

  // Listen for runSession data dispatched by the pre-GECX fetch interceptor in index.html.
  // GECX captures window.fetch at SDK bundle load time (before React mounts), so patching
  // window.fetch inside React effects never intercepts GECX's own API calls. The inline
  // script in index.html runs before chat-messenger.js loads, putting it in GECX's call
  // chain and dispatching 'acn-session-data' events that we receive here.
  useEffect(() => {
    const handler = (e) => {
      const data = e.detail;
      if (!data?.messages) return;
      const outputs = [];

      // Pass 1: session-scoped tool registry — toolCalls and chunk.payloads land
      // in different messages, so per-message scoping loses the widget name.
      const toolMeta = {};
      const widgetOrder = [];
      for (const msg of data.messages) {
        if (msg.role === 'user') continue;
        for (const chunk of msg.chunks || []) {
          const tc = chunk.toolCall;
          const tr = chunk.toolResponse;
          if (tc?.id) {
            if (!toolMeta[tc.id]) toolMeta[tc.id] = {};
            if (tc.displayName) toolMeta[tc.id].name = tc.displayName;
            if (tc.args?.summary) toolMeta[tc.id].summary = tc.args.summary;
            if (tc.args?.payload) toolMeta[tc.id].argsPayload = tc.args.payload;
            if (tc.args?.payload) widgetOrder.push(tc.id);
          }
          if (tr?.id) {
            if (!toolMeta[tr.id]) toolMeta[tr.id] = {};
            if (tr.displayName) toolMeta[tr.id].name = tr.displayName;
            if (tr.response?.summary) toolMeta[tr.id].summary = tr.response.summary;
          }
        }
      }

      // Pass 2: text and chunk.payloads in document order, annotated with widget name.
      let payloadIdx = 0;
      for (const msg of data.messages) {
        if (msg.role === 'user') continue;
        for (const chunk of msg.chunks || []) {
          if (chunk.text) outputs.push({ text: chunk.text });
          if (chunk.payload) {
            const meta = toolMeta[widgetOrder[payloadIdx]];
            const withName = meta?.name ? { ...chunk.payload, name: meta.name } : chunk.payload;
            const annotated = (meta?.summary && !withName.summary) ? { ...withName, summary: meta.summary } : withName;
            outputs.push({ payload: annotated });
            payloadIdx++;
          }
        }
      }

      // Pass 3: widgets that never produce chunk.payload (e.g. quick_actions).
      for (let i = payloadIdx; i < widgetOrder.length; i++) {
        const meta = toolMeta[widgetOrder[i]];
        if (meta?.argsPayload && meta?.name) {
          const withName = { ...meta.argsPayload, name: meta.name };
          const annotated = meta.summary && !withName.summary ? { ...withName, summary: meta.summary } : withName;
          outputs.push({ payload: annotated });
        }
      }

      if (outputs.length) {
        // Always let acn-session-data override an earlier GECX native event.
        // GECX fires chat-response-received synchronously before our JSON parse
        // completes, potentially setting the dedup sig with a partial output list.
        // Resetting here ensures the full output set (carousel+insight+qa) goes through.
        lastProcessedRef.current = { time: 0, sig: '' };
        processOutputsRef.current(outputs);
      }
    };

    window.addEventListener('acn-session-data', handler);
    return () => window.removeEventListener('acn-session-data', handler);
  }, []);

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

  const handleTileSelect = useCallback((action, comboId) => {
    setMessages((prev) => prev.filter((m) => m.id !== comboId));
    addUser(action.content || action.utterance);
    showTyping();
    gecxSend(action.utterance || action.content);
    setTimeout(() => { if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight; }, 50);
  }, [addUser, showTyping]);

  const handleFormSubmit = useCallback((value, displayText) => {
    setActiveForm(null);
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
    setActiveForm(null);
    setSessionStarted(false);
    setInputVal('');
    setIsResponding(false);
    pendingHeadingRef.current = null;
    pendingSubtitleRef.current = null;
    comboCreatedRef.current = false;
    if (respondingTimerRef.current) clearTimeout(respondingTimerRef.current);
    if (finalTimerRef.current) clearTimeout(finalTimerRef.current);
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

  return (
    <>
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

      <div className={`acn-chat-window${isOpen ? '' : ' closed'}`}>
        <div className="acn-chat-header">
          <div className="acn-chat-avatar">AB</div>
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

        <div className="acn-messages" ref={msgsRef}>
          {messages.map((msg, idx) => {
            const isConsBot = msg.type === 'bot' && messages[idx - 1]?.type === 'bot';

            if (msg.type === 'bot') return (
              <div key={msg.id} className={`acn-bot-bubble acn-msg-enter${isConsBot ? ' acn-bot-consecutive' : ''}`}>
                <BotText text={msg.text} />
              </div>
            );

            if (msg.type === 'user') return (
              <div key={msg.id} className="acn-user-bubble acn-msg-enter">{msg.text}</div>
            );

            if (msg.type === 'typing') return (
              <div key={msg.id} className="acn-typing"><span /><span /><span /></div>
            );

            if (msg.type === 'carousel') return (
              <div key={msg.id} className="acn-msg-enter" data-combo="true">
                <AccountCarousel
                  payload={msg.payload}
                  onCta={(v) => { showTyping(); gecxSend(v); }}
                />
              </div>
            );

            if (msg.type === 'insight') return (
              <div key={msg.id} className="acn-msg-enter" data-combo="true">
                <InsightCard
                  payload={msg.payload}
                  onCta={(v) => { addUser(v); showTyping(); gecxSend(v); }}
                />
              </div>
            );

            if (msg.type === 'amount') return (
              <div key={msg.id} className="acn-msg-enter" data-combo="true">
                <AmountInput
                  payload={msg.payload}
                  onSubmit={(v) => { addUser(v); showTyping(); gecxSend(v); }}
                />
              </div>
            );

            if (msg.type === 'receipt') {
              const r = msg.payload || {};
              const amt = Number(r.amount);
              return (
                <div key={msg.id} className="acn-msg-enter acn-receipt" data-combo="true">
                  <div className="acn-receipt-check">✓</div>
                  <div className="acn-receipt-title">{r.title || 'Done'}</div>
                  {r.payee_name && <div className="acn-receipt-row"><span>To</span><span>{r.payee_name}</span></div>}
                  {!Number.isNaN(amt) && amt > 0 && <div className="acn-receipt-row"><span>Amount</span><span>{(r.currency || 'CAD')} {amt.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>}
                  {r.date_or_frequency && <div className="acn-receipt-row"><span>Date</span><span>{r.date_or_frequency}</span></div>}
                  {r.receipt_id && <div className="acn-receipt-ref">Ref: {r.receipt_id}</div>}
                </div>
              );
            }

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

        {activeForm && (
          <div style={{ padding: '0 12px 8px', borderTop: '1px solid #EBEBEB', background: '#fff' }}>
            <AcnFormWidget key={activeForm.id} payload={activeForm.payload} onSubmit={handleFormSubmit} />
          </div>
        )}

        <div className="acn-input-bar">
          <button className="acn-input-icon-btn" title="Attach file" onClick={() => document.getElementById('acn-file-input').click()}>
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
          <button className={`acn-input-icon-btn${voiceActive ? ' active' : ''}`} title="Voice input" onClick={toggleVoice} disabled={isResponding}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>
          <button className={`acn-send-btn${isResponding ? ' disabled' : ''}`} onClick={sendMessage} disabled={isResponding}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}

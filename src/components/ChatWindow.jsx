import { useState, useEffect, useRef, useCallback } from 'react';
import { initGecx, resetGecx, gecxSend, setResponseHandler } from './gecx';
import ComboCard from './ComboCard';
import Carousel from './Carousel';

function stripMarkdown(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,3}\s+/gm, '')
    .trim();
}

/* ── Render text with line breaks ── */
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

export default function ChatWindow({ isOpen, onClose, onReset, intent }) {
  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [carousel, setCarousel] = useState(null);
  const [voiceActive, setVoiceActive] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const msgsRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  /* ── Scroll to bottom ── */
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    requestAnimationFrame(() => {
      if (msgsRef.current) {
        msgsRef.current.scrollTo({ top: msgsRef.current.scrollHeight, behavior });
      }
    });
    setTimeout(() => {
      if (msgsRef.current) {
        msgsRef.current.scrollTo({ top: msgsRef.current.scrollHeight, behavior: 'smooth' });
      }
    }, 150);
  }, []);

  /* ── Add messages ── */
  const addBot = useCallback((text) => {
    const clean = stripMarkdown(text);
    if (!clean) return;
    setMessages((prev) => [...prev, { type: 'bot', text: clean, id: uid() }]);
  }, []);

  const addUser = useCallback((text) => {
    setMessages((prev) => [...prev, { type: 'user', text, id: uid() }]);
  }, []);

  const showTyping = useCallback(() => {
    setIsResponding(true);
    setMessages((prev) => {
      const filtered = prev.filter((m) => m.type !== 'typing');
      return [...filtered, { type: 'typing', id: uid() }];
    });
  }, []);

  const removeTyping = useCallback(() => {
    setIsResponding(false);
    setMessages((prev) => prev.filter((m) => m.type !== 'typing'));
  }, []);

  /* ── Parse Gemini 2.5 tool_code format ── */
  const parseToolCode = useCallback((text) => {
    if (!text.includes('tool_code') && !text.includes('default_api.quick_actions')) return null;
    try {
      const actions = [];
      const contentRe = /['"]content['"]\s*:\s*(['"])((?:(?!\1).)*)\1/g;
      let m;
      while ((m = contentRe.exec(text)) !== null) {
        const content = m[2].trim();
        const snippet = text.slice(m.index, m.index + 600);
        const uttRe = /['"]utterance['"]\s*:\s*(['"])((?:(?!\1).)*)\1/;
        const descRe = /['"]description['"]\s*:\s*(['"])((?:(?!\1).)*)\1/;
        const uttM = snippet.match(uttRe);
        const descM = snippet.match(descRe);
        if (content && uttM) {
          actions.push({ content, description: descM ? descM[2].trim() : '', utterance: uttM[2].trim() });
        }
      }
      const sumM = text.match(/['"]summary['"]\s*:\s*(['"])((?:(?!\1).)*)\1/);
      const summary = sumM ? sumM[2].trim() : 'What can I help you with?';
      return actions.length > 0 ? { actions, summary } : null;
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

  const showCombo = useCallback((actions, summary, heading) => {
    setMessages((prev) => {
      // If there's a recent bot bubble, absorb it as the heading
      const lastBotIdx = [...prev].reverse().findIndex((m) => m.type === 'bot');
      if (!heading && lastBotIdx !== -1) {
        const realIdx = prev.length - 1 - lastBotIdx;
        const h = prev[realIdx].text;
        const without = prev.filter((_, i) => i !== realIdx);
        return [...without, { type: 'combo', heading: h, actions, id: uid() }];
      }
      return [...prev, { type: 'combo', heading: heading || summary || 'How can I help?', actions, id: uid() }];
    });
  }, []);

  /* ── Process GECX outputs ── */
  const processOutputs = useCallback((outputs) => {
    removeTyping();
    outputs.forEach((output) => {
      if (output.text) {
        const text = output.text;

        /* Gemini tool_code + quick_actions */
        const toolCode = parseToolCode(text);
        if (toolCode) {
          const sayLines = extractSayLines(text);
          if (sayLines.length > 0) {
            // Additional Say: lines (index 1+) become bot bubbles above
            sayLines.slice(1).forEach((line) => addBot(line));
            // First Say: line becomes the combo heading
            setMessages((prev) => [
              ...prev,
              { type: 'combo', heading: sayLines[0], actions: toolCode.actions, id: uid() }
            ]);
          } else {
            showCombo(toolCode.actions, toolCode.summary);
          }
          return;
        }

        /* Narrated quick_actions fallback */
        if (text.includes('quick_actions') && text.includes('content:') && text.includes('utterance:')) {
          const actions = [];
          const re = /content:\s*["']?([^,}"'\n]+?)["']?\s*,\s*description:\s*["']?([^,}"'\n]+?)["']?\s*,\s*utterance:\s*["']?([^}"'\n\]]+?)["']?\s*\}/g;
          let m;
          while ((m = re.exec(text)) !== null) {
            actions.push({ content: m[1].trim(), description: m[2].trim(), utterance: m[3].trim() });
          }
          const summaryM = text.match(/summary:\s*["']?([^,}"'\]\n]+?)["']?\s*[,}]/);
          const summary = summaryM ? summaryM[1].trim() : 'What can I help you with?';
          if (actions.length > 0) { showCombo(actions, summary); return; }
        }

        /* Suppress internal signals */
        if (text.includes('narration_checkpoint')) return;
        if (text.includes('tool_code:')) return;

        addBot(text);
      }

      if (output.payload) {
        const p = output.payload;
        if (p.type === 'quick_actions' && p.actions) {
          showCombo(p.actions, p.summary);
        }
        if (p.name === 'acn-payment-carousel') {
          setCarousel(p);
        }
      }
    });
  }, [removeTyping, addBot, showCombo, parseToolCode, extractSayLines]);

  /* ── Register response handler ── */
  useEffect(() => {
    setResponseHandler(processOutputs);
  }, [processOutputs]);

  /* ── Scroll on new messages ── */
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  /* ── Start session ── */
  useEffect(() => {
    if (!isOpen) return;
    if (intent) {
      setTimeout(() => {
        addUser(intent);
        showTyping();
        gecxSend(intent);
      }, 600);
    } else if (!sessionStarted) {
      setSessionStarted(true);
      showTyping();
      initGecx();
    }
    setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]); // eslint-disable-line

  /* ── Tile selected ── */
  const handleTileSelect = useCallback((action, comboId) => {
    setMessages((prev) => prev.filter((m) => m.id !== comboId));
    addUser(action.content || action.utterance);
    showTyping();
    gecxSend(action.utterance || action.content);
  }, [addUser, showTyping]);

  /* ── Send message ── */
  const sendMessage = useCallback(() => {
    const text = inputVal.trim();
    if (!text || isResponding) return;
    setInputVal('');
    addUser(text);
    showTyping();
    gecxSend(text);
  }, [inputVal, addUser, showTyping, isResponding]);

  /* ── Reset ── */
  const handleReset = useCallback(() => {
    setMessages([]);
    setCarousel(null);
    setSessionStarted(false);
    setInputVal('');
    setIsResponding(false);
    resetGecx();
    setTimeout(() => showTyping(), 600);
    onReset?.();
  }, [showTyping, onReset]);

  /* ── Voice ── */
  const toggleVoice = useCallback(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Voice input not supported in this browser.');
      return;
    }
    if (voiceActive) {
      recognitionRef.current?.stop();
      setVoiceActive(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = 'en-CA';
    rec.interimResults = false;
    rec.onresult = (e) => {
      setInputVal(e.results[0][0].transcript);
      setTimeout(sendMessage, 100);
    };
    rec.onend = () => setVoiceActive(false);
    rec.start();
    recognitionRef.current = rec;
    setVoiceActive(true);
  }, [voiceActive, sendMessage]);

  /* ── File upload ── */
  const handleFileUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    addUser(`📎 ${file.name}`);
    showTyping();
    gecxSend(`I am uploading a file: ${file.name}`);
    e.target.value = '';
  }, [addUser, showTyping]);

  /* ── Carousel CTA ── */
  const handleCarouselCta = useCallback((ctaValue) => {
    setCarousel(null);
    showTyping();
    gecxSend(ctaValue);
  }, [showTyping]);

  return (
    <>
      {/* Hidden GECX widget */}
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
            const prevMsg = messages[idx - 1];
            const isConsecutiveBot = msg.type === 'bot' && prevMsg?.type === 'bot';

            if (msg.type === 'bot') {
              return (
                <div
                  key={msg.id}
                  className={`acn-bot-bubble acn-msg-enter${isConsecutiveBot ? ' acn-bot-consecutive' : ''}`}
                >
                  <BotText text={msg.text} />
                </div>
              );
            }
            if (msg.type === 'user') {
              return (
                <div key={msg.id} className="acn-user-bubble acn-msg-enter">
                  {msg.text}
                </div>
              );
            }
            if (msg.type === 'typing') {
              return (
                <div key={msg.id} className="acn-typing">
                  <span /><span /><span />
                </div>
              );
            }
            if (msg.type === 'combo') {
              return (
                <ComboCard
                  key={msg.id}
                  heading={msg.heading}
                  actions={msg.actions}
                  onSelect={(action) => handleTileSelect(action, msg.id)}
                />
              );
            }
            return null;
          })}
        </div>

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

      {/* Carousel */}
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

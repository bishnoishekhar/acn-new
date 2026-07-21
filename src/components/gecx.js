const DEPLOYMENT = 'projects/483471568825/locations/us/apps/27be6c70-74dc-4e50-a3e8-25b032e7c965/deployments/7cbb68f9-147f-4698-be02-e7ea5fa5d1a3';

let _initDone = false;
let _onResponse = null;

export function setResponseHandler(fn) {
  _onResponse = fn;
}

export function initGecx() {
  if (_initDone) return;
  _initDone = true;
  const doRegister = () => {
    try {
      window.chatSdk.registerContext(
        window.chatSdk.prebuilts.ces.createContext({
          deploymentName: DEPLOYMENT,
          tokenBroker: { enableTokenBroker: true, enableRecaptcha: false },
          enableWelcomeEvent: true,
        })
      );
      console.log('[ACN] GECX registered');
    } catch (e) {
      console.error('[ACN] GECX init error:', e);
    }
  };
  if (window.chatSdk) {
    doRegister();
  } else {
    window.addEventListener('chat-messenger-loaded', doRegister);
  }
}

export function resetGecx() {
  // Click the hidden GECX reset button to clear session token
  const resetBtn = document.querySelector('chat-reset-session-button');
  if (resetBtn) resetBtn.click();
  // Try messenger built-in reset
  const messenger = document.querySelector('chat-messenger');
  if (messenger && typeof messenger.resetSession === 'function') messenger.resetSession();
  // Re-register with fresh session
  _initDone = false;
  setTimeout(() => initGecx(), 500);
}

/* ── Send message to GECX ── */
export function gecxSend(text) {
  const m = document.querySelector('chat-messenger');
  if (m && typeof m.sendRequest === 'function') {
    m.sendRequest('query', text);
  }
}

let _interceptorInstalled = false;

/* ── Fetch interceptor — catches runSession responses ── */
export function installFetchInterceptor() {
  if (_interceptorInstalled) return;
  _interceptorInstalled = true;
  const _orig = window.fetch;
  window.fetch = function (url, opts) {
    const p = _orig.apply(this, arguments);
    if (url && url.toString().includes('runSession')) {
      p.then((r) => {
        r.clone().json().then((data) => {
          if (!_onResponse) return;

          // Primary path: data.outputs
          if (data?.outputs?.length) {
            _onResponse(data.outputs);
          }

          // Secondary path: Dialogflow CX queryResult.responseMessages
          // GECX may put widget payloads here when they're not in data.outputs
          const msgs = data?.queryResult?.responseMessages || [];
          const widgetOutputs = [];
          for (const msg of msgs) {
            if (msg.payload) widgetOutputs.push({ payload: msg.payload });
          }
          if (widgetOutputs.length) {
            _onResponse(widgetOutputs);
          }
        }).catch(() => {});
      }).catch(() => {});
    }
    return p;
  };
}

/* ── Fallback event listeners ── */
export function installEventListeners() {
  ['df-response-received', 'ces-response-received', 'chat-response-received'].forEach((n) => {
    window.addEventListener(n, (e) => {
      if (_onResponse && e.detail?.outputs) {
        _onResponse(e.detail.outputs);
      }
    });
  });
}

/* ── Bootstrap — install interceptors on page load only, NOT initGecx ── */
export function bootstrapGecx() {
  installFetchInterceptor();
  installEventListeners();
  /* Do NOT call initGecx here — enableWelcomeEvent must fire AFTER chat opens */
}

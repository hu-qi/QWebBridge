const DEV_CLICK_THRESHOLD = 5;
const DEV_CLICK_RESET_MS = 2000;
const POLL_INTERVAL_MS = 3000;

let devClickCount = 0;
let devClickTimer = null;

const $ = (id) => document.getElementById(id);

const el = {
  statusIcon: $("status-icon"),
  iconConnected: $("icon-connected"),
  iconDisconnected: $("icon-disconnected"),
  statusText: $("status-text"),
  guideLink: $("guide-link"),
  mainContent: $("main-content"),
  trustScreen: $("trust-screen"),
  devSettings: $("dev-settings"),
  insecureWarning: $("insecure-warning"),
  wsUrl: $("ws-url"),
  devTestBtn: $("dev-test-btn"),
  devTestResult: $("dev-test-result"),
  devReset: $("dev-reset"),
  devSave: $("dev-save"),
  devExit: $("dev-exit"),
  logoArea: $("logo-area"),
};

function setStatus(connected) {
  if (!el.statusIcon || !el.statusText || !el.guideLink) return;
  el.statusIcon.className = `status-circle ${connected ? "connected" : "disconnected"}`;
  if (el.iconConnected) el.iconConnected.classList.toggle("hidden", !connected);
  if (el.iconDisconnected) el.iconDisconnected.classList.toggle("hidden", connected);
  el.statusText.textContent = connected ? "浏览器助手已就绪" : "浏览器助手未就绪";
  el.guideLink.textContent = connected ? "使用指南" : "查看安装指引";
  el.guideLink.href = connected
    ? "https://github.com/hu-qi/QWebBridge"
    : "https://github.com/hu-qi/QWebBridge#readme";
}

function showTrustScreen(url) {
  if (!el.mainContent || !el.trustScreen || !el.devSettings) return;
  el.mainContent.classList.add("hidden");
  el.trustScreen.classList.remove("hidden");
  el.devSettings.classList.add("hidden");
  if (el.insecureWarning) {
    if (url && url.startsWith("ws://")) {
      el.insecureWarning.classList.remove("hidden");
    } else {
      el.insecureWarning.classList.add("hidden");
    }
  }
}

function showMain() {
  if (!el.mainContent || !el.trustScreen || !el.devSettings) return;
  el.mainContent.classList.remove("hidden");
  el.trustScreen.classList.add("hidden");
  el.devSettings.classList.add("hidden");
}

function showDevSettings() {
  if (!el.mainContent || !el.trustScreen || !el.devSettings) return;
  el.mainContent.classList.add("hidden");
  el.trustScreen.classList.add("hidden");
  el.devSettings.classList.remove("hidden");
}

const STORAGE = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local
  ? chrome.storage.local
  : { get: function(keys, cb) { cb({}); }, set: function() {} };

let cachedUrl = "ws://127.0.0.1:10086/selector/command";
let cachedTrusted = [];

function loadStorage(cb) {
  STORAGE.get(["daemonUrl", "trustedOrigins"], function(result) {
    cachedUrl = result.daemonUrl || "ws://127.0.0.1:10086/selector/command";
    try { cachedTrusted = JSON.parse(result.trustedOrigins || "[]"); } catch { cachedTrusted = []; }
    if (typeof cb === "function") cb();
  });
}

function getStoredUrl() {
  return cachedUrl;
}

function setStoredUrl(url) {
  cachedUrl = url;
  STORAGE.set({ daemonUrl: url });
}

function getTrustedOrigins() {
  return cachedTrusted;
}

function addTrustedOrigin(url) {
  if (!cachedTrusted.includes(url)) {
    cachedTrusted.push(url);
    STORAGE.set({ trustedOrigins: JSON.stringify(cachedTrusted) });
  }
}

function isUrlTrusted(url) {
  return getTrustedOrigins().includes(url);
}

function testConnection(url) {
  if (!el.devTestResult || !el.devTestBtn) return Promise.resolve(false);
  el.devTestResult.className = "test-result";
  el.devTestResult.textContent = "测试中…";
  el.devTestResult.classList.remove("hidden");
  el.devTestBtn.disabled = true;

  return new Promise(function(resolve) {
    var ws;
    try { ws = new WebSocket(url); } catch (e) {
      el.devTestResult.className = "test-result test-fail";
      el.devTestResult.textContent = "地址格式不正确";
      el.devTestBtn.disabled = false;
      resolve(false);
      return;
    }
    var timer = setTimeout(function() {
      try { ws.close(); } catch {}
      el.devTestResult.className = "test-result test-fail";
      el.devTestResult.textContent = "连接失败 — 请检查地址、网络、目标服务是否运行";
      el.devTestBtn.disabled = false;
      resolve(false);
    }, 5000);

    ws.onopen = function() {
      clearTimeout(timer);
      try { ws.close(); } catch {}
      el.devTestResult.className = "test-result test-ok";
      el.devTestResult.textContent = "连接成功";
      el.devTestBtn.disabled = false;
      resolve(true);
    };
    ws.onerror = function() {
      clearTimeout(timer);
      el.devTestResult.className = "test-result test-fail";
      el.devTestResult.textContent = "连接失败 — 请检查地址、网络、目标服务是否运行";
      el.devTestBtn.disabled = false;
      resolve(false);
    };
  });
}

function checkStatus() {
  if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
    setStatus(false);
    return;
  }
  try {
    chrome.runtime.sendMessage({ type: "status" }).then(function(response) {
      setStatus(response && response.connected ? true : false);
    }).catch(function() {
      setStatus(false);
    });
  } catch (e) {
    setStatus(false);
  }
}

// Init
loadStorage(function() {
  checkStatus();
});
setInterval(checkStatus, POLL_INTERVAL_MS);

// Event listeners with defense
function on(id, event, fn) {
  var el_ = document.getElementById(id);
  if (el_) el_.addEventListener(event, fn);
}

on("guide-link", "click", function(e) {
  e.preventDefault();
  try {
    if (chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: el.guideLink ? el.guideLink.href : "https://github.com/hu-qi/QWebBridge", active: true });
    }
  } catch {}
});

on("logo-area", "click", function() {
  devClickCount++;
  if (devClickTimer) clearTimeout(devClickTimer);
  if (devClickCount >= DEV_CLICK_THRESHOLD) {
    devClickCount = 0;
    var url = getStoredUrl();
    if (el.wsUrl) el.wsUrl.value = url;
    if (!isUrlTrusted(url)) {
      showTrustScreen(url);
    } else {
      showDevSettings();
    }
    return;
  }
  devClickTimer = setTimeout(function() {
    devClickCount = 0;
  }, DEV_CLICK_RESET_MS);
});

on("trust-cancel", "click", function() { showMain(); });

on("trust-confirm", "click", function() {
  var url = getStoredUrl();
  addTrustedOrigin(url);
  showDevSettings();
});

on("dev-test-btn", "click", function() {
  if (!el.wsUrl || !el.devTestResult) return;
  var url = el.wsUrl.value.trim();
  if (!url) {
    el.devTestResult.className = "test-result test-fail";
    el.devTestResult.textContent = "地址不能为空";
    el.devTestResult.classList.remove("hidden");
    return;
  }
  if (url.indexOf("ws://") !== 0 && url.indexOf("wss://") !== 0) {
    el.devTestResult.className = "test-result test-fail";
    el.devTestResult.textContent = "地址必须以 ws:// 或 wss:// 开头";
    el.devTestResult.classList.remove("hidden");
    return;
  }
  testConnection(url);
});

on("dev-reset", "click", function() {
  var defaultUrl = "ws://127.0.0.1:10086/selector/command";
  if (el.wsUrl) el.wsUrl.value = defaultUrl;
  setStoredUrl(defaultUrl);
  if (el.devTestResult) {
    el.devTestResult.className = "test-result test-ok";
    el.devTestResult.textContent = "已恢复默认";
    el.devTestResult.classList.remove("hidden");
  }
});

on("dev-save", "click", function() {
  if (!el.wsUrl || !el.devTestResult) return;
  var url = el.wsUrl.value.trim();
  if (!url) {
    el.devTestResult.className = "test-result test-fail";
    el.devTestResult.textContent = "地址不能为空";
    el.devTestResult.classList.remove("hidden");
    return;
  }
  setStoredUrl(url);
  el.devTestResult.className = "test-result test-ok";
  el.devTestResult.textContent = "已保存，连接中…";
  el.devTestResult.classList.remove("hidden");
  try {
    chrome.runtime.sendMessage({ type: "SET_DAEMON_URL", url: url }).catch(function() {});
  } catch {}
});

on("dev-exit", "click", function() { showMain(); });

// Listen for background status updates
try {
  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function(msg) {
      if (msg && msg.type === "CONNECTION_STATUS") {
        setStatus(msg.connected);
      }
    });
  }
} catch {}

const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const infoText = document.getElementById("info-text");

function updateStatus(connected) {
  if (connected) {
    statusDot.className = "dot connected";
    statusText.textContent = "Connected";
    infoText.textContent = "Daemon: ws://127.0.0.1:10086/selector/command";
  } else {
    statusDot.className = "dot disconnected";
    statusText.textContent = "Disconnected";
    infoText.textContent = "Start daemon: qweb-bridge run";
  }
}

try {
  chrome.runtime.sendMessage({ type: "status" }, (response) => {
    if (chrome.runtime.lastError) {
      updateStatus(false);
    } else {
      updateStatus(response?.connected ?? false);
    }
  });
} catch {
  updateStatus(false);
}

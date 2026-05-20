const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");

function updateStatus(connected) {
  if (connected) {
    statusDot.className = "dot connected";
    statusText.textContent = "Connected";
  } else {
    statusDot.className = "dot disconnected";
    statusText.textContent = "Disconnected";
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

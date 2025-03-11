// popup/services/TabService.js
export default class TabService {
  async getCurrentTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0] || null;
  }
  
  async sendMessage(tabId, message) {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ error: chrome.runtime.lastError.message });
        } else {
          resolve(response);
        }
      });
    });
  }
  
  async executeScript(tabId, script) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [script]
      });
      return true;
    } catch (error) {
      console.error('Script injection error:', error);
      return false;
    }
  }
}
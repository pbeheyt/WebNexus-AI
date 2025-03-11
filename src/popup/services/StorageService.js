// popup/services/StorageService.js
export default class StorageService {
  async get(key, area = 'sync') {
    return new Promise((resolve, reject) => {
      chrome.storage[area].get(key, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(key ? result[key] : result);
        }
      });
    });
  }
  
  async set(items, area = 'sync') {
    return new Promise((resolve, reject) => {
      chrome.storage[area].set(items, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }
  
  async remove(keys, area = 'sync') {
    return new Promise((resolve, reject) => {
      chrome.storage[area].remove(keys, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }
}
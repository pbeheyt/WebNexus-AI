// Handles all interactions with Chrome storage
export default class StorageService {
  constructor() {
    this.cache = {};
  }

  async get(key, area = 'sync') {
    return new Promise((resolve, reject) => {
      chrome.storage[area].get(key, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          // If key is string, return the value, otherwise return the whole result
          resolve(typeof key === 'string' ? result[key] : result);
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

  // Cache utility for frequently accessed data
  getCache(key) {
    return this.cache[key];
  }

  setCache(key, value) {
    this.cache[key] = value;
    return value;
  }

  clearCache(key) {
    if (key) {
      delete this.cache[key];
    } else {
      this.cache = {};
    }
  }
}
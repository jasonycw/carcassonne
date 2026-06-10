class EventEmitter {
  constructor() {
    this._callbacks = {};
  }

  on(eventName, callback) {
    if (!this._callbacks[eventName]) {
      this._callbacks[eventName] = [];
    }
    this._callbacks[eventName].push(callback);
    return this;
  }

  off(eventName, callback) {
    const cbs = this._callbacks[eventName];
    if (!cbs) return this;
    if (callback) {
      this._callbacks[eventName] = cbs.filter(cb => cb !== callback);
    } else {
      delete this._callbacks[eventName];
    }
    return this;
  }

  emit(eventName, ...args) {
    const cbs = this._callbacks[eventName];
    if (!cbs) return this;
    for (const cb of cbs) {
      try {
        cb(...args);
      } catch (err) {
        console.error(`EventEmitter error in "${eventName}" listener:`, err);
      }
    }
    return this;
  }

  once(eventName, callback) {
    const wrapper = (...args) => {
      this.off(eventName, wrapper);
      callback(...args);
    };
    this.on(eventName, wrapper);
    return this;
  }

  removeAllListeners(eventName) {
    if (eventName) {
      delete this._callbacks[eventName];
    } else {
      this._callbacks = {};
    }
    return this;
  }

  listenerCount(eventName) {
    const cbs = this._callbacks[eventName];
    return cbs ? cbs.length : 0;
  }
}

export { EventEmitter };
export default EventEmitter;

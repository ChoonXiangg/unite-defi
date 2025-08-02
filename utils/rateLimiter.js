class RateLimiter {
  constructor(maxCalls = 30, windowMs = 60000) { // 30 calls per minute by default
    this.maxCalls = maxCalls;
    this.windowMs = windowMs;
    this.calls = [];
  }

  canMakeCall() {
    const now = Date.now();
    
    // Remove calls outside the current window
    this.calls = this.calls.filter(callTime => now - callTime < this.windowMs);
    
    // Check if we can make another call
    return this.calls.length < this.maxCalls;
  }

  recordCall() {
    this.calls.push(Date.now());
  }

  async waitForSlot() {
    if (this.canMakeCall()) {
      this.recordCall();
      return;
    }

    // Calculate how long to wait for the oldest call to expire
    const oldestCall = Math.min(...this.calls);
    const waitTime = this.windowMs - (Date.now() - oldestCall) + 100; // Add 100ms buffer
    
    console.log(`Rate limit reached. Waiting ${waitTime}ms before next call...`);
    
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    // Recursive call to ensure we get a slot
    return this.waitForSlot();
  }

  getStatus() {
    const now = Date.now();
    this.calls = this.calls.filter(callTime => now - callTime < this.windowMs);
    
    return {
      callsInWindow: this.calls.length,
      maxCalls: this.maxCalls,
      remainingCalls: this.maxCalls - this.calls.length,
      windowMs: this.windowMs,
      nextResetTime: this.calls.length > 0 ? Math.min(...this.calls) + this.windowMs : now
    };
  }
}

// Create a singleton instance for CoinGecko API
const coinGeckoRateLimiter = new RateLimiter(30, 60000); // 30 calls per minute

module.exports = {
  RateLimiter,
  coinGeckoRateLimiter
};
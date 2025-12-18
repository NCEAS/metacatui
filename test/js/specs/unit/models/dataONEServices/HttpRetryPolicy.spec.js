define([
  "/test/js/specs/shared/clean-state.js",
  "models/dataONEServices/HttpRetryPolicy",
], (cleanState, RetryPolicy) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("HttpRetryPolicy", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      return { sandbox };
    }, beforeEach);

    afterEach(() => {
      state.sandbox.restore();
    });

    it("fallsback to defaults when constructed with no options", () => {
      const policy = new RetryPolicy();
      expect(policy.maxRetries).to.equal(RetryPolicy.DEFAULT_RETRY.maxRetries);
      expect(policy.baseDelayMs).to.equal(
        RetryPolicy.DEFAULT_RETRY.baseDelayMs,
      );
      expect(policy.maxDelayMs).to.equal(RetryPolicy.DEFAULT_RETRY.maxDelayMs);
      expect(policy.retryOn).to.deep.equal(RetryPolicy.DEFAULT_RETRY_ON);
      expect(policy.retryNetworkErrors).to.equal(
        RetryPolicy.DEFAULT_RETRY.retryNetworkErrors,
      );
    });

    it("converts negative maxDelayMs to zero", () => {
      const policy = new RetryPolicy({ maxDelayMs: -500 });
      expect(policy.maxDelayMs).to.equal(0);
    });

    it("converts negative maxRetries to zero", () => {
      const policy = new RetryPolicy({ maxRetries: -3 });
      expect(policy.maxRetries).to.equal(0);
    });

    it("converts negative baseDelayMs to zero", () => {
      const policy = new RetryPolicy({ baseDelayMs: -200 });
      expect(policy.baseDelayMs).to.equal(0);
    });

    it("calculates max attempts from maxRetries", () => {
      const policy = new RetryPolicy({ maxRetries: 4 });
      expect(policy.maxAttempts).to.equal(5);
    });

    it("converts string status codes to numbers in retryOn", () => {
      const policy = new RetryPolicy({ retryOn: [500, "502", "504"] });
      expect(policy.retryOn).to.deep.equal([500, 502, 504]);
    });

    it("normalizes status codes correctly", () => {
      expect(RetryPolicy.normalizeStatus("404")).to.equal(404);
      expect(RetryPolicy.normalizeStatus(500)).to.equal(500);
      expect(RetryPolicy.normalizeStatus(null)).to.equal(null);
      expect(RetryPolicy.normalizeStatus(undefined)).to.equal(null);
      expect(RetryPolicy.normalizeStatus("abc")).to.equal(null);
      expect(RetryPolicy.normalizeStatus(50)).to.equal(null);
    });

    it("parses Retry-After seconds and dates", () => {
      const seconds = new Headers({ "Retry-After": "5" });
      const policy = new RetryPolicy({ maxDelayMs: 10000 });
      policy.parseRetryAfter(seconds).should.equal(5000);

      const clock = state.sandbox.useFakeTimers({ now: 0 });
      const future = new Date(Date.now() + 4000).toUTCString();
      const dateHeaders = new Headers({ "Retry-After": future });
      policy.parseRetryAfter(dateHeaders).should.equal(4000);
      clock.restore();
    });

    it("returns retryAfterMs directly when provided", () => {
      const policy = new RetryPolicy();
      const delay = policy.computeDelay({
        attempt: 2,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        retryAfterMs: 1500,
      });
      delay.should.equal(1500);
    });

    it("applies exponential backoff with jitter", () => {
      const policy = new RetryPolicy({
        baseDelayMs: 100,
        maxDelayMs: 1000,
        randomFn: () => 1,
      });
      const delay = policy.computeDelay({
        attempt: 2,
        retryAfterMs: null,
      });
      const expectedBase = 100 * 2 ** 1; // 200
      delay.should.equal(expectedBase * 1.2); // +20% jitter
    });

    it("treats attempt 0 as the first retry for backoff calculations", () => {
      const policy = new RetryPolicy({
        baseDelayMs: 200,
        maxDelayMs: 1000,
        randomFn: () => 0.5,
      });
      const delay = policy.computeDelay({
        attempt: 0,
        retryAfterMs: null,
      });
      delay.should.equal(200); // centered jitter => 0
    });

    it("decides to retry for network and status codes within limits", () => {
      const policy = new RetryPolicy({
        maxRetries: 1,
        retryOn: RetryPolicy.DEFAULT_RETRY_ON,
        retryNetworkErrors: true,
      });

      policy.shouldRetry({
        attempt: 1,
        status: 500,
        isNetworkError: false,
      }).should.be.true;

      policy.shouldRetry({
        attempt: 1,
        status: null,
        isNetworkError: true,
      }).should.be.true;

      policy.shouldRetry({
        attempt: 2,
        status: 500,
        isNetworkError: false,
      }).should.be.false;
    });

    it("creates an overridden policy with merged values", () => {
      const base = new RetryPolicy({
        maxRetries: 2,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        retryOn: [500],
        retryNetworkErrors: false,
      });

      const overridden = base.withOverrides({
        maxRetries: 5,
        retryOn: [429, 503],
        randomFn: () => 0.5,
      });

      overridden.maxRetries.should.equal(5);
      overridden.baseDelayMs.should.equal(100);
      overridden.maxDelayMs.should.equal(1000);
      overridden.retryOn.should.deep.equal([429, 503]);
      overridden.retryNetworkErrors.should.equal(false);
      // Original remains unchanged
      base.maxRetries.should.equal(2);
      base.retryOn.should.deep.equal([500]);
    });
  });
});

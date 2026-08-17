define([], () => {
  /**
   * Tracks the peak number of concurrent in-flight async operations so a test
   * can assert that a worker honours its concurrency limit, without each spec
   * re-implementing the same in-flight bookkeeping.
   *
   * Wrap the body of a stub or fake with `track(body)`. Every call to the
   * returned function increments an in-flight counter, records the running peak
   * in `max`, defers to a later tick, then decrements and resolves with the
   * body's return value. If `body` throws (or returns a rejected promise) the
   * returned promise rejects, which is handy for simulating per-item failures.
   *
   * Example usage:
   *
   * const concurrency = trackConcurrency();
   * stub.callsFake(concurrency.track((pid) => ({ identifier: pid })));
   * await doWork({ maxConcurrent: 2 });
   * concurrency.max.should.equal(2);
   *
   * @returns {{ max: number, track: (body?: Function) => Function }} A tracker
   *   whose `max` holds the observed peak concurrency and whose `track` wraps a
   *   body in the in-flight bookkeeping.
   */
  return () => {
    const tracker = { max: 0 };
    let inFlight = 0;

    tracker.track =
      (body) =>
      (...args) =>
        new Promise((resolve, reject) => {
          inFlight += 1;
          tracker.max = Math.max(tracker.max, inFlight);
          setTimeout(() => {
            inFlight -= 1;
            Promise.resolve()
              .then(() => (body ? body(...args) : undefined))
              .then(resolve, reject);
          }, 0);
        });

    return tracker;
  };
});

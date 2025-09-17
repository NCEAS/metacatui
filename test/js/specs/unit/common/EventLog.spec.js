define([
  "/test/js/specs/shared/clean-state.js",
  "common/EventLog",
  "models/analytics/Analytics",
], (cleanState, EventLog, Analytics) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("EventLog Test Suite", () => {
    // Establish a clean state before each test and restore afterwards
    const state = cleanState(
      () => {
        const sandbox = sinon.createSandbox();

        // Stub console so tests stay quiet
        sandbox.stub(console, "info");
        sandbox.stub(console, "warn");
        sandbox.stub(console, "error");

        const eventLog = new EventLog({ maxEvents: 3 }); // 3 makes trimming easy

        return { sandbox, eventLog };
      },
      beforeEach,
      afterEach,
    );

    afterEach(() => {
      // Blow away any logs created during the test
      state.eventLog.logs.clear();
      state.sandbox.restore();
    });

    describe("Instantiation & option validation", () => {
      it("creates an instance with defaults", () => {
        state.eventLog.should.be.instanceof(EventLog);
        state.eventLog.consoleLevel.should.equal("info");
      });

      it("accepts consoleLevel = false to silence console output", () => {
        const silent = new EventLog({ consoleLevel: false });
        silent.consoleLevel.should.be.false;
      });
    });

    describe("getOrCreateLog()", () => {
      it("returns the same instance for the same name", () => {
        const a = state.eventLog.getOrCreateLog("my‑log");
        const b = state.eventLog.getOrCreateLog("my‑log");
        a.should.equal(b);
      });

      it("creates distinct logs for different names", () => {
        const a = state.eventLog.getOrCreateLog("a");
        const b = state.eventLog.getOrCreateLog("b");
        a.should.not.equal(b);
      });
    });

    describe("Recording events", () => {
      it("records info / warning / error events", () => {
        const log = state.eventLog.getOrCreateLog("demo");
        state.eventLog.log(log, "info", "hello");
        state.eventLog.log(log, "warning", "careful");
        state.eventLog.log(log, "error", "boom");

        log.events.length.should.equal(3);
        log.events
          .map((e) => e.level)
          .should.deep.equal(["info", "warning", "error"]);
      });

      it("trims events when maxEvents is exceeded", () => {
        const log = state.eventLog.getOrCreateLog("trim");
        // maxEvents = 3 set in cleanState
        ["one", "two", "three", "four"].forEach((msg) =>
          state.eventLog.log(log, "info", msg),
        );
        log.events.length.should.equal(3);
        log.events[0].message.should.equal("two"); // first one was trimmed
      });

      it("throws on an invalid level", () => {
        const log = state.eventLog.getOrCreateLog("bad‑level");
        expect(() => state.eventLog.log(log, "fatal", "nope")).to.throw(
          "Invalid level",
        );
      });
    });

    describe("Console logging behaviour", () => {
      it("honours consoleLevel threshold", () => {
        const log = state.eventLog.getOrCreateLog("console");
        state.eventLog.setConsoleLogLevel("warning");

        state.eventLog.log(log, "info", "ignore me");
        state.eventLog.log(log, "warning", "show me");

        console.info.called.should.be.false;
        console.warn.calledOnce.should.be.true;
      });

      it("supports disabling console logging", () => {
        const log = state.eventLog.getOrCreateLog("silent");
        state.eventLog.setConsoleLogLevel(false);

        state.eventLog.log(log, "error", "nothing to see");

        console.error.called.should.be.false;
      });
    });

    describe("clearLog()", () => {
      it("empties events and resets startTime", async () => {
        const log = state.eventLog.getOrCreateLog("clear");
        state.eventLog.log(log, "info", "before clear");
        const oldStart = log.startTime;

        // wait a beat so we can see the startTime change
        await new Promise((r) => setTimeout(r, 5));
        state.eventLog.clearLog(log);

        log.events.should.be.empty;
        log.startTime.should.be.greaterThan(oldStart);
      });
    });

    describe("sendToAnalytics()", () => {
      it("sends each event via Analytics.trackCustomEvent", () => {
        const log = state.eventLog.getOrCreateLog("analytics");
        state.eventLog.log(log, "info", "a‑1", { x: 1 });
        state.eventLog.log(log, "warning", "a‑2", { x: 2 });

        // stub event log because it can be blocked by extensions
        state.eventLog.analytics = new Backbone.Model();
        state.eventLog.analytics.trackCustomEvent = function () {};

        // stub the underlying Analytics method
        const trackStub = state.sandbox.stub(
          state.eventLog.analytics,
          "trackCustomEvent",
        );

        state.eventLog.sendToAnalytics(log, "eventName");

        trackStub.calledTwice.should.be.true;
        const [name, pararms] = trackStub.firstCall.args;
        name.should.equal("eventName");
        pararms.should.deep.equal({
          timestamp: log.events[0].timestamp,
          level: "info",
          message: "a‑1",
          x: 1,
        });
      });
    });

    describe("static getLogs()", () => {
      it("returns the events array for inspection", () => {
        const log = state.eventLog.getOrCreateLog("static");
        state.eventLog.log(log, "info", "peek");
        const arr = EventLog.getLogs(log);
        arr.should.equal(log.events);
        arr.length.should.equal(1);
      });
    });
  });
});

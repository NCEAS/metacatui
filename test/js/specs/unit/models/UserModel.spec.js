define(
  ["/test/js/specs/shared/clean-state.js", "models/UserModel"],
  (cleanState, UserModel) => {
    const should = chai.should();
    const expect = chai.expect;

    describe("UserModel Test Suite", () => {
      const state = cleanState(() => {
        const sandbox = sinon.createSandbox();
        const user = new UserModel();
        return { sandbox, user };
      }, beforeEach);

      afterEach(() => {
        state.sandbox.restore();
      });

      describe("getTokenPromise()", () => {
        it("applies exponential timeout backoff and increments the timeout counter", async () => {
          const { sandbox, user } = state;
          const getTokenStub = sandbox.stub(user, "getToken");
          let timeoutCallback;
          let timeoutMs;

          sandbox.stub(globalThis, "setTimeout").callsFake((callback, ms) => {
            timeoutCallback = callback;
            timeoutMs = ms;
            return 1;
          });

          user.set("tokenTimeoutCounter", 2);

          const errorPromise = user.getTokenPromise(25).catch((e) => e);

          getTokenStub.calledOnce.should.be.true;
          timeoutMs.should.equal(100);

          timeoutCallback();

          const error = await errorPromise;
          error.message.should.equal("token check timed out");
          user.get("tokenTimeoutCounter").should.equal(3);
        });

        it("stops retrying after repeated timeouts and resets state after five minutes", async () => {
          const { sandbox, user } = state;
          const getTokenStub = sandbox.stub(user, "getToken");
          let resetCallback;
          let resetDelay;

          sandbox.stub(globalThis, "setTimeout").callsFake((callback, ms) => {
            resetCallback = callback;
            resetDelay = ms;
            return 1;
          });

          user.set({
            tokenChecked: false,
            tokenTimeoutCounter: 4,
          });

          const error = await user.getTokenPromise().catch((e) => e);

          error.message.should.equal("token check failed too many times");
          user.get("tokenChecked").should.be.true;
          getTokenStub.called.should.be.false;
          resetDelay.should.equal(5 * 60 * 1000);

          resetCallback();

          user.get("tokenChecked").should.be.false;
          user.get("tokenTimeoutCounter").should.equal(0);
        });
      });
    });
  },
);

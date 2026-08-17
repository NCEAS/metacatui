define(["common/ErrorUtilities"], (ErrorUtilities) => {
  const { expect } = chai;

  describe("ErrorUtilities", () => {
    describe("createNamedError", () => {
      it("creates an error with a stable name and extra fields", () => {
        const error = ErrorUtilities.createNamedError("CustomError", "Nope", {
          code: "custom",
          status: 400,
        });

        expect(error).to.be.instanceOf(Error);
        expect(error.name).to.equal("CustomError");
        expect(error.message).to.equal("Nope");
        expect(error.code).to.equal("custom");
        expect(error.status).to.equal(400);
      });
    });

    describe("abort helpers", () => {
      it("creates and identifies AbortError instances", () => {
        const error = ErrorUtilities.createAbortError("Stopped");

        expect(error).to.be.instanceOf(Error);
        expect(error.name).to.equal("AbortError");
        expect(error.message).to.equal("Stopped");
        expect(ErrorUtilities.isAbortError(error)).to.equal(true);
        expect(ErrorUtilities.isAbortError(new Error("Other"))).to.equal(false);
      });

      it("throws when a signal has already aborted", () => {
        const controller = new AbortController();
        controller.abort();

        expect(() => {
          ErrorUtilities.throwIfAborted(controller.signal, "Cancelled");
        }).to.throw("Cancelled");
      });
    });

    describe("timeout helpers", () => {
      it("creates and identifies TimeoutError instances", () => {
        const error = ErrorUtilities.createTimeoutError("Too slow");

        expect(error).to.be.instanceOf(Error);
        expect(error.name).to.equal("TimeoutError");
        expect(error.code).to.equal("ETIMEDOUT");
        expect(error.isTimeout).to.equal(true);
        expect(error.message).to.equal("Too slow");
        expect(ErrorUtilities.isTimeoutError(error)).to.equal(true);
        expect(ErrorUtilities.isTimeoutError(new Error("Other"))).to.equal(
          false,
        );
      });
    });

    describe("quota helpers", () => {
      it("identifies quota errors by name, code, or message", () => {
        const named = ErrorUtilities.createNamedError(
          "QuotaExceededError",
          "Storage failed",
        );
        const coded = new Error("Storage failed");
        coded.code = "QUOTA_BYTES_EXCEEDED";

        expect(ErrorUtilities.isQuotaError(named)).to.equal(true);
        expect(ErrorUtilities.isQuotaError(coded)).to.equal(true);
        expect(ErrorUtilities.isQuotaError("quota exceeded")).to.equal(true);
        expect(ErrorUtilities.isQuotaError(new Error("other"))).to.equal(false);
      });
    });
  });
});

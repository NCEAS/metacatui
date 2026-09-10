define(["models/dataPackage/UploadResult"], (UploadResult) => {
  const should = chai.should();
  const { Statuses, Outcomes } = UploadResult;

  function actionsFor(targets) {
    return targets.map((targetPid) => ({
      id: `create:${targetPid}`,
      phase: "data",
      operation: "create",
      targetPid,
    }));
  }

  describe("UploadResult", () => {
    it("keeps actions and initializes their statuses", () => {
      const actions = actionsFor(["a", "b"]);
      const result = new UploadResult(actions, { draftRevision: 3 });
      result.actions.should.equal(actions);
      result.draftRevision.should.equal(3);
      result.getStatus("create:a").should.equal(Statuses.PENDING);
      result.getStatus("create:b").should.equal(Statuses.PENDING);
    });

    it("transitions statuses and records errors", () => {
      const result = new UploadResult(actionsFor(["a"]));
      const error = new Error("boom");
      result.markRunning("create:a");
      result.getStatus("create:a").should.equal(Statuses.RUNNING);
      result.markFailed("create:a", error);
      result.getError("create:a").should.equal(error);
      result.markSucceeded("create:a");
      should.equal(result.getError("create:a"), null);
    });

    it("collects unique error messages from actions and members", () => {
      const dataPackage = {
        members: {
          toArray: () => [
            { lastUploadError: { message: "member level failure" } },
            { lastUploadError: { message: "shared failure" } },
            { lastUploadError: null },
          ],
        },
      };
      const result = new UploadResult(actionsFor(["a", "b"]), { dataPackage });
      result.markFailed("create:a", new Error("action failure"));
      result.markAmbiguous("create:b", new Error("shared failure"));

      result
        .getErrorMessages()
        .should.deep.equal([
          "action failure",
          "shared failure",
          "member level failure",
        ]);
    });

    it("returns no error messages on a clean result", () => {
      const result = new UploadResult(actionsFor(["a"]));
      result.markSucceeded("create:a");
      result.getErrorMessages().should.deep.equal([]);
    });

    it("classifies success and partial failure", () => {
      const success = new UploadResult(actionsFor(["a", "b"]));
      success.markSucceeded("create:a").markSucceeded("create:b").finalize();
      success.outcome.should.equal(Outcomes.SUCCESS);
      success.retryable.should.equal(false);

      const failed = new UploadResult(actionsFor(["a", "b"]));
      failed.markSucceeded("create:a").markFailed("create:b").finalize();
      failed.outcome.should.equal(Outcomes.PARTIAL_FAILURE);
      failed.retryable.should.equal(true);
    });

    it("classifies skipped work as a retryable partial failure", () => {
      const result = new UploadResult(actionsFor(["a", "b"]));
      result.markSucceeded("create:a").markSkipped("create:b").finalize();
      result.outcome.should.equal(Outcomes.PARTIAL_FAILURE);
      result.retryable.should.equal(true);
    });

    it("classifies ambiguous actions as retryable failures", () => {
      const result = new UploadResult(actionsFor(["a"]));
      result.markAmbiguous("create:a").finalize();
      result.outcome.should.equal(Outcomes.PARTIAL_FAILURE);
      result.retryable.should.equal(true);
    });

    it("allows retry when cancellation leaves only unstarted work", () => {
      const cancelled = new UploadResult(actionsFor(["a"]));
      cancelled.markCancelled("create:a").finalize();
      cancelled.outcome.should.equal(Outcomes.CANCELLED);
      cancelled.wasCancelled.should.equal(true);
      cancelled.reloadRequired.should.equal(false);
      cancelled.retryable.should.equal(true);
    });

    it("keeps confirmed work successful when later work is cancelled", () => {
      const result = new UploadResult(actionsFor(["a", "b"]));
      result.markSucceeded("create:a").markCancelled("create:b").finalize();
      result.getStatus("create:a").should.equal(Statuses.SUCCEEDED);
      result.outcome.should.equal(Outcomes.CANCELLED);
      result.reloadRequired.should.equal(false);
      result.retryable.should.equal(true);
    });

    it("allows retry of a definitively rejected write after cancellation", () => {
      const result = new UploadResult(actionsFor(["a"]));
      result.markFailed("create:a", new Error("rejected"));
      result.wasCancelled = true;
      result.finalize();
      result.outcome.should.equal(Outcomes.CANCELLED);
      result.reloadRequired.should.equal(false);
      result.retryable.should.equal(true);
    });

    it("requires reload when cancellation leaves an ambiguous write", () => {
      const result = new UploadResult(actionsFor(["a"]));
      result.markAmbiguous("create:a", new Error("unknown"));
      result.wasCancelled = true;
      result.finalize();
      result.outcome.should.equal(Outcomes.CANCELLED);
      result.reloadRequired.should.equal(true);
      result.retryable.should.equal(false);
    });

    it("succeeds when all writes committed before cancellation settled", () => {
      const result = new UploadResult(actionsFor(["a", "b"]));
      result.markSucceeded("create:a").markSucceeded("create:b");
      result.wasCancelled = true;
      result.finalize();
      result.outcome.should.equal(Outcomes.SUCCESS);
      result.reloadRequired.should.equal(false);
      result.retryable.should.equal(false);
    });

    it("keeps skipped work cancelled when cancellation settles", () => {
      const result = new UploadResult(actionsFor(["a", "b"]));
      result.markSucceeded("create:a").markSkipped("create:b");
      result.wasCancelled = true;
      result.finalize();
      result.outcome.should.equal(Outcomes.CANCELLED);
      result.reloadRequired.should.equal(false);
      result.retryable.should.equal(true);
    });

    it("preserves stale-state precedence over cancellation", () => {
      const stale = new UploadResult(actionsFor(["a"]));
      stale.wasCancelled = true;
      stale.markStaleRemote("create:a", new Error("stale")).finalize();
      stale.outcome.should.equal(Outcomes.STALE_REMOTE);
      stale.reloadRequired.should.equal(true);
      stale.retryable.should.equal(false);
    });
  });
});

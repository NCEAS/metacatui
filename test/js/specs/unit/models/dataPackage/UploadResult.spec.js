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
      success.markSucceeded("create:a").markSkipped("create:b").finalize();
      success.outcome.should.equal(Outcomes.SUCCESS);
      success.retryable.should.equal(false);

      const failed = new UploadResult(actionsFor(["a", "b"]));
      failed.markSucceeded("create:a").markFailed("create:b").finalize();
      failed.outcome.should.equal(Outcomes.PARTIAL_FAILURE);
      failed.retryable.should.equal(true);
    });

    it("classifies ambiguous actions as retryable failures", () => {
      const result = new UploadResult(actionsFor(["a"]));
      result.markAmbiguous("create:a").finalize();
      result.outcome.should.equal(Outcomes.PARTIAL_FAILURE);
      result.retryable.should.equal(true);
    });

    it("classifies cancellation and stale state as reload-required", () => {
      const cancelled = new UploadResult(actionsFor(["a"]));
      cancelled.markCancelled("create:a").finalize();
      cancelled.outcome.should.equal(Outcomes.CANCELLED);
      cancelled.reloadRequired.should.equal(true);
      cancelled.retryable.should.equal(false);

      const stale = new UploadResult(actionsFor(["a"]));
      stale.markStaleRemote("create:a", new Error("stale")).finalize();
      stale.outcome.should.equal(Outcomes.STALE_REMOTE);
      stale.reloadRequired.should.equal(true);
      stale.retryable.should.equal(false);
    });
  });
});

"use strict";

define([], () => {
  const STATUSES = Object.freeze({
    PENDING: "pending",
    RUNNING: "running",
    SUCCEEDED: "succeeded",
    FAILED: "failed",
    AMBIGUOUS: "ambiguous",
    CANCELLED: "cancelled",
    SKIPPED: "skipped",
  });

  const OUTCOMES = Object.freeze({
    SUCCESS: "success",
    PARTIAL_FAILURE: "partial_failure",
    CANCELLED: "cancelled",
    STALE_REMOTE: "stale_remote",
  });

  /**
   * Mutable per action state for one in memory upload attempt.
   * @class UploadResult
   * @classcategory Models/DataPackage
   * @since 0.0.0
   */
  class UploadResult {
    /**
     * Create state for one upload attempt.
     * @param {object[]} actions Actions prepared for the upload
     * @param {object} [options] Result context
     * @param {number} [options.draftRevision] Prepared package revision
     * @param {object} [options.dataPackage] Owning package instance
     */
    constructor(actions = [], { draftRevision = 0, dataPackage = null } = {}) {
      this.actions = actions;
      this.draftRevision = draftRevision;
      this.dataPackage = dataPackage;
      this.actionStatus = new Map();
      this.actionErrors = new Map();
      actions.forEach((action) => {
        this.actionStatus.set(action.id, STATUSES.PENDING);
      });
      this.outcome = null;
      this.retryable = false;
      this.reloadRequired = false;
      this.staleRemote = false;
    }

    /**
     * Set an action's status and optional error.
     * @param {string} actionId Upload action identifier
     * @param {string} status Action status
     * @param {Error|null} [error] Action error
     * @returns {UploadResult} This result
     */
    setStatus(actionId, status, error = null) {
      this.actionStatus.set(actionId, status);
      if (error) {
        this.actionErrors.set(actionId, error);
      } else {
        this.actionErrors.delete(actionId);
      }
      return this;
    }

    /**
     * Mark an action as running.
     * @param {string} actionId Upload action identifier
     * @returns {UploadResult} This result
     */
    markRunning(actionId) {
      return this.setStatus(actionId, STATUSES.RUNNING);
    }

    /**
     * Mark an action as succeeded.
     * @param {string} actionId Upload action identifier
     * @returns {UploadResult} This result
     */
    markSucceeded(actionId) {
      return this.setStatus(actionId, STATUSES.SUCCEEDED);
    }

    /**
     * Mark an action as failed.
     * @param {string} actionId Upload action identifier
     * @param {Error} error Action error
     * @returns {UploadResult} This result
     */
    markFailed(actionId, error) {
      return this.setStatus(actionId, STATUSES.FAILED, error);
    }

    /**
     * Mark an action as an ambiguous write.
     * @param {string} actionId Upload action identifier
     * @param {Error} error Action error
     * @returns {UploadResult} This result
     */
    markAmbiguous(actionId, error) {
      return this.setStatus(actionId, STATUSES.AMBIGUOUS, error);
    }

    /**
     * Mark an action as cancelled.
     * @param {string} actionId Upload action identifier
     * @returns {UploadResult} This result
     */
    markCancelled(actionId) {
      return this.setStatus(actionId, STATUSES.CANCELLED);
    }

    /**
     * Mark an action as skipped.
     * @param {string} actionId Upload action identifier
     * @returns {UploadResult} This result
     */
    markSkipped(actionId) {
      return this.setStatus(actionId, STATUSES.SKIPPED);
    }

    /**
     * Return an action's status.
     * @param {string} actionId Upload action identifier
     * @returns {string|null} Action status, or null
     */
    getStatus(actionId) {
      return this.actionStatus.get(actionId) ?? null;
    }

    /**
     * Return an action's error.
     * @param {string} actionId Upload action identifier
     * @returns {Error|null} Action error, or null
     */
    getError(actionId) {
      return this.actionErrors.get(actionId) ?? null;
    }

    /**
     * Collect per action and member level errors so callers can show the actual
     * failure instead of a generic "save failed" message.
     * @returns {string[]} Unique, non empty error messages
     */
    getErrorMessages() {
      const messages = new Set();
      const add = (error) => {
        let message = null;
        if (typeof error === "string") message = error;
        else if (error && typeof error.message === "string")
          message = error.message;
        if (message) messages.add(message);
      };
      this.actionErrors.forEach((error) => add(error));
      const members = this.dataPackage?.members?.toArray?.() || [];
      members.forEach((member) => add(member?.lastUploadError));
      return [...messages];
    }

    /**
     * Mark the package as stale against remote state.
     * @param {string|null} actionId Related upload action identifier
     * @param {Error} error Stale remote error
     * @returns {UploadResult} This result
     */
    markStaleRemote(actionId, error) {
      if (actionId) this.markFailed(actionId, error);
      this.staleRemote = true;
      return this;
    }

    /**
     * Derive the upload outcome from action statuses.
     * @returns {UploadResult} This result
     */
    finalize() {
      this.retryable = false;
      this.reloadRequired = false;
      const statuses = [...this.actionStatus.values()];
      const anyFailed = statuses.some(
        (status) => status === STATUSES.FAILED || status === STATUSES.AMBIGUOUS,
      );
      const anyCancelled = statuses.some(
        (status) => status === STATUSES.CANCELLED,
      );

      if (this.staleRemote) {
        this.outcome = OUTCOMES.STALE_REMOTE;
        this.reloadRequired = true;
      } else if (anyCancelled) {
        this.outcome = OUTCOMES.CANCELLED;
        this.reloadRequired = true;
      } else if (anyFailed) {
        this.outcome = OUTCOMES.PARTIAL_FAILURE;
        this.retryable = true;
      } else {
        this.outcome = OUTCOMES.SUCCESS;
      }
      return this;
    }
  }

  UploadResult.Statuses = STATUSES;
  UploadResult.Outcomes = OUTCOMES;

  return UploadResult;
});

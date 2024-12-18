"use strict";

// TODO:
//  - Abstract out storage into a separate model/class (e.g., FileQueueStorage).
//  - Implement IndexedDB storage or another persistent layer.
//  - Add serialization/ID assignment for files to ensure they can be matched
//    post-reload (currently reference-based equality).
//  - Improve error-handling and possibly separate out error storage logic.
//  - Batching & asynchronous storage calls to prevent UI blocking in large
//    queues.
//  - For uploads... maybe use a service worker with Background Sync API to
//    handle network interruptions and retries.

define(["backbone"], (Backbone) => {
  /**
   * @class FileQueue
   * @classdesc A first-in, first-out queue for managing processing of files.
   * This can be used to manage a queue of files to be uploaded, fetched, or
   * processed in some way. The queue can be persisted to localStorage and
   * reloaded later.
   * @classcategory Models
   * @name FileQueue
   * @augments Backbone.Model
   * @class
   * @fires FileQueue#start
   * @fires FileQueue#success
   * @fires FileQueue#error
   * @fires FileQueue#fail
   * @fires FileQueue#cancel
   * @fires FileQueue#cleared
   */

  /**
   * @event FileQueue#start
   * @description Triggered when a file starts processing.
   * @param {object} file - The file object that started processing.
   */

  /**
   * @event FileQueue#success
   * @description Triggered when a file is successfully processed.
   * @param {object} file - The file object that was successfully processed.
   */

  /**
   * @event FileQueue#error
   * @description Triggered when an error occurs during processing.
   * @param {object} file - The file object that failed to process.
   * @param {Error|string} error - The error object or message that was thrown
   * during processing.
   */

  /**
   * @event FileQueue#fail
   * @description Triggered when a file fails to process after the maximum number
   * of retries.
   * @param {object} file - The file object that failed to process.
   * @param {Error|string} error - The error object or message that was thrown
   * during processing.
   */

  /**
   * @event FileQueue#cancel
   * @description Triggered when processing is stopped for a file.
   * @param {object} file - The file object that was stopped.
   * @param {Error|string} error - The error object or message that was thrown
   * during processing.
   */

  const FileQueue = Backbone.Model.extend(
    /** @lends FileQueue.prototype */ {
      type: "FileQueue",
      /**
       * Default attributes for the model.
       * @returns {object} - Default attributes
       * @property {object} queueId - Unique ID for this queue instance. For
       * example, a PID for the data package being uploaded. One will be
       * generated if not provided.
       * @property {Array} queue - List of files in the queue to be processed.
       * These may be DataObject models, file paths, or any other type. As long
       * as the fileProcessor function can handle them.
       * @property {boolean} isProcessing - Flag indicating if the queue is
       * currently being processed. Will be updated to false when processing is
       * complete or interrupted intentionally.
       * @property {Array} inProgress - List of files currently being processed.
       * @property {Array} retries - List of files that have failed to process
       * and are being retried. Each item in the array should be an object with
       * the file, error, and retries properties.
       * @property {Array} errors - List of errors that have occurred during
       * processing. Each item in the array should be an object with the file
       * and error properties.
       * @property {Array} complete - List of files that have been successfully
       * processed.
       * @property {number} maxConcurrent - Maximum number of concurrent files
       * that can be processed at once.
       * @property {number} maxRetries - Number of retries allowed for each file.
       * @property {number} timeout - Timeout in milliseconds for processing a
       * single file. If the file processing takes longer than this, it will be
       * considered a failure and the file will be retried or marked as failed.
       * @property {Function} fileProcessor - External function that processes the
       * files in the queue. This function must return a Promise that resolves
       * when the file processing is complete or rejects if there is an error.
       * The function will be passed the file object and an AbortSignal object
       * that can be used to cancel the processing. Example:
       *
       * ```javascript
       * function fileProcessor(file, { signal }) {
       *   return fetch(file.url, { signal })
       *     .then((response) => {
       *       if (!response.ok) {
       *         throw new Error(`Failed to fetch file: ${response.statusText}`);
       *       }
       *       return response; // Resolves with the response object
       *     })
       *     .catch((error) => {
       *       if (error.name === "AbortError") {
       *         console.error("Fetch aborted for file:", file.url);
       *       }
       *       throw error; // Rethrow the error for further handling
       *     });
       * }
       * ```
       */
      defaults() {
        return {
          queueId: null,
          queue: [],
          isProcessing: false,
          inProgress: [],
          retries: [],
          errors: [],
          complete: [],
          maxConcurrent: 2,
          maxRetries: 3,
          timeout: 4 * 60 * 60 * 1000, // default to 4 hours
          fileProcessor: null,
        };
      },

      /** @inheritdoc */
      initialize(options = {}) {
        // Generate a unique ID for this queue if not provided
        this.set("queueId", options.queueId || `file-queue-${Date.now()}`);

        // Ensure an process handler is provided
        if (typeof options.fileProcessor !== "function") {
          throw new Error("An fileProcessor function must be provided");
        }
        this.set("fileProcessor", options.fileProcessor);

        // Initialize abortControllers map
        this.set("abortControllers", new Map());

        // Load queue from localStorage, if available
        // TODO: Replace this with calls to a dedicated storage class.
        this.loadQueue();
      },

      /**
       * Since backbone doesn't trigger events when the contents of an array
       * change, we need to manually trigger the change event when the array
       * is updated.
       * @param {Array} array - Array to update.
       * @param {*} item - Item to add or remove from the array.
       * @param {"add"|"remove"} action - Action to perform on the array.
       * @param {boolean} [silent] - Flag indicating if the change event
       * should be triggered.
       * @returns {Array} - Updated array.
       */
      updateArray(array, item, action, silent = false) {
        const a = this.get(array) || [];
        if (action === "add") {
          a.push(item);
        } else if (action === "remove") {
          const index = a.findIndex((f) => this.filesAreEqual(f, item));
          if (index >= 0) a.splice(index, 1);
        }
        this.set(array, a);
        if (!silent) this.trigger(`change:${array}`);
        return a;
      },

      /**
       * Compare two files to determine if they are the same. Reference
       * comparison is used by default, but this can be overridden in case
       * the file objects are mutable, serialized and deserialized, or can
       * be recreated at some point, etc. For example, we this function could
       * test whether id properties are equal, or whether objects deep equal.
       * @param {*} file1 - First file to compare.
       * @param {*} file2 - Second file to compare.
       * @returns {boolean} - True if the files are equal, false otherwise.
       */
      filesAreEqual(file1, file2) {
        // TODO: Implement a stable ID-based comparison.
        return file1 === file2;
      },

      /**
       * Add a file to the queue.
       * @param {object} file - File object to add to the queue.
       */
      enqueue(file) {
        this.updateArray("queue", file, "add");
        // Persist the queue
        this.saveQueue();
      },

      /**
       * Remove the next file from the queue.
       * @returns {object|null} - File object removed from the queue or null if
       * the queue is empty.
       */
      dequeue() {
        const queue = this.get("queue");
        if (queue.length === 0) return null;
        const file = queue[0];
        this.updateArray("queue", file, "remove");
        this.saveQueue();
        return file;
      },

      /** Start processing the queue. */
      start() {
        this.set("isProcessing", true);
        this.continue();
      },

      /** Start processing the queue. */
      continue() {
        if (!this.get("isProcessing") || this.isEmpty()) return;

        const inProgress = this.get("inProgress");
        if (inProgress.length >= this.get("maxConcurrent")) return;

        const file = this.dequeue();
        if (!file) return;

        this.processFile(file).then(() => this.continue());
      },

      /**
       * Immediately stop processing any files in progress, and do not start any new files.
       */
      stop() {
        // TODO: Consider how to handle partial progress (resume logic, stable IDs).
        this.set("isProcessing", false); // Mark processing as stopped
        const inProgress = this.get("inProgress");

        // Cancel or cleanup any in-progress files
        inProgress.forEach((file) => {
          this.trigger("cancel", file);

          // Abort processing for the file
          const controller = this.get("abortControllers").get(file);
          if (controller) {
            controller.abort(); // Signal the fileProcessor to stop
            this.get("abortControllers").delete(file);
          } else {
            this.handleProcessError(file, "Processing was stopped");
          }
        });
        // TODO: Potentially persist state after stop if needed.
      },

      /**
       * Process file (delegates to an external processor function). This will
       * trigger the start event and process the file with the fileProcessor
       * function while supporting timeout-based cancellation.
       * @param {object} file - File object to process.
       * @returns {Promise} - Promise that resolves when the file is processed.
       */
      async processFile(file) {
        //  TODO: Use indexing/IDing files for stable persistence.
        this.updateArray("inProgress", file, "add");

        const controller = new AbortController();
        const abortControllers = this.get("abortControllers");
        const { signal } = controller;
        abortControllers.set(file, controller);

        const timeout = this.get("timeout");
        const fileProcessor = this.get("fileProcessor");

        const timeoutId = setTimeout(() => {
          if (this.getFileStatus(file) === "inProgress") {
            controller.abort();
          }
        }, timeout);

        this.trigger("start", file);

        return fileProcessor(file, { signal })
          .then(() => {
            clearTimeout(timeoutId);
            this.handleProcessSuccess(file);
          })
          .catch((error) => {
            clearTimeout(timeoutId);
            this.handleProcessError(file, error);
          });
      },

      /**
       * Checks whether a file is in progress, complete, queued, or has failed.
       * @param {object} file - File object to check.
       * @returns {"inProgress"|"complete"|"queued"|"failed"|"unknown"} - Status
       */
      getFileStatus(file) {
        //  TODO: Once stable IDs are in place, use those for comparison.
        if (this.get("inProgress").includes(file)) return "inProgress";
        if (this.get("complete").includes(file)) return "complete";
        if (this.get("queue").includes(file)) return "queued";
        if (this.get("retries")?.find((r) => r.file === file)) return "failed";
        return "unknown";
      },

      /**
       * Handle a successful process for a single file. This will remove the file
       * from the inProgress list and trigger the process:success event.
       * @param {object} file - File object that was successfully processed.
       */
      handleProcessSuccess(file) {
        this.removeFromInProgressAndNext(file);
        this.updateArray("complete", file, "add");
        this.trigger("success", file);
        this.saveQueue();
      },

      /**
       * Remove a file from the inProgress list and start processing the next
       * file in the queue.
       * @param {object} file - File object to remove from inProgress.
       */
      removeFromInProgressAndNext(file) {
        this.updateArray("inProgress", file, "remove");
        this.saveQueue();
        this.get("abortControllers").delete(file);
        this.continue();
      },

      /**
       * Handle a process error for a single file. This will remove the file
       * from the inProgress list and add it to the retries list if the maximum
       * number of retries has not been reached. If the maximum number of
       * retries has been reached, the file will be removed from the queue and
       * the process will be marked as failed.
       * @param {object} file - File object that failed to process.
       * @param {Error|string} error - Error object that was thrown during
       * processing or a string message.
       */
      handleProcessError(file, error) {
        this.removeFromInProgressAndNext(file);

        let errors = this.get("errors");
        if (!errors) {
          errors = [];
          this.set("errors", errors);
        }
        errors.push({ file, error });
        this.trigger("error", file, error);

        const retries = this.get("retries");
        const numRetries = retries.find((r) => r.file === file)?.retries || 0;

        if (numRetries < this.get("maxRetries")) {
          // Check if the file is already in the retries list
          const existingRetry = retries.find((r) => r.file === file);
          if (existingRetry) {
            existingRetry.retries += 1;
          } else {
            this.updateArray(
              "retries",
              { file, error, retries: numRetries + 1 },
              "add",
            );
          }
          this.enqueue(file); // Re-enqueue file
        } else {
          this.trigger("fail", file, error);
        }

        this.saveQueue();
        this.continue(); // Continue with the next file
      },

      /**
       * Check if the queue is empty.
       * @returns {boolean} - True if the queue is empty, false otherwise.
       */
      isEmpty() {
        return this.get("queue").length === 0;
      },

      /**
       * Clear the queue, inProgress, and retries lists. This will not stop any
       * processing that is currently in progress. Use stop() to
       * immediately stop processing.
       */
      clearQueue() {
        this.set({ queue: [], inProgress: [], retries: [] });
        this.trigger("cleared");
        this.saveQueue();
      },

      /** Persist the queue to localStorage */
      saveQueue() {
        // TODO: Replace with a call to a separate storage layer (e.g., FileQueueStorage).
        const queueId = this.get("queueId");
        const data = {
          queue: this.get("queue"),
          inProgress: this.get("inProgress"),
          retries: this.get("retries"),
          complete: this.get("complete"),
        };
        localStorage.setItem(queueId, JSON.stringify(data));
      },

      /**
       * Load the queue from localStorage. This will overwrite any existing
       * queue, inProgress, or retries data.
       */
      loadQueue() {
        // TODO: Use a separate storage model/class and potentially handle IndexedDB.
        const queueId = this.get("queueId");
        const savedData = JSON.parse(localStorage.getItem(queueId) || "{}");
        this.set("queue", savedData.queue || []);
        this.set("inProgress", savedData.inProgress || []);
        this.set("retries", savedData.retries || []);
        this.set("complete", savedData.complete || []);
      },
    },
  );
  return FileQueue;
});

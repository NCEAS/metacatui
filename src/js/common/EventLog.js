/* eslint-disable no-console */

define(["models/analytics/Analytics"], (Analytics) => {
  // TODO: Implement singletons for different log contexts to avoid
  // creating multiple EventLog instances throughout the app...

  const DEFAULT_MAX_EVENTS = 500;
  const DEFAULT_CONSOLE_LEVEL = "info";
  // The entire Analytics.js file can be blocked by privacy extensions, so
  // we need to check if it exists before using it.
  const DEFAULT_ANALYTICS = Analytics ? new Analytics() : null;

  const LEVELS = {
    INFO: "info",
    WARNING: "warning",
    ERROR: "error",
  };

  const LEVEL_WEIGHTS = {
    info: 0,
    warning: 1,
    error: 2,
  };
  /**
   * @class EventLog
   * @classdesc A utility class for recording events and grouping by context.
   * Allows logging of events with a descriptive name and severity levels, and
   * provides access to the current analytics service.
   * @since 2.34.0
   */
  class EventLog {
    /**
     * Constructor for EventLog
     * @param {object} options - Options for the event log
     * @param {string} [options.consoleLevel] - The level at which to log to the
     * events to the console. Must be one of the LEVELS or false to prevent all
     * console logging.
     * @param {Backbone.Model} [options.analyticsModel] - An existing analytics
     * model to use for sending events. If not provided, the current app
     * analytics model or a no-op Analytics model will be used.
     * @param {number} [options.maxEvents] - Maximum number of events per log.
     * Defaults to 500.
     */
    constructor({
      consoleLevel = DEFAULT_CONSOLE_LEVEL,
      maxEvents = DEFAULT_MAX_EVENTS,
      analyticsModel = null,
    } = {}) {
      this.logs = new Map();
      this.analyticsModel = analyticsModel;
      this.maxEvents =
        Number.isInteger(maxEvents) && maxEvents > 0
          ? maxEvents
          : DEFAULT_MAX_EVENTS;
      try {
        this.setConsoleLogLevel(consoleLevel);
      } catch (e) {
        this.setConsoleLogLevel(DEFAULT_CONSOLE_LEVEL);
      }
    }

    /**
     * Get the analytics model currently available to the event log.
     * @returns {Backbone.Model|null} The analytics model
     */
    get analytics() {
      return (
        this.analyticsModel ||
        globalThis.MetacatUI?.analytics ||
        DEFAULT_ANALYTICS
      );
    }

    /**
     * Create a new collection to record events related by context or scope. If
     * a log with the same name already exists, it will return the existing log.
     * @param {string} name - Label and ID for the log. If not provided, the
     * default log will be used.
     * @returns {object} - The log object containing an ID, name, start time,
     * and events.
     */
    getOrCreateLog(name) {
      if (this.logs.has(name)) {
        return this.logs.get(name);
      }
      const log = {
        name: name || "Default Log",
        startTime: Date.now(),
        events: [],
      };
      this.logs.set(name, log);
      return log;
    }

    /**
     * Set the console log level for this EventLog instance.
     * @param {string|boolean} level - The log level to set. Must be one of the
     * LEVELS (info, warning, error) or false to disable console logging.
     * @throws {Error} If an invalid level is provided.
     */
    setConsoleLogLevel(level) {
      if (level === false) {
        this.consoleLevel = false;
      } else if (LEVELS[level.toUpperCase()]) {
        this.consoleLevel = LEVELS[level.toUpperCase()];
      } else {
        throw new Error("Invalid console log level");
      }
    }

    /**
     * Record an event to the specified log with a given level.
     * @param {object} log - The log object to record the event in
     * @param {"info"|"warning"|"error"} level - Log level, must be in LEVELS
     * @param {string} message - The log message
     * @param {object} [meta] - Optional metadata to include with the log
     */
    log(log, level, message, meta = {}) {
      if (!LEVELS[level.toUpperCase()]) throw new Error("Invalid level");
      const event = {
        timestamp: Date.now(),
        level,
        message,
        meta,
      };
      if (log.events.length >= this.maxEvents) {
        log.events.shift(); // Remove oldest event
      }
      log.events.push(event);

      const levelWeight = LEVEL_WEIGHTS[level];
      if (
        this.consoleLevel &&
        LEVEL_WEIGHTS[this.consoleLevel] <= levelWeight
      ) {
        this.consoleLog(message, log.name, level, meta);
      }
    }

    /**
     * Log an event to the console with a prefix indicating the log name.
     * @param {string} message - The log message
     * @param {object} [logName] - The log object containing the log name
     * @param {"info"|"warning"|"error"} [level] - The log level
     * @param {object} [meta] - Optional metadata to include with the log
     */
    consoleLog(message, logName = "Default Log", level = "info", meta = {}) {
      if (!this.consoleLevel) return; // Skip if console logging is disabled
      if (!LEVELS[level.toUpperCase()]) throw new Error("Invalid level");
      const prefix = `[Log:${logName}]`;
      if (level === LEVELS.ERROR) {
        console.error(`${prefix} ERROR: ${message}`, meta);
      } else if (level === LEVELS.WARNING) {
        console.warn(`${prefix} WARNING: ${message}`, meta);
      } else {
        console.info(`${prefix} ${message}`, meta);
      }
    }
  }

  return EventLog;
});
/* eslint-enable no-console */

"use strict";

define(["common/UriTemplateUtilities"], (UriTemplateUtilities) => {
  /**
   * A map from search parameter key to the actual keys used by the application.
   */
  const paramIdToDestinationKey = {
    lt: "latitude",
    ln: "longitude",
    ht: "height",
    hd: "heading",
    p: "pitch",
    r: "roll",
  };
  /** Search parameter IDs in the restore state contract. */
  const SCHEMA_VERSION_ID = "sv";
  const ACTIVE_ACTION_ID = "a";
  const OPEN_PANEL_ID = "op";
  const ACTIVE_FEATURES_ID = "f";

  /** The search parameter ID for enabled layers in the save to URL feature. */
  const ENABLED_LAYERS_ID = "el";

  /**
   * @param {string} actionId Stable action identifier.
   * @returns {string} Prefix for namespaced action state keys.
   * @since 0.0.0
   */
  const actionPrefix = (actionId) => `${actionId}-`;

  /**
   * @param {string} actionId Stable action identifier.
   * @param {string} key Variable name from the iframe URL template.
   * @returns {string} Namespaced URL key (e.g., `wt-lat`).
   * @since 0.0.0
   */
  const namespacedActionKey = (actionId, key) =>
    `${actionPrefix(actionId)}${key}`;

  /** Destination IDs plus all known restore-state keys. */
  const restoreStateIds = [
    ...Object.keys(paramIdToDestinationKey),
    SCHEMA_VERSION_ID,
    ACTIVE_ACTION_ID,
    OPEN_PANEL_ID,
    ACTIVE_FEATURES_ID,
    ENABLED_LAYERS_ID,
  ];

  /**
   * The normalized default state returned by parser and normalizer.
   * @returns {object} normalized state with default values.
   * @since 0.0.0
   */
  const getDefaultState = () => ({
    schemaVersion: 0,
    destination: {},
    enabledLayerIds: [],
    enabledLayerStateProvided: false,
    activeActionId: null,
    openPanel: null,
    activeFeatureIds: [],
  });

  /**
   * Return a URL instance for reading/writing current search params.
   * @returns {URL} the current URL
   * @since 0.0.0
   */
  const getCurrentUrl = () => new URL(window.location.href);

  /**
   * Replace the browser URL without navigating.
   * @param {URL} url The URL instance to write to history.
   * @since 0.0.0
   */
  const replaceUrl = (url) => {
    window.history.replaceState(null, "", url);
  };

  /**
   * Parse a comma-separated string into a clean string list.
   * @param {string|null} value A comma-separated value.
   * @returns {string[]} A cleaned list of non-empty values.
   * @since 0.0.0
   */
  const parseCommaSeparated = (value) => {
    if (typeof value !== "string" || !value.length) return [];
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  };

  /**
   * @param {unknown} value Candidate ID from the URL or model.
   * @returns {string|null} A normalized ID string, or null if invalid.
   * @since 0.0.0
   */
  const normalizeId = (value) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  };

  /**
   * Normalize action URL template variable names.
   * @param {unknown} variableNames Candidate variable names list.
   * @returns {string[]} Unique non-empty variable names.
   * @since 0.0.0
   */
  const normalizeVariableNames = (variableNames) => {
    if (!Array.isArray(variableNames)) return [];
    const seen = new Set();
    const normalized = [];

    variableNames.forEach((name) => {
      if (typeof name !== "string") return;
      const trimmed = name.trim();
      if (!trimmed.length || seen.has(trimmed)) return;
      seen.add(trimmed);
      normalized.push(trimmed);
    });

    return normalized;
  };

  /**
   * Normalize the destination object by coercing numeric values and dropping
   * non-finite values.
   * @param {object} destination Candidate destination object.
   * @returns {object} A normalized destination object.
   * @since 0.0.0
   */
  const normalizeDestination = (destination = {}) => {
    const normalized = {};
    Object.values(paramIdToDestinationKey).forEach((destinationId) => {
      if (destination[destinationId] == null) return;
      const num = Number(destination[destinationId]);
      if (!Number.isNaN(num) && Number.isFinite(num)) {
        normalized[destinationId] = num;
      }
    });
    return normalized;
  };

  /**
   * Normalize a state candidate into the full restore-state shape.
   * @param {object} [state] Candidate state.
   * @returns {object} The normalized restore state.
   * @since 0.0.0
   */
  const normalizeState = (state = {}) => {
    const defaults = getDefaultState();
    const normalized = {
      ...defaults,
      ...state,
      destination: normalizeDestination(state.destination || {}),
      enabledLayerIds: parseCommaSeparated(
        Array.isArray(state.enabledLayerIds)
          ? state.enabledLayerIds.join(",")
          : state.enabledLayerIds,
      ),
      enabledLayerStateProvided: Boolean(state.enabledLayerStateProvided),
      activeActionId: normalizeId(state.activeActionId),
      openPanel: normalizeId(state.openPanel),
      activeFeatureIds: parseCommaSeparated(
        Array.isArray(state.activeFeatureIds)
          ? state.activeFeatureIds.join(",")
          : state.activeFeatureIds,
      ),
    };

    const requestedSchema = Number(state.schemaVersion);
    normalized.schemaVersion =
      Number.isFinite(requestedSchema) && requestedSchema >= 0
        ? Math.floor(requestedSchema)
        : 0;

    // Phase 1 fields imply schema 1 writing.
    if (
      normalized.activeActionId ||
      normalized.openPanel ||
      normalized.activeFeatureIds.length
    ) {
      normalized.schemaVersion = Math.max(1, normalized.schemaVersion);
    }

    return normalized;
  };

  /**
   * Parse restore state from the current URL search params.
   * @returns {object} Normalized restore state.
   * @since 0.0.0
   */
  const parseStateFromUrl = () => {
    const url = getCurrentUrl();
    const schemaValue = Number(url.searchParams.get(SCHEMA_VERSION_ID));
    const schemaVersion =
      Number.isFinite(schemaValue) && schemaValue >= 0
        ? Math.floor(schemaValue)
        : 0;

    const destination = {};
    Object.entries(paramIdToDestinationKey).forEach(
      ([searchParamId, destinationId]) => {
        if (url.searchParams.has(searchParamId)) {
          const num = Number(url.searchParams.get(searchParamId));
          if (!Number.isNaN(num) && Number.isFinite(num)) {
            destination[destinationId] = num;
          }
        }
      },
    );

    const base = {
      schemaVersion,
      destination,
      enabledLayerIds: parseCommaSeparated(
        url.searchParams.get(ENABLED_LAYERS_ID),
      ),
      enabledLayerStateProvided: url.searchParams.has(ENABLED_LAYERS_ID),
      activeActionId: null,
      openPanel: null,
      activeFeatureIds: [],
    };

    if (schemaVersion >= 1) {
      base.activeActionId = normalizeId(url.searchParams.get(ACTIVE_ACTION_ID));
      base.openPanel = normalizeId(url.searchParams.get(OPEN_PANEL_ID));
      base.activeFeatureIds = parseCommaSeparated(
        url.searchParams.get(ACTIVE_FEATURES_ID),
      );
    }

    return normalizeState(base);
  };

  /**
   * Write a normalized restore state to the URL while preserving unrelated
   * query parameters.
   * @param {object} state Restore state candidate.
   * @returns {object} The normalized restore state that was written.
   * @since 0.0.0
   */
  const writeStateToUrl = (state) => {
    const url = getCurrentUrl();
    const normalized = normalizeState(state);

    // Always clear known restore keys first to avoid stale values.
    restoreStateIds.forEach((id) => {
      url.searchParams.delete(id);
    });

    Object.entries(paramIdToDestinationKey).forEach(
      ([searchParamId, destinationId]) => {
        if (normalized.destination[destinationId] != null) {
          url.searchParams.set(
            searchParamId,
            normalized.destination[destinationId],
          );
        }
      },
    );

    if (
      normalized.enabledLayerStateProvided ||
      normalized.enabledLayerIds.length
    ) {
      url.searchParams.set(
        ENABLED_LAYERS_ID,
        normalized.enabledLayerIds.join(","),
      );
    }

    if (normalized.schemaVersion >= 1) {
      url.searchParams.set(SCHEMA_VERSION_ID, String(normalized.schemaVersion));
      if (normalized.activeActionId) {
        url.searchParams.set(ACTIVE_ACTION_ID, normalized.activeActionId);
      }
      if (normalized.openPanel) {
        url.searchParams.set(OPEN_PANEL_ID, normalized.openPanel);
      }
      if (normalized.activeFeatureIds.length) {
        url.searchParams.set(
          ACTIVE_FEATURES_ID,
          normalized.activeFeatureIds.join(","),
        );
      }
    }

    replaceUrl(url);
    return normalized;
  };

  /**
   * Update restore state by merging a partial state into the current URL state.
   * @param {object} partialState Partial restore state.
   * @returns {object} The normalized restore state after merge.
   * @since 0.0.0
   */
  const updateStateInUrl = (partialState = {}) => {
    const current = parseStateFromUrl();
    const hasEnabledLayerIdsUpdate = Object.prototype.hasOwnProperty.call(
      partialState,
      "enabledLayerIds",
    );
    const next = {
      ...current,
      ...partialState,
      destination: {
        ...current.destination,
        ...(partialState.destination || {}),
      },
    };

    if (hasEnabledLayerIdsUpdate) {
      next.enabledLayerStateProvided = true;
    }

    return writeStateToUrl(next);
  };

  /**
   * Remove all known restore state params from the URL.
   * @since 0.0.0
   */
  const clearStateInUrl = () => {
    const url = getCurrentUrl();
    restoreStateIds.forEach((id) => {
      url.searchParams.delete(id);
    });

    replaceUrl(url);
  };

  /**
   * Read iframe action state from namespaced portal query params.
   * @param {string} actionId Stable action identifier.
   * @param {string[]} variableNames Allowed keys from the action URL template.
   * @returns {object} State object keyed by template variable name.
   * @since 0.0.0
   */
  const getActionStateFromUrl = (actionId, variableNames = []) => {
    const normalizedActionId = normalizeId(actionId);
    if (!normalizedActionId) return {};

    const allowedVariables = normalizeVariableNames(variableNames);
    if (!allowedVariables.length) return {};

    const url = getCurrentUrl();
    const state = {};
    allowedVariables.forEach((name) => {
      const key = namespacedActionKey(normalizedActionId, name);
      if (url.searchParams.has(key)) {
        state[name] = url.searchParams.get(key);
      }
    });

    return state;
  };

  /**
   * Set namespaced action state values in the portal query string and clear
   * omitted allow-listed keys.
   * @param {string} actionId Stable action identifier.
   * @param {string[]} variableNames Allowed keys from the action URL template.
   * @param {object} nextValues Parsed values keyed by template variable name.
   * @returns {boolean} True when URL state was written.
   * @since 0.0.0
   */
  const writeActionStateToUrl = (
    actionId,
    variableNames = [],
    nextValues = {},
  ) => {
    const normalizedActionId = normalizeId(actionId);
    if (!normalizedActionId) return false;

    const allowedVariables = normalizeVariableNames(variableNames);
    if (!allowedVariables.length) return false;

    const url = getCurrentUrl();

    // Clear all namespaced keys in the allow-list first so omitted values are removed.
    allowedVariables.forEach((name) => {
      url.searchParams.delete(namespacedActionKey(normalizedActionId, name));
    });

    allowedVariables.forEach((name) => {
      const value = nextValues[name];
      if (value == null) return;
      const normalized = String(value);
      if (!normalized.length) return;
      url.searchParams.set(
        namespacedActionKey(normalizedActionId, name),
        normalized,
      );
    });

    replaceUrl(url);
    return true;
  };

  /**
   * Remove all namespaced action keys for a given action id.
   * @param {string} actionId Stable action identifier.
   * @since 0.0.0
   */
  const clearActionStateInUrl = (actionId) => {
    const normalizedActionId = normalizeId(actionId);
    if (!normalizedActionId) return;

    const url = getCurrentUrl();
    const prefix = actionPrefix(normalizedActionId);
    const keysToDelete = [];
    url.searchParams.forEach((_value, key) => {
      if (key.startsWith(prefix)) keysToDelete.push(key);
    });

    keysToDelete.forEach((key) => {
      url.searchParams.delete(key);
    });

    replaceUrl(url);
  };

  /**
   * Build the iframe URL for an action by expanding a URI template with any
   * namespaced portal URL state for that action.
   * @param {object} action Viewfinder action object.
   * @param {string} action.id Stable action identifier.
   * @param {string} action.url RFC6570 URL template.
   * @param {boolean} [showShareUrl=true] Whether to read namespaced browser
   *   state when resolving the template.
   * @returns {string|null} The resolved iframe URL or null when no URL exists.
   * @since 0.0.0
   */
  const resolveActionUrl = (action = {}, showShareUrl = true) => {
    if (typeof action?.url !== "string" || !action.url.length) return null;

    const actionId = normalizeId(action.id);
    const variableNames = UriTemplateUtilities.getTemplateVarNames(action.url);
    const restoreValues =
      actionId && showShareUrl
        ? getActionStateFromUrl(actionId, variableNames)
        : {};

    const expandedUrl = UriTemplateUtilities.expandTemplate(
      action.url,
      restoreValues,
    );

    const resolvedUrl =
      expandedUrl || UriTemplateUtilities.getTemplateBaseUrl(action.url);
    const initialQueryParams =
      action?.initialQueryParams &&
      typeof action.initialQueryParams === "object"
        ? action.initialQueryParams
        : null;

    return initialQueryParams
      ? UriTemplateUtilities.appendQueryParams(resolvedUrl, initialQueryParams)
      : resolvedUrl;
  };

  /**
   * Parse URL state from a visualization postMessage and write it back to the
   * parent portal URL using `actionId-<key>` namespaced query params.
   * @param {object} options Options describing the incoming iframe state update.
   * @param {string} options.actionId Stable action identifier.
   * @param {string} options.actionUrlTemplate RFC6570 template from action config.
   * @param {string} options.visualizationUrl URL sent from the iframe app.
   * @returns {boolean} True when namespaced state was applied.
   * @since 0.0.0
   */
  const syncActionStateFromVisualizationUrl = ({
    actionId,
    actionUrlTemplate,
    visualizationUrl,
  } = {}) => {
    const normalizedActionId = normalizeId(actionId);
    if (!normalizedActionId) return false;
    if (typeof actionUrlTemplate !== "string" || !actionUrlTemplate.length) {
      return false;
    }
    if (typeof visualizationUrl !== "string" || !visualizationUrl.length) {
      return false;
    }

    const variableNames =
      UriTemplateUtilities.getTemplateVarNames(actionUrlTemplate);
    if (!variableNames.length) return false;

    const extracted = UriTemplateUtilities.extractValuesFromUrl(
      actionUrlTemplate,
      visualizationUrl,
    );

    if (!extracted) return false;

    return writeActionStateToUrl(normalizedActionId, variableNames, extracted);
  };

  /**
   * Get schema version from URL.
   * @returns {number} the schema version from the URL, or 0 if not present or invalid.
   * @since 0.0.0
   */
  const getSchemaVersion = () => parseStateFromUrl().schemaVersion;

  /**
   * Set or clear active action id in URL state.
   * @param {string|null} activeActionId The action id to write.
   * @since 0.0.0
   */
  const updateActiveActionId = (activeActionId) => {
    updateStateInUrl({ activeActionId });
  };

  /**
   * Set or clear open panel id in URL state.
   * @param {string|null} openPanel The panel id to write.
   * @since 0.0.0
   */
  const updateOpenPanel = (openPanel) => {
    updateStateInUrl({ openPanel });
  };

  /**
   * Set active feature ids in URL state.
   * @param {string[]} activeFeatureIds The feature ids to write.
   * @since 0.0.0
   */
  const updateActiveFeatureIds = (activeFeatureIds) => {
    updateStateInUrl({ activeFeatureIds });
  };

  /**
   * @namespace SearchParams
   * @description Helpful functions for dealing with various search parameter
   * changes.
   * @type {object}
   * @since 2.30.0
   */
  return {
    clearActionStateInUrl,
    clearStateInUrl,
    getActionStateFromUrl,
    getSchemaVersion,
    normalizeState,
    parseStateFromUrl,
    resolveActionUrl,
    syncActionStateFromVisualizationUrl,
    updateActiveActionId,
    updateActiveFeatureIds,
    updateOpenPanel,
    updateStateInUrl,
    writeActionStateToUrl,
    writeStateToUrl,
  };
});

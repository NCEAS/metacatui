"use strict";

define(["backbone"], (Backbone) => {
  /**
   * @param {unknown} value Candidate id.
   * @returns {string|null} Trimmed id string or null.
   * @since 0.0.0
   */
  function normalizeId(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  /**
   * Extract a feature id from either a Feature model or plain attrs object.
   * @param {Backbone.Model|object} feature Feature model or attrs object.
   * @returns {string|undefined} Stable feature id when present.
   * @since 0.0.0
   */
  function getFeatureId(feature) {
    if (feature instanceof Backbone.Model) {
      return feature.get("featureID");
    }
    return feature?.featureID;
  }

  /**
   * Extract map layer id from either a Feature model or plain attrs object.
   * @param {Backbone.Model|object} feature Feature model or attrs object.
   * @returns {string|null} Layer id if available.
   * @since 0.0.0
   */
  function getLayerId(feature) {
    const mapAsset =
      feature instanceof Backbone.Model
        ? feature.get("mapAsset")
        : feature?.mapAsset;
    if (!mapAsset || typeof mapAsset.get !== "function") return null;
    return normalizeId(mapAsset.get("layerId"));
  }

  /**
   * Build a stable key for a feature selection entry.
   * @param {{featureId: string, layerId: (string|null)}} featureState Entry.
   * @returns {string} Stable serialization key.
   * @since 0.0.0
   */
  function getFeatureStateKey(featureState) {
    return JSON.stringify(featureState);
  }

  /**
   * Normalize a single feature entry into feature/layer form.
   * @param {unknown} entry Candidate feature state entry.
   * @returns {{featureId: string, layerId: (string|null)}|null} Normalized entry.
   * @since 0.0.0
   */
  function normalizeFeatureStateEntry(entry) {
    if (typeof entry === "string") {
      const featureId = normalizeId(entry);
      if (!featureId) return null;
      return { featureId, layerId: null };
    }

    if (!entry || typeof entry !== "object") return null;

    const featureId = normalizeId(entry.featureId || entry.featureID);
    if (!featureId) return null;

    return {
      featureId,
      layerId: normalizeId(entry.layerId) || null,
    };
  }

  /**
   * Normalize and deduplicate feature state entries.
   * @param {unknown[]} entries Candidate entries.
   * @returns {{featureId: string, layerId: (string|null)}[]} Normalized entries.
   * @since 0.0.0
   */
  function normalizeFeatureState(entries) {
    if (!Array.isArray(entries)) return [];
    const normalized = [];
    const seen = new Set();

    entries.forEach((entry) => {
      const normalizedEntry = normalizeFeatureStateEntry(entry);
      if (!normalizedEntry) return;

      const key = getFeatureStateKey(normalizedEntry);
      if (seen.has(key)) return;

      seen.add(key);
      normalized.push(normalizedEntry);
    });

    return normalized;
  }

  /**
   * Create a feature state entry from a selected feature model/attrs object.
   * @param {Backbone.Model|object} feature Selected feature entry.
   * @returns {{featureId: string, layerId: (string|null)}|null} Feature state entry.
   * @since 0.0.0
   */
  function getFeatureStateFromSelection(feature) {
    const featureId = normalizeId(getFeatureId(feature));
    if (!featureId) return null;

    return {
      featureId,
      layerId: getLayerId(feature),
    };
  }

  /**
   * Convert selected features to normalized feature state entries.
   * @param {Array<Backbone.Model|object>} features Selected features.
   * @returns {{featureId: string, layerId: (string|null)}[]} Normalized entries.
   * @since 0.0.0
   */
  function getFeatureStateFromSelections(features = []) {
    return normalizeFeatureState(
      features
        .map((feature) => getFeatureStateFromSelection(feature))
        .filter((featureState) => featureState != null),
    );
  }

  /**
   * Whether a resolved feature satisfies a requested feature state.
   * @param {{featureId: string, layerId: (string|null)}} requestedFeature Requested entry.
   * @param {{featureId: string, layerId: (string|null)}} resolvedFeature Resolved entry.
   * @returns {boolean} True when resolved entry satisfies request.
   * @since 0.0.0
   */
  function matchesRequestedFeature(requestedFeature, resolvedFeature) {
    if (!requestedFeature || !resolvedFeature) return false;
    if (requestedFeature.featureId !== resolvedFeature.featureId) return false;
    if (!requestedFeature.layerId) return true;
    return requestedFeature.layerId === resolvedFeature.layerId;
  }

  /**
   * Check whether a requested feature is resolved by any resolved entry.
   * @param {{featureId: string, layerId: (string|null)}} requestedFeature Requested entry.
   * @param {{featureId: string, layerId: (string|null)}[]} resolvedFeatures Resolved entries.
   * @returns {boolean} True when request is resolved.
   * @since 0.0.0
   */
  function isFeatureResolved(requestedFeature, resolvedFeatures = []) {
    return resolvedFeatures.some((resolvedFeature) =>
      matchesRequestedFeature(requestedFeature, resolvedFeature),
    );
  }

  /**
   * Merge current and newly found features without duplicating feature ids.
   * @param {Array<Backbone.Model|object>} currentFeatures Currently selected features.
   * @param {Array<Backbone.Model|object>} newFeatures Newly resolved features.
   * @returns {Array<Backbone.Model|object>} Merged feature list.
   * @since 0.0.0
   */
  function mergeFeatureSelections(currentFeatures = [], newFeatures = []) {
    const merged = [];
    const seenKeys = new Set();

    currentFeatures.concat(newFeatures).forEach((feature) => {
      if (!feature) return;

      const featureState = getFeatureStateFromSelection(feature);
      if (featureState) {
        const featureKey = getFeatureStateKey(featureState);
        if (seenKeys.has(featureKey)) return;
        seenKeys.add(featureKey);
      }

      merged.push(feature);
    });

    return merged;
  }

  /**
   * Manage asynchronous feature restore state for a map model.
   * @param {object} options Controller options.
   * @param {MapModel} options.mapModel Owning map model.
   * @class MapFeatureRestoreController
   * @since 0.0.0
   */
  function MapFeatureRestoreController({ mapModel }) {
    this.mapModel = mapModel;
  }

  MapFeatureRestoreController.prototype = {
    /**
     * Get the current restore session from the owning map.
     * @returns {object|null} Current restore session.
     * @since 0.0.0
     */
    getSession() {
      return this.mapModel.featureRestoreSession || null;
    },

    /**
     * Set the current restore session on the owning map.
     * @param {object|null} session Restore session.
     * @returns {object|null} The assigned session.
     * @since 0.0.0
     */
    setSession(session) {
      this.mapModel.featureRestoreSession = session;
      return session;
    },

    /**
     * Merge selected features with in-flight restore entries for URL sync.
     * @param {{featureId: string, layerId: (string|null)}[]} selectedFeatures
     * Currently selected feature state entries.
     * @returns {{featureId: string, layerId: (string|null)}[]}
     * Feature state entries to write to URL.
     * @since 0.0.0
     */
    getRequestedFeaturesForUrlSync(selectedFeatures = []) {
      const normalizedSelected = normalizeFeatureState(selectedFeatures);
      const restoringFeatures = normalizeFeatureState(
        this.getSession()?.requestedFeatures,
      );
      if (!restoringFeatures.length) return normalizedSelected;

      const merged = restoringFeatures.slice();
      normalizedSelected.forEach((selectedFeature) => {
        const selectedKey = getFeatureStateKey(selectedFeature);
        if (
          merged.some(
            (featureState) => getFeatureStateKey(featureState) === selectedKey,
          )
        ) {
          return;
        }

        const replaceIndex =
          selectedFeature.layerId &&
          merged.findIndex(
            (featureState) =>
              featureState.featureId === selectedFeature.featureId &&
              featureState.layerId == null,
          );

        if (replaceIndex >= 0) {
          merged[replaceIndex] = selectedFeature;
        } else {
          merged.push(selectedFeature);
        }
      });

      return normalizeFeatureState(merged);
    },

    /**
     * Cancel and clear any in-flight asynchronous feature restore waiters.
     * @since 0.0.0
     */
    clearSession() {
      const session = this.getSession();
      if (!session) return;

      this.setSession(null);
      session.cancelers.forEach((cancel) => {
        if (typeof cancel === "function") cancel();
      });
    },

    /**
     * Start a new feature restore session, canceling any previous one.
     * @param {{featureId: string, layerId: (string|null)}[]} activeFeatures
     * The features being restored.
     * @returns {object} The active restore session.
     * @since 0.0.0
     */
    beginSession(activeFeatures) {
      const normalizedFeatures = normalizeFeatureState(activeFeatures);
      const sessionKey = JSON.stringify(normalizedFeatures);
      if (this.getSession()?.key === sessionKey) {
        return this.getSession();
      }

      this.clearSession();
      return this.setSession({
        cancelers: [],
        key: sessionKey,
        requestedFeatures: normalizedFeatures.slice(),
      });
    },

    /**
     * Track a cancel function for in-flight feature restore waiting.
     * @param {Function} cancel Cancel function returned by a waiter.
     * @param {object} session The restore session that owns the waiter.
     * @since 0.0.0
     */
    addWaiter(cancel, session = this.getSession()) {
      if (typeof cancel !== "function" || !session) return;
      if (this.getSession() !== session) {
        cancel();
        return;
      }

      session.cancelers.push(cancel);
    },

    /**
     * Check whether a restore session is still active.
     * @param {object} session The restore session to check.
     * @returns {boolean} True if the session is still current.
     * @since 0.0.0
     */
    isActiveSession(session) {
      return this.getSession() === session;
    },

    /**
     * Search layers for features matching the given feature state and return
     * feature attribute objects ready to be passed to selectFeatures().
     * @param {{featureId: string, layerId: (string|null)}[]} features
     * Feature state entries to search for.
     * @returns {object[]} Matching feature attribute objects.
     * @since 0.0.0
     */
    findFeatureAttributes(features) {
      const normalizedFeatures = normalizeFeatureState(features);

      return normalizedFeatures.reduce((result, featureState) => {
        const match = this.mapModel.findFeature(
          featureState.featureId,
          featureState.layerId,
        );

        if (match?.attributes) result.push(match.attributes);
        return result;
      }, []);
    },

    /**
     * Read normalized feature state from restoreState.
     * @returns {{featureId: string, layerId: (string|null)}[]} Restore entries.
     * @since 0.0.0
     */
    getRestoreFeatures() {
      const restoreState = this.mapModel.get("restoreState") || {};
      return normalizeFeatureState(restoreState.activeFeatures);
    },

    /**
     * Open the feature info panel for any feature ids stored in restoreState.
     * Called after other state is restored so the feature panel appears last.
     * Searches all map layers for a matching feature and selects it directly
     * without simulating a user click. If entities are not yet loaded,
     * waits for each layer's status to become 'ready' before retrying.
     * @since 0.0.0
     */
    applyRestoreState() {
      const { mapModel } = this;
      if (!mapModel.shouldSyncUrlState()) {
        this.clearSession();
        return;
      }

      const activeFeatures = this.getRestoreFeatures();
      if (!activeFeatures.length) {
        this.clearSession();
        return;
      }

      const selectedFeatures = mapModel.getSelectedFeatures();
      const selectedRequestedFeatures = getFeatureStateFromSelections(
        selectedFeatures?.models || [],
      ).filter((featureState) =>
        activeFeatures.some((requestedFeature) =>
          matchesRequestedFeature(requestedFeature, featureState),
        ),
      );
      const allSearchableLayers = mapModel
        .getAllLayers()
        .filter((layer) => typeof layer.getFeatureById === "function");
      const featureAttrs = this.findFeatureAttributes(activeFeatures);
      const resolvedFeatures = selectedRequestedFeatures.slice();

      featureAttrs.forEach((feature) => {
        const featureState = getFeatureStateFromSelection(feature);
        if (featureState) resolvedFeatures.push(featureState);
      });

      const unresolvedFeatures = activeFeatures.filter(
        (featureState) => !isFeatureResolved(featureState, resolvedFeatures),
      );
      const restoreKey = JSON.stringify(activeFeatures);
      const canResolveAsynchronously = allSearchableLayers.some(
        (layer) =>
          layer.get("status") !== "ready" ||
          typeof layer.waitForFeatureById === "function",
      );
      const existingSession = this.getSession();
      let restoreSession = existingSession;

      if (
        unresolvedFeatures.length &&
        canResolveAsynchronously &&
        existingSession?.key !== restoreKey
      ) {
        restoreSession = this.beginSession(activeFeatures);
      }

      if (featureAttrs.length) {
        mapModel.selectFeatures(
          mergeFeatureSelections(selectedFeatures?.models || [], featureAttrs),
        );
      }

      if (!unresolvedFeatures.length) {
        this.clearSession();
        return;
      }

      if (!canResolveAsynchronously) {
        this.clearSession();
        mapModel.syncSelectedFeaturesToUrl();
        return;
      }

      if (
        this.getSession()?.key === restoreKey &&
        existingSession?.key === restoreKey
      ) {
        return;
      }

      const selectIfFound = () => {
        if (!this.isActiveSession(restoreSession)) return;

        const selectedFeatureStates = getFeatureStateFromSelections(
          mapModel.getSelectedFeatures()?.models || [],
        );
        if (
          activeFeatures.every((featureState) =>
            isFeatureResolved(featureState, selectedFeatureStates),
          )
        ) {
          this.clearSession();
          return;
        }

        const attrs = this.findFeatureAttributes(activeFeatures);
        if (attrs.length) {
          mapModel.selectFeatures(
            mergeFeatureSelections(
              mapModel.getSelectedFeatures()?.models || [],
              attrs,
            ),
          );
        }

        const resolvedAfterRetry = getFeatureStateFromSelections(
          mapModel.getSelectedFeatures()?.models || [],
        );
        if (
          activeFeatures.every((featureState) =>
            isFeatureResolved(featureState, resolvedAfterRetry),
          )
        ) {
          this.clearSession();
        }
      };

      const registerTileWaiters = (layer) => {
        if (!this.isActiveSession(restoreSession)) return;
        if (typeof layer.waitForFeatureById !== "function") return;

        const layerId = normalizeId(layer.get("layerId"));
        const selectedFeatureStates = getFeatureStateFromSelections(
          mapModel.getSelectedFeatures()?.models || [],
        );
        const missingFeatures = activeFeatures.filter((featureState) => {
          if (featureState.layerId && featureState.layerId !== layerId) {
            return false;
          }
          return !isFeatureResolved(featureState, selectedFeatureStates);
        });

        missingFeatures.forEach((featureState) => {
          const cancel = layer.waitForFeatureById(featureState.featureId, () =>
            selectIfFound(),
          );
          this.addWaiter(cancel, restoreSession);
        });
      };

      if (!allSearchableLayers.length) return;

      allSearchableLayers.forEach((layer) => {
        const layerId = normalizeId(layer.get("layerId"));
        const isRelevantLayer = unresolvedFeatures.some(
          (featureState) =>
            !featureState.layerId || featureState.layerId === layerId,
        );
        if (!isRelevantLayer) return;

        if (layer.get("status") !== "ready") {
          const statusListener = () => {
            if (!this.isActiveSession(restoreSession)) {
              mapModel.stopListening(layer, "change:status", statusListener);
              return;
            }
            if (layer.get("status") !== "ready") return;

            mapModel.stopListening(layer, "change:status", statusListener);
            selectIfFound();
            registerTileWaiters(layer);
          };

          mapModel.listenTo(layer, "change:status", statusListener);
          this.addWaiter(() => {
            mapModel.stopListening(layer, "change:status", statusListener);
          }, restoreSession);
        } else if (typeof layer.waitForFeatureById === "function") {
          registerTileWaiters(layer);
        }
      });
    },
  };

  return MapFeatureRestoreController;
});

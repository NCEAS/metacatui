"use strict";

define(["backbone", "models/maps/LayerLoadingCoordinator"], (
  Backbone,
  LayerLoadingCoordinator,
) => {
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
   * Merge current and newly found features without duplicating feature ids.
   * @param {Array<Backbone.Model|object>} currentFeatures Currently selected features.
   * @param {Array<Backbone.Model|object>} newFeatures Newly resolved features.
   * @returns {Array<Backbone.Model|object>} Merged feature list.
   * @since 0.0.0
   */
  function mergeFeatureSelections(currentFeatures = [], newFeatures = []) {
    const merged = [];
    const seenIds = new Set();

    currentFeatures.concat(newFeatures).forEach((feature) => {
      if (!feature) return;

      const featureId = getFeatureId(feature);
      if (typeof featureId === "string" && featureId.length) {
        if (seenIds.has(featureId)) return;
        seenIds.add(featureId);
      }

      merged.push(feature);
    });

    return merged;
  }

  /**
   * Serialize a feature-restore scope without ambiguity between ids that may
   * contain separator characters.
   * @param {string[]} featureIds Requested feature ids.
   * @param {string[]} layerIds Searchable layer ids.
   * @returns {string} Stable scope key.
   * @since 0.0.0
   */
  function serializeRestoreScopeKey(featureIds, layerIds) {
    return JSON.stringify({
      featureIds: [...new Set(featureIds)].sort(),
      layerIds: [...new Set(layerIds)].sort(),
    });
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

  /**
   * Check whether a layer supports Backbone-style event listening.
   * @param {object} layer Candidate layer object.
   * @returns {boolean} True when the layer has on/off event functions.
   * @since 0.0.0
   */
  function isObservableLayer(layer) {
    return (
      layer && typeof layer.on === "function" && typeof layer.off === "function"
    );
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
     * Merge selected ids with in-flight restore ids for URL sync.
     * @param {string[]} selectedIds Currently selected feature ids.
     * @returns {string[]} Feature ids to write to URL.
     * @since 0.0.0
     */
    getRequestedIdsForUrlSync(selectedIds = []) {
      const restoringIds = this.getSession()?.requestedIds;
      if (!restoringIds?.length) return selectedIds;

      const mergedIds = restoringIds.slice();
      selectedIds.forEach((id) => {
        if (!mergedIds.includes(id)) mergedIds.push(id);
      });

      return mergedIds;
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
     * @param {string[]} activeFeatureIds The ids being restored.
     * @param {string} [sessionKey] Optional key describing restore scope.
     * @returns {object} The active restore session.
     * @since 0.0.0
     */
    beginSession(activeFeatureIds, sessionKey = activeFeatureIds.join(",")) {
      if (this.getSession()?.key === sessionKey) {
        return this.getSession();
      }

      this.clearSession();
      const session = this.setSession({
        cancelers: [],
        key: sessionKey,
        requestedIds: activeFeatureIds.slice(),
      });

      // Ensure restores have a bounded lifetime so unresolved waits do not
      // persist forever when no matching feature ever arrives.
      const timeoutMs = this.mapModel.get("featureRestoreTimeoutMs") || 15000;
      const timeoutId = setTimeout(() => {
        if (!this.isActiveSession(session)) return;
        this.clearSession();
        LayerLoadingCoordinator.updateLayerLoadingState(this.mapModel);
      }, timeoutMs);
      this.addWaiter(() => clearTimeout(timeoutId), session);

      return session;
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
     * Search all layers for features matching the given ids and return
     * feature attribute objects ready to be passed to selectFeatures().
     * @param {string[]} ids Feature ids to search for.
     * @param {Array<object>} [layers] Layers to search within.
     * @returns {object[]} Matching feature attribute objects.
     * @since 0.0.0
     */
    findFeatureAttributesByIds(ids, layers = this.mapModel.getAllLayers()) {
      return ids.reduce((result, id) => {
        const featureAttrs = layers.reduce((foundAttrs, layer) => {
          if (
            foundAttrs ||
            typeof layer.getFeatureById !== "function" ||
            layer.get("status") === "error"
          ) {
            return foundAttrs;
          }

          const feature = layer.getFeatureById(id);
          if (!feature) return foundAttrs;

          return layer.getFeatureAttributes(feature) || foundAttrs;
        }, null);

        if (featureAttrs) result.push(featureAttrs);
        return result;
      }, []);
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

      const restoreState = mapModel.get("restoreState") || {};
      const { activeFeatureIds = [] } = restoreState;
      if (!activeFeatureIds.length) {
        this.clearSession();
        return;
      }

      const selectedFeatures = mapModel.getSelectedFeatures();
      const selectedRequestedIds = (selectedFeatures?.models || [])
        .map((feature) => getFeatureId(feature))
        .filter((id) => activeFeatureIds.includes(id));
      const allSearchableLayers = mapModel
        .getAllLayers()
        .filter(
          (layer) =>
            layer.get("visible") !== false &&
            typeof layer.getFeatureById === "function" &&
            layer.get("status") !== "error",
        );
      const featureAttrs = this.findFeatureAttributesByIds(
        activeFeatureIds,
        allSearchableLayers,
      );
      const resolvedIds = new Set(selectedRequestedIds);

      featureAttrs.forEach((feature) => {
        const featureId = getFeatureId(feature);
        if (typeof featureId === "string" && featureId.length) {
          resolvedIds.add(featureId);
        }
      });

      const unresolvedIds = activeFeatureIds.filter(
        (id) => !resolvedIds.has(id),
      );
      const searchableLayerIds = allSearchableLayers
        .map((layer) => layer.get("layerId") || layer.cid || "")
        .filter((layerId) => typeof layerId === "string" && layerId.length);
      const restoreScopeKey = serializeRestoreScopeKey(
        activeFeatureIds,
        searchableLayerIds,
      );
      const canResolveAsynchronously = allSearchableLayers.some(
        (layer) =>
          layer.get("status") !== "ready" ||
          typeof layer.waitForFeatureById === "function",
      );
      const existingSession = this.getSession();
      let restoreSession = existingSession;

      if (
        unresolvedIds.length &&
        canResolveAsynchronously &&
        existingSession?.key !== restoreScopeKey
      ) {
        restoreSession = this.beginSession(activeFeatureIds, restoreScopeKey);
      }

      if (featureAttrs.length) {
        mapModel.selectFeatures(
          mergeFeatureSelections(selectedFeatures?.models || [], featureAttrs),
        );
      }

      if (!unresolvedIds.length) {
        this.clearSession();
        return;
      }

      if (!allSearchableLayers.length) {
        this.clearSession();
        return;
      }

      if (!canResolveAsynchronously) {
        this.clearSession();
        mapModel.syncSelectedFeaturesToUrl();
        return;
      }

      if (
        this.getSession()?.key === restoreScopeKey &&
        existingSession?.key === restoreScopeKey
      ) {
        return;
      }

      const selectIfFound = () => {
        if (!this.isActiveSession(restoreSession)) return;

        const selectedIds = (mapModel.getSelectedFeatures()?.models || [])
          .map((feature) => getFeatureId(feature))
          .filter((id) => activeFeatureIds.includes(id));
        const selectedIdSet = new Set(selectedIds);
        if (activeFeatureIds.every((id) => selectedIdSet.has(id))) {
          this.clearSession();
          return;
        }

        const attrs = this.findFeatureAttributesByIds(
          activeFeatureIds,
          allSearchableLayers,
        );
        if (attrs.length) {
          mapModel.selectFeatures(
            mergeFeatureSelections(
              mapModel.getSelectedFeatures()?.models || [],
              attrs,
            ),
          );
        }

        const resolvedAfterRetry = new Set(
          (mapModel.getSelectedFeatures()?.models || [])
            .map((feature) => getFeatureId(feature))
            .filter((id) => activeFeatureIds.includes(id)),
        );
        if (activeFeatureIds.every((id) => resolvedAfterRetry.has(id))) {
          this.clearSession();
        }
      };

      const registerTileWaiters = (layer) => {
        if (!this.isActiveSession(restoreSession)) return;
        if (layer.get("status") === "error") return;
        if (typeof layer.waitForFeatureById !== "function") return;

        const selectedIds = (mapModel.getSelectedFeatures()?.models || []).map(
          (feature) => getFeatureId(feature),
        );
        const missingIds = activeFeatureIds.filter(
          (id) => !selectedIds.includes(id),
        );

        missingIds.forEach((id) => {
          const cancel = layer.waitForFeatureById(id, () => selectIfFound());
          this.addWaiter(cancel, restoreSession);
        });
      };

      if (!allSearchableLayers.length) return;

      allSearchableLayers.forEach((layer) => {
        if (layer.get("status") !== "ready") {
          if (!isObservableLayer(layer)) {
            registerTileWaiters(layer);
            return;
          }

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

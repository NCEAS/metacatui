"use strict";

define(["models/PersistentStorage", "common/UrlUtilities"], (
  PersistentStorage,
  UrlUtilities,
) => {
  const STORE_NAMESPACE = "UploadRecovery";
  // localforage's IndexedDB driver name. Recovery records carry serialized
  // ResourceMap XML (hundreds of KB at hundreds of members — a few ms to
  // write), so do not fall back to WebSQL/localStorage.
  const INDEXEDDB_DRIVER = "asyncStorage";
  // Recovery records never expire on their own: an orphaned metadata document
  // stays broken until it is repaired, however long that takes. They are
  // cleared explicitly once the ResourceMap write is confirmed.
  const RECOVERY_TTL_MS = null;

  /**
   * Durable, per server store for upload recovery records. Each record captures
   * everything needed to finish (or reconstruct) the ResourceMap write for one
   * metadata document, keyed by that metadata PID, so a crash between "metadata
   * committed" and "ResourceMap committed" is recoverable on the next load.
   *
   * Backed by {@link PersistentStorage} (localforage/IndexedDB), so records
   * survive a tab crash. Each record stores the exact serialized ResourceMap
   * bytes the interrupted upload had prepared; server side reconstruction is
   * the cross device fallback.
   * @class UploadRecoveryStore
   * @classcategory Models/DataPackage
   * @since 0.0.0
   */
  class UploadRecoveryStore {
    /**
     * Create an upload recovery store.
     * @param {object} [options] Store options
     * @param {PersistentStorage} [options.storage] Storage instance to use
     * When omitted, a per server singleton is created
     * @param {string} [options.baseUrl] Service base URL used to namespace the
     * store. Defaults to the app's Member Node service URL
     */
    constructor({ storage, baseUrl } = {}) {
      const url =
        baseUrl ||
        globalThis.MetacatUI?.appModel?.get?.("metaServiceUrl") ||
        "";
      this.storage =
        storage ||
        PersistentStorage.get({
          instanceKeys: [UrlUtilities.normalizeUrl(url), STORE_NAMESPACE],
          ttlMs: RECOVERY_TTL_MS,
          memory: false,
          localforageConfig: { driver: INDEXEDDB_DRIVER },
        });
    }

    /**
     * Persist a recovery record for a metadata PID.
     * @param {string} metadataPid Metadata document PID the record recovers
     * @param {object} record Recovery record payload
     * @returns {Promise<void>} Resolves after attempting the storage write
     */
    async save(metadataPid, record) {
      if (!metadataPid || !record) return;
      const stored = { ...record, metadataPid };
      try {
        await this.storage.setItem(metadataPid, stored, {
          ttlMs: RECOVERY_TTL_MS,
        });
      } catch (_error) {
        // Recovery is best-effort; a storage failure must never fail an upload.
      }
    }

    /**
     * Read a recovery record for a metadata PID.
     * @param {string} metadataPid Metadata document PID
     * @returns {Promise<object|null>} The record, or null when absent or
     * unreadable after retry
     */
    async get(metadataPid) {
      if (!metadataPid) return null;
      try {
        return (await this.storage.getItem(metadataPid)) || null;
      } catch (_error) {
        // Retry once, in case the first failure was a transient IndexedDB error
        // (cheap to retry and IndexedDB errors vary across browsers)
        try {
          return (await this.storage.getItem(metadataPid)) || null;
        } catch (_retryError) {
          // An unreadable record cannot support exact replay, so let recovery
          // fall back to the server whether or not a local record exists.
          return null;
        }
      }
    }

    /**
     * Remove a recovery record for a metadata PID.
     * @param {string} metadataPid Metadata document PID
     * @returns {Promise<void>} Resolves when removal has been attempted
     */
    async remove(metadataPid) {
      if (!metadataPid) return;
      try {
        await this.storage.removeItem(metadataPid);
      } catch (_error) {
        // Ignore: a stale record left behind is harmless (it is re-validated
        // against the server before any repair acts on it).
      }
    }
  }

  return UploadRecoveryStore;
});

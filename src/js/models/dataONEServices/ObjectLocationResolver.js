define([
  "models/dataONEServices/SysMetaService",
  "common/ErrorUtilities",
  "common/UrlUtilities",
  "common/Utilities",
], (SysMetaService, ErrorUtilities, UrlUtilities, Utilities) => {
  const LOCATION_ERROR_CODE = "OBJECT_LOCATION_UNAVAILABLE";

  /**
   * Resolve registered Member Node object service locations from System
   * Metadata.
   * @class ObjectLocationResolver
   * @classcategory Models/DataONEServices
   * @since 2.39.0
   */
  class ObjectLocationResolver {
    /**
     * @param {object} [options] Resolver options
     * @param {string} [options.metaServiceUrl] System Metadata service URL
     * @param {SysMetaService} [options.sysMetaService] System Metadata service
     * @param {Function} [options.getToken] Token resolver
     * @param {Function} [options.getNodeModel] Node model resolver
     * @param {Function} [options.getMemberNodeApis] Member Node API resolver
     */
    constructor({
      metaServiceUrl = "",
      sysMetaService = null,
      getToken,
      getNodeModel = async () => {
        await Utilities.awaitMetacatUI({ appName: "nodeModel" });
        return globalThis.MetacatUI?.nodeModel || null;
      },
      getMemberNodeApis = (baseURL) =>
        globalThis.MetacatUI?.appModel?.getDataONEMNAPIs?.(baseURL) || {},
    } = {}) {
      this.sysMetaService =
        sysMetaService ||
        new SysMetaService({ readBaseUrl: metaServiceUrl, getToken });
      this.getNodeModel = getNodeModel;
      this.getMemberNodeApis = getMemberNodeApis;
    }

    /**
     * Wait for the node registry check to finish.
     * @param {AbortSignal} [signal] Request signal
     * @returns {Promise<*>} Node registry model
     * @throws {AbortError} When the request is aborted
     */
    async waitForNodeModel(signal) {
      ErrorUtilities.throwIfAborted(signal);
      const nodeModel = await this.getNodeModel();
      ErrorUtilities.throwIfAborted(signal);
      if (!nodeModel || nodeModel.get?.("checked") === true) return nodeModel;

      await new Promise((resolve, reject) => {
        let onChecked;
        let onAbort;
        const cleanup = () => {
          nodeModel.off("change:checked", onChecked);
          signal?.removeEventListener("abort", onAbort);
        };
        onChecked = () => {
          cleanup();
          resolve();
        };
        onAbort = () => {
          cleanup();
          reject(ErrorUtilities.createAbortError(signal?.reason));
        };
        nodeModel.on("change:checked", onChecked);
        signal?.addEventListener("abort", onAbort, { once: true });
      });
      return nodeModel;
    }

    /**
     * Find registered readable Member Node object services for an object.
     * @param {string} pid Object identifier
     * @param {object} [options] Lookup options
     * @param {AbortSignal} [options.signal] Request signal
     * @returns {Promise<object>} Ordered object service URLs and public status
     * @throws {Error} When System Metadata cannot be read
     */
    async locate(pid, { signal } = {}) {
      const sysMeta = await this.sysMetaService.download(pid, { signal });
      const isPublic = sysMeta.accessPolicy?.isPublic?.() === true;
      const nodeIds = [
        sysMeta.authoritativeMemberNode,
        ...Array.from(sysMeta.replicas || [])
          .filter((replica) => replica.replicationStatus === "completed")
          .map((replica) => replica.replicaMemberNode),
      ].filter(Boolean);
      const uniqueNodeIds = [...new Set(nodeIds)];
      const nodeModel = await this.waitForNodeModel(signal);
      if (!nodeModel || nodeModel.get?.("error") === true) {
        return { objectServiceUrls: [], isPublic };
      }

      const objectServiceUrls = uniqueNodeIds
        .map((nodeId) => nodeModel.getMember?.(nodeId))
        .filter((node) => node?.readv2 && node.baseURL)
        .map((node) =>
          UrlUtilities.normalizeUrl(
            this.getMemberNodeApis(node.baseURL).objectServiceUrl,
          ),
        )
        .filter(Boolean);

      return {
        objectServiceUrls: [...new Set(objectServiceUrls)],
        isPublic,
      };
    }
  }

  ObjectLocationResolver.LOCATION_ERROR_CODE = LOCATION_ERROR_CODE;
  return ObjectLocationResolver;
});

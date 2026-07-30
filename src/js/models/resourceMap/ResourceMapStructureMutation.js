"use strict";

/**
 * Update package membership and links from metadata to documented data. ORE
 * statements say which objects belong to the package; CiTO statements say
 * which metadata object documents which data object. Callers use ResourceMap,
 * which starts each graph transaction and handles rollback.
 * @since 0.0.0
 */

define([
  "common/ValueUtilities",
  "models/resourceMap/RDFGraph",
  "models/resourceMap/ResourceMapCommon",
], (ValueUtilities, RDFGraph, ResourceMapCommon) => {
  const { dedupeArray, dedupeBy, requireNonEmptyString } = ValueUtilities;
  const { NS, ResourceMapConflictError } = ResourceMapCommon;

  /**
   * Record in both directions that a metadata member documents a data member.
   * @param {ResourceMap} resourceMap Resource map being updated
   * @param {object} metadataNode Metadata member node
   * @param {object} dataNode Documented member node
   */
  function addDocumentationStatements(resourceMap, metadataNode, dataNode) {
    resourceMap.graph.addStatementIfMissing({
      subject: metadataNode,
      predicate: NS.CITO("documents"),
      object: dataNode,
    });
    resourceMap.graph.addStatementIfMissing({
      subject: dataNode,
      predicate: NS.CITO("isDocumentedBy"),
      object: metadataNode,
    });
  }

  /**
   * Remove both RDF statements connecting metadata to the data it documents.
   * @param {ResourceMap} resourceMap Resource map being updated
   * @param {object} metadataNode Metadata member node
   * @param {object} dataNode Documented member node
   */
  function removeDocumentationStatements(resourceMap, metadataNode, dataNode) {
    resourceMap.graph.removeStatementsMatching({
      subject: metadataNode,
      predicate: NS.CITO("documents"),
      object: dataNode,
    });
    resourceMap.graph.removeStatementsMatching({
      subject: dataNode,
      predicate: NS.CITO("isDocumentedBy"),
      object: metadataNode,
    });
  }

  /**
   * Validate member PIDs and remove duplicates.
   * @param {string[]} pids Candidate member PIDs
   * @returns {string[]} Normalized member PIDs
   */
  function normalizeMemberPids(pids) {
    return dedupeArray(
      pids.map((pid) => requireNonEmptyString(pid, "PID required")),
    );
  }

  /**
   * Build a stable key from a documentation link's metadata and data PIDs.
   * @param {ResMapDocLink} link Documentation link
   * @returns {string} Stable link key
   */
  function documentationLinkKey({ metadataPid, dataPid }) {
    return RDFGraph.buildKey([metadataPid, dataPid]);
  }

  /**
   * Validate metadata and data PIDs and remove exact duplicate links.
   * @param {ResMapDocLink[]} links Candidate documentation links
   * @returns {ResMapDocLink[]} Normalized documentation links
   */
  function normalizeDocumentationLinks(links) {
    return dedupeBy(
      links.map((link) => ({
        metadataPid: requireNonEmptyString(
          link?.metadataPid,
          "Metadata PID required",
        ),
        dataPid: requireNonEmptyString(link?.dataPid, "Data PID required"),
      })),
      documentationLinkKey,
    );
  }

  /**
   * Require both objects in every documentation link to be package members.
   * @param {ResMapDocLink[]} links Documentation links to inspect
   * @param {Function} isAggregated Member predicate
   */
  function assertDocumentationLinksAggregated(links, isAggregated) {
    links.forEach(({ metadataPid, dataPid }) => {
      if (!isAggregated(metadataPid)) {
        throw new Error(`Metadata "${metadataPid}" is not aggregated`);
      }
      if (!isAggregated(dataPid)) {
        throw new Error(`Data "${dataPid}" is not aggregated`);
      }
    });
  }

  /**
   * Find the exact RDF nodes for the metadata and data in one documentation
   * link.
   * @param {ResourceMap} resourceMap Resource map being inspected
   * @param {ResMapDocLink} link Documentation link to resolve
   * @returns {{metadataNode: NamedNode, dataNode: NamedNode}} Endpoint nodes
   */
  function resolveDocumentationNodes(resourceMap, link) {
    const metadataMember = resourceMap.resolveMemberNode(link.metadataPid);
    const dataMember = resourceMap.resolveMemberNode(link.dataPid);
    return {
      metadataNode: RDFGraph.createNamedNode(
        metadataMember?.uri || resourceMap.pidToUri(link.metadataPid),
      ),
      dataNode: RDFGraph.createNamedNode(
        dataMember?.uri || resourceMap.pidToUri(link.dataPid),
      ),
    };
  }

  /**
   * Find the documentation links that must be added or removed to reach the
   * requested set.
   * @param {ResourceMap} resourceMap Resource map being inspected
   * @param {ResMapDocLink[]} currentLinks Current documentation links
   * @param {ResMapDocLink[]} nextLinks Desired documentation links
   * @returns {object} Added and removed endpoint node pairs
   */
  function diffDocumentationLinks(resourceMap, currentLinks, nextLinks) {
    const currentByKey = new Map(
      currentLinks.map((link) => [documentationLinkKey(link), link]),
    );
    const nextByKey = new Map(
      nextLinks.map((link) => [documentationLinkKey(link), link]),
    );
    const removed = [...currentByKey]
      .filter(([key]) => !nextByKey.has(key))
      .map(([, link]) => resolveDocumentationNodes(resourceMap, link));
    const added = [];
    nextByKey.forEach((link, key) => {
      const { metadataNode, dataNode } = resolveDocumentationNodes(
        resourceMap,
        link,
      );
      const isComplete =
        currentByKey.has(key) &&
        resourceMap.graph.hasStatement({
          subject: metadataNode,
          predicate: NS.CITO("documents"),
          object: dataNode,
        }) &&
        resourceMap.graph.hasStatement({
          subject: dataNode,
          predicate: NS.CITO("isDocumentedBy"),
          object: metadataNode,
        });
      if (!isComplete) {
        added.push({ metadataNode, dataNode });
      }
    });

    return { removed, added };
  }

  /**
   * Find the package members that must be added or removed to reach the
   * requested set.
   * @param {ResourceMap} resourceMap Resource map being inspected
   * @param {string[]} nextPids Desired member PIDs
   * @returns {object} Added and removed member descriptors
   */
  function diffMemberPids(resourceMap, nextPids) {
    const currentPids = resourceMap.getMemberPids();
    const currentPidSet = new Set(currentPids);
    const nextPidSet = new Set(nextPids);
    const addedMembers = nextPids
      .filter((pid) => !currentPidSet.has(pid))
      // A provenance node that claims the same PID is not automatically a
      // package member. New members use the configured resolver instead of
      // adopting that separate node.
      .map((pid) => ({ pid, uri: resourceMap.pidToUri(pid) }));
    const removedMembers = currentPids
      .filter((pid) => !nextPidSet.has(pid))
      .map((pid) => resourceMap.resolveMemberNode(pid));

    return { addedMembers, removedMembers };
  }

  /**
   * Find provenance relationships that must be cleaned up before members are
   * removed.
   * @param {ResourceMap} resourceMap Resource map being inspected
   * @param {object[]} removedMembers Members being removed
   * @returns {object|null} Collected provenance edits
   */
  function collectProvenanceRemovals(resourceMap, removedMembers) {
    return removedMembers.length
      ? resourceMap.provenance.collectMemberReferenceRemovals(
          new Set(removedMembers.map(({ pid }) => pid)),
        )
      : null;
  }

  /**
   * Remove package members and the provenance relationships that refer to them.
   * @param {ResourceMap} resourceMap Resource map being updated
   * @param {object[]} removedMembers Members being removed
   * @param {object|null} provenanceRemovals Collected provenance edits
   */
  function applyMemberRemovals(
    resourceMap,
    removedMembers,
    provenanceRemovals,
  ) {
    if (provenanceRemovals) {
      resourceMap.provenance.applyMemberReferenceRemovals(provenanceRemovals);
    }
    removedMembers.forEach(({ uri }) => {
      // Removing a member deletes every statement that references its exact
      // aggregated node. Other nodes that claim the same PID remain; only their
      // managed provenance links to the removed PID are deleted.
      resourceMap.graph.removeNodeReferences(RDFGraph.createNamedNode(uri));
    });
  }

  /**
   * Update package membership and links from metadata to documented data for
   * one Resource Map.
   * @class ResourceMapStructureMutation
   * @classcategory Models/ResourceMap
   * @since 0.0.0
   */
  class ResourceMapStructureMutation {
    /**
     * @param {object} options Mutation options
     * @param {ResourceMap} options.resourceMap Resource map being updated
     */
    constructor({ resourceMap } = {}) {
      this.resourceMap = resourceMap;
    }

    /**
     * Add the two RDF statements that make an object a package member:
     * `package --aggregates--> member` and
     * `member --isAggregatedBy--> package`.
     * @param {string} pid Member PID
     * @param {string} uri Member node URI
     * @returns {ResourceMap} Updated resource map
     */
    addAggregationTriples(pid, uri) {
      const { resourceMap } = this;
      const memberNode = RDFGraph.createNamedNode(uri);
      const aggregationNode = RDFGraph.createNamedNode(
        resourceMap.aggregationUri,
      );

      resourceMap.ensureIdentifierForUri(uri, pid);
      resourceMap.graph.addStatementIfMissing({
        subject: aggregationNode,
        predicate: NS.ORE("aggregates"),
        object: memberNode,
      });
      resourceMap.graph.addStatementIfMissing({
        subject: memberNode,
        predicate: NS.ORE("isAggregatedBy"),
        object: aggregationNode,
      });
      return resourceMap;
    }

    /**
     * Remove package members and the managed relationships attached to their
     * exact RDF nodes.
     * @param {string[]} pids Member PIDs to remove
     * @returns {ResourceMap} Updated resource map
     */
    removeMembers(pids) {
      const { resourceMap } = this;
      const normalizedPids = normalizeMemberPids(
        Array.isArray(pids) ? pids : [pids],
      );
      const removedMembers = normalizedPids
        .map((pid) => resourceMap.resolveMemberNode(pid))
        .filter(Boolean);
      if (!removedMembers.length) return resourceMap;

      const provenanceRemovals = collectProvenanceRemovals(
        resourceMap,
        removedMembers,
      );
      return resourceMap.mutateGraph(() => {
        applyMemberRemovals(resourceMap, removedMembers, provenanceRemovals);
      });
    }

    /**
     * Change a package member's PID wherever managed package relationships use
     * it.
     * @param {string} oldPid Existing member PID
     * @param {string} newPid Replacement member PID
     * @returns {ResourceMap} Updated resource map
     */
    replaceMember(oldPid, newPid) {
      const { resourceMap } = this;
      const normalizedOldPid = requireNonEmptyString(oldPid, "oldPid required");
      const normalizedNewPid = requireNonEmptyString(newPid, "newPid required");
      if (normalizedOldPid === normalizedNewPid) return resourceMap;

      const oldMember = resourceMap.resolveMemberNode(normalizedOldPid);
      if (!oldMember) {
        throw new Error(
          `Cannot replace member: "${normalizedOldPid}" is not in this resource map`,
        );
      }
      const oldMemberUri = oldMember.uri;

      const existingNewMemberUri =
        resourceMap.resolveMemberNode(normalizedNewPid)?.uri;
      if (existingNewMemberUri && existingNewMemberUri !== oldMemberUri) {
        throw new ResourceMapConflictError(
          `Cannot replace member: "${normalizedNewPid}" is already aggregated`,
          {
            code: "memberAlreadyAggregated",
            details: {
              oldPid: normalizedOldPid,
              newPid: normalizedNewPid,
            },
          },
        );
      }

      return resourceMap.mutateGraph(() => {
        const nextMemberUri = resourceMap.pidToUri(normalizedNewPid);
        if (nextMemberUri !== oldMemberUri) {
          resourceMap.graph.replaceNodeValue(oldMemberUri, nextMemberUri);
        }
        resourceMap.setIdentifierForUri(nextMemberUri, normalizedNewPid, {
          removeValues: [normalizedOldPid],
        });
      });
    }

    /**
     * Set all package members and metadata documentation links in one edit. If
     * any step fails, the whole edit is rolled back.
     * @param {string[]} pids Desired member PIDs
     * @param {ResMapDocLink[]} links Desired documentation links
     * @returns {ResourceMap} Updated resource map
     */
    setPackageStructure(pids, links) {
      if (!Array.isArray(pids)) {
        throw new Error("pids must be an array");
      }
      if (!Array.isArray(links)) {
        throw new Error("links must be an array");
      }
      const { resourceMap } = this;
      const normalizedPids = normalizeMemberPids(pids);
      const nextPidSet = new Set(normalizedPids);
      const normalizedLinks = normalizeDocumentationLinks(links);
      assertDocumentationLinksAggregated(normalizedLinks, (pid) =>
        nextPidSet.has(pid),
      );

      const { addedMembers, removedMembers } = diffMemberPids(
        resourceMap,
        normalizedPids,
      );
      const { removed: removedDocs, added: addedDocs } = diffDocumentationLinks(
        resourceMap,
        resourceMap.getDocumentationLinks(),
        normalizedLinks,
      );

      if (
        !removedMembers.length &&
        !addedMembers.length &&
        !removedDocs.length &&
        !addedDocs.length
      ) {
        return resourceMap;
      }

      const provenanceRemovals = collectProvenanceRemovals(
        resourceMap,
        removedMembers,
      );
      return resourceMap.mutateGraph(
        () => {
          removedDocs.forEach(({ metadataNode, dataNode }) => {
            removeDocumentationStatements(resourceMap, metadataNode, dataNode);
          });
          applyMemberRemovals(resourceMap, removedMembers, provenanceRemovals);
          addedMembers.forEach(({ pid, uri }) => {
            this.addAggregationTriples(pid, uri);
          });
          addedDocs.forEach(({ metadataNode, dataNode }) => {
            addDocumentationStatements(resourceMap, metadataNode, dataNode);
          });
        },
        { rollbackOnError: true },
      );
    }

    /**
     * Record in both directions that one metadata member documents a data
     * member.
     * @param {string} metadataPid Documenting metadata PID
     * @param {string} dataPid Documented member PID
     * @returns {ResourceMap} Updated resource map
     */
    linkDocumentation(metadataPid, dataPid) {
      const { resourceMap } = this;
      const metadataMember = resourceMap.resolveMemberNode(metadataPid, {
        required: true,
        message: "Metadata PID required",
      });
      const dataMember = resourceMap.resolveMemberNode(dataPid, {
        required: true,
        message: "Data PID required",
      });

      return resourceMap.mutateGraph(() => {
        resourceMap.ensureIdentifierForUri(
          metadataMember.uri,
          metadataMember.pid,
        );
        resourceMap.ensureIdentifierForUri(dataMember.uri, dataMember.pid);
        addDocumentationStatements(
          resourceMap,
          metadataMember.node,
          dataMember.node,
        );
      });
    }

    /**
     * Remove both RDF directions of a link from metadata to documented data.
     * @param {string} metadataPid Documenting metadata PID
     * @param {string} dataPid Documented member PID
     * @returns {ResourceMap} Updated resource map
     */
    unlinkDocumentation(metadataPid, dataPid) {
      const { resourceMap } = this;
      const metadataMember = resourceMap.resolveMemberNode(metadataPid, {
        required: true,
        message: "Metadata PID required",
      });
      const dataMember = resourceMap.resolveMemberNode(dataPid, {
        required: true,
        message: "Data PID required",
      });

      return resourceMap.mutateGraph(() => {
        removeDocumentationStatements(
          resourceMap,
          metadataMember.node,
          dataMember.node,
        );
      });
    }

    /**
     * Replace all links from metadata to documented data.
     * @param {ResMapDocLink[]} links Desired documentation links
     * @returns {ResourceMap} Updated resource map
     */
    setDocumentationLinks(links) {
      if (!Array.isArray(links)) {
        throw new Error("links must be an array");
      }
      const { resourceMap } = this;
      const normalizedLinks = normalizeDocumentationLinks(links);
      assertDocumentationLinksAggregated(normalizedLinks, (pid) =>
        resourceMap.graphState.hasMember(pid),
      );
      const { removed, added } = diffDocumentationLinks(
        resourceMap,
        resourceMap.getDocumentationLinks(),
        normalizedLinks,
      );
      if (!removed.length && !added.length) return resourceMap;

      return resourceMap.mutateGraph(() => {
        removed.forEach(({ metadataNode, dataNode }) => {
          removeDocumentationStatements(resourceMap, metadataNode, dataNode);
        });
        added.forEach(({ metadataNode, dataNode }) => {
          addDocumentationStatements(resourceMap, metadataNode, dataNode);
        });
      });
    }
  }

  return ResourceMapStructureMutation;
});

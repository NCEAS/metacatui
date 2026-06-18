"use strict";

define([
  "rdflib",
  "common/Utilities",
  "common/DataONEXmlUtilities",
  "common/XMLUtilities",
  "common/DateUtilities",
  "common/UrlUtilities",
  "common/ValidationUtilities",
  "common/ValueUtilities",
  "models/resourceMap/GraphMutation",
  "models/resourceMap/GraphNormalization",
  "models/resourceMap/ResourceMapCommon",
  "models/resourceMap/ResourceMapState",
  "models/resourceMap/ResourceMapValidation",
  "models/resourceMap/Provenance",
], (
  rdf,
  Utilities,
  DataONEXML,
  XMLUtilities,
  DateUtilities,
  UrlUtilities,
  ValidationUtilities,
  ValueUtilities,
  GraphMutation,
  GraphNormalization,
  ResourceMapCommon,
  ResourceMapState,
  ResourceMapValidation,
  Provenance,
) => {
  const NAMESPACES = {
    RDF: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    FOAF: "http://xmlns.com/foaf/0.1/",
    DC: "http://purl.org/dc/elements/1.1/",
    ORE: "http://www.openarchives.org/ore/terms/",
    DCTERMS: "http://purl.org/dc/terms/",
    CITO: "http://purl.org/spar/cito/",
    PROV: "http://www.w3.org/ns/prov#",
    PROVONE: "http://purl.dataone.org/provone/2015/01/15/ontology#",
    XSD: "http://www.w3.org/2001/XMLSchema#",
  };

  const RESOURCE_MAP_PID_PREFIX = "resource_map_";

  const { createValidationException, createValidationReport } =
    ValidationUtilities;
  const { ResourceMapConflictError } = ResourceMapCommon;

  const {
    dedupeArray,
    dedupeBy,
    isNonEmptyString,
    normalizeText,
    requireNonEmptyString,
    makeUUID,
  } = ValueUtilities;

  const { getMetacatUIProperty } = Utilities;
  const { ParseError } = XMLUtilities;

  /**
   * Ensure that there is a trailing slash on url, trim whitespace.
   * @param {string} value Candidate base URL.
   * @returns {string|null} Normalized base URL or `null` when invalid.
   */
  function normalizeBase(value) {
    return (
      UrlUtilities.normalizeUrl(value, "", {
        trailingSlash: "ensure",
      }) || null
    );
  }

  /**
   * @typedef {object} ResourceMapMember
   * @property {string} pid DataONE PID for the aggregated object.
   * @property {string} uri Resolve service URI used for that object in the RDF
   * graph.
   * @property {string[]} isDocumentedBy Aggregated PIDs that document this
   * object.
   * @property {string[]} documents Aggregated PIDs documented by this object.
   * @property {string[]} atLocations Raw `prov:atLocation` literals, when
   * present.
   * @property {string[]} displayAtLocations Normalized display paths derived
   * from `prov:atLocation`, when present.
   */

  /**
   * Canonical resource map summary used for cached reads, public reads, JSON
   * output, and helper lookups.
   * @typedef {object} ResourceMapSummary
   * @property {string} resourceMapPid DataONE PID for the resource map object.
   * @property {string} resourceMapUri Canonical RDF URI used for the resource
   * map node.
   * @property {string} aggregationUri Canonical RDF URI used for the
   * aggregation node.
   * @property {string} resolveBase Resolve service base URL used to create
   * object URIs.
   * @property {ResourceMapMember[]} members Normalized aggregated members.
   * @property {string[]} memberPids Aggregated member PIDs.
   * @property {ResMapDocLink[]} documentationLinks Normalized metadata-to-data
   * documentation links.
   * @property {string|null} creatorName Creator name stored on the resource
   * map, when present.
   * @property {string|null} modified Modified timestamp stored on the resource
   * map, when present.
   * @property {Object<string, ResourceMapMember>} membersByPid Normalized
   * members keyed by PID.
   * @property {string[]} metadataPids Unique documenting member PIDs.
   * @property {string[]} documentedObjectPids Unique documented object PIDs.
   * @property {object} provenance Canonical package-level provenance summary.
   */

  /**
   * Parse, edit, validate, and serialize a single DataONE OAI-ORE resource map.
   * This class owns the RDF graph for package membership, package structure
   * links, creator/modified metadata, `prov:atLocation`, and package-level
   * provenance. Package-level provenance may reference external data PIDs that
   * are not aggregated members. Graph mutations that affect derived member
   * reads are expected to go through `ResourceMap` APIs so the cached summary
   * stays consistent. Upon parsing, it normalizes common non-canonical RDF
   * patterns found in real DataONE resource maps into a consistent form for
   * easier member and provenance extraction.
   * The RDF graph is the source of truth for the package. The summary returned
   * by `toJSON()` is a derived read view built from that graph for easier UI
   * and caller use.
   * @class
   * @since 0.0.0
   */
  class ResourceMap {
    /**
     * @param {object} options Constructor options.
     * @param {string} options.resourceMapPid DataONE PID for the resource map
     * object.
     * @param {string} [options.resolveBase] Resolve service base URL used to
     * build member URIs, e.g. `https://cn.dataone.org/cn/v2/resolve/`. If not
     * provided, the base URL will try to be inferred from the graph. Otherwise
     * fall back to a configured MetacatUI resolve URL.
     * @param {string} [options.resolveServiceUrl] Resolve service base URL used
     * when an explicit `resolveBase` is not provided.
     * @param {string} [options.objectServiceUrl] Object-service base URL used
     * only as a parser-base fallback.
     * @param {IndexedFormula} [options.graph] Existing RDF graph to adopt. Used
     * when constructing a ResourceMap from parsed RDF/XML.
     * @param {string} [options.rawData] Original RDF/XML string used to create
     * the graph, when available. Stored for later retrieval and comparison
     * during serialization.
     */
    constructor({
      resourceMapPid,
      resolveBase,
      resolveServiceUrl,
      objectServiceUrl,
      graph,
      rawData,
    } = {}) {
      this.rawData = isNonEmptyString(rawData) ? rawData.trim() : null;

      this.resourceMapPid = requireNonEmptyString(
        resourceMapPid,
        "resourceMapPid required",
      );

      if (graph && typeof graph.add !== "function") {
        throw new Error("ResourceMap requires an rdflib graph instance");
      }

      this.graph = graph || rdf.graph();

      this.resolveServiceUrl = normalizeBase(resolveServiceUrl);
      this.objectServiceUrl = normalizeBase(objectServiceUrl);

      this.namespaces = { ...NAMESPACES };
      this.ns = Object.fromEntries(
        Object.entries(this.namespaces).map(([prefix, uri]) => [
          prefix,
          rdf.Namespace(uri),
        ]),
      );

      // The resolve url is needed to construct the member URIs, e.g.
      // `https://cn.dataone.org/cn/v2/resolve/{pid}`. If not explicitly
      // provided, try to infer it from the graph, then fallback to a configured
      // MetacatUI resolve URL.
      this.resolveBase = this.pickResolveBase({
        resolveBase,
        resolveServiceUrl: this.resolveServiceUrl,
      });

      // In rdf xml, the resource map URI and aggregation URI are used in
      // <rdf:Description rdf:about=""> and <ore:Aggregation rdf:about="">
      // respectively.
      this.resourceMapUri = this.pidToUri(this.resourceMapPid);
      this.aggregationUri = `${this.resourceMapUri}#aggregation`;
      this.graphState = new ResourceMapState({ resourceMap: this });
      this.graphMutationDepth = 0;
      this.unsavedChanges = false;

      this.provenance = new Provenance({ resourceMap: this });

      // Existing graphs may contain malformed but parseable RDF or legacy node
      // shapes. Repair those once at the import boundary before normalizing the
      // managed graph.
      if (graph) {
        this.mutateGraph(() => GraphNormalization.repairBrokenGraph(this), {
          markDirty: false,
          rollbackOnError: true,
        });
      }

      // Initialize the graph with the core triples that we manage.
      this.normalizeGraph();
      this.invalidateGraphState();
      this.unsavedChanges = false;
    }

    /**
     * Pick the parser base URI used by the RDF/XML parser.
     * @param {object} [options] Parse-base options.
     * @param {string} [options.parseBase] Caller-provided parser/document base.
     * @param {string} [options.resolveBase] Caller-provided resolve base.
     * @param {string} [options.resolveServiceUrl] Caller-provided resolve
     * service base.
     * @param {string} [options.objectServiceUrl] Caller-provided object-service
     * base.
     * @returns {string} Normalized parser base URI.
     */
    static pickParseBase({
      parseBase,
      resolveBase,
      resolveServiceUrl,
      objectServiceUrl,
    } = {}) {
      const base =
        normalizeText(parseBase) ||
        normalizeText(resolveBase) ||
        normalizeText(resolveServiceUrl) ||
        normalizeText(objectServiceUrl) ||
        normalizeText(getMetacatUIProperty("resolveServiceUrl")) ||
        normalizeText(getMetacatUIProperty("objectServiceUrl"));

      requireNonEmptyString(base, "parseBase required");

      return normalizeBase(base);
    }

    /**
     * Pick the resolve service base URL used to build DataONE resolve URIs.
     * @param {object} [options] Resolve-base options.
     * @param {string} [options.resolveBase] Explicit caller-provided resolve
     * base.
     * @param {string} [options.resolveServiceUrl] Resolve-service URL used when
     * no explicit resolve base is provided.
     * @returns {string} Normalized resolve base URL.
     */
    pickResolveBase({ resolveBase, resolveServiceUrl } = {}) {
      const base =
        normalizeText(resolveBase) ||
        normalizeText(resolveServiceUrl) ||
        this.inferResolveBase() ||
        normalizeText(getMetacatUIProperty("resolveServiceUrl")) ||
        null;

      requireNonEmptyString(base, "resolveBase required");

      return normalizeBase(base);
    }

    /**
     * Infer a resolve-service base URL from named nodes in an imported graph.
     * This runs during construction, before derived graph state exists.
     * @returns {string|null} Inferred resolve base URL.
     */
    inferResolveBase() {
      if (!this.graph) return null;
      const statements = this?.graph?.statements || [];
      for (let i = 0; i < statements.length; i += 1) {
        const statement = statements[i];
        const values = [statement.subject, statement.object]
          .filter((node) => node?.termType === "NamedNode")
          .map((node) => node.value);
        for (let j = 0; j < values.length; j += 1) {
          const baseUrl = UrlUtilities.extractBaseUrl(values[j], {
            requiredPathSegment: "/resolve/",
            trailingSlash: "ensure",
          });
          if (baseUrl) return baseUrl;
        }
      }
      return null;
    }

    /**
     * Collect `dc:creator` and `dcterms:creator` statements on the resource map
     * node.
     * @param {ResourceMap} resourceMap Resource map whose graph is inspected.
     * @returns {object[]} Creator statements.
     */
    static collectCreatorStatements(resourceMap) {
      const resourceMapNode = rdf.sym(resourceMap.resourceMapUri);
      return [
        ...resourceMap.graph.statementsMatching(
          resourceMapNode,
          resourceMap.ns.DC("creator"),
          undefined,
          undefined,
        ),
        ...resourceMap.graph.statementsMatching(
          resourceMapNode,
          resourceMap.ns.DCTERMS("creator"),
          undefined,
          undefined,
        ),
      ];
    }

    /**
     * Create a new resource map from structured package inputs.
     * @param {object} [options] Structured package values used to seed the
     * graph.
     * @param {string} [options.resourceMapPid] PID assigned to the resource map
     * object. A generated PID is used when omitted.
     * @param {string} [options.resolveBase] Resolve service base URL used to
     * mint member URIs.
     * @param {string} [options.objectServiceUrl] Object-service base URL used
     * for parser/document fallback.
     * @param {string} [options.resolveServiceUrl] Resolve service base URL used
     * as the canonical configuration fallback.
     * @param {Array<{pid: string, atLocations?: string[]}>} [options.members]
     * Aggregated members and their optional `prov:atLocation` values.
     * @param {string[]} [options.memberPids] Convenience shorthand for a plain
     * list of member PIDs without `prov:atLocation` values. Any PID already
     * present in `members` is ignored.
     * @param {ResMapDocLink[]} [options.documentationLinks] Reciprocal CiTO
     * links to create.
     * @param {string} [options.creatorName] Creator name to write onto the map.
     * @param {string|Date} [options.modified] Modified timestamp to store in
     * the format of an xsd:dateTime literal, e.g. `2024-01-01T12:00:00Z`.
     * @param {object} [options.provenance] Provenance summary to project into
     * RDF.
     * @returns {ResourceMap} Newly created resource map instance.
     */
    static create({
      resourceMapPid,
      resolveBase,
      objectServiceUrl,
      resolveServiceUrl,
      members = [],
      memberPids = [],
      documentationLinks = [],
      creatorName,
      modified,
      provenance = {},
    } = {}) {
      const resourceMap = new ResourceMap({
        resourceMapPid:
          resourceMapPid || makeUUID({ prefix: RESOURCE_MAP_PID_PREFIX }),
        resolveBase,
        objectServiceUrl,
        resolveServiceUrl,
      });

      if (isNonEmptyString(creatorName)) {
        resourceMap.setCreatorName(creatorName);
      }

      resourceMap.setModified(modified || new Date().toISOString());
      const memberPidSet = new Set(members.map((m) => m.pid));
      const extraMembers = (memberPids || []).filter(
        (pid) => !memberPidSet.has(pid),
      );
      const allMembers = [...members, ...extraMembers.map((pid) => ({ pid }))];
      resourceMap.setMembers(allMembers.map((member) => member.pid));
      resourceMap.setDocumentationLinks(documentationLinks);

      // Preserve the long-standing DataONE workaround for single-member
      // packages: adding a self-doc link helps DataONE indexers populate the
      // reverse resourceMap lookup for the lone member, especially when the
      // package contains only metadata.
      resourceMap.ensureSoloMemberSelfDocumentation();

      const locatedMembers = allMembers.flatMap(({ pid, atLocations = [] }) => {
        if (!Array.isArray(atLocations)) {
          throw new Error("atLocations must be an array");
        }
        return atLocations.map((location) => ({
          pid,
          location,
        }));
      });
      if (locatedMembers.length) {
        resourceMap.mutateGraph(() => {
          locatedMembers.forEach(({ pid, location }) => {
            const memberNode = rdf.sym(resourceMap.pidToUri(pid));
            GraphMutation.addStatementIfMissing(
              resourceMap,
              memberNode,
              resourceMap.ns.PROV("atLocation"),
              rdf.literal(requireNonEmptyString(location, "Path required")),
            );
          });
        });
      }

      const summary = provenance || {};
      (summary.wasDerivedFrom || []).forEach((relationship) => {
        resourceMap.provenance.addWasDerivedFrom(
          relationship.derivedPid,
          relationship.sourcePid,
        );
      });
      (summary.generatedByPrograms || []).forEach((relationship) => {
        resourceMap.provenance.addGeneratedByProgram(
          relationship.dataPid,
          relationship.programPid,
          relationship,
        );
      });
      (summary.usedByPrograms || []).forEach((relationship) => {
        resourceMap.provenance.addUsedByProgram(
          relationship.dataPid,
          relationship.programPid,
          relationship,
        );
      });
      (summary.wasInformedByPrograms || []).forEach((relationship) => {
        resourceMap.provenance.restoreWasInformedByLink(relationship);
      });
      (summary.typeAssertions || [])
        .filter(
          ({ pid, className }) =>
            ["Data", "Program"].includes(className) &&
            !resourceMap.provenance.hasRole(pid, className),
        )
        .forEach(({ pid, className }) => {
          resourceMap.provenance.addTypeAssertion(pid, className);
        });
      return resourceMap;
    }

    /**
     * Parse RDF/XML into a resource map instance.
     * @param {string} resourceMapPid PID expected for the resource map object.
     * @param {string} resourceMapXml RDF/XML serialization.
     * @param {object} [options] Parse options.
     * @param {string} [options.parseBase] Base URI passed to the RDF parser.
     * @param {string} [options.resolveBase] Resolve base used when graph
     * inference is needed.
     * @returns {ResourceMap} Parsed resource map instance.
     */
    static fromXml(resourceMapPid, resourceMapXml, options = {}) {
      requireNonEmptyString(resourceMapPid, "resourceMapPid required");
      const normalizedXml = requireNonEmptyString(
        resourceMapXml,
        "resourceMapXml required",
      ).trim();

      DataONEXML.parseRequiredDocument(normalizedXml, "ResourceMap XML");

      const graph = rdf.graph();

      const parseBase = this.pickParseBase({
        parseBase: options.parseBase,
        resolveBase: options.resolveBase,
        resolveServiceUrl: options.resolveServiceUrl,
        objectServiceUrl: options.objectServiceUrl,
      });

      try {
        rdf.parse(normalizedXml, graph, parseBase, "application/rdf+xml");
      } catch (error) {
        const msg = error?.message || "Unknown parse error";
        throw new ParseError(`Parse failed: ${msg}`);
      }

      // The constructor repairs the parsed RDF in-place, so malformed and
      // legacy node formats are normalized before callers read the graph.
      const resourceMap = new ResourceMap({
        resourceMapPid,
        graph,
        resolveBase: options.resolveBase,
        objectServiceUrl: options.objectServiceUrl,
        resolveServiceUrl: options.resolveServiceUrl,
        rawData: normalizedXml,
      });

      return resourceMap;
    }

    /**
     * Extract a DataONE PID from a resolve service URI.
     * @param {string} value Candidate URI.
     * @returns {string|null} Decoded PID when the URI matches a DataONE resolve
     * URL.
     * @example uriToPid(".../resolve/data.1") => "data.1"
     */
    static uriToPid(value) {
      const normalized = UrlUtilities.stripFragment(value);
      if (!isNonEmptyString(normalized) || normalized.startsWith("_:")) {
        return null;
      }

      const resolveMatch = normalized.match(
        /^https?:\/\/.+\/resolve\/(?:.+\/)?([^/?#]+)$/i,
      );
      if (!resolveMatch?.[1]) return null;

      const decoded = UrlUtilities.decodeDataONEPidFromPath(resolveMatch[1]);
      return isNonEmptyString(decoded)
        ? decoded
        : normalizeText(resolveMatch[1]);
    }

    /**
     * Test whether a URI is the canonical resolve service URI for a PID.
     * @param {string} value Candidate URI.
     * @param {string} pid Expected PID.
     * @param {object} [options] URI-matching options.
     * @param {boolean} [options.allowFragment] Whether hash fragments are
     * accepted, e.g. `https://cn.dataone.org/cn/v2/resolve/data.1#section1`.
     * @returns {boolean} True when the URI resolves to the expected PID.
     * @example
     * isResolveUriForPid(".../resolve/data.1", "data.1") => true
     * isResolveUriForPid(".../resolve/doi:10.5063/F1+ABC", "doi:10.5063/F1+ABC") => false
     */
    static isResolveUriForPid(value, pid, { allowFragment = true } = {}) {
      const normalizedUri = normalizeText(value);
      const normalizedPid = normalizeText(pid);
      if (
        !isNonEmptyString(normalizedUri) ||
        !isNonEmptyString(normalizedPid)
      ) {
        return false;
      }

      if (!allowFragment && normalizedUri.includes("#")) {
        return false;
      }

      const withoutFragment = UrlUtilities.stripFragment(normalizedUri);
      const resolveMatch = withoutFragment.match(
        /^https?:\/\/.+\/resolve\/(?:.+\/)?([^/?#]+)$/i,
      );
      if (!resolveMatch?.[1]) return false;

      return (
        resolveMatch[1] ===
          UrlUtilities.encodeDataONEPidForPath(normalizedPid) &&
        ResourceMap.uriToPid(normalizedUri) === normalizedPid
      );
    }

    /** @returns {ResourceMapState} Cached derived graph-state manager. */
    getGraphState() {
      return this.graphState;
    }

    /** @returns {ResourceMap} Res map after clearing derived state. */
    invalidateGraphState() {
      this.graphState.invalidate();
      return this;
    }

    /** @returns {ResourceMap} Res map after entering mutation mode. */
    beginGraphMutation() {
      this.graphMutationDepth += 1;
      return this;
    }

    /** @returns {ResourceMap}Res map after leaving mutation mode. */
    endGraphMutation() {
      this.graphMutationDepth = Math.max(0, this.graphMutationDepth - 1);
      return this;
    }

    /** @returns {boolean} Whether a grouped graph mutation is in progress. */
    isGraphMutating() {
      return this.graphMutationDepth > 0;
    }

    /** @returns {boolean} Whether the graph differs from its saved baseline. */
    hasUnsavedChanges() {
      return this.unsavedChanges;
    }

    /**
     * Store the serialized graph as the new saved baseline.
     * @param {string} [resourceMapXml] Saved RDF/XML. Defaults to the current
     * graph serialization.
     * @returns {ResourceMap} Updated resource map instance.
     */
    markSaved(resourceMapXml = this.serializeGraph()) {
      this.rawData = requireNonEmptyString(
        resourceMapXml,
        "ResourceMap XML required",
      ).trim();
      this.unsavedChanges = false;
      return this;
    }

    /**
     * Reparse the saved RDF/XML baseline, discarding unsaved graph changes.
     * @returns {ResourceMap} Fresh resource map restored from `rawData`.
     */
    reparseRawData() {
      if (!isNonEmptyString(this.rawData)) {
        throw new Error("No saved ResourceMap XML available");
      }

      return ResourceMap.fromXml(this.resourceMapPid, this.rawData, {
        resolveBase: this.resolveBase,
        objectServiceUrl: this.objectServiceUrl,
        resolveServiceUrl: this.resolveServiceUrl,
      });
    }

    /** @returns {ResourceMap} Res map after marking the graph as changed. */
    markGraphDirty() {
      this.unsavedChanges = true;
      // Keep the pre-mutation projection stable throughout a grouped mutation.
      // The outer mutation invalidates it once after all graph edits complete.
      if (!this.isGraphMutating()) {
        this.invalidateGraphState();
      }
      return this;
    }

    /**
     * Return a derived package summary.
     * @returns {ResourceMapSummary} Package summary.
     */
    getSummary() {
      return this.getGraphState().getSummary();
    }

    /** @returns {ResourceMapValidationContext} Shared validation inputs. */
    getValidationContext() {
      return this.getGraphState().createValidationContext();
    }

    /** @returns {string[]} Aggregated member PIDs. */
    getMemberPids() {
      return this.getGraphState().getMemberPids();
    }

    /**
     * Return aggregated member summaries.
     * @returns {ResourceMapMember[]} Member summaries.
     */
    getMembers() {
      return this.getSummary().members;
    }

    /**
     * Return one aggregated member summary.
     * @param {string} pid Member PID.
     * @returns {ResourceMapMember|null} Member summary when aggregated.
     */
    getMember(pid) {
      return this.getGraphState().getMember(pid);
    }

    /**
     * Test whether a PID is aggregated.
     * @param {string} pid Candidate member PID.
     * @returns {boolean} Whether the PID is a member.
     */
    hasMember(pid) {
      return this.getGraphState().hasMember(pid);
    }

    /**
     * Aggregate one PID.
     * @param {string} pid PID to add.
     * @returns {ResourceMap} Updated resource map.
     */
    addMember(pid) {
      const normalizedPid = requireNonEmptyString(pid, "PID required");
      const memberUri = this.getNodeUriForPid(normalizedPid);

      return this.mutateGraph(() => {
        const memberNode = rdf.sym(memberUri);
        const aggregationNode = rdf.sym(this.aggregationUri);

        GraphMutation.ensureIdentifierForUri(this, memberUri, normalizedPid);
        GraphMutation.addStatementIfMissing(
          this,
          aggregationNode,
          this.ns.ORE("aggregates"),
          memberNode,
        );
        GraphMutation.addStatementIfMissing(
          this,
          memberNode,
          this.ns.ORE("isAggregatedBy"),
          aggregationNode,
        );
      });
    }

    /**
     * Remove one member and graph references owned by it.
     * @param {string} pid PID to remove.
     * @returns {ResourceMap} Updated resource map.
     */
    removeMember(pid) {
      const normalizedPid = requireNonEmptyString(pid, "PID required");
      const memberUri = this.getGraphState().findNodeUriForPid(normalizedPid);
      if (!memberUri) {
        return this;
      }
      const provenanceRemovals = this.provenance.collectMemberReferenceRemovals(
        new Set([normalizedPid]),
      );

      return this.mutateGraph(
        () => {
          const memberNode = rdf.sym(memberUri);
          this.provenance.applyMemberReferenceRemovals(provenanceRemovals);
          GraphMutation.removeNodeReferences(this, memberNode);
        },
        { removeOrphans: true },
      );
    }

    /**
     * Replace an aggregated PID throughout the managed graph.
     * @param {string} oldPid Existing member PID.
     * @param {string} newPid Replacement member PID.
     * @returns {ResourceMap} Updated resource map.
     * @throws {ResourceMapConflictError} When the replacement PID is already
     * aggregated by a different node.
     */
    replaceMember(oldPid, newPid) {
      const normalizedOldPid = requireNonEmptyString(oldPid, "oldPid required");
      const normalizedNewPid = requireNonEmptyString(newPid, "newPid required");
      if (normalizedOldPid === normalizedNewPid) {
        return this;
      }

      const graphState = this.getGraphState();
      const oldMemberUri = graphState.findNodeUriForPid(normalizedOldPid);
      if (!oldMemberUri) {
        throw new Error(
          `Cannot replace member: "${normalizedOldPid}" is not in this resource map`,
        );
      }

      const existingNewMemberUri =
        graphState.findNodeUriForPid(normalizedNewPid);
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

      return this.mutateGraph(() => {
        const nextMemberUri = this.pidToUri(normalizedNewPid);
        if (nextMemberUri !== oldMemberUri) {
          GraphMutation.replaceNodeValue(this, oldMemberUri, nextMemberUri);
        }

        GraphMutation.setIdentifierForUri(
          this,
          nextMemberUri,
          normalizedNewPid,
          {
            removeValues: [normalizedOldPid],
          },
        );
      });
    }

    /**
     * Replace the complete aggregated-member PID set.
     * @param {string[]} pids Desired member PIDs.
     * @returns {ResourceMap} Updated resource map.
     */
    setMembers(pids) {
      const normalizedPids = dedupeArray(
        (Array.isArray(pids) ? pids : []).map((pid) =>
          requireNonEmptyString(pid, "PID required"),
        ),
      );

      const currentPids = this.getMemberPids();
      const currentPidSet = new Set(currentPids);
      const nextPidSet = new Set(normalizedPids);
      const addedMembers = normalizedPids
        .filter((pid) => !currentPidSet.has(pid))
        .map((pid) => ({ pid, uri: this.getNodeUriForPid(pid) }));
      const removedMembers = currentPids
        .filter((pid) => !nextPidSet.has(pid))
        .map((pid) => ({
          pid,
          uri: this.getGraphState().findNodeUriForPid(pid),
        }));
      const provenanceRemovals = removedMembers.length
        ? this.provenance.collectMemberReferenceRemovals(
            new Set(removedMembers.map(({ pid }) => pid)),
          )
        : null;

      if (removedMembers.length || addedMembers.length) {
        this.mutateGraph(
          () => {
            if (removedMembers.length) {
              this.provenance.applyMemberReferenceRemovals(provenanceRemovals);
              removedMembers.forEach(({ uri }) => {
                GraphMutation.removeNodeReferences(this, rdf.sym(uri));
              });
            }

            const aggregationNode = rdf.sym(this.aggregationUri);
            addedMembers.forEach(({ pid, uri }) => {
              const memberNode = rdf.sym(uri);
              GraphMutation.ensureIdentifierForUri(this, uri, pid);
              GraphMutation.addStatementIfMissing(
                this,
                aggregationNode,
                this.ns.ORE("aggregates"),
                memberNode,
              );
              GraphMutation.addStatementIfMissing(
                this,
                memberNode,
                this.ns.ORE("isAggregatedBy"),
                aggregationNode,
              );
            });
          },
          { removeOrphans: removedMembers.length > 0 },
        );
      }

      return this;
    }

    /** @returns {ResMapDocLink[]} Reciprocal documentation links. */
    getDocumentationLinks() {
      return this.getGraphState().getDocumentationLinks();
    }

    /**
     * Add reciprocal documentation statements between two members.
     * @param {string} metadataPid Documenting metadata PID.
     * @param {string} dataPid Documented member PID.
     * @returns {ResourceMap} Updated resource map.
     */
    linkDocumentation(metadataPid, dataPid) {
      const metadataMember = this.ensurePidNode(metadataPid, {
        requireAggregated: true,
        createIdentifier: true,
        message: "Metadata PID required",
      });
      const dataMember =
        metadataMember.pid ===
        requireNonEmptyString(dataPid, "Data PID required")
          ? metadataMember
          : this.ensurePidNode(dataPid, {
              requireAggregated: true,
              createIdentifier: true,
              message: "Data PID required",
            });

      return this.mutateGraph(() => {
        GraphMutation.addDocumentationLink(
          this,
          metadataMember.node,
          dataMember.node,
        );
      });
    }

    /**
     * Remove reciprocal documentation statements between two members.
     * @param {string} metadataPid Documenting metadata PID.
     * @param {string} dataPid Documented member PID.
     * @returns {ResourceMap} Updated resource map.
     */
    unlinkDocumentation(metadataPid, dataPid) {
      const normalizedMetadataPid = requireNonEmptyString(
        metadataPid,
        "Metadata PID required",
      );
      const normalizedDataPid = requireNonEmptyString(
        dataPid,
        "Data PID required",
      );
      const metadataUri = this.getNodeUriForPid(normalizedMetadataPid);
      const dataUri = this.getNodeUriForPid(normalizedDataPid);

      return this.mutateGraph(() => {
        GraphMutation.removeDocumentationLink(
          this,
          rdf.sym(metadataUri),
          rdf.sym(dataUri),
        );
      });
    }

    /**
     * Replace the complete reciprocal documentation-link set.
     * @param {ResMapDocLink[]} links Desired documentation links.
     * @returns {ResourceMap} Updated resource map.
     */
    setDocumentationLinks(links) {
      const normalizedLinks = dedupeBy(
        (Array.isArray(links) ? links : []).map((link) => ({
          metadataPid: requireNonEmptyString(
            link?.metadataPid,
            "Metadata PID required",
          ),
          dataPid: requireNonEmptyString(link?.dataPid, "Data PID required"),
        })),
        ({ metadataPid, dataPid }) =>
          ResourceMapCommon.buildKey([metadataPid, dataPid]),
      );

      normalizedLinks.forEach(({ metadataPid, dataPid }) => {
        if (!this.hasMember(metadataPid)) {
          throw new Error(`Metadata "${metadataPid}" is not aggregated`);
        }
        if (!this.hasMember(dataPid)) {
          throw new Error(`Data "${dataPid}" is not aggregated`);
        }
      });

      const currentByKey = new Map(
        this.getDocumentationLinks().map((link) => [
          ResourceMapCommon.buildKey([link.metadataPid, link.dataPid]),
          link,
        ]),
      );
      const nextByKey = new Map(
        normalizedLinks.map((link) => [
          ResourceMapCommon.buildKey([link.metadataPid, link.dataPid]),
          link,
        ]),
      );
      const removedKeys = [...currentByKey.keys()].filter(
        (key) => !nextByKey.has(key),
      );
      const addedKeys = [...nextByKey.keys()].filter(
        (key) => !currentByKey.has(key),
      );
      if (!removedKeys.length && !addedKeys.length) {
        return this;
      }

      const nodePairsByKey = new Map(
        [...removedKeys, ...addedKeys].map((key) => {
          const link = currentByKey.get(key) || nextByKey.get(key);
          return [
            key,
            {
              metadataNode: rdf.sym(this.getNodeUriForPid(link.metadataPid)),
              dataNode: rdf.sym(this.getNodeUriForPid(link.dataPid)),
            },
          ];
        }),
      );

      this.mutateGraph(() => {
        removedKeys.forEach((key) => {
          const { metadataNode, dataNode } = nodePairsByKey.get(key);
          GraphMutation.removeDocumentationLink(this, metadataNode, dataNode);
        });
        addedKeys.forEach((key) => {
          const { metadataNode, dataNode } = nodePairsByKey.get(key);
          GraphMutation.addDocumentationLink(this, metadataNode, dataNode);
        });
      });

      return this;
    }

    /** @returns {string[]} Unique documenting metadata PIDs. */
    getMetadataPids() {
      return this.getGraphState().getMetadataPids();
    }

    /** @returns {string[]} Unique documented member PIDs. */
    getDocumentedObjectPids() {
      return this.getGraphState().getDocumentedObjectPids();
    }

    /**
     * Add the DataONE self-documentation fallback for a one-member package.
     * @returns {ResourceMap} Updated resource map.
     */
    ensureSoloMemberSelfDocumentation() {
      if (this.getDocumentationLinks().length) {
        return this;
      }

      const memberPids = this.getMemberPids();
      if (memberPids.length !== 1) {
        return this;
      }

      const [pid] = memberPids;
      return this.linkDocumentation(pid, pid);
    }

    /**
     * Replace all `prov:atLocation` values for one member.
     * @param {string} pid Aggregated member PID.
     * @param {string} path Raw location value.
     * @returns {ResourceMap} Updated resource map.
     */
    setLocation(pid, path) {
      const member = this.ensurePidNode(pid, {
        requireAggregated: true,
        createIdentifier: true,
        message: "Member PID required",
      });
      const rawPath = requireNonEmptyString(path, "Path required");

      return this.mutateGraph(() => {
        GraphMutation.removeStatementsMatching(
          this,
          member.node,
          this.ns.PROV("atLocation"),
          undefined,
        );
        GraphMutation.addStatementIfMissing(
          this,
          member.node,
          this.ns.PROV("atLocation"),
          rdf.literal(rawPath),
        );
      });
    }

    /**
     * Remove one matching location, or every location when no path is given.
     * @param {string} pid Member PID.
     * @param {string} [path] Specific raw location value to remove.
     * @returns {ResourceMap} Updated resource map.
     */
    removeLocation(pid, path) {
      const normalizedPid = this.requireExistingMemberPid(
        pid,
        "Member PID required",
      );
      const memberUri = this.getNodeUriForPid(normalizedPid);
      const normalizedPath =
        path === undefined || path === null
          ? null
          : requireNonEmptyString(path, "Path required");

      return this.mutateGraph(() => {
        if (normalizedPath) {
          this.graph
            .statementsMatching(
              rdf.sym(memberUri),
              this.ns.PROV("atLocation"),
              undefined,
              undefined,
            )
            .filter(
              (statement) =>
                normalizeText(statement.object?.value) === normalizedPath,
            )
            .forEach((statement) => {
              GraphMutation.removeStatement(this, statement);
            });
          return;
        }

        GraphMutation.removeStatementsMatching(
          this,
          rdf.sym(memberUri),
          this.ns.PROV("atLocation"),
          undefined,
        );
      });
    }

    /**
     * Change the resource map PID and update the managed core triples.
     * @param {string} pid Replacement PID for the resource map object.
     * @returns {ResourceMap} Updated resource map instance.
     */
    setResourceMapPid(pid) {
      const normalizedPid = requireNonEmptyString(pid, "PID required");
      if (normalizedPid === this.resourceMapPid) return this;

      return this.mutateGraph(() => {
        const oldResourceMapPid = this.resourceMapPid;
        const oldResourceMapUri = this.resourceMapUri;
        const oldAggregationUri = this.aggregationUri;

        this.resourceMapPid = normalizedPid;
        this.resourceMapUri = this.pidToUri(normalizedPid);
        this.aggregationUri = `${this.resourceMapUri}#aggregation`;

        GraphMutation.replaceNodeValue(
          this,
          oldResourceMapUri,
          this.resourceMapUri,
        );
        GraphMutation.replaceNodeValue(
          this,
          oldAggregationUri,
          this.aggregationUri,
        );
        GraphMutation.setIdentifierForUri(
          this,
          this.resourceMapUri,
          normalizedPid,
          {
            removeValues: [oldResourceMapPid],
          },
        );
      });
    }

    /**
     * Set or update the creator name while preserving the existing creator
     * node.
     * @param {string} creatorName Creator name to write into the graph.
     * @returns {ResourceMap} Updated resource map instance.
     */
    setCreatorName(creatorName) {
      const normalizedCreatorName = ValueUtilities.requireNonEmptyString(
        creatorName,
        "Creator required",
      ).trim();
      const creatorStatements = ResourceMap.collectCreatorStatements(this);
      const creatorPredicates = dedupeArray(
        creatorStatements
          .map((statement) => statement.predicate?.value)
          .filter(Boolean),
      );
      const creatorNode =
        creatorStatements.find(
          (statement) => statement.object?.termType !== "Literal",
        )?.object || rdf.blankNode();

      return this.mutateGraph(() => {
        creatorStatements
          .filter((statement) => statement.object?.termType === "Literal")
          .forEach((statement) => {
            GraphMutation.removeStatement(this, statement);
          });

        // Preserve the existing creator predicate style in the XML when we can
        // so editing a name does not also rewrite `dc:` vs `dcterms:` usage.
        (creatorPredicates.length
          ? creatorPredicates.map((predicateValue) => rdf.sym(predicateValue))
          : [this.ns.DC("creator")]
        ).forEach((creatorPredicate) => {
          GraphMutation.addStatementIfMissing(
            this,
            rdf.sym(this.resourceMapUri),
            creatorPredicate,
            creatorNode,
          );
        });

        GraphMutation.removeStatementsMatching(
          this,
          creatorNode,
          this.ns.FOAF("name"),
          undefined,
        );
        GraphMutation.addStatementIfMissing(
          this,
          creatorNode,
          this.ns.FOAF("name"),
          rdf.literal(normalizedCreatorName, undefined, this.ns.XSD("string")),
        );
        GraphMutation.addStatementIfMissing(
          this,
          creatorNode,
          this.ns.RDF("type"),
          this.ns.DCTERMS("Agent"),
        );
      });
    }

    /**
     * Set the resource map modified timestamp.
     * @param {string|Date} modified ISO timestamp or `Date`.
     * @returns {ResourceMap} Updated resource map instance.
     */
    setModified(modified) {
      const normalizedModified =
        modified instanceof Date
          ? DateUtilities.toISOString(modified)
          : ValueUtilities.normalizeText(modified);

      ValueUtilities.requireNonEmptyString(
        normalizedModified,
        "Modified required",
      );

      return this.mutateGraph(() => {
        const resourceMapNode = rdf.sym(this.resourceMapUri);
        GraphMutation.removeStatementsMatching(
          this,
          resourceMapNode,
          this.ns.DCTERMS("modified"),
          undefined,
        );
        GraphMutation.removeStatementsMatching(
          this,
          resourceMapNode,
          this.ns.DC("modified"),
          undefined,
        );
        GraphMutation.addStatementIfMissing(
          this,
          resourceMapNode,
          this.ns.DCTERMS("modified"),
          rdf.literal(normalizedModified, this.ns.XSD("dateTime")),
        );
      });
    }

    /**
     * Validate the package against the DataONE resource map rules implemented
     * by this model.
     * @returns {object[]} Validation issues.
     */
    validate() {
      return ResourceMapValidation.validateResourceMap(this);
    }

    /**
     * Explicitly normalize the managed package graph in place. When a package
     * has exactly one remaining member and no documentation links, adds the
     * self-documenting CiTO pair that older callers previously got implicitly
     * during serialization.
     * @param {object} [options] Normalization options.
     * @param {boolean} [options.markDirty] Mark normalization changes unsaved.
     * @returns {ResourceMap} Updated resource map instance.
     */
    normalize({ markDirty = false } = {}) {
      try {
        // Keep the graph in the XML shape that historically works best with
        // DataONE indexing for one-member packages before normalizing it.
        this.ensureSoloMemberSelfDocumentation();
        this.normalizeGraph({ markDirty });
        return this;
      } catch (error) {
        const msg = error?.message || "Unknown normalization error";
        throw new Error(`Normalize failed: ${msg}`);
      }
    }

    /**
     * Serialize the current graph to RDF/XML.
     * @param {object} [options] Serialization options.
     * @param {boolean} [options.validate] Throw when validation errors remain
     * in the current graph.
     * @returns {string} RDF/XML serialization of the current graph.
     */
    serialize({ validate = true } = {}) {
      if (validate) {
        const validationErrors = this.validate();
        if (!createValidationReport(validationErrors).valid) {
          throw createValidationException(
            "ResourceMap validation failed",
            validationErrors,
          );
        }
      }

      return this.serializeGraph();
    }

    /**
     * Convert the current package state into a plain JSON summary.
     * @param {object} [options] JSON options.
     * @param {string[]} [options.excludeFields] Top-level summary fields to
     * remove from the returned summary.
     * @returns {ResourceMapSummary} Plain JSON summary of the current resource
     * map state.
     */
    toJSON(options = {}) {
      const { excludeFields = [] } = options || {};
      const summary = this.getSummary();
      if (Array.isArray(excludeFields) && excludeFields.length > 0) {
        excludeFields.forEach((field) => {
          delete summary[field];
        });
      }
      return summary;
    }

    /**
     * Convert a PID into a canonical resolve service URI.
     * @param {string} pid PID to encode as a resolve service URI.
     * @returns {string} Canonical resolve URI for the PID.
     */
    pidToUri(pid) {
      const normalizedPid = requireNonEmptyString(pid, "PID required");
      const resolveBase = requireNonEmptyString(
        this.resolveBase,
        "resolveBase required",
      );
      return UrlUtilities.buildUrl(
        resolveBase,
        UrlUtilities.encodeDataONEPidForPath(normalizedPid),
        { encodePath: false },
      );
    }

    /**
     * Resolve the URI currently used for a PID in the graph, or the canonical
     * resolve URI if the PID is not yet present.
     * @param {string} pid PID whose current RDF subject URI should be resolved.
     * @returns {string} Existing graph URI or the canonical resolve URI.
     */
    getNodeUriForPid(pid) {
      const normalizedPid = requireNonEmptyString(pid, "PID required");
      return (
        this.getGraphState().findNodeUriForPid(normalizedPid) ||
        this.pidToUri(normalizedPid)
      );
    }

    /**
     * Require that a PID is non-empty and currently aggregated.
     * @private
     * @param {string} pid PID to validate.
     * @param {string} message Error message used when validation fails.
     * @returns {string} Normalized aggregated PID.
     */
    requireExistingMemberPid(pid, message) {
      const normalizedPid = requireNonEmptyString(pid, message);
      if (!this.hasMember(normalizedPid)) {
        throw new Error(`${message}: "${normalizedPid}" is not aggregated`);
      }
      return normalizedPid;
    }

    /**
     * Resolve or create the RDF node used for a PID.
     * @private
     * @param {string} pid PID to resolve.
     * @param {object} [options] Node-resolution options.
     * @param {boolean} [options.requireAggregated] Whether the PID must already
     * be aggregated.
     * @param {boolean} [options.createIdentifier] Whether a
     * `dcterms:identifier` should be ensured.
     * @param {string} [options.message] Error message used when the PID is
     * invalid.
     * @returns {{pid: string, uri: string, node: NamedNode}} Resolved PID-node
     * summary whose `uri` is the current RDF subject URI for that PID.
     */
    ensurePidNode(
      pid,
      {
        requireAggregated = false,
        createIdentifier = false,
        message = "PID required",
      } = {},
    ) {
      const normalizedPid = requireAggregated
        ? this.requireExistingMemberPid(pid, message)
        : requireNonEmptyString(pid, message);
      const uri = GraphMutation.ensureNodeUriForPid(this, normalizedPid, {
        createIdentifier,
      });

      // Return the current RDF subject URI after canonicalization so callers
      // mutate the same node that will later be serialized back to XML.
      return {
        pid: normalizedPid,
        uri,
        node: rdf.sym(uri),
      };
    }

    /**
     * Apply a graph mutation with consistent pre/post bookkeeping. Use it for
     * one grouped custom RDF edit when the higher-level `ResourceMap` methods
     * are not enough.
     * @param {Function} mutator Graph mutation callback.
     * @param {object} [options] Mutation bookkeeping options.
     * @param {boolean} [options.removeOrphans] Remove orphaned blank nodes
     * after mutation. Graph mutations that affect derived JSON reads should
     * flow through this method or other `ResourceMap` APIs so the cached
     * summary stays coherent.
     * @param {boolean} [options.markDirty] Mark a successful outer mutation
     * unsaved. When false, preserve the previous dirty state.
     * @param {boolean} [options.rollbackOnError] Restore the graph if the
     * outermost mutation throws.
     * @returns {ResourceMap} Updated resource map instance.
     */
    mutateGraph(
      mutator,
      { removeOrphans = false, markDirty = true, rollbackOnError = false } = {},
    ) {
      // True only for the outermost graph mutation, which is responsible for
      // snapshotting, rollback, and unsaved-change tracking across the entire
      // nested mutation chain.
      const isOuterMutation = !this.isGraphMutating();
      const shouldRollback = isOuterMutation && rollbackOnError;
      const previousStatements = shouldRollback
        ? this.graph.statements.slice()
        : null;
      const previousResourceMapPid = this.resourceMapPid;
      const previousResourceMapUri = this.resourceMapUri;
      const previousAggregationUri = this.aggregationUri;
      const previousUnsavedChanges = this.unsavedChanges;

      this.beginGraphMutation();
      try {
        mutator();

        if (removeOrphans) {
          GraphMutation.removeOrphanedBlankNodes(this);
        }
        if (isOuterMutation) {
          this.unsavedChanges = markDirty ? true : previousUnsavedChanges;
        }
      } catch (error) {
        if (shouldRollback) {
          this.graph.statements.slice().forEach((statement) => {
            this.graph.remove(statement);
          });
          previousStatements.forEach((statement) => {
            this.graph.add(
              statement.subject,
              statement.predicate,
              statement.object,
              statement.why,
            );
          });
          this.resourceMapPid = previousResourceMapPid;
          this.resourceMapUri = previousResourceMapUri;
          this.aggregationUri = previousAggregationUri;
          this.unsavedChanges = previousUnsavedChanges;
        } else if (isOuterMutation) {
          this.unsavedChanges = true;
        }
        throw error;
      } finally {
        if (isOuterMutation) {
          this.invalidateGraphState();
        }
        this.endGraphMutation();
      }

      return this;
    }

    /**
     * Serialize the current RDF graph without additional validation or
     * normalization. Converts the current rdflib graph directly into an XML
     * string.
     * @private
     * @returns {string} Raw RDF/XML serialization.
     */
    serializeGraph() {
      const serializer = rdf.Serializer();
      serializer.store = this.graph;
      // Data/Program ProvONE types are derived from provenance edges and are
      // not persisted in the live graph. Materialize them into the serialized
      // output so resource maps carry the typing that the DataONE indexer and
      // other ProvONE tools expect, without mutating the editing graph.
      const rdfType = this.ns.RDF("type").value;
      const oreAggregation = this.ns.ORE("Aggregation").value;
      // Keep the submitted XML aligned with the legacy DataONE payload, which
      // omits the explicit ore:Aggregation type for the aggregation node.
      const statements = this.graph.statements
        .filter(
          (statement) =>
            !(
              statement.subject?.value === this.aggregationUri &&
              statement.predicate?.value === rdfType &&
              statement.object?.value === oreAggregation
            ),
        )
        .concat(this.deriveRoleTypeStatements());
      return serializer.statementsToXML(statements);
    }

    /**
     * Build the derived ProvONE Data/Program `rdf:type` statements like "X
     * prov:hadRole Data" or "Y prov:hadRole Program" for every node that plays
     * those roles as defined by the provenance edges in the graph. These
     * statements are not stored in the live graph but are derived for
     * serialization only.
     * @private
     * @returns {Array<object>} Derived RDF type statements for serialization.
     */
    deriveRoleTypeStatements() {
      const graphState = this.getGraphState();
      const statements = [];
      const existingTypeKeys = new Set(
        this.graph
          .statementsMatching(undefined, this.ns.RDF("type"), undefined)
          .map(ResourceMapCommon.statementKey),
      );
      ["Data", "Program"].forEach((className) => {
        const classNode = this.ns.PROVONE(className);
        graphState.getRolePidSet(className).forEach((pid) => {
          const uri = graphState.findNodeUriForPid(pid);
          if (!uri) {
            return;
          }
          const subject = rdf.sym(uri);
          const statement = rdf.st(subject, this.ns.RDF("type"), classNode);
          const statementKey = ResourceMapCommon.statementKey(statement);
          if (!existingTypeKeys.has(statementKey)) {
            existingTypeKeys.add(statementKey);
            statements.push(statement);
          }
        });
      });
      return statements;
    }

    /**
     * Synchronize and normalize the graph and provenance in place. This
     * includes deduping statements, ensuring the core graph shape is consistent
     * with the current member PID set, and normalizing provenance references to
     * match the current graph state.
     * @param {object} [options] Normalization options.
     * @param {boolean} [options.markDirty] Mark normalization changes unsaved.
     * @returns {ResourceMap} Updated resource map instance.
     * @private
     */
    normalizeGraph({ markDirty = false } = {}) {
      const memberPids = this.getMemberPids();
      this.mutateGraph(
        () => {
          GraphNormalization.synchronizeCoreGraph(this, memberPids);
          GraphNormalization.dedupeStatements(this);
        },
        { markDirty, rollbackOnError: true },
      );
      this.provenance.normalize({ markDirty });
      return this;
    }

    /**
     * Normalize a stored `prov:atLocation` value for display without mutating
     * the underlying graph value. e.g. ./data/../file.csv => file.csv.
     * @param {string} path Raw path-like value from the RDF graph.
     * @returns {string} Display-friendly path string.
     */
    static normalizeAtLocationForDisplay(path) {
      const normalizedPath = normalizeText(path) || "";
      if (!normalizedPath) {
        return "/";
      }

      if (
        normalizedPath.startsWith("/") ||
        normalizedPath.startsWith("\\") ||
        normalizedPath.includes("\\") ||
        normalizedPath.includes("://") ||
        /^[A-Za-z]:[\\/]/.test(normalizedPath)
      ) {
        return normalizedPath;
      }

      const resolvedPath = [];

      normalizedPath.split("/").forEach((component, index) => {
        if (
          component === "" ||
          component === "." ||
          (component === "~" && index === 0)
        ) {
          return;
        }

        if (component === "..") {
          // Display normalization behaves like a relative-path collapse, but it
          // never mutates the raw prov:atLocation literal stored in the graph.
          if (resolvedPath.length) {
            resolvedPath.pop();
          }
          return;
        }

        resolvedPath.push(component);
      });

      return resolvedPath.join("/") || "/";
    }
  }

  /** Namespace URIs used by {@link ResourceMap} and its helper modules. */
  ResourceMap.NAMESPACES = { ...NAMESPACES };
  ResourceMap.RESOURCE_MAP_PID_PREFIX = RESOURCE_MAP_PID_PREFIX;

  return ResourceMap;
});

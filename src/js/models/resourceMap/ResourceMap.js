"use strict";

define([
  "common/DataONEXmlUtilities",
  "common/XMLUtilities",
  "common/DateUtilities",
  "common/UrlUtilities",
  "common/ValidationUtilities",
  "common/ValueUtilities",
  "models/resourceMap/RDFGraph",
  "models/resourceMap/ResourceMapNormalization",
  "models/resourceMap/ResourceMapCommon",
  "models/resourceMap/ResourceMapState",
  "models/resourceMap/ResourceMapStructureMutation",
  "models/resourceMap/ResourceMapValidation",
  "models/resourceMap/Provenance",
], (
  DataONEXML,
  XMLUtilities,
  DateUtilities,
  UrlUtilities,
  ValidationUtilities,
  ValueUtilities,
  RDFGraph,
  ResourceMapNormalization,
  ResourceMapCommon,
  ResourceMapState,
  ResourceMapStructureMutation,
  ResourceMapValidation,
  Provenance,
) => {
  const { createValidationException, createValidationReport } =
    ValidationUtilities;
  const { isNonEmptyString, normalizeText, requireNonEmptyString, makeUUID } =
    ValueUtilities;
  const { ResourceMapConflictError } = ResourceMapCommon;

  const { ParseError } = XMLUtilities;

  /**
   * Trim a service URL and ensure it ends with a slash.
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
   * A relationship between metadata and the data it documents. RDF stores the
   * relationship in both directions, and both objects must be package members.
   * @typedef {object} ResMapDocLink
   * @property {string} metadataPid Documenting metadata PID
   * @property {string} dataPid Documented member PID
   */

  /**
   * One package member supplied when creating a new Resource Map.
   * @typedef {object} ResourceMapCreateMember
   * @property {string} pid DataONE PID for the member
   * @property {string[]} [atLocations] Original storage locations or paths
   */

  /**
   * @typedef {object} ResourceMapMember
   * @property {string} pid DataONE PID for the package member.
   * @property {string} uri Exact URI used for the member in the RDF graph.
   * @property {string[]} isDocumentedBy PIDs of package members that document
   * this object.
   * @property {string[]} documents PIDs of package members documented by this
   * object.
   * @property {string[]} atLocations Original storage locations or paths from
   * `prov:atLocation`, when present.
   */

  /**
   * Plain package summary used by callers and JSON output.
   * @typedef {object} ResourceMapSummary
   * @property {string} resourceMapPid DataONE PID for the resource map object.
   * @property {string} resourceMapUri Exact RDF URI for the Resource Map
   * document.
   * @property {string} aggregationUri Exact RDF URI for the package described by
   * the Resource Map.
   * @property {string} resolveServiceUrl Resolve service base URL used to
   * create object URIs
   * @property {ResourceMapMember[]} members Package members.
   * @property {ResMapDocLink[]} documentationLinks Links from metadata to the
   * data it documents.
   * @property {string|null} creatorName Creator name stored on the resource
   * map, when present.
   * @property {string|null} modified Modified timestamp stored on the resource
   * map, when present.
   * @property {object} provenance Package history and program relationships.
   */

  /**
   * Read, edit, validate, and serialize one DataONE Resource Map. A Resource Map
   * is an RDF document that lists a package's members and describes
   * relationships among them.
   *
   * This class stores the original RDF graph, including membership, links from
   * metadata to data, locations, creator and modified values, and package
   * history. Callers should edit through ResourceMap methods so cached package
   * summaries stay in sync. Imported graphs are repaired only when the graph
   * determines the intended statement without guessing. The graph remains the
   * source of truth. `getSummary()` gives the UI a simpler view that cannot
   * change the graph.
   * @class
   * @classcategory Models/ResourceMap
   * @since 0.0.0
   */
  class ResourceMap {
    /**
     * @param {object} options Constructor options.
     * @param {string} options.resourceMapPid DataONE PID for the resource map
     * object.
     * @param {string} options.resolveServiceUrl Resolve service base URL used
     * to create URIs for new nodes
     * @param {string} [options.objectServiceUrl] Object service base used only
     * to recognize exact managed Resource Map and member URLs
     * @param {IndexedFormula|RDFGraph} [options.graph] Existing RDF graph to
     * adopt. Used when constructing a ResourceMap from parsed RDF/XML
     */
    constructor({
      resourceMapPid,
      resolveServiceUrl,
      objectServiceUrl,
      graph,
    } = {}) {
      this.resourceMapPid = requireNonEmptyString(
        resourceMapPid,
        "resourceMapPid required",
      );

      this.resolveServiceUrl = requireNonEmptyString(
        normalizeBase(
          requireNonEmptyString(
            resolveServiceUrl,
            "resolveServiceUrl required",
          ),
        ),
        "resolveServiceUrl required",
      );
      this.objectServiceUrl = normalizeBase(objectServiceUrl);

      const hasSuppliedGraph = graph !== undefined && graph !== null;
      this.graph =
        graph instanceof RDFGraph ? graph : new RDFGraph(graph || undefined);

      this.ns = ResourceMapCommon.NS;

      const selectedRoot = hasSuppliedGraph
        ? ResourceMapNormalization.selectImportedRoot(
            this.graph,
            this.resourceMapPid,
          )
        : null;
      if (selectedRoot) {
        this.resourceMapUri = selectedRoot.resourceMapUri;
        this.aggregationUri = selectedRoot.aggregationUri;
      } else {
        // Only a new Resource Map may create its document and aggregation URIs.
        // An imported graph must already identify one exact pair.
        this.resourceMapUri = this.pidToUri(this.resourceMapPid);
        this.aggregationUri = `${this.resourceMapUri}#aggregation`;
      }
      this.graphState = new ResourceMapState({ resourceMap: this });
      this.graphMutationDepth = 0;
      this.unsavedChanges = false;

      this.provenance = new Provenance({ resourceMap: this });
      this.structureMutation = new ResourceMapStructureMutation({
        resourceMap: this,
      });
      this.normalization = new ResourceMapNormalization({
        resourceMap: this,
      });

      let identity = null;
      if (hasSuppliedGraph) {
        // Compare every imported PID claim before any repair or cached summary
        // can add the expected PID and hide a contradiction.
        identity = ResourceMapValidation.inspectRawIdentity(this);
        if (!identity.issues.length) {
          this.mutateGraph(
            () =>
              this.normalization.repairImportedGraph(
                identity,
                selectedRoot.recoveredFromInverse,
              ),
            { markDirty: false, rollbackOnError: true },
          );
        }
      }

      if (!hasSuppliedGraph || !identity.issues.length) {
        this.normalizeGraph();
      }
      this.unsavedChanges = false;
    }

    /**
     * Build the default upload filename for a resource map PID.
     * @param {string} pid Resource map PID
     * @returns {string} Resource map filename
     */
    static defaultFileName(pid) {
      return `${pid.replace(/[^a-zA-Z0-9]/g, "_")}.rdf.xml`;
    }

    /**
     * Create a new Resource Map from a list of members and package
     * relationships.
     * @param {object} [options] Structured package values used to seed the
     * graph.
     * @param {string} [options.resourceMapPid] PID assigned to the resource map
     * object. A generated PID is used when omitted.
     * @param {string} options.resolveServiceUrl Resolve service base URL used
     * to create member URIs
     * @param {string} [options.objectServiceUrl] Object service base used only
     * to recognize exact managed URLs
     * @param {Array.<ResourceMapCreateMember>} [options.members] Package members
     * and their optional original storage locations or paths.
     * @param {string[]} [options.memberPids] Convenience shorthand for a plain
     * list of member PIDs without `prov:atLocation` values. Any PID already
     * present in `members` is ignored.
     * @param {ResMapDocLink[]} [options.documentationLinks] Links from metadata
     * to documented data
     * @param {string} [options.creatorName] Creator name to write onto the map.
     * @param {string|Date} [options.modified] Modified timestamp to store in
     * the format of an xsd:dateTime literal, e.g. `2024-01-01T12:00:00Z`.
     * @returns {ResourceMap} Newly created resource map instance.
     */
    static create({
      resourceMapPid,
      resolveServiceUrl,
      objectServiceUrl,
      members = [],
      memberPids = [],
      documentationLinks = [],
      creatorName,
      modified,
    } = {}) {
      const resourceMap = new ResourceMap({
        resourceMapPid:
          resourceMapPid ||
          makeUUID({ prefix: ResourceMap.RESOURCE_MAP_PID_PREFIX }),
        resolveServiceUrl,
        objectServiceUrl,
      });

      if (isNonEmptyString(creatorName)) {
        const resourceMapNode = RDFGraph.createNamedNode(
          resourceMap.resourceMapUri,
        );
        const creatorNode = RDFGraph.createBlankNode();
        resourceMap.mutateGraph(() => {
          resourceMap.graph.addStatementIfMissing({
            subject: resourceMapNode,
            predicate: resourceMap.ns.DC("creator"),
            object: creatorNode,
          });
          resourceMap.graph.addStatementIfMissing({
            subject: creatorNode,
            predicate: resourceMap.ns.FOAF("name"),
            object: RDFGraph.createLiteral(
              requireNonEmptyString(creatorName, "Creator required"),
              undefined,
              resourceMap.ns.XSD("string"),
            ),
          });
          resourceMap.graph.addStatementIfMissing({
            subject: creatorNode,
            predicate: resourceMap.ns.RDF("type"),
            object: resourceMap.ns.DCTERMS("Agent"),
          });
        });
      }

      resourceMap.setModified(modified || new Date().toISOString());
      resourceMap.setPackageStructure(
        [...members.map((member) => member.pid), ...(memberPids || [])],
        documentationLinks,
      );

      resourceMap.setMemberLocations(
        members.filter((member) => member.atLocations !== undefined),
      );
      return resourceMap;
    }

    /**
     * Parse an RDF/XML Resource Map and preserve its exact RDF identities.
     * @param {string} resourceMapPid PID expected for the resource map object.
     * @param {string} resourceMapXml RDF/XML serialization.
     * @param {object} options Parse options
     * @param {string} options.resolveServiceUrl Current DataONE resolve service
     * base used to create new nodes
     * @param {string} [options.objectServiceUrl] Current object service base used
     * only to recognize exact managed URLs
     * @returns {ResourceMap} Parsed resource map instance.
     */
    static fromXml(resourceMapPid, resourceMapXml, options = {}) {
      requireNonEmptyString(resourceMapPid, "resourceMapPid required");
      const resolveServiceUrl = requireNonEmptyString(
        options.resolveServiceUrl,
        "resolveServiceUrl required",
      );
      const normalizedXml = requireNonEmptyString(
        resourceMapXml,
        "resourceMapXml required",
      );

      DataONEXML.parseRequiredDocument(normalizedXml, "ResourceMap XML");

      const graph = new RDFGraph();

      try {
        // Do not use the deployment URL or fetch URL as the RDF base. An
        // explicit absolute xml:base still applies. Without one, relative
        // identities remain relative and validation blocks editing.
        graph.parseXml(normalizedXml, "");
      } catch (error) {
        throw new ParseError(
          `Parse failed: ${error?.message || "Unknown parse error"}`,
        );
      }

      return new ResourceMap({
        resourceMapPid,
        graph,
        resolveServiceUrl,
        objectServiceUrl: options.objectServiceUrl,
      });
    }

    /** @returns {boolean} Whether a grouped graph mutation is in progress. */
    isGraphMutating() {
      return this.graphMutationDepth > 0;
    }

    /** @returns {boolean} Whether the graph has changed since loading or save. */
    hasUnsavedChanges() {
      return this.unsavedChanges;
    }

    /** @returns {ResourceMap} Resource map with a cleared dirty flag. */
    markSaved() {
      this.unsavedChanges = false;
      return this;
    }

    /**
     * Add the DataONE PID identifier to an RDF resource if it is missing.
     * @param {string} uri RDF subject URI
     * @param {string} pid DataONE PID
     * @returns {ResourceMap} Updated resource map
     */
    ensureIdentifierForUri(uri, pid) {
      const node = RDFGraph.createNamedNode(
        requireNonEmptyString(uri, "URI required"),
      );
      const normalizedPid = requireNonEmptyString(pid, "PID required");
      this.graph.addStatementIfMissing({
        subject: node,
        predicate: this.ns.DCTERMS("identifier"),
        object: RDFGraph.createLiteral(
          normalizedPid,
          undefined,
          this.ns.XSD("string"),
        ),
      });
      return this;
    }

    /**
     * Add a DataONE PID identifier and remove specified obsolete identifiers
     * from an RDF resource.
     * @param {string} uri RDF subject URI
     * @param {string} pid DataONE PID
     * @param {object} [options] Identifier update options
     * @param {string[]} [options.removeValues] Identifier values to remove
     * @returns {ResourceMap} Updated resource map
     */
    setIdentifierForUri(uri, pid, { removeValues = [] } = {}) {
      const node = RDFGraph.createNamedNode(
        requireNonEmptyString(uri, "URI required"),
      );
      const normalizedPid = requireNonEmptyString(pid, "PID required");
      const valuesToRemove = new Set(
        removeValues
          .map(normalizeText)
          .filter(
            (value) => isNonEmptyString(value) && value !== normalizedPid,
          ),
      );

      if (valuesToRemove.size) {
        this.graph
          .findStatements({
            subject: node,
            predicate: this.ns.DCTERMS("identifier"),
          })
          .filter((statement) =>
            valuesToRemove.has(normalizeText(statement.object?.value)),
          )
          .forEach((statement) => {
            this.graph.removeStatement(statement);
          });
      }

      return this.ensureIdentifierForUri(uri, normalizedPid);
    }

    /**
     * Return a plain package summary built from the RDF graph.
     * @returns {ResourceMapSummary} Package summary
     */
    getSummary() {
      return this.graphState.getSummary();
    }

    /** @returns {string[]} Aggregated member PIDs. */
    getMemberPids() {
      return this.graphState.getMemberPids();
    }

    /**
     * Remove package members and managed relationships attached to their exact
     * RDF nodes.
     * @param {string[]} pids PIDs to remove
     * @returns {ResourceMap} Updated resource map
     */
    removeMembers(pids) {
      (Array.isArray(pids) ? pids : [pids]).forEach((pid) => {
        this.resolveMemberNode(pid);
      });
      return this.structureMutation.removeMembers(pids);
    }

    /**
     * Change a package member's PID wherever managed package relationships use
     * it.
     * @param {string} oldPid Existing member PID.
     * @param {string} newPid Replacement member PID.
     * @returns {ResourceMap} Updated resource map.
     * @throws {ResourceMapConflictError} When a different package member already
     * uses the replacement PID.
     */
    replaceMember(oldPid, newPid) {
      this.resolveMemberNode(oldPid);
      this.resolveMemberNode(newPid);
      return this.structureMutation.replaceMember(oldPid, newPid);
    }

    /**
     * Set all package members and metadata documentation links in one edit.
     * If any step fails, the whole edit is rolled back.
     * @param {string[]} pids Desired member PIDs
     * @param {ResMapDocLink[]} links Desired documentation links
     * @returns {ResourceMap} Updated resource map
     */
    setPackageStructure(pids, links) {
      this.getMemberPids().forEach((pid) => this.resolveMemberNode(pid));
      return this.structureMutation.setPackageStructure(pids, links);
    }

    /** @returns {ResMapDocLink[]} Links from metadata to documented data. */
    getDocumentationLinks() {
      return this.graphState.getDocumentationLinks();
    }

    /**
     * Record in both directions that a metadata member documents a data member.
     * @param {string} metadataPid Documenting metadata PID.
     * @param {string} dataPid Documented member PID.
     * @returns {ResourceMap} Updated resource map.
     */
    linkDocumentation(metadataPid, dataPid) {
      return this.structureMutation.linkDocumentation(metadataPid, dataPid);
    }

    /**
     * Remove both RDF directions of a link from metadata to documented data.
     * @param {string} metadataPid Documenting metadata PID.
     * @param {string} dataPid Documented member PID.
     * @returns {ResourceMap} Updated resource map.
     */
    unlinkDocumentation(metadataPid, dataPid) {
      return this.structureMutation.unlinkDocumentation(metadataPid, dataPid);
    }

    /**
     * Replace all links from metadata to documented data.
     * @param {ResMapDocLink[]} links Desired documentation links.
     * @returns {ResourceMap} Updated resource map.
     */
    setDocumentationLinks(links) {
      this.getMemberPids().forEach((pid) => this.resolveMemberNode(pid));
      return this.structureMutation.setDocumentationLinks(links);
    }

    /**
     * Replace the stored source locations or paths for multiple members.
     * @param {Array<{pid: string, atLocations: string[]}>} locationUpdates
     * Member location updates. An empty `atLocations` array clears locations
     * @returns {ResourceMap} Updated resource map
     */
    setMemberLocations(locationUpdates) {
      const updatesByPid = new Map();
      (Array.isArray(locationUpdates) ? locationUpdates : []).forEach(
        ({ pid, atLocations }) => {
          const member = this.resolveMemberNode(pid, {
            required: true,
            message: "Member PID required",
          });
          if (!Array.isArray(atLocations)) {
            throw new Error("atLocations must be an array");
          }
          updatesByPid.set(member.pid, {
            node: member.node,
            atLocations: atLocations.map((path) =>
              requireNonEmptyString(path, "Path required"),
            ),
          });
        },
      );
      if (!updatesByPid.size) {
        return this;
      }

      return this.mutateGraph(
        () => {
          updatesByPid.forEach(({ node, atLocations }) => {
            this.graph.removeStatementsMatching({
              subject: node,
              predicate: this.ns.PROV("atLocation"),
            });
            atLocations.forEach((rawPath) => {
              this.graph.addStatementIfMissing({
                subject: node,
                predicate: this.ns.PROV("atLocation"),
                object: RDFGraph.createLiteral(rawPath),
              });
            });
          });
        },
        { rollbackOnError: true },
      );
    }

    /**
     * Replace the stored source location or path for one member.
     * @param {string} pid Aggregated member PID
     * @param {string} path Raw location value
     * @returns {ResourceMap} Updated resource map
     */
    setLocation(pid, path) {
      return this.setMemberLocations([
        {
          pid,
          atLocations: [path],
        },
      ]);
    }

    /**
     * Add one source location or path to a package member.
     * @param {string} pid Aggregated member PID
     * @param {string} path Raw location value
     * @returns {ResourceMap} Updated resource map
     */
    addLocation(pid, path) {
      const member = this.resolveMemberNode(pid, {
        required: true,
        message: "Member PID required",
      });
      const rawPath = requireNonEmptyString(path, "Path required");

      return this.mutateGraph(() => {
        this.ensureIdentifierForUri(member.uri, member.pid);
        this.graph.addStatementIfMissing({
          subject: member.node,
          predicate: this.ns.PROV("atLocation"),
          object: RDFGraph.createLiteral(rawPath),
        });
      });
    }

    /**
     * Remove one matching location, or every location when no path is given.
     * @param {string} pid Member PID.
     * @param {string} [path] Specific raw location value to remove.
     * @returns {ResourceMap} Updated resource map.
     */
    removeLocation(pid, path) {
      const { node: memberNode } = this.resolveMemberNode(pid, {
        required: true,
        message: "Member PID required",
      });
      const normalizedPath =
        path === undefined || path === null
          ? null
          : requireNonEmptyString(path, "Path required");

      return this.mutateGraph(() => {
        if (normalizedPath) {
          this.graph
            .findStatements({
              subject: memberNode,
              predicate: this.ns.PROV("atLocation"),
            })
            .filter(
              (statement) =>
                normalizeText(RDFGraph.getLiteralValue(statement.object)) ===
                normalizedPath,
            )
            .forEach((statement) => {
              this.graph.removeStatement(statement);
            });
          return;
        }

        this.graph.removeStatementsMatching({
          subject: memberNode,
          predicate: this.ns.PROV("atLocation"),
        });
      });
    }

    /**
     * Change the Resource Map PID and update the map and package URIs that
     * depend on it.
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

        this.graph.replaceNodeValues(
          new Map([
            [oldResourceMapUri, this.resourceMapUri],
            [oldAggregationUri, this.aggregationUri],
          ]),
        );
        this.setIdentifierForUri(this.resourceMapUri, normalizedPid, {
          removeValues: [oldResourceMapPid],
        });
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
          : normalizeText(modified);

      requireNonEmptyString(normalizedModified, "Modified required");

      return this.mutateGraph(() => {
        const resourceMapNode = RDFGraph.createNamedNode(this.resourceMapUri);
        this.graph.removeStatementsMatching({
          subject: resourceMapNode,
          predicate: this.ns.DCTERMS("modified"),
        });
        this.graph.removeStatementsMatching({
          subject: resourceMapNode,
          predicate: this.ns.DC("modified"),
        });
        this.graph.addStatementIfMissing({
          subject: resourceMapNode,
          predicate: this.ns.DCTERMS("modified"),
          object: RDFGraph.createLiteral(
            normalizedModified,
            this.ns.XSD("dateTime"),
          ),
        });
      });
    }

    /**
     * Check whether the Resource Map can be edited and published safely.
     * @returns {object[]} Validation issues.
     */
    validate() {
      return ResourceMapValidation.validateResourceMap(this);
    }

    /**
     * Return only validation errors that block editing and validated output.
     * @returns {object[]} Error severity validation issues
     */
    getEditBlockers() {
      return createValidationReport(this.validate()).errors;
    }

    /**
     * Repair missing or duplicate package statements only when the graph makes
     * the intended value certain.
     * @param {object} [options] Normalization options.
     * @param {boolean} [options.markDirty] Mark normalization changes unsaved.
     * @returns {ResourceMap} Updated resource map instance.
     * @throws {ResourceMapConflictError} When the graph no longer contains the
     * same Resource Map document and aggregation selected during construction.
     */
    normalize({ markDirty = false } = {}) {
      const selectedRoot = ResourceMapNormalization.selectImportedRoot(
        this.graph,
        this.resourceMapPid,
      );
      if (
        selectedRoot.resourceMapUri !== this.resourceMapUri ||
        selectedRoot.aggregationUri !== this.aggregationUri
      ) {
        throw new ResourceMapConflictError(
          "Cannot normalize because the Resource Map no longer describes the same aggregation.",
          {
            code: "ambiguousResourceMapRoot",
            details: {
              resourceMapPid: this.resourceMapPid,
              expectedResourceMapUri: this.resourceMapUri,
              expectedAggregationUri: this.aggregationUri,
              selectedResourceMapUri: selectedRoot.resourceMapUri,
              selectedAggregationUri: selectedRoot.aggregationUri,
            },
          },
        );
      }

      const identity = ResourceMapValidation.inspectRawIdentity(this);
      if (identity.issues.length) {
        throw createValidationException(
          "ResourceMap identity validation failed",
          identity.issues,
        );
      }
      // Build the cached graph index before editing. ResourceMapState refuses
      // to build a new index during an edit because it would describe a partly
      // updated graph.
      this.graphState.getIndex();
      return this.mutateGraph(() => this.normalizeGraph(), {
        markDirty,
        rollbackOnError: true,
      });
    }

    /**
     * Convert the current graph to RDF/XML, optionally rejecting validation
     * errors first.
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

      // Data and Program types may be explicit in imported RDF or implied by
      // provenance relationships. Add implied types only to serialized output
      // so the DataONE indexer and other ProvONE tools can read them without
      // changing the graph being edited.
      // Keep ore:Aggregation typing because it is part of both the validated
      // graph and DataONE's documented Resource Map shape.
      const statements = this.graph.getStatements({ copy: true });

      const memberDescriptors = this.graphState.getMemberDescriptors();
      if (validate && memberDescriptors.length === 1) {
        const memberNode = RDFGraph.createNamedNode(memberDescriptors[0].uri);
        // DataONE's Solr indexer needs a package with one member to say that
        // the member documents itself. Add either missing direction only to
        // validated output, without changing the graph being edited.
        [this.ns.CITO("documents"), this.ns.CITO("isDocumentedBy")].forEach(
          (predicate) => {
            if (
              !this.graph.hasStatement({
                subject: memberNode,
                predicate,
                object: memberNode,
              })
            ) {
              statements.push(
                RDFGraph.createStatement(memberNode, predicate, memberNode),
              );
            }
          },
        );
      }

      statements.push(...this.provenance.deriveRoleTypeStatements());
      return this.graph.serializeStatementsToXml(statements);
    }

    /**
     * Convert a PID into its URI under the configured DataONE resolve service.
     * @param {string} pid PID to encode as a resolve service URI.
     * @returns {string} Canonical resolve URI for the PID.
     */
    pidToUri(pid) {
      const normalizedPid = requireNonEmptyString(pid, "PID required");
      const resolveServiceUrl = requireNonEmptyString(
        this.resolveServiceUrl,
        "resolveServiceUrl required",
      );
      return UrlUtilities.buildUrl(
        resolveServiceUrl,
        UrlUtilities.encodeDataONEPidForPath(normalizedPid),
        { encodePath: false },
      );
    }

    /**
     * Return the URI already used for a PID, or create its configured resolve
     * URI when the graph does not contain one.
     * @param {string} pid PID whose current RDF subject URI should be resolved.
     * @returns {string} Existing graph URI or configured resolve URI.
     */
    getNodeUriForPid(pid) {
      const normalizedPid = requireNonEmptyString(pid, "PID required");
      return (
        this.graphState.findNodeUriForPid(normalizedPid) ||
        this.pidToUri(normalizedPid)
      );
    }

    /**
     * Find the single exact RDF node representing a package member. Return
     * `null` when the PID is not a member, and reject multiple matching member
     * nodes instead of guessing.
     * @param {string} pid Member PID to inspect
     * @param {object} [options] Resolution options
     * @param {boolean} [options.required] Throw when the PID is not a package
     * member
     * @param {string} [options.message] Missing/invalid PID error prefix
     * @returns {{pid: string, uri: string, node: NamedNode}|null} Sole exact
     * membership node, when present
     * @throws {ResourceMapConflictError} When multiple exact member URIs claim
     * the PID
     */
    resolveMemberNode(
      pid,
      { required = false, message = "Member PID required" } = {},
    ) {
      const normalizedPid = requireNonEmptyString(pid, message);
      const memberUris = this.graphState.getMemberUris(normalizedPid);
      if (memberUris.length > 1) {
        throw new ResourceMapConflictError(
          `Cannot edit member "${normalizedPid}" because more than one RDF resource is aggregated with that PID.`,
          {
            code: "ambiguousMemberPid",
            details: { pid: normalizedPid, memberUris },
          },
        );
      }
      const [uri] = memberUris;
      if (!uri) {
        if (required) {
          throw new Error(`${message}: "${normalizedPid}" is not aggregated`);
        }
        return null;
      }
      return { pid: normalizedPid, uri, node: RDFGraph.createNamedNode(uri) };
    }

    /**
     * Apply one grouped RDF edit while keeping cached summaries, change
     * tracking, and optional rollback consistent. Use this only when the public
     * ResourceMap methods cannot express the edit.
     * @param {Function} mutator Graph mutation callback.
     * @param {object} [options] Mutation bookkeeping options.
     * Graph mutations that affect derived JSON reads should flow through this
     * method or other `ResourceMap` APIs so the cached summary stays coherent
     * @param {boolean} [options.markDirty] Mark a successful outer mutation
     * unsaved. When false, preserve the previous dirty state.
     * @param {boolean} [options.rollbackOnError] Restore the graph if the
     * outermost mutation throws.
     * @returns {ResourceMap} Updated resource map instance.
     */
    mutateGraph(mutator, { markDirty = true, rollbackOnError = false } = {}) {
      // Only the outer mutation copies state, rolls back failures, and records
      // unsaved changes for the full nested edit.
      const isOuterMutation = !this.isGraphMutating();
      const shouldRollback = isOuterMutation && rollbackOnError;
      const previous = {
        statements: shouldRollback
          ? this.graph.getStatements({ copy: true })
          : null,
        resourceMapPid: this.resourceMapPid,
        resourceMapUri: this.resourceMapUri,
        aggregationUri: this.aggregationUri,
        unsavedChanges: this.unsavedChanges,
      };

      this.graphMutationDepth += 1;
      try {
        mutator();

        if (isOuterMutation) {
          this.unsavedChanges = markDirty ? true : previous.unsavedChanges;
        }
      } catch (error) {
        if (shouldRollback) {
          this.graph.restoreStatements(previous.statements);
          this.resourceMapPid = previous.resourceMapPid;
          this.resourceMapUri = previous.resourceMapUri;
          this.aggregationUri = previous.aggregationUri;
          this.unsavedChanges = previous.unsavedChanges;
        } else if (isOuterMutation) {
          this.unsavedChanges = true;
        }
        throw error;
      } finally {
        if (isOuterMutation) {
          this.graphState.invalidate();
        }
        this.graphMutationDepth -= 1;
      }

      return this;
    }

    /**
     * Ensure the graph contains the required package/member statements, remove
     * duplicate statements, and add only unambiguous provenance details.
     * @private
     */
    normalizeGraph() {
      // Keep each imported member's exact RDF URI. Rebuilding every URI from
      // its PID would move valid members that came from another Coordinating
      // Node. pidToUri() creates URIs only for new members.
      const memberDescriptors = this.graphState.getMemberDescriptors();
      this.mutateGraph(
        () => {
          this.normalization.synchronizeCoreGraph(memberDescriptors);
          this.graph.dedupeStatements();
        },
        { markDirty: false, rollbackOnError: true },
      );
      this.provenance.normalize();
    }
  }

  ResourceMap.RESOURCE_MAP_PID_PREFIX = "resource_map_";

  return ResourceMap;
});

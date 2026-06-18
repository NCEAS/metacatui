"use strict";

define([
  "rdflib",
  "common/UrlUtilities",
  "common/ValueUtilities",
  "models/resourceMap/ResourceMapCommon",
], (rdf, UrlUtilities, ValueUtilities, ResourceMapCommon) => {
  const PROVONE_BASE_URI =
    "http://purl.dataone.org/provone/2015/01/15/ontology#";
  const EXECUTION_CLASS_URI = `${PROVONE_BASE_URI}Execution`;

  const {
    dedupeBy,
    dedupeStrings,
    isNonEmptyString,
    normalizeText,
    sortBy,
    sortObjectKeys,
    sortStrings,
  } = ValueUtilities;

  const { dedupeNodes, getLiteralLikeObjectValue, nodeKey } = ResourceMapCommon;

  /**
   * Append a non-null value to an array stored under a string map key.
   * @param {Map<string, Array<*>>} map Target map.
   * @param {string} key Lookup key.
   * @param {*} value Value to append.
   */
  function addMapArrayValue(map, key, value) {
    if (!isNonEmptyString(key) || value == null) {
      return;
    }
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(value);
  }

  /**
   * Add a non-null value to a set stored under a string map key.
   * @param {Map<string, Set<*>>} map Target map.
   * @param {string} key Lookup key.
   * @param {*} value Value to add.
   */
  function addMapSetValue(map, key, value) {
    if (!isNonEmptyString(key) || value == null) {
      return;
    }
    if (!map.has(key)) {
      map.set(key, new Set());
    }
    map.get(key).add(value);
  }

  /**
   * Choose the preferred URI for a PID from all indexed graph candidates.
   * @param {ResourceMap} resourceMap Owning resource map.
   * @param {string} pid PID being resolved.
   * @param {string[]} uris Candidate URIs.
   * @param {Map<string, string>} identifierForUri Identifier lookup by URI.
   * @param {boolean} isAggregated Whether the PID is a package member.
   * @returns {string|null} Preferred URI.
   */
  function buildPreferredUri(
    resourceMap,
    pid,
    uris,
    identifierForUri,
    isAggregated,
  ) {
    const candidateUris = sortStrings(Array.isArray(uris) ? [...uris] : []);
    if (!candidateUris.length) {
      return null;
    }

    const directPidUri = candidateUris.find(
      (uri) => normalizeText(uri) === pid,
    );
    if (
      directPidUri &&
      !isAggregated &&
      ResourceMapCommon.isExternalDirectUriPid(pid)
    ) {
      return directPidUri;
    }

    const canonicalUri = isNonEmptyString(resourceMap.resolveBase)
      ? resourceMap.pidToUri(pid)
      : null;
    if (candidateUris.includes(canonicalUri)) {
      return canonicalUri;
    }

    const exactResolveUri = candidateUris.find((uri) =>
      resourceMap.constructor.isResolveUriForPid(uri, pid, {
        allowFragment: false,
      }),
    );
    if (exactResolveUri) {
      return exactResolveUri;
    }

    const fragmentResolveUri = candidateUris.find((uri) =>
      resourceMap.constructor.isResolveUriForPid(
        UrlUtilities.stripFragment(uri),
        pid,
        { allowFragment: false },
      ),
    );
    if (fragmentResolveUri) {
      return fragmentResolveUri;
    }

    const identifierMatch = candidateUris.find(
      (uri) => identifierForUri.get(uri) === pid,
    );

    return identifierMatch || directPidUri || candidateUris[0];
  }

  /**
   * ResourceMapState builds cached indexes and derived information from a
   * ResourceMap's RDF graph. This allows the rest of the code to answer common
   * questions, such as "what are the members?" or "which PID belongs to this
   * node?", without repeatedly traversing RDF statements (which can be
   * expensive to query).
   *
   * ResourceMapState never modifies the graph. Instead, it analyzes the graph
   * and creates lookup tables, summaries, and other derived structures that
   * make reads faster and simpler.
   *
   * The cached state is cleared whenever the graph changes. It is rebuilt
   * lazily on the next read operation so that the state always stays in sync
   * with the graph while avoiding unnecessary work.
   */
  class ResourceMapState {
    /**
     * @param {object} options State options.
     * @param {ResourceMap} options.resourceMap Owning resource map.
     */
    constructor({ resourceMap } = {}) {
      this.resourceMap = resourceMap;
      this.summaryCache = new Map();
      this.graphIndex = null;
    }

    /** Clear all derived state after a graph mutation. */
    invalidate() {
      this.graphIndex = null;
      this.summaryCache.clear();
    }

    /** @returns {object} Lazily built graph index. */
    getIndex() {
      if (!this.graphIndex) {
        if (this.resourceMap.isGraphMutating()) {
          throw new Error(
            "ResourceMapState must be built before starting a graph mutation",
          );
        }
        this.graphIndex = this.buildGraphIndex();
      }
      return this.graphIndex;
    }

    /**
     * Build the shared graph index used by ResourceMap reads and validation.
     * @returns {object} Derived graph index.
     */
    buildGraphIndex() {
      const { resourceMap } = this;
      const { graph, ns } = resourceMap;

      const predicateUris = {
        identifier: ns.DCTERMS("identifier").value,
        rdfType: ns.RDF("type").value,
        oreAggregates: ns.ORE("aggregates").value,
        oreIsAggregatedBy: ns.ORE("isAggregatedBy").value,
        citoDocuments: ns.CITO("documents").value,
        citoIsDocumentedBy: ns.CITO("isDocumentedBy").value,
        provAtLocation: ns.PROV("atLocation").value,
        dcCreator: ns.DC("creator").value,
        dctermsCreator: ns.DCTERMS("creator").value,
        dcModified: ns.DC("modified").value,
        dctermsModified: ns.DCTERMS("modified").value,
        foafName: ns.FOAF("name").value,
        provWasDerivedFrom: ns.PROV("wasDerivedFrom").value,
        provWasGeneratedBy: ns.PROV("wasGeneratedBy").value,
        provUsed: ns.PROV("used").value,
        provWasInformedBy: ns.PROV("wasInformedBy").value,
        provQualifiedAssociation: ns.PROV("qualifiedAssociation").value,
        provHadPlan: ns.PROV("hadPlan").value,
        provAgent: ns.PROV("agent").value,
      };

      const nodeByKey = new Map();
      const namedNodeByUri = new Map();
      const identifierValuesByNodeKey = new Map();
      const typeUrisByNodeKey = new Map();
      const foafNamesByNodeKey = new Map();
      const creatorStatements = [];
      const modifiedValues = [];
      const aggregateStatements = [];
      const isAggregatedByStatements = [];
      const documentationEdges = [];
      const atLocationStatements = [];
      const wasDerivedFromStatements = [];
      const wasGeneratedByStatements = [];
      const usedStatements = [];
      const wasInformedByStatements = [];
      const executionNodeKeys = new Set();
      const generatedLinkExecutionKeys = new Set();
      const usedLinkExecutionKeys = new Set();
      const informedLinkExecutionKeys = new Set();
      const associationNodesByExecutionKey = new Map();
      const planNodesByAssociationKey = new Map();
      const agentUrisByAssociationKey = new Map();
      /**
       * Register one RDF node in the shared node lookups.
       * @param {NamedNode|BlankNode|Literal|null|undefined} node Candidate
       * node.
       */
      const registerNode = (node) => {
        if (!node) {
          return;
        }
        const key = nodeKey(node);
        if (!nodeByKey.has(key)) {
          nodeByKey.set(key, node);
        }
        if (node.termType === "NamedNode" && !namedNodeByUri.has(node.value)) {
          namedNodeByUri.set(node.value, node);
        }
      };

      const statements = graph.statements || [];
      statements.forEach((statement) => {
        const { subject, object } = statement;
        const predicateUri = statement.predicate?.value;
        const subjectKey = nodeKey(subject);
        const objectKey = nodeKey(object);

        registerNode(subject);
        registerNode(object);

        switch (predicateUri) {
          case predicateUris.identifier: {
            const identifierValue = getLiteralLikeObjectValue(object);
            if (isNonEmptyString(identifierValue)) {
              addMapArrayValue(
                identifierValuesByNodeKey,
                subjectKey,
                identifierValue,
              );
            }
            break;
          }
          case predicateUris.rdfType: {
            if (object?.termType === "NamedNode") {
              addMapArrayValue(typeUrisByNodeKey, subjectKey, object.value);
              if (object.value === EXECUTION_CLASS_URI) {
                executionNodeKeys.add(subjectKey);
              }
            }
            break;
          }
          case predicateUris.foafName: {
            const nameValue = getLiteralLikeObjectValue(object);
            if (isNonEmptyString(nameValue)) {
              addMapArrayValue(foafNamesByNodeKey, subjectKey, nameValue);
            }
            break;
          }
          case predicateUris.oreAggregates: {
            aggregateStatements.push(statement);
            break;
          }
          case predicateUris.oreIsAggregatedBy: {
            isAggregatedByStatements.push(statement);
            break;
          }
          case predicateUris.citoDocuments: {
            documentationEdges.push({
              metadataNode: subject,
              dataNode: object,
            });
            break;
          }
          case predicateUris.citoIsDocumentedBy: {
            documentationEdges.push({
              metadataNode: object,
              dataNode: subject,
            });
            break;
          }
          case predicateUris.provAtLocation: {
            const rawPath = normalizeText(object?.value);
            if (isNonEmptyString(rawPath)) {
              atLocationStatements.push({
                subjectNode: subject,
                path: rawPath,
              });
            }
            break;
          }
          case predicateUris.dcCreator:
          case predicateUris.dctermsCreator: {
            if (subject?.value === resourceMap.resourceMapUri) {
              creatorStatements.push(statement);
            }
            break;
          }
          case predicateUris.dcModified:
          case predicateUris.dctermsModified: {
            if (subject?.value === resourceMap.resourceMapUri) {
              const modifiedValue = normalizeText(object?.value);
              if (isNonEmptyString(modifiedValue)) {
                modifiedValues.push(modifiedValue);
              }
            }
            break;
          }
          case predicateUris.provWasDerivedFrom: {
            wasDerivedFromStatements.push(statement);
            break;
          }
          case predicateUris.provWasGeneratedBy: {
            wasGeneratedByStatements.push(statement);
            generatedLinkExecutionKeys.add(objectKey);
            executionNodeKeys.add(objectKey);
            break;
          }
          case predicateUris.provUsed: {
            usedStatements.push(statement);
            usedLinkExecutionKeys.add(subjectKey);
            executionNodeKeys.add(subjectKey);
            break;
          }
          case predicateUris.provWasInformedBy: {
            wasInformedByStatements.push(statement);
            executionNodeKeys.add(subjectKey);
            executionNodeKeys.add(objectKey);
            informedLinkExecutionKeys.add(subjectKey);
            informedLinkExecutionKeys.add(objectKey);
            break;
          }
          case predicateUris.provQualifiedAssociation: {
            executionNodeKeys.add(subjectKey);
            addMapArrayValue(
              associationNodesByExecutionKey,
              subjectKey,
              object,
            );
            break;
          }
          case predicateUris.provHadPlan: {
            addMapArrayValue(planNodesByAssociationKey, subjectKey, object);
            break;
          }
          case predicateUris.provAgent: {
            if (object?.termType === "NamedNode") {
              addMapArrayValue(
                agentUrisByAssociationKey,
                subjectKey,
                object.value,
              );
            }
            break;
          }
          default:
            break;
        }
      });

      const identifierForNodeKey = new Map(
        Array.from(identifierValuesByNodeKey.entries()).map(([key, values]) => [
          key,
          dedupeStrings(values).find(isNonEmptyString) || null,
        ]),
      );
      const identifierForUri = new Map();
      identifierForNodeKey.forEach((identifierValue, key) => {
        const node = nodeByKey.get(key);
        if (
          node?.termType === "NamedNode" &&
          isNonEmptyString(identifierValue)
        ) {
          identifierForUri.set(node.value, identifierValue);
        }
      });

      const pidByNodeKey = new Map();
      const urisByPid = new Map();

      /**
       * Resolve a PID using only lookups collected for this index.
       * @param {NamedNode|BlankNode|Literal|null|undefined} node Candidate
       * node.
       * @returns {string|null} Resolved PID.
       */
      const resolvePidForNode = (node) => {
        const key = nodeKey(node);
        if (pidByNodeKey.has(key)) {
          return pidByNodeKey.get(key);
        }

        const pid =
          node?.termType === "NamedNode"
            ? ResourceMapCommon.recoverPidFromUri(resourceMap, node.value, {
                identifierForUri,
                allowBareValue: true,
              })
            : null;

        pidByNodeKey.set(key, pid || null);
        if (isNonEmptyString(pid) && node?.termType === "NamedNode") {
          addMapSetValue(urisByPid, pid, node.value);
        }

        return pid || null;
      };

      namedNodeByUri.forEach((node) => {
        resolvePidForNode(node);
      });

      const associatedAggregationUris = new Set(
        ResourceMapCommon.collectAssociatedAggregationUris(resourceMap, {
          pidFromNode: resolvePidForNode,
          resourceMapUris: Array.from(
            urisByPid.get(resourceMap.resourceMapPid) || [],
          ),
        }),
      );
      const memberNodeKeys = new Set();
      aggregateStatements.forEach((statement) => {
        if (
          statement.object?.termType === "NamedNode" &&
          associatedAggregationUris.has(statement.subject?.value)
        ) {
          memberNodeKeys.add(nodeKey(statement.object));
        }
      });
      isAggregatedByStatements.forEach((statement) => {
        if (
          statement.subject?.termType === "NamedNode" &&
          associatedAggregationUris.has(statement.object?.value)
        ) {
          memberNodeKeys.add(nodeKey(statement.subject));
        }
      });
      const memberCandidateNodeKeys = Array.from(memberNodeKeys);
      const aggregatedPids = new Set(
        memberCandidateNodeKeys
          .map((key) => resolvePidForNode(nodeByKey.get(key)))
          .filter(isNonEmptyString),
      );
      const preferredUriByPid = new Map(
        Array.from(urisByPid.entries()).map(([pid, values]) => [
          pid,
          buildPreferredUri(
            resourceMap,
            pid,
            Array.from(values),
            identifierForUri,
            aggregatedPids.has(pid),
          ),
        ]),
      );

      const nodesByIdentifier = new Map();
      identifierValuesByNodeKey.forEach((values, key) => {
        const node = nodeByKey.get(key);
        dedupeStrings(values).forEach((identifierValue) => {
          addMapArrayValue(nodesByIdentifier, identifierValue, node);
        });
      });
      namedNodeByUri.forEach((node, uri) => {
        addMapArrayValue(nodesByIdentifier, normalizeText(uri), node);
      });

      let memberDescriptors = dedupeBy(
        memberCandidateNodeKeys
          .map((key) => nodeByKey.get(key))
          .filter((node) => node?.termType === "NamedNode")
          .map((node) => {
            const pid = resolvePidForNode(node);
            if (!isNonEmptyString(pid)) {
              return null;
            }
            return {
              pid,
              uri: node.value,
            };
          })
          .filter(Boolean),
        (member) => member.pid,
      );
      const memberPids = memberDescriptors.map((member) => member.pid);
      const memberSet = new Set(memberPids);

      const documentationLinks = dedupeBy(
        documentationEdges
          .map(({ metadataNode, dataNode }) => {
            const metadataPid = resolvePidForNode(metadataNode);
            const dataPid = resolvePidForNode(dataNode);
            if (!metadataPid || !dataPid) {
              return null;
            }
            return { metadataPid, dataPid };
          })
          .filter(Boolean),
        ({ metadataPid, dataPid }) =>
          ResourceMapCommon.buildKey([metadataPid, dataPid]),
      );
      const isDocumentedByByPid = new Map();
      const documentsByPid = new Map();
      documentationLinks.forEach(({ metadataPid, dataPid }) => {
        addMapSetValue(isDocumentedByByPid, dataPid, metadataPid);
        addMapSetValue(documentsByPid, metadataPid, dataPid);
      });

      const atLocationsByMemberPid = new Map();
      atLocationStatements.forEach(({ subjectNode, path }) => {
        const pid = resolvePidForNode(subjectNode);
        if (!pid) {
          return;
        }
        if (!atLocationsByMemberPid.has(pid)) {
          atLocationsByMemberPid.set(pid, []);
        }
        atLocationsByMemberPid.get(pid).push(path);
      });
      memberDescriptors = memberDescriptors.map((descriptor) => {
        const atLocations = sortStrings(
          dedupeStrings(atLocationsByMemberPid.get(descriptor.pid) || []),
        );
        return {
          ...descriptor,
          atLocations,
          displayAtLocations: atLocations.map((path) =>
            resourceMap.constructor.normalizeAtLocationForDisplay(path),
          ),
        };
      });
      const memberDescriptorByPid = new Map(
        memberDescriptors.map((descriptor) => [descriptor.pid, descriptor]),
      );

      const creatorName = (() => {
        const namedCreator = creatorStatements.find((statement) => {
          if (!statement.object || statement.object.termType === "Literal") {
            return false;
          }
          const names = foafNamesByNodeKey.get(nodeKey(statement.object)) || [];
          return names.some(isNonEmptyString);
        })?.object;

        if (namedCreator) {
          return (
            dedupeStrings(
              foafNamesByNodeKey.get(nodeKey(namedCreator)) || [],
            ).find(isNonEmptyString) || null
          );
        }

        return (
          creatorStatements
            .map((statement) => getLiteralLikeObjectValue(statement.object))
            .find(isNonEmptyString) || null
        );
      })();

      const modified = modifiedValues.find(isNonEmptyString) || null;

      // Type assertions physically present in the graph: explicit annotations
      // and managed Execution scaffolding.
      const explicitTypeAssertions = dedupeBy(
        Array.from(typeUrisByNodeKey.entries()).flatMap(
          ([subjectKey, classUris]) => {
            const pid = resolvePidForNode(nodeByKey.get(subjectKey));
            if (!pid) {
              return [];
            }
            return dedupeStrings(classUris)
              .filter((classUri) => classUri.startsWith(PROVONE_BASE_URI))
              .map((classUri) => ({
                pid,
                className: classUri.slice(PROVONE_BASE_URI.length),
              }));
          },
        ),
        ({ pid, className }) => ResourceMapCommon.buildKey([pid, className]),
      );

      const rolePidSets = {
        Data: new Set(),
        Program: new Set(),
      };
      wasDerivedFromStatements.forEach((statement) => {
        [statement.subject, statement.object]
          .map(resolvePidForNode)
          .filter(Boolean)
          .forEach((pid) => rolePidSets.Data.add(pid));
      });
      wasGeneratedByStatements.forEach((statement) => {
        const pid = resolvePidForNode(statement.subject);
        if (pid) {
          rolePidSets.Data.add(pid);
        }
      });
      usedStatements.forEach((statement) => {
        const pid = resolvePidForNode(statement.object);
        if (pid) {
          rolePidSets.Data.add(pid);
        }
      });
      planNodesByAssociationKey.forEach((planNodes) => {
        planNodes
          .map(resolvePidForNode)
          .filter(Boolean)
          .forEach((pid) => rolePidSets.Program.add(pid));
      });

      // Data/Program types are a projection of provenance structure. Rather
      // than persist them as graph triples, derive them from the current role
      // edges and union them with the explicit assertions. This keeps reads,
      // toJSON, and serialized output consistent without the resource map
      // owning auto-generated type triples.
      const typeAssertions = dedupeBy(
        [
          ...explicitTypeAssertions,
          ...Array.from(rolePidSets.Data, (pid) => ({
            pid,
            className: "Data",
          })),
          ...Array.from(rolePidSets.Program, (pid) => ({
            pid,
            className: "Program",
          })),
        ],
        ({ pid, className }) => ResourceMapCommon.buildKey([pid, className]),
      );
      const typeAssertionsByPid = new Map();
      typeAssertions.forEach((assertion) => {
        addMapSetValue(typeAssertionsByPid, assertion.pid, assertion.className);
      });

      const executionSummariesByKey = new Map();
      const executionNodes = dedupeNodes(
        Array.from(executionNodeKeys)
          .map((key) => nodeByKey.get(key))
          .filter(Boolean),
      );

      executionNodes.forEach((executionNode) => {
        const executionKey = nodeKey(executionNode);
        const associations = dedupeNodes(
          associationNodesByExecutionKey.get(executionKey) || [],
        ).map((associationNode) => {
          const associationKey = nodeKey(associationNode);
          return {
            node: associationNode,
            planNodes: dedupeNodes(
              planNodesByAssociationKey.get(associationKey) || [],
            ),
            agentUris: dedupeStrings(
              agentUrisByAssociationKey.get(associationKey) || [],
            ),
          };
        });

        const programs = dedupeBy(
          associations
            .flatMap(({ planNodes, agentUris }) =>
              planNodes.flatMap((planNode) => {
                const programPid = resolvePidForNode(planNode);
                return (agentUris.length ? agentUris : [null]).map(
                  (agentUri) => ({
                    programPid,
                    agentUri,
                  }),
                );
              }),
            )
            .filter(({ programPid }) => isNonEmptyString(programPid)),
          ({ programPid, agentUri }) =>
            ResourceMapCommon.buildKey([programPid, agentUri]),
        );

        const identifierLiteral =
          identifierForNodeKey.get(executionKey) || null;
        const identifier =
          identifierLiteral ||
          (executionNode?.termType === "NamedNode"
            ? normalizeText(executionNode.value)
            : null);

        executionSummariesByKey.set(executionKey, {
          node: executionNode,
          label: identifier || executionNode?.value || "unknown execution",
          isExecution: dedupeStrings(
            typeUrisByNodeKey.get(executionKey) || [],
          ).includes(EXECUTION_CLASS_URI),
          identifier,
          hasIdentifierLiteral: isNonEmptyString(identifierLiteral),
          associations,
          programs,
          programPids: dedupeStrings(
            programs.map((program) => program.programPid),
          ),
          hasGeneratedLinks: generatedLinkExecutionKeys.has(executionKey),
          hasUsedLinks: usedLinkExecutionKeys.has(executionKey),
          hasWasInformedByLinks: informedLinkExecutionKeys.has(executionKey),
        });
      });

      const executionNodesByProgramPid = new Map();

      executionSummariesByKey.forEach((summary) => {
        summary.programPids.forEach((programPid) => {
          addMapArrayValue(
            executionNodesByProgramPid,
            programPid,
            summary.node,
          );
        });
      });

      const wasDerivedFrom = dedupeBy(
        wasDerivedFromStatements
          .map((statement) => {
            const derivedPid = resolvePidForNode(statement.subject);
            const sourcePid = resolvePidForNode(statement.object);
            if (!derivedPid || !sourcePid) {
              return null;
            }
            return { derivedPid, sourcePid };
          })
          .filter(Boolean),
        ({ derivedPid, sourcePid }) =>
          ResourceMapCommon.buildKey([derivedPid, sourcePid]),
      );

      const projectExecutionProgramRelationships = (
        statementsToProject,
        dataFromObject,
      ) =>
        dedupeBy(
          statementsToProject.flatMap((statement) => {
            const dataNode = dataFromObject
              ? statement.object
              : statement.subject;
            const executionNode = dataFromObject
              ? statement.subject
              : statement.object;
            const dataPid = resolvePidForNode(dataNode);
            const executionSummary = executionSummariesByKey.get(
              nodeKey(executionNode),
            );
            if (!dataPid || !executionSummary) {
              return [];
            }
            return executionSummary.programs
              .filter(({ programPid }) => isNonEmptyString(programPid))
              .map(({ programPid, agentUri }) => ({
                dataPid,
                programPid,
                executionId: normalizeText(executionSummary.identifier),
                agentUri: agentUri || null,
              }));
          }),
          ({ dataPid, programPid, executionId, agentUri }) =>
            ResourceMapCommon.buildKey([
              dataPid,
              programPid,
              executionId,
              agentUri,
            ]),
        );

      // prov:wasGeneratedBy stores the data PID in the subject position;
      // prov:used stores it in the object position.
      const generatedByPrograms = projectExecutionProgramRelationships(
        wasGeneratedByStatements,
        false,
      );
      const usedByPrograms = projectExecutionProgramRelationships(
        usedStatements,
        true,
      );

      const wasInformedByPrograms = dedupeBy(
        wasInformedByStatements.flatMap((statement) => {
          const currentExecution = executionSummariesByKey.get(
            nodeKey(statement.subject),
          );
          const previousExecution = executionSummariesByKey.get(
            nodeKey(statement.object),
          );
          if (!currentExecution || !previousExecution) {
            return [];
          }

          return currentExecution.programs.flatMap((currentProgram) =>
            previousExecution.programs
              .filter(
                (previousProgram) =>
                  isNonEmptyString(currentProgram.programPid) &&
                  isNonEmptyString(previousProgram.programPid),
              )
              .map((previousProgram) => ({
                programPid: currentProgram.programPid,
                previousProgramPid: previousProgram.programPid,
                executionId: normalizeText(currentExecution.identifier),
                previousExecutionId: normalizeText(
                  previousExecution.identifier,
                ),
              })),
          );
        }),
        ({
          programPid,
          previousProgramPid,
          executionId,
          previousExecutionId,
        }) =>
          ResourceMapCommon.buildKey([
            programPid,
            previousProgramPid,
            executionId,
            previousExecutionId,
          ]),
      );

      const programExecutions = dedupeBy(
        Array.from(executionSummariesByKey.values()).flatMap((summary) => {
          if (!summary.isExecution) {
            return [];
          }
          return summary.programs
            .filter(({ programPid }) => isNonEmptyString(programPid))
            .map(({ programPid, agentUri }) => ({
              programPid,
              executionId: normalizeText(summary.identifier),
              agentUri: agentUri || null,
            }));
        }),
        ({ programPid, executionId, agentUri }) =>
          ResourceMapCommon.buildKey([programPid, executionId, agentUri]),
      );

      return {
        nodesByIdentifier,
        identifierForNodeKey,
        pidByNodeKey,
        preferredUriByPid,
        memberDescriptors,
        memberDescriptorByPid,
        memberPids,
        memberSet,
        documentationLinks,
        isDocumentedByByPid,
        documentsByPid,
        creatorName,
        modified,
        typeAssertions,
        typeAssertionsByPid,
        rolePidSets,
        executionNodes,
        executionSummariesByKey,
        executionNodesByProgramPid,
        programExecutions,
        wasDerivedFrom,
        generatedByPrograms,
        usedByPrograms,
        wasInformedByPrograms,
      };
    }

    /**
     * Sort a mutable ResourceMap summary for deterministic output.
     * @param {ResourceMapSummary} snapshot Summary to sort in place.
     * @returns {ResourceMapSummary} Sorted summary.
     */
    static sortSummary(snapshot) {
      /* eslint-disable no-param-reassign */
      snapshot.members = sortBy(
        snapshot.members.map((member) =>
          Object.fromEntries(
            Object.entries(member).map(([key, value]) => [
              key,
              Array.isArray(value) ? sortStrings([...value]) : value,
            ]),
          ),
        ),
        (member) => member.pid,
      );
      snapshot.membersByPid = sortObjectKeys(
        Object.fromEntries(
          snapshot.members.map((member) => [member.pid, member]),
        ),
      );
      snapshot.memberPids = sortStrings([...(snapshot.memberPids || [])]);
      snapshot.documentationLinks = ResourceMapCommon.sortByFields(
        snapshot.documentationLinks,
        ["metadataPid", "dataPid"],
      );
      snapshot.metadataPids = sortStrings([...(snapshot.metadataPids || [])]);
      snapshot.documentedObjectPids = sortStrings([
        ...(snapshot.documentedObjectPids || []),
      ]);
      snapshot.provenance = ResourceMapCommon.sortProvenanceSummary(
        snapshot.provenance,
      );

      return snapshot;
      /* eslint-enable no-param-reassign */
    }

    /**
     * Build or read a cached package summary.
     * @returns {ResourceMapSummary} Cloned package summary.
     */
    getSummary() {
      const cachedSummary = this.summaryCache.get("summary");
      if (cachedSummary) {
        return ValueUtilities.deepClone(cachedSummary);
      }

      const index = this.getIndex();
      const members = index.memberDescriptors.map((descriptor) => ({
        pid: descriptor.pid,
        uri: descriptor.uri,
        isDocumentedBy: sortStrings([
          ...(index.isDocumentedByByPid.get(descriptor.pid) || []),
        ]),
        documents: sortStrings([
          ...(index.documentsByPid.get(descriptor.pid) || []),
        ]),
        atLocations: [...descriptor.atLocations],
        displayAtLocations: [...descriptor.displayAtLocations],
      }));

      const summary = ResourceMapState.sortSummary({
        resourceMapPid: this.resourceMap.resourceMapPid,
        resourceMapUri: this.resourceMap.resourceMapUri,
        aggregationUri: this.resourceMap.aggregationUri,
        resolveBase: this.resourceMap.resolveBase,
        members,
        membersByPid: Object.fromEntries(
          members.map((member) => [member.pid, member]),
        ),
        memberPids: members.map((member) => member.pid),
        documentationLinks: index.documentationLinks.map((link) => ({
          ...link,
        })),
        creatorName: index.creatorName,
        modified: index.modified,
        provenance: this.resourceMap.provenance.toJSON(),
        metadataPids: Array.from(index.documentsByPid.keys()),
        documentedObjectPids: Array.from(index.isDocumentedByByPid.keys()),
      });

      this.summaryCache.set("summary", ValueUtilities.deepClone(summary));
      return ValueUtilities.deepClone(summary);
    }

    /** @returns {ResourceMapValidationContext} Shared validation inputs. */
    createValidationContext() {
      const index = this.getIndex();
      return {
        resourceMap: this.resourceMap,
        graph: this.resourceMap.graph,
        ns: this.resourceMap.ns,
        resourceMapNode: rdf.sym(this.resourceMap.resourceMapUri),
        aggregationNode: rdf.sym(this.resourceMap.aggregationUri),
        memberPids: [...index.memberPids],
        memberSet: new Set(index.memberPids),
        documentationLinks: index.documentationLinks.map((link) => ({
          ...link,
        })),
        hasSoloMemberSelfDocumentationCandidate:
          !index.documentationLinks.length && index.memberPids.length === 1,
      };
    }

    /** @returns {Array<{pid: string, uri: string}>} Member descriptors. */
    getMemberDescriptors() {
      return this.getIndex().memberDescriptors.map(({ pid, uri }) => ({
        pid,
        uri,
      }));
    }

    /**
     * Return one member summary from indexed graph state.
     * @param {string} pid Member PID.
     * @returns {ResourceMapMember|null} Member summary when present.
     */
    getMember(pid) {
      const normalizedPid = normalizeText(pid);
      if (!isNonEmptyString(normalizedPid)) {
        return null;
      }

      const index = this.getIndex();
      const descriptor = index.memberDescriptorByPid.get(normalizedPid);
      if (!descriptor) {
        return null;
      }

      return {
        pid: descriptor.pid,
        uri: descriptor.uri,
        isDocumentedBy: sortStrings([
          ...(index.isDocumentedByByPid.get(normalizedPid) || []),
        ]),
        documents: sortStrings([
          ...(index.documentsByPid.get(normalizedPid) || []),
        ]),
        atLocations: [...descriptor.atLocations],
        displayAtLocations: [...descriptor.displayAtLocations],
      };
    }

    /**
     * Test whether a PID is aggregated.
     * @param {string} pid Candidate PID.
     * @returns {boolean} Whether the PID is a member.
     */
    hasMember(pid) {
      const normalizedPid = normalizeText(pid);
      return (
        isNonEmptyString(normalizedPid) &&
        this.getIndex().memberSet.has(normalizedPid)
      );
    }

    /** @returns {string[]} Aggregated member PIDs. */
    getMemberPids() {
      return [...this.getIndex().memberPids];
    }

    /** @returns {string[]} Unique documenting metadata PIDs. */
    getMetadataPids() {
      return Array.from(this.getIndex().documentsByPid.keys());
    }

    /** @returns {string[]} Unique documented member PIDs. */
    getDocumentedObjectPids() {
      return Array.from(this.getIndex().isDocumentedByByPid.keys());
    }

    /** @returns {ResMapDocLink[]} Cloned documentation links. */
    getDocumentationLinks() {
      return this.getIndex().documentationLinks.map((link) => ({ ...link }));
    }

    /** @returns {string|null} Resource-map creator name. */
    getCreatorName() {
      return this.getIndex().creatorName;
    }

    /** @returns {string|null} Resource-map modified value. */
    getModifiedValue() {
      return this.getIndex().modified;
    }

    /**
     * Read the indexed identifier for an RDF node.
     * @param {NamedNode|BlankNode|Literal} node RDF node.
     * @returns {string|null} Identifier when present.
     */
    identifierFromNode(node) {
      return this.getIndex().identifierForNodeKey.get(nodeKey(node)) || null;
    }

    /**
     * Find indexed RDF resource nodes for an identifier.
     * @param {string} identifier Identifier to resolve.
     * @returns {Array<NamedNode|BlankNode>} Matching RDF resource nodes.
     */
    findNodesByIdentifier(identifier) {
      return dedupeNodes(
        this.getIndex().nodesByIdentifier.get(normalizeText(identifier)) || [],
      );
    }

    /**
     * Resolve an indexed PID for an RDF node.
     * @param {NamedNode|BlankNode|Literal} node RDF node.
     * @returns {string|null} PID when resolvable.
     */
    pidFromNode(node) {
      return this.getIndex().pidByNodeKey.get(nodeKey(node)) || null;
    }

    /**
     * Find the preferred indexed URI for a PID.
     * @param {string} pid PID to resolve.
     * @returns {string|null} Preferred URI.
     */
    findNodeUriForPid(pid) {
      const normalizedPid = normalizeText(pid);
      if (!isNonEmptyString(normalizedPid)) {
        return null;
      }
      return this.getIndex().preferredUriByPid.get(normalizedPid) || null;
    }

    /**
     * Test whether a node has an expected identifier.
     * @param {NamedNode|BlankNode|Literal} node RDF node.
     * @param {string} pid Expected PID.
     * @returns {boolean} Whether the identifier matches.
     */
    nodeHasIdentifier(node, pid) {
      const normalizedPid = normalizeText(pid);
      const nodeIdentifier = this.identifierFromNode(node);
      return (
        nodeIdentifier === normalizedPid && isNonEmptyString(nodeIdentifier)
      );
    }

    /** @returns {TypeAssertion[]} Cloned PROVONE type assertions. */
    getTypeAssertions() {
      return this.getIndex().typeAssertions.map((assertion) => ({
        ...assertion,
      }));
    }

    /**
     * Test whether a PID has one PROVONE type assertion.
     * @param {string} pid PID to inspect.
     * @param {string} className PROVONE class name.
     * @returns {boolean} Whether the type is asserted.
     */
    hasTypeAssertion(pid, className) {
      const normalizedPid = normalizeText(pid);
      return (
        isNonEmptyString(normalizedPid) &&
        !!this.getIndex().typeAssertionsByPid
          .get(normalizedPid)
          ?.has(className)
      );
    }

    /**
     * Return PIDs assigned one PROVONE role.
     * @param {string} className PROVONE class name.
     * @returns {Set<string>} Matching PIDs.
     */
    getRolePidSet(className) {
      return new Set(this.getIndex().rolePidSets[className] || []);
    }

    /**
     * Test whether a PID has one PROVONE role.
     * @param {string} pid PID to inspect.
     * @param {string} className PROVONE class name.
     * @returns {boolean} Whether the role is asserted.
     */
    hasRole(pid, className) {
      const normalizedPid = normalizeText(pid);
      return (
        isNonEmptyString(normalizedPid) &&
        !!this.getIndex().rolePidSets[className]?.has(normalizedPid)
      );
    }

    /** @returns {Array<NamedNode|BlankNode>} Indexed execution nodes. */
    getExecutionNodes() {
      return dedupeNodes(this.getIndex().executionNodes);
    }

    /**
     * Return a cloned execution summary.
     * @param {NamedNode|BlankNode} executionNode Execution node.
     * @returns {object|null} Execution summary.
     */
    getExecutionSummary(executionNode) {
      const summary = this.getIndex().executionSummariesByKey.get(
        nodeKey(executionNode),
      );
      if (!summary) {
        return null;
      }
      return {
        ...summary,
        associations: summary.associations.map((association) => ({
          ...association,
          planNodes: [...association.planNodes],
          agentUris: [...association.agentUris],
        })),
        programs: summary.programs.map((program) => ({ ...program })),
        programPids: [...summary.programPids],
      };
    }

    /**
     * Find executions associated with a program PID.
     * @param {string} programPid Program PID.
     * @returns {Array<NamedNode|BlankNode>} Matching executions.
     */
    getExecutionNodesForProgram(programPid) {
      return dedupeNodes(
        this.getIndex().executionNodesByProgramPid.get(
          normalizeText(programPid),
        ) || [],
      );
    }

    /**
     * Filter execution nodes by identifier.
     * @param {Array<NamedNode|BlankNode>} executionNodes Candidate executions.
     * @param {string|null} executionId Optional identifier filter.
     * @returns {Array<NamedNode|BlankNode>} Matching executions.
     */
    filterExecutionNodesByIdentifier(executionNodes, executionId) {
      const normalizedExecutionId = normalizeText(executionId);
      if (!isNonEmptyString(normalizedExecutionId)) {
        return dedupeNodes(executionNodes);
      }

      return dedupeNodes(executionNodes).filter(
        (executionNode) =>
          this.getExecutionIdentifier(executionNode) === normalizedExecutionId,
      );
    }

    /**
     * Read an execution identifier.
     * @param {NamedNode|BlankNode} executionNode Execution node.
     * @returns {string|null} Identifier when present.
     */
    getExecutionIdentifier(executionNode) {
      return this.getExecutionSummary(executionNode)?.identifier || null;
    }

    /**
     * Test whether an execution has an identifier literal.
     * @param {NamedNode|BlankNode} executionNode Execution node.
     * @returns {boolean} Whether an identifier literal exists.
     */
    hasExecutionIdentifier(executionNode) {
      return !!this.getExecutionSummary(executionNode)?.hasIdentifierLiteral;
    }

    /**
     * Test whether a node is typed as an execution.
     * @param {NamedNode|BlankNode} executionNode Candidate execution node.
     * @returns {boolean} Whether the node is an execution.
     */
    isExecutionNode(executionNode) {
      return !!this.getExecutionSummary(executionNode)?.isExecution;
    }

    /** @returns {object[]} Cloned program-execution relationships. */
    getProgramExecutions() {
      return this.getIndex().programExecutions.map((relationship) => ({
        ...relationship,
      }));
    }

    /** @returns {WasDerivedFromRelationship[]} Cloned derivation links. */
    getWasDerivedFromLinks() {
      return this.getIndex().wasDerivedFrom.map((relationship) => ({
        ...relationship,
      }));
    }

    /** @returns {ExecutionProgramRelationship[]} Cloned generation links. */
    getGeneratedByPrograms() {
      return this.getIndex().generatedByPrograms.map((relationship) => ({
        ...relationship,
      }));
    }

    /** @returns {ExecutionProgramRelationship[]} Cloned usage links. */
    getUsedByPrograms() {
      return this.getIndex().usedByPrograms.map((relationship) => ({
        ...relationship,
      }));
    }

    /** @returns {ProgramLineageRelationship[]} Cloned program lineage links. */
    getWasInformedByPrograms() {
      return this.getIndex().wasInformedByPrograms.map((relationship) => ({
        ...relationship,
      }));
    }
  }

  return ResourceMapState;
});

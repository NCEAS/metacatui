"use strict";

define([
  "rdflib",
  "common/UrlUtilities",
  "common/ValueUtilities",
  "models/resourceMap/GraphRead",
  "models/resourceMap/ResourceMapCommon",
], (rdf, UrlUtilities, ValueUtilities, GraphRead, ResourceMapCommon) => {
  const PROVONE_BASE_URI =
    "http://purl.dataone.org/provone/2015/01/15/ontology#";
  const EXECUTION_CLASS_URI = `${PROVONE_BASE_URI}Execution`;

  const {
    cloneObjectWithArrayValues,
    dedupeArray,
    dedupeBy,
    dedupeStrings,
    isNonEmptyString,
    normalizeText,
    sortBy,
    sortObjectKeys,
    sortStrings,
  } = ValueUtilities;

  const { getLiteralLikeObjectValue, recoverBarePidValue } = GraphRead;

  /**
   * Build a stable lookup key for an RDF node.
   * @param {NamedNode|BlankNode|Literal|null|undefined} node RDF node.
   * @returns {string} Stable node key.
   */
  function nodeKey(node) {
    return `${node?.termType || ""}::${node?.value || ""}`;
  }

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
   * Deduplicate RDF nodes.
   * @param {Array<NamedNode|BlankNode|Literal>} nodes Candidate nodes.
   * @returns {Array<NamedNode|BlankNode|Literal>} Deduplicated nodes.
   */
  function dedupeNodes(nodes) {
    return ResourceMapCommon.dedupeNodes(nodes || []);
  }

  /**
   * Choose the preferred URI for a PID from all indexed graph candidates.
   * @param {ResourceMap} resourceMap Owning resource map.
   * @param {string} pid PID being resolved.
   * @param {string[]} uris Candidate URIs.
   * @param {Map<string, string>} identifierForUri Identifier lookup by URI.
   * @returns {string|null} Preferred URI.
   */
  function buildPreferredUri(resourceMap, pid, uris, identifierForUri) {
    const candidateUris = sortStrings(Array.isArray(uris) ? [...uris] : []);
    if (!candidateUris.length) {
      return null;
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
    if (identifierMatch) {
      return identifierMatch;
    }

    const directPidUri = candidateUris.find(
      (uri) => normalizeText(uri) === pid,
    );
    if (directPidUri) {
      return directPidUri;
    }

    return candidateUris[0];
  }

  /**
   * Cached derived read state for a ResourceMap RDF graph.
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
      this.provenanceMemberFieldMap = null;
    }

    /** Clear all derived state after a graph mutation. */
    invalidate() {
      this.graphIndex = null;
      this.summaryCache.clear();
      this.provenanceMemberFieldMap = null;
    }

    /** @returns {object} Lazily built graph index. */
    getIndex() {
      if (!this.graphIndex) {
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
      const explicitMemberNodeKeys = new Set();
      const fallbackAggregateNodeKeys = new Set();
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
            if (object?.termType === "NamedNode") {
              fallbackAggregateNodeKeys.add(objectKey);
              if (subject?.value === resourceMap.aggregationUri) {
                explicitMemberNodeKeys.add(objectKey);
              }
            }
            break;
          }
          case predicateUris.oreIsAggregatedBy: {
            if (
              subject?.termType === "NamedNode" &&
              object?.value === resourceMap.aggregationUri
            ) {
              explicitMemberNodeKeys.add(subjectKey);
            }
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
      const pidByUri = new Map();
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

        let pid = null;
        if (node?.termType === "NamedNode") {
          pid =
            identifierForUri.get(node.value) ||
            resourceMap.constructor.uriToPid(node.value);

          if (!isNonEmptyString(pid)) {
            const fragmentlessUri = UrlUtilities.stripFragment(node.value);
            if (fragmentlessUri !== node.value) {
              pid =
                identifierForUri.get(fragmentlessUri) ||
                resourceMap.constructor.uriToPid(fragmentlessUri);
            }
          }

          if (!isNonEmptyString(pid)) {
            pid =
              recoverBarePidValue(node.value) ||
              recoverBarePidValue(UrlUtilities.stripFragment(node.value));
          }
        }

        pidByNodeKey.set(key, pid || null);
        if (isNonEmptyString(pid) && node?.termType === "NamedNode") {
          pidByUri.set(node.value, pid);
          addMapSetValue(urisByPid, pid, node.value);
        }

        return pid || null;
      };

      namedNodeByUri.forEach((node) => {
        resolvePidForNode(node);
      });

      const preferredUriByPid = new Map(
        Array.from(urisByPid.entries()).map(([pid, values]) => [
          pid,
          buildPreferredUri(
            resourceMap,
            pid,
            Array.from(values),
            identifierForUri,
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

      const memberCandidateNodeKeys = explicitMemberNodeKeys.size
        ? Array.from(explicitMemberNodeKeys)
        : Array.from(fallbackAggregateNodeKeys);
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
        ResourceMapCommon.buildKey,
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

      const typeAssertions = dedupeBy(
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
        ResourceMapCommon.buildKey,
      );
      const typeAssertionsByPid = new Map();
      typeAssertions.forEach((assertion) => {
        addMapSetValue(typeAssertionsByPid, assertion.pid, assertion.className);
      });

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

      const executionSummariesByKey = new Map();
      const executionNodes = dedupeNodes(
        Array.from(executionNodeKeys)
          .map((key) => nodeByKey.get(key))
          .filter(Boolean),
      );

      executionNodes.forEach((executionNode) => {
        const executionKey = nodeKey(executionNode);
        const associationNodes = dedupeNodes(
          associationNodesByExecutionKey.get(executionKey) || [],
        );
        const associations = associationNodes.map((associationNode) => {
          const associationKey = nodeKey(associationNode);
          const planNodes = dedupeNodes(
            planNodesByAssociationKey.get(associationKey) || [],
          );
          const agentUris = dedupeStrings(
            agentUrisByAssociationKey.get(associationKey) || [],
          );

          return {
            node: associationNode,
            planNodes,
            agentUris,
            programPids: dedupeStrings(
              planNodes.map((planNode) => resolvePidForNode(planNode)),
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
          ResourceMapCommon.buildKey,
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
          associationNodes,
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
      const executionNodesByIdentifier = new Map();

      executionSummariesByKey.forEach((summary) => {
        summary.programPids.forEach((programPid) => {
          addMapArrayValue(
            executionNodesByProgramPid,
            programPid,
            summary.node,
          );
        });
        if (isNonEmptyString(summary.identifier)) {
          addMapArrayValue(
            executionNodesByIdentifier,
            summary.identifier,
            summary.node,
          );
        }
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
        ResourceMapCommon.buildKey,
      );

      const generatedByPrograms = dedupeBy(
        wasGeneratedByStatements.flatMap((statement) => {
          const dataPid = resolvePidForNode(statement.subject);
          const executionSummary = executionSummariesByKey.get(
            nodeKey(statement.object),
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
        ResourceMapCommon.buildKey,
      );

      const usedByPrograms = dedupeBy(
        usedStatements.flatMap((statement) => {
          const dataPid = resolvePidForNode(statement.object);
          const executionSummary = executionSummariesByKey.get(
            nodeKey(statement.subject),
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
        ResourceMapCommon.buildKey,
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
        ResourceMapCommon.buildKey,
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
        ResourceMapCommon.buildKey,
      );

      return {
        nodeByKey,
        namedNodeByUri,
        nodesByIdentifier,
        identifierForNodeKey,
        identifierForUri,
        pidByNodeKey,
        pidByUri,
        urisByPid,
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
        executionNodesByIdentifier,
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
      snapshot.documentationLinks = ResourceMapCommon.sortByBuildKey(
        snapshot.documentationLinks,
      );
      snapshot.metadataPids = sortStrings([...(snapshot.metadataPids || [])]);
      snapshot.documentedObjectPids = sortStrings([
        ...(snapshot.documentedObjectPids || []),
      ]);
      snapshot.provenance = {
        wasDerivedFrom: ResourceMapCommon.sortByBuildKey(
          snapshot.provenance?.wasDerivedFrom,
        ),
        generatedByPrograms: ResourceMapCommon.sortByBuildKey(
          snapshot.provenance?.generatedByPrograms,
        ),
        usedByPrograms: ResourceMapCommon.sortByBuildKey(
          snapshot.provenance?.usedByPrograms,
        ),
        wasInformedByPrograms: ResourceMapCommon.sortByBuildKey(
          snapshot.provenance?.wasInformedByPrograms,
        ),
        typeAssertions: ResourceMapCommon.sortByBuildKey(
          snapshot.provenance?.typeAssertions,
        ),
      };

      return snapshot;
      /* eslint-enable no-param-reassign */
    }

    /**
     * Build or read a cached package summary.
     * @param {object} [options] Summary options.
     * @param {boolean} [options.includeProvenanceFields] Include projected
     * provenance fields on members.
     * @returns {ResourceMapSummary} Cloned package summary.
     */
    getSummary({ includeProvenanceFields = true } = {}) {
      const cacheKey = includeProvenanceFields
        ? "withProvenance"
        : "withoutProvenance";
      const cachedSummary = this.summaryCache.get(cacheKey);
      if (cachedSummary) {
        return ValueUtilities.deepClone(cachedSummary);
      }

      const index = this.getIndex();
      const isDocumentedBy = new Map();
      const documents = new Map();

      index.documentationLinks.forEach((link) => {
        if (!isDocumentedBy.has(link.dataPid)) {
          isDocumentedBy.set(link.dataPid, []);
        }
        isDocumentedBy.get(link.dataPid).push(link.metadataPid);

        if (!documents.has(link.metadataPid)) {
          documents.set(link.metadataPid, []);
        }
        documents.get(link.metadataPid).push(link.dataPid);
      });

      const provenanceFieldMap = includeProvenanceFields
        ? this.getProvenanceMemberFieldMap()
        : null;
      const members = index.memberDescriptors.map((descriptor) => {
        const member = {
          pid: descriptor.pid,
          uri: descriptor.uri,
          isDocumentedBy: sortStrings([
            ...(isDocumentedBy.get(descriptor.pid) || []),
          ]),
          documents: sortStrings([...(documents.get(descriptor.pid) || [])]),
          atLocations: [...descriptor.atLocations],
          displayAtLocations: [...descriptor.displayAtLocations],
        };

        if (includeProvenanceFields) {
          Object.assign(
            member,
            cloneObjectWithArrayValues(provenanceFieldMap?.[descriptor.pid]),
          );
        }

        return member;
      });

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
        metadataPids: dedupeArray(
          index.documentationLinks.map((link) => link.metadataPid),
        ),
        documentedObjectPids: dedupeArray(
          index.documentationLinks.map((link) => link.dataPid),
        ),
      });

      this.summaryCache.set(cacheKey, ValueUtilities.deepClone(summary));
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

    /**
     * Infer a resolve-service base from indexed named nodes.
     * @param {string|null} [fallbackBaseUrl] Value returned when none is found.
     * @returns {string|null} Inferred or fallback base URL.
     */
    inferResolveBase(fallbackBaseUrl = null) {
      const index = this.getIndex();
      const candidateValues = Array.from(index.namedNodeByUri.keys());

      for (let i = 0; i < candidateValues.length; i += 1) {
        const baseUrl = UrlUtilities.extractBaseUrl(candidateValues[i], {
          requiredPathSegment: "/resolve/",
          trailingSlash: "ensure",
        });
        if (baseUrl) {
          return baseUrl;
        }
      }

      return fallbackBaseUrl;
    }

    /** @returns {string|null} Inferred resource-map node URI. */
    inferResourceMapUri() {
      const index = this.getIndex();
      const byIdentifier = index.nodesByIdentifier.get(
        this.resourceMap.resourceMapPid,
      );
      const identifierMatch = (byIdentifier || []).find(
        (node) => node?.termType === "NamedNode",
      );
      if (identifierMatch) {
        return identifierMatch.value;
      }

      const exactResolveUri = Array.from(index.namedNodeByUri.keys()).find(
        (uri) =>
          this.resourceMap.constructor.uriToPid(uri) ===
          this.resourceMap.resourceMapPid,
      );
      return exactResolveUri || null;
    }

    /** @returns {string|null} Inferred aggregation node URI. */
    inferAggregationUri() {
      const describesStatement = this.resourceMap.graph.statementsMatching(
        rdf.sym(this.resourceMap.resourceMapUri),
        this.resourceMap.ns.ORE("describes"),
        undefined,
        undefined,
      )[0];
      if (describesStatement?.object?.value) {
        return describesStatement.object.value;
      }

      const describedByStatement = this.resourceMap.graph.statementsMatching(
        undefined,
        this.resourceMap.ns.ORE("isDescribedBy"),
        rdf.sym(this.resourceMap.resourceMapUri),
        undefined,
      )[0];
      return describedByStatement?.subject?.value || null;
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
     * @param {object} [options] Read options.
     * @param {boolean} [options.includeProvenanceFields] Include projected
     * provenance fields.
     * @returns {ResourceMapMember|null} Member summary when present.
     */
    getMember(pid, { includeProvenanceFields = false } = {}) {
      const normalizedPid = normalizeText(pid);
      if (!isNonEmptyString(normalizedPid)) {
        return null;
      }

      const index = this.getIndex();
      const descriptor = index.memberDescriptorByPid.get(normalizedPid);
      if (!descriptor) {
        return null;
      }

      const member = {
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

      if (includeProvenanceFields) {
        Object.assign(
          member,
          cloneObjectWithArrayValues(
            this.getProvenanceMemberFieldMap()?.[normalizedPid],
          ),
        );
      }

      return member;
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
      return dedupeArray(
        this.getIndex().documentationLinks.map((link) => link.metadataPid),
      );
    }

    /** @returns {string[]} Unique documented member PIDs. */
    getDocumentedObjectPids() {
      return dedupeArray(
        this.getIndex().documentationLinks.map((link) => link.dataPid),
      );
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
     * Find indexed named nodes for an identifier.
     * @param {string} identifier Identifier to resolve.
     * @returns {NamedNode[]} Matching named nodes.
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

    /** @returns {Object<string, object>} Cached provenance fields by PID. */
    getProvenanceMemberFieldMap() {
      if (!this.provenanceMemberFieldMap) {
        this.provenanceMemberFieldMap =
          this.resourceMap.provenance.getMemberFieldMap();
      }
      return this.provenanceMemberFieldMap;
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
        associationNodes: [...summary.associationNodes],
        associations: summary.associations.map((association) => ({
          ...association,
          planNodes: [...association.planNodes],
          agentUris: [...association.agentUris],
          programPids: [...association.programPids],
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

    /**
     * Return association nodes for an execution.
     * @param {NamedNode|BlankNode} executionNode Execution node.
     * @returns {Array<NamedNode|BlankNode>} Association nodes.
     */
    getAssociationNodesForExecution(executionNode) {
      return this.getExecutionSummary(executionNode)?.associationNodes || [];
    }

    /**
     * Return programs associated with an execution.
     * @param {NamedNode|BlankNode} executionNode Execution node.
     * @returns {object[]} Program summaries.
     */
    getProgramsForExecution(executionNode) {
      return this.getExecutionSummary(executionNode)?.programs || [];
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

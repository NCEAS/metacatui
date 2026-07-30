"use strict";

define([
  "common/UrlUtilities",
  "common/ValueUtilities",
  "models/resourceMap/RDFGraph",
  "models/resourceMap/ResourceMapCommon",
], (UrlUtilities, ValueUtilities, RDFGraph, ResourceMapCommon) => {
  const TYPE_ASSERTION_CLASS_NAMES = new Set(["Data", "Program"]);

  const {
    addMapArrayValue,
    addMapSetValue,
    dedupeBy,
    dedupeStrings,
    isNonEmptyString,
    normalizeText,
    sortBy,
    sortStrings,
  } = ValueUtilities;

  const { NAMESPACES, NS, PROV_EDGE_SPECS } = ResourceMapCommon;

  const PROVONE_BASE_URI = NAMESPACES.PROVONE;
  const EXECUTION_CLASS_URI = NS.PROVONE("Execution").value;
  const PREDICATE_URIS = Object.freeze({
    identifier: NS.DCTERMS("identifier").value,
    rdfType: NS.RDF("type").value,
    oreAggregates: NS.ORE("aggregates").value,
    oreIsAggregatedBy: NS.ORE("isAggregatedBy").value,
    citoDocuments: NS.CITO("documents").value,
    citoIsDocumentedBy: NS.CITO("isDocumentedBy").value,
    provAtLocation: NS.PROV("atLocation").value,
    dcCreator: NS.DC("creator").value,
    dctermsCreator: NS.DCTERMS("creator").value,
    dcModified: NS.DC("modified").value,
    dctermsModified: NS.DCTERMS("modified").value,
    foafName: NS.FOAF("name").value,
    provWasDerivedFrom: NS.PROV("wasDerivedFrom").value,
    provWasGeneratedBy: NS.PROV("wasGeneratedBy").value,
    provUsed: NS.PROV("used").value,
    provWasInformedBy: NS.PROV("wasInformedBy").value,
    provQualifiedAssociation: NS.PROV("qualifiedAssociation").value,
    provHadPlan: NS.PROV("hadPlan").value,
  });

  /**
   * Choose one existing RDF URI for summaries that use PIDs. Member editing
   * does not rely on this choice; it reads every exact member URI and rejects
   * ambiguous membership.
   * @param {ResourceMap} resourceMap Resource Map being read
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
    const candidateUris = sortStrings(uris);
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

    const canonicalUri = resourceMap.pidToUri(pid);
    if (candidateUris.includes(canonicalUri)) {
      return canonicalUri;
    }

    const exactResolveUri = candidateUris.find((uri) =>
      ResourceMapCommon.isResolveUriForPid(uri, pid, {
        allowFragment: false,
      }),
    );
    if (exactResolveUri) {
      return exactResolveUri;
    }

    const fragmentResolveUri = candidateUris.find((uri) =>
      ResourceMapCommon.isResolveUriForPid(
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
   * Sort one provenance statement into the collections needed to build the
   * index.
   * @param {string} predicateUri Predicate URI
   * @param {object} scan Collected statements and lookup inputs
   * @param {RDFGraphStatement} statement RDF statement
   * @param {string} subjectKey Subject term key
   * @param {string} objectKey Object term key
   */
  function scanProvenanceStatement(
    predicateUri,
    scan,
    statement,
    subjectKey,
    objectKey,
  ) {
    const {
      wasDerivedFromStatements,
      wasGeneratedByStatements,
      usedStatements,
      wasInformedByStatements,
      executionTermKeys,
      managedLinkExecutionKeys,
      associationNodesByExecutionKey,
      planNodesByAssociationKey,
    } = scan;
    const { object } = statement;

    switch (predicateUri) {
      case PREDICATE_URIS.provWasDerivedFrom: {
        wasDerivedFromStatements.push(statement);
        break;
      }
      case PREDICATE_URIS.provWasGeneratedBy: {
        const executionKey = PROV_EDGE_SPECS.generatedByProgram.dataFromObject
          ? subjectKey
          : objectKey;
        wasGeneratedByStatements.push(statement);
        managedLinkExecutionKeys.add(executionKey);
        executionTermKeys.add(executionKey);
        break;
      }
      case PREDICATE_URIS.provUsed: {
        const executionKey = PROV_EDGE_SPECS.usedByProgram.dataFromObject
          ? subjectKey
          : objectKey;
        usedStatements.push(statement);
        managedLinkExecutionKeys.add(executionKey);
        executionTermKeys.add(executionKey);
        break;
      }
      case PREDICATE_URIS.provWasInformedBy: {
        wasInformedByStatements.push(statement);
        executionTermKeys.add(subjectKey);
        executionTermKeys.add(objectKey);
        managedLinkExecutionKeys.add(subjectKey);
        managedLinkExecutionKeys.add(objectKey);
        break;
      }
      case PREDICATE_URIS.provQualifiedAssociation: {
        executionTermKeys.add(subjectKey);
        addMapArrayValue(associationNodesByExecutionKey, subjectKey, object);
        break;
      }
      case PREDICATE_URIS.provHadPlan: {
        addMapArrayValue(planNodesByAssociationKey, subjectKey, object);
        break;
      }
      default:
        break;
    }
  }

  /**
   * Sort one RDF statement into the collections needed to build the index.
   * @param {ResourceMap} resourceMap Resource Map being indexed
   * @param {object} scan Collected statements and lookup inputs
   * @param {RDFGraphStatement} statement RDF statement
   */
  function scanResourceMapStatement(resourceMap, scan, statement) {
    const {
      identifierValuesByTermKey,
      typeUrisByTermKey,
      foafNamesByTermKey,
      creatorStatements,
      modifiedValues,
      aggregateStatements,
      isAggregatedByStatements,
      documentationEdges,
      atLocationStatements,
      executionTermKeys,
    } = scan;

    const { subject, object } = statement;
    const predicateUri = statement.predicate?.value;
    const subjectKey = RDFGraph.buildTermKey(subject);
    const objectKey = RDFGraph.buildTermKey(object);

    switch (predicateUri) {
      case PREDICATE_URIS.identifier: {
        const identifierValue = normalizeText(RDFGraph.getLiteralValue(object));
        if (isNonEmptyString(identifierValue)) {
          addMapArrayValue(
            identifierValuesByTermKey,
            subjectKey,
            identifierValue,
          );
        }
        break;
      }
      case PREDICATE_URIS.rdfType: {
        if (RDFGraph.isNamedNode(object)) {
          addMapArrayValue(typeUrisByTermKey, subjectKey, object.value);
          if (object.value === EXECUTION_CLASS_URI) {
            executionTermKeys.add(subjectKey);
          }
        }
        break;
      }
      case PREDICATE_URIS.foafName: {
        const nameValue = normalizeText(RDFGraph.getLiteralValue(object));
        if (isNonEmptyString(nameValue)) {
          addMapArrayValue(foafNamesByTermKey, subjectKey, nameValue);
        }
        break;
      }
      case PREDICATE_URIS.oreAggregates: {
        aggregateStatements.push(statement);
        break;
      }
      case PREDICATE_URIS.oreIsAggregatedBy: {
        isAggregatedByStatements.push(statement);
        break;
      }
      case PREDICATE_URIS.citoDocuments: {
        documentationEdges.push({
          metadataNode: subject,
          dataNode: object,
        });
        break;
      }
      case PREDICATE_URIS.citoIsDocumentedBy: {
        documentationEdges.push({
          metadataNode: object,
          dataNode: subject,
        });
        break;
      }
      case PREDICATE_URIS.provAtLocation: {
        const rawPath = normalizeText(RDFGraph.getLiteralValue(object));
        if (isNonEmptyString(rawPath)) {
          atLocationStatements.push({
            subjectNode: subject,
            path: rawPath,
          });
        }
        break;
      }
      case PREDICATE_URIS.dcCreator:
      case PREDICATE_URIS.dctermsCreator: {
        if (
          RDFGraph.isNamedNode(subject) &&
          subject.value === resourceMap.resourceMapUri
        ) {
          creatorStatements.push(statement);
        }
        break;
      }
      case PREDICATE_URIS.dcModified:
      case PREDICATE_URIS.dctermsModified: {
        if (
          RDFGraph.isNamedNode(subject) &&
          subject.value === resourceMap.resourceMapUri
        ) {
          const modifiedValue = normalizeText(RDFGraph.getLiteralValue(object));
          if (isNonEmptyString(modifiedValue)) {
            modifiedValues.push(modifiedValue);
          }
        }
        break;
      }
      case PREDICATE_URIS.provWasDerivedFrom:
      case PREDICATE_URIS.provWasGeneratedBy:
      case PREDICATE_URIS.provUsed:
      case PREDICATE_URIS.provWasInformedBy:
      case PREDICATE_URIS.provQualifiedAssociation:
      case PREDICATE_URIS.provHadPlan: {
        scanProvenanceStatement(
          predicateUri,
          scan,
          statement,
          subjectKey,
          objectKey,
        );
        break;
      }
      default:
        break;
    }
  }

  /**
   * Read every graph statement once and group the values needed for later
   * package and provenance lookups.
   * @param {ResourceMap} resourceMap Resource Map being indexed
   * @returns {object} Collected statements and lookup inputs
   */
  function scanStatements(resourceMap) {
    const baseIndex = resourceMap.graph.createIndex();
    const scan = {
      termByKey: baseIndex.termByKey,
      namedNodeByUri: baseIndex.namedNodeByUri,
      identifierValuesByTermKey: new Map(),
      typeUrisByTermKey: new Map(),
      foafNamesByTermKey: new Map(),
      creatorStatements: [],
      modifiedValues: [],
      aggregateStatements: [],
      isAggregatedByStatements: [],
      documentationEdges: [],
      atLocationStatements: [],
      wasDerivedFromStatements: [],
      wasGeneratedByStatements: [],
      usedStatements: [],
      wasInformedByStatements: [],
      executionTermKeys: new Set(),
      managedLinkExecutionKeys: new Set(),
      associationNodesByExecutionKey: new Map(),
      planNodesByAssociationKey: new Map(),
    };

    resourceMap.graph.getStatements().forEach((statement) => {
      scanResourceMapStatement(resourceMap, scan, statement);
    });

    return scan;
  }

  /**
   * Build lookups between RDF nodes, declared identifiers, and DataONE PIDs.
   * @param {object} scan Collected statements and lookup inputs
   * @returns {object} Identity lookups and shared PID resolver
   */
  function buildIdentityIndex(scan) {
    const { termByKey, namedNodeByUri, identifierValuesByTermKey } = scan;
    const identifiersByTermKey = new Map();
    const identifierForTermKey = new Map();
    identifierValuesByTermKey.forEach((values, key) => {
      const identifiers = dedupeStrings(values);
      identifiersByTermKey.set(key, identifiers);

      const node = termByKey.get(key);
      const isNamedNode = RDFGraph.isNamedNode(node);
      const uriPid = isNamedNode
        ? ResourceMapCommon.recoverPidFromUri(node.value, {
            allowBareValue: true,
          })
        : null;
      const preferredIdentifier =
        identifiers.find(
          (identifier) =>
            isNamedNode &&
            (ResourceMapCommon.identifierMatchesPid(identifier, uriPid) ||
              identifier === node.value),
        ) || (identifiers.length === 1 ? identifiers[0] : null);
      identifierForTermKey.set(key, preferredIdentifier);
    });
    const identifierForUri = new Map();
    identifierForTermKey.forEach((identifierValue, key) => {
      const node = termByKey.get(key);
      if (RDFGraph.isNamedNode(node) && isNonEmptyString(identifierValue)) {
        // PID lookups collapse DataONE URL aliases, while the raw
        // identifier indexes above preserve imported RDF literals exactly.
        identifierForUri.set(
          node.value,
          ResourceMapCommon.managedIdentifierValuePid(identifierValue),
        );
      }
    });

    const pidByTermKey = new Map();
    const urisByPid = new Map();

    /**
     * Resolve a PID using only lookups collected for this index.
     * @param {NamedNode|BlankNode|Literal|null|undefined} node Candidate node
     * @returns {string|null} Resolved PID
     */
    const resolvePidForNode = (node) => {
      const key = RDFGraph.buildTermKey(node);
      if (pidByTermKey.has(key)) {
        return pidByTermKey.get(key);
      }

      // Prefer an exact node's unambiguous declared identifier. If several
      // identifiers all disagree with a known URL PID, leave the node
      // unresolved so normalization cannot add the URL PID and hide the
      // contradiction that validation needs to report.
      const identifiers = identifiersByTermKey.get(key) || [];
      const hasAmbiguousDeclaredIdentifiers =
        identifiers.length > 1 && !identifierForTermKey.get(key);
      const pid =
        RDFGraph.isNamedNode(node) && !hasAmbiguousDeclaredIdentifiers
          ? ResourceMapCommon.recoverPidFromUri(node.value, {
              identifierForUri,
              allowBareValue: true,
            })
          : null;

      pidByTermKey.set(key, pid || null);
      if (isNonEmptyString(pid) && RDFGraph.isNamedNode(node)) {
        addMapSetValue(urisByPid, pid, node.value);
      }

      return pid || null;
    };

    namedNodeByUri.forEach((node) => {
      resolvePidForNode(node);
    });

    return {
      identifiersByTermKey,
      identifierForTermKey,
      identifierForUri,
      pidByTermKey,
      urisByPid,
      resolvePidForNode,
    };
  }

  /**
   * Add each member's stored locations and read the Resource Map creator and
   * modified date.
   * @param {Array<{pid: string, uri: string}>} memberDescriptors Members
   * without atLocation metadata
   * @param {object} scan Collected statements and lookup inputs
   * @returns {object} Member metadata and descriptive resource map values
   */
  function buildPackageMetadata(memberDescriptors, scan) {
    const {
      foafNamesByTermKey,
      creatorStatements,
      modifiedValues,
      atLocationStatements,
    } = scan;
    const atLocationsByMemberUri = new Map();
    atLocationStatements.forEach(({ subjectNode, path }) => {
      if (RDFGraph.isNamedNode(subjectNode)) {
        addMapArrayValue(atLocationsByMemberUri, subjectNode.value, path);
      }
    });
    const descriptorsWithLocations = memberDescriptors.map((descriptor) => {
      const atLocations = sortStrings(
        dedupeStrings(atLocationsByMemberUri.get(descriptor.uri) || []),
      );
      return {
        ...descriptor,
        atLocations,
      };
    });
    const memberDescriptorByPid = new Map(
      descriptorsWithLocations.map((descriptor) => [
        descriptor.pid,
        descriptor,
      ]),
    );

    const namedCreator = creatorStatements.find(({ object }) => {
      const names = foafNamesByTermKey.get(RDFGraph.buildTermKey(object));
      return !RDFGraph.isLiteral(object) && names?.length;
    })?.object;
    const creatorName = namedCreator
      ? foafNamesByTermKey.get(RDFGraph.buildTermKey(namedCreator))[0]
      : creatorStatements
          .map(({ object }) => normalizeText(RDFGraph.getLiteralValue(object)))
          .find(isNonEmptyString) || null;

    return {
      memberDescriptors: descriptorsWithLocations,
      memberDescriptorByPid,
      creatorName,
      modified: modifiedValues[0] || null,
    };
  }

  /**
   * Build package member, metadata documentation, creator, and modified date
   * lookups.
   * @param {ResourceMap} resourceMap Resource Map being indexed
   * @param {object} scan Collected statements and lookup inputs
   * @param {object} identity Identity lookups and shared PID resolver
   * @returns {object} Package lookups and summaries
   */
  function buildPackageProjection(resourceMap, scan, identity) {
    const {
      termByKey,
      namedNodeByUri,
      aggregateStatements,
      isAggregatedByStatements,
      documentationEdges,
    } = scan;
    const {
      identifiersByTermKey,
      identifierForUri,
      urisByPid,
      resolvePidForNode,
    } = identity;

    const memberTermKeys = new Set();
    const aggregationKey = RDFGraph.buildTermKey(
      RDFGraph.createNamedNode(resourceMap.aggregationUri),
    );
    aggregateStatements.forEach((statement) => {
      if (
        RDFGraph.isNamedNode(statement.object) &&
        ResourceMapCommon.isAbsoluteIri(statement.object.value) &&
        RDFGraph.buildTermKey(statement.subject) === aggregationKey
      ) {
        memberTermKeys.add(RDFGraph.buildTermKey(statement.object));
      }
    });
    isAggregatedByStatements.forEach((statement) => {
      if (
        RDFGraph.isNamedNode(statement.subject) &&
        ResourceMapCommon.isAbsoluteIri(statement.subject.value) &&
        RDFGraph.buildTermKey(statement.object) === aggregationKey
      ) {
        memberTermKeys.add(RDFGraph.buildTermKey(statement.subject));
      }
    });
    // The UI groups records by PID, but RDF still distinguishes exact URIs.
    // Keep every URI linked to the selected aggregation so duplicate member
    // identities can be reported instead of silently choosing one.
    const membershipDescriptors = Array.from(memberTermKeys)
      .map((key) => {
        const node = termByKey.get(key);
        const pid = resolvePidForNode(node);
        return isNonEmptyString(pid) ? { pid, uri: node.value } : null;
      })
      .filter(Boolean);
    const memberPids = dedupeStrings(
      membershipDescriptors.map(({ pid }) => pid),
    );
    const memberSet = new Set(memberPids);
    const memberUrisByPid = new Map();
    membershipDescriptors.forEach(({ pid, uri }) => {
      addMapSetValue(memberUrisByPid, pid, uri);
    });
    const preferredUriByPid = new Map(
      Array.from(urisByPid.entries()).map(([pid, values]) => [
        pid,
        buildPreferredUri(
          resourceMap,
          pid,
          Array.from(memberUrisByPid.get(pid) || values),
          identifierForUri,
          memberSet.has(pid),
        ),
      ]),
    );
    const memberDescriptors = memberPids.map((pid) => ({
      pid,
      uri: preferredUriByPid.get(pid),
    }));

    const nodesByIdentifier = new Map();
    identifiersByTermKey.forEach((identifiers, key) => {
      const node = termByKey.get(key);
      identifiers.forEach((identifierValue) => {
        addMapArrayValue(nodesByIdentifier, identifierValue, node);
      });
    });
    namedNodeByUri.forEach((node, uri) => {
      addMapArrayValue(nodesByIdentifier, normalizeText(uri), node);
    });

    const documentationLinksByKey = new Map();
    documentationEdges.forEach(({ metadataNode, dataNode }) => {
      const metadataPid = resolvePidForNode(metadataNode);
      const dataPid = resolvePidForNode(dataNode);
      if (!metadataPid || !dataPid) return;

      const link = { metadataPid, dataPid };
      const key = RDFGraph.buildKey([metadataPid, dataPid]);
      const metadataIsMember = memberTermKeys.has(
        RDFGraph.buildTermKey(metadataNode),
      );
      const dataIsMember = memberTermKeys.has(RDFGraph.buildTermKey(dataNode));
      if (metadataIsMember && dataIsMember) {
        documentationLinksByKey.set(key, link);
      }
    });
    const documentationLinks = Array.from(documentationLinksByKey.values());
    const isDocumentedByByPid = new Map();
    const documentsByPid = new Map();
    documentationLinks.forEach(({ metadataPid, dataPid }) => {
      addMapSetValue(isDocumentedByByPid, dataPid, metadataPid);
      addMapSetValue(documentsByPid, metadataPid, dataPid);
    });

    const packageMetadata = buildPackageMetadata(memberDescriptors, scan);

    return {
      preferredUriByPid,
      nodesByIdentifier,
      ...packageMetadata,
      membershipDescriptors,
      memberUrisByPid,
      memberPids,
      memberSet,
      documentationLinks,
      isDocumentedByByPid,
      documentsByPid,
    };
  }

  /**
   * Determine which PIDs represent data and which represent programs, using
   * both explicit types and how nodes participate in provenance relationships.
   * @param {object} scan Collected statements and lookup inputs
   * @param {object} identity Identity lookups and shared PID resolver
   * @returns {object} Data and program role lookups and summaries
   */
  function buildRoleProjection(scan, identity) {
    const {
      termByKey,
      typeUrisByTermKey,
      wasDerivedFromStatements,
      wasGeneratedByStatements,
      usedStatements,
      managedLinkExecutionKeys,
      associationNodesByExecutionKey,
      planNodesByAssociationKey,
    } = scan;
    const { resolvePidForNode } = identity;

    // Public type summaries include only the supported Data and Program
    // classes. Execution RDF remains unchanged and appears in execution
    // summaries instead.
    const explicitTypeAssertions = Array.from(
      typeUrisByTermKey.entries(),
    ).flatMap(([subjectKey, classUris]) => {
      const pid = resolvePidForNode(termByKey.get(subjectKey));
      if (!pid) {
        return [];
      }
      return dedupeStrings(classUris)
        .filter((classUri) => classUri.startsWith(PROVONE_BASE_URI))
        .map((classUri) => ({
          pid,
          className: classUri.slice(PROVONE_BASE_URI.length),
        }))
        .filter(({ className }) => TYPE_ASSERTION_CLASS_NAMES.has(className));
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
    [
      [wasGeneratedByStatements, PROV_EDGE_SPECS.generatedByProgram],
      [usedStatements, PROV_EDGE_SPECS.usedByProgram],
    ].forEach(([statements, { dataFromObject }]) => {
      statements.forEach((statement) => {
        const pid = resolvePidForNode(
          dataFromObject ? statement.object : statement.subject,
        );
        if (pid) {
          rolePidSets.Data.add(pid);
        }
      });
    });
    associationNodesByExecutionKey.forEach((associationNodes, executionKey) => {
      const executionNode = termByKey.get(executionKey);
      if (
        (!RDFGraph.isNamedNode(executionNode) &&
          !RDFGraph.isBlankNode(executionNode)) ||
        !managedLinkExecutionKeys.has(executionKey)
      ) {
        return;
      }
      associationNodes.forEach((associationNode) => {
        const planNodes =
          planNodesByAssociationKey.get(
            RDFGraph.buildTermKey(associationNode),
          ) || [];
        planNodes
          .map(resolvePidForNode)
          .filter(Boolean)
          .forEach((pid) => rolePidSets.Program.add(pid));
      });
    });

    // Provenance relationships can imply Data and Program types. Derive those
    // types for summaries instead of storing generated statements in the graph.
    // Serialization adds them when needed, while explicit imported types remain
    // unchanged.
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
      ({ pid, className }) => RDFGraph.buildKey([pid, className]),
    );

    return {
      typeAssertions,
      rolePidSets,
    };
  }

  /**
   * Build a summary for each program run and a lookup from program PID to its
   * runs.
   * @param {object} scan Collected statements and lookup inputs
   * @param {object} identity Identity lookups and shared PID resolver
   * @returns {object} Program run lookups and summaries
   */
  function buildExecutionProjection(scan, identity) {
    const {
      termByKey,
      typeUrisByTermKey,
      executionTermKeys,
      managedLinkExecutionKeys,
      associationNodesByExecutionKey,
      planNodesByAssociationKey,
    } = scan;
    const { identifiersByTermKey, identifierForTermKey, resolvePidForNode } =
      identity;

    const executionSummariesByKey = new Map();
    const executionNodes = Array.from(executionTermKeys)
      .map((key) => termByKey.get(key))
      .filter(
        (node) => RDFGraph.isNamedNode(node) || RDFGraph.isBlankNode(node),
      );

    executionNodes.forEach((executionNode) => {
      const executionKey = RDFGraph.buildTermKey(executionNode);
      const associations = RDFGraph.dedupeTerms(
        associationNodesByExecutionKey.get(executionKey) || [],
      ).map((associationNode) => {
        const associationKey = RDFGraph.buildTermKey(associationNode);
        return {
          node: associationNode,
          planNodes: RDFGraph.dedupeTerms(
            planNodesByAssociationKey.get(associationKey) || [],
          ),
        };
      });

      const programPids = dedupeStrings(
        associations
          .flatMap(({ planNodes }) => planNodes)
          .map(resolvePidForNode)
          .filter(isNonEmptyString),
      );

      const identifierLiteral = identifierForTermKey.get(executionKey) || null;
      const identifierValues = identifiersByTermKey.get(executionKey) || [];
      const identifier =
        identifierLiteral ||
        (RDFGraph.isNamedNode(executionNode)
          ? normalizeText(executionNode.value)
          : null);

      executionSummariesByKey.set(executionKey, {
        node: executionNode,
        executionKey,
        isExecution: dedupeStrings(
          typeUrisByTermKey.get(executionKey) || [],
        ).includes(EXECUTION_CLASS_URI),
        identifier,
        hasIdentifierLiteral: identifierValues.length > 0,
        hasAmbiguousIdentifier:
          identifierValues.length > 1 && !identifierLiteral,
        associations,
        programPids,
        hasManagedLinks: managedLinkExecutionKeys.has(executionKey),
      });
    });

    const executionNodesByProgramPid = new Map();

    executionSummariesByKey.forEach((summary) => {
      summary.programPids.forEach((programPid) => {
        addMapArrayValue(executionNodesByProgramPid, programPid, summary.node);
      });
    });

    return {
      executionNodes,
      executionSummariesByKey,
      executionNodesByProgramPid,
    };
  }

  /**
   * Convert `wasInformedBy` links between program runs into current and
   * previous program pairs.
   * @param {RDFGraphStatement[]} wasInformedByStatements Informed by
   * statements
   * @param {Map<string, object>} executionSummariesByKey Execution summaries
   * by term key
   * @returns {ProgramLineageRelationship[]} Program lineage relationships
   */
  function buildWasInformedByPrograms(
    wasInformedByStatements,
    executionSummariesByKey,
  ) {
    return dedupeBy(
      wasInformedByStatements.flatMap((statement) => {
        const currentExecution = executionSummariesByKey.get(
          RDFGraph.buildTermKey(statement.subject),
        );
        const previousExecution = executionSummariesByKey.get(
          RDFGraph.buildTermKey(statement.object),
        );
        if (!currentExecution || !previousExecution) {
          return [];
        }

        return currentExecution.programPids.flatMap((programPid) =>
          previousExecution.programPids.map((previousProgramPid) => ({
            programPid,
            previousProgramPid,
            executionId: normalizeText(currentExecution.identifier),
            previousExecutionId: normalizeText(previousExecution.identifier),
          })),
        );
      }),
      ({ programPid, previousProgramPid, executionId, previousExecutionId }) =>
        RDFGraph.buildKey([
          programPid,
          previousProgramPid,
          executionId,
          previousExecutionId,
        ]),
    );
  }

  /**
   * Convert RDF provenance statements into plain relationship summaries keyed
   * by PID.
   * @param {object} scan Collected statements and lookup inputs
   * @param {object} identity Identity lookups and shared PID resolver
   * @param {object} executionProjection Program run lookups
   * @returns {object} Provenance relationship summaries
   */
  function buildProvenanceProjection(scan, identity, executionProjection) {
    const {
      wasDerivedFromStatements,
      wasGeneratedByStatements,
      usedStatements,
      wasInformedByStatements,
    } = scan;
    const { resolvePidForNode } = identity;
    const { executionSummariesByKey } = executionProjection;

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
      ({ derivedPid, sourcePid }) => RDFGraph.buildKey([derivedPid, sourcePid]),
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
            RDFGraph.buildTermKey(executionNode),
          );
          if (!dataPid || !executionSummary) {
            return [];
          }
          // The editor works at program level, but these detailed summaries
          // keep execution identity so imported runs remain distinct when RDF
          // is serialized, parsed again, or cleaned up.
          return executionSummary.programPids.map((programPid) => ({
            dataPid,
            programPid,
            executionId: normalizeText(executionSummary.identifier),
            ...(executionSummary.identifier
              ? {}
              : { executionKey: executionSummary.executionKey }),
          }));
        }),
        ({ dataPid, programPid, executionId, executionKey }) =>
          RDFGraph.buildKey([dataPid, programPid, executionId, executionKey]),
      );

    // prov:wasGeneratedBy stores the data PID in the subject position;
    // prov:used stores it in the object position.
    const generatedByPrograms = projectExecutionProgramRelationships(
      wasGeneratedByStatements,
      PROV_EDGE_SPECS.generatedByProgram.dataFromObject,
    );
    const usedByPrograms = projectExecutionProgramRelationships(
      usedStatements,
      PROV_EDGE_SPECS.usedByProgram.dataFromObject,
    );

    const wasInformedByPrograms = buildWasInformedByPrograms(
      wasInformedByStatements,
      executionSummariesByKey,
    );

    return {
      wasDerivedFrom,
      generatedByPrograms,
      usedByPrograms,
      wasInformedByPrograms,
    };
  }

  /**
   * Build one plain package member record from the graph index.
   * @param {object} index Derived graph index
   * @param {{pid: string, uri: string, atLocations: string[]}} descriptor
   * Indexed member descriptor
   * @returns {ResourceMapMember} Member summary
   */
  function buildMemberSummary(index, descriptor) {
    return {
      pid: descriptor.pid,
      uri: descriptor.uri,
      isDocumentedBy: sortStrings([
        ...(index.isDocumentedByByPid.get(descriptor.pid) || []),
      ]),
      documents: sortStrings([
        ...(index.documentsByPid.get(descriptor.pid) || []),
      ]),
      atLocations: [...descriptor.atLocations],
    };
  }

  /**
   * Cache plain lookups and summaries derived from a Resource Map's RDF graph.
   * This class never changes the graph. ResourceMap clears the cache after each
   * graph edit, and the next read rebuilds it. Keeping these derived values
   * avoids repeating the same graph scans during reads and validation.
   * @class ResourceMapState
   * @classcategory Models/ResourceMap
   * @since 0.0.0
   */
  class ResourceMapState {
    /**
     * @param {object} options State options
     * @param {ResourceMap} options.resourceMap Resource Map to index
     */
    constructor({ resourceMap } = {}) {
      this.resourceMap = resourceMap;
      this.cachedSummary = null;
      this.graphIndex = null;
    }

    /** Clear all derived state after a graph mutation. */
    invalidate() {
      this.graphIndex = null;
      this.cachedSummary = null;
    }

    /**
     * Clone an indexed record list so callers can mutate the result safely.
     * @param {string} field Graph index field holding plain record objects
     * @returns {object[]} Shallow cloned records
     */
    cloneRecords(field) {
      return this.getIndex()[field].map((record) => ({ ...record }));
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
     * Build all cached lookups used by ResourceMap reads and validation.
     * @returns {object} Derived graph index
     */
    buildGraphIndex() {
      const { resourceMap } = this;
      const scan = scanStatements(resourceMap);
      const identity = buildIdentityIndex(scan);
      const executionProjection = buildExecutionProjection(scan, identity);

      return {
        identifiersByTermKey: identity.identifiersByTermKey,
        pidByTermKey: identity.pidByTermKey,
        ...buildPackageProjection(resourceMap, scan, identity),
        ...buildRoleProjection(scan, identity),
        ...executionProjection,
        ...buildProvenanceProjection(scan, identity, executionProjection),
      };
    }

    /**
     * Return a cached plain package summary, building it on the first read.
     * @returns {ResourceMapSummary} Cloned package summary.
     */
    getSummary() {
      if (this.cachedSummary) {
        return ValueUtilities.deepClone(this.cachedSummary);
      }

      const index = this.getIndex();
      const members = index.memberDescriptors.map((descriptor) =>
        buildMemberSummary(index, descriptor),
      );

      const summary = {
        resourceMapPid: this.resourceMap.resourceMapPid,
        resourceMapUri: this.resourceMap.resourceMapUri,
        aggregationUri: this.resourceMap.aggregationUri,
        resolveServiceUrl: this.resourceMap.resolveServiceUrl,
        members: sortBy(members, (member) => member.pid),
        documentationLinks: ResourceMapCommon.sortByFields(
          index.documentationLinks,
          ["metadataPid", "dataPid"],
        ),
        creatorName: index.creatorName,
        modified: index.modified,
        provenance: this.resourceMap.provenance.toJSON(),
      };

      this.cachedSummary = summary;
      return ValueUtilities.deepClone(summary);
    }

    /** @returns {ResourceMapValidationContext} Shared validation inputs. */
    createValidationContext() {
      return {
        resourceMap: this.resourceMap,
        ns: this.resourceMap.ns,
        resourceMapNode: RDFGraph.createNamedNode(
          this.resourceMap.resourceMapUri,
        ),
        aggregationNode: RDFGraph.createNamedNode(
          this.resourceMap.aggregationUri,
        ),
      };
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
      return descriptor ? buildMemberSummary(index, descriptor) : null;
    }

    /**
     * Test whether a PID belongs to the package.
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

    /** @returns {Array<{pid: string, uri: string}>} Exact membership nodes. */
    getMemberDescriptors() {
      return this.cloneRecords("membershipDescriptors");
    }

    /**
     * Return every exact RDF URI used by package members that claim one PID.
     * @param {string} pid Member PID
     * @returns {string[]} Sorted package member URIs
     */
    getMemberUris(pid) {
      const normalizedPid = normalizeText(pid);
      if (!isNonEmptyString(normalizedPid)) return [];
      return sortStrings(
        Array.from(this.getIndex().memberUrisByPid.get(normalizedPid) || []),
      );
    }

    /** @returns {ResMapDocLink[]} Cloned documentation links. */
    getDocumentationLinks() {
      return this.cloneRecords("documentationLinks");
    }

    /**
     * Find RDF resources that declare a given identifier.
     * @param {string} identifier Identifier to resolve.
     * @returns {Array<NamedNode|BlankNode>} Matching RDF resource nodes.
     */
    findNodesByIdentifier(identifier) {
      return RDFGraph.dedupeTerms(
        this.getIndex().nodesByIdentifier.get(normalizeText(identifier)) || [],
      );
    }

    /**
     * Return the PID represented by an RDF node when the index can determine it
     * safely.
     * @param {NamedNode|BlankNode|Literal} node RDF node.
     * @returns {string|null} PID when resolvable.
     */
    pidFromNode(node) {
      return (
        this.getIndex().pidByTermKey.get(RDFGraph.buildTermKey(node)) || null
      );
    }

    /**
     * Return the preferred existing RDF URI for a PID.
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
      return (
        isNonEmptyString(normalizedPid) &&
        (
          this.getIndex().identifiersByTermKey.get(
            RDFGraph.buildTermKey(node),
          ) || []
        ).includes(normalizedPid)
      );
    }

    /** @returns {TypeAssertion[]} Data and Program classifications. */
    getTypeAssertions() {
      return this.cloneRecords("typeAssertions");
    }

    /**
     * Return PIDs classified as one PROVONE type, such as `Data` or `Program`.
     * @param {string} className PROVONE class name.
     * @returns {Set<string>} Matching PIDs.
     */
    getRolePidSet(className) {
      return new Set(this.getIndex().rolePidSets[className] || []);
    }

    /** @returns {Array<NamedNode|BlankNode>} RDF nodes representing program runs. */
    getExecutionNodes() {
      return [...this.getIndex().executionNodes];
    }

    /**
     * Return a safe copy of one program run summary.
     * @param {NamedNode|BlankNode} executionNode Execution node.
     * @returns {object|null} Execution summary.
     */
    getExecutionSummary(executionNode) {
      const summary = this.getIndex().executionSummariesByKey.get(
        RDFGraph.buildTermKey(executionNode),
      );
      if (!summary) {
        return null;
      }
      return {
        ...summary,
        associations: summary.associations.map((association) => ({
          ...association,
          planNodes: [...association.planNodes],
        })),
        programPids: [...summary.programPids],
      };
    }

    /**
     * Find the recorded runs of one program.
     * @param {string} programPid Program PID.
     * @returns {Array<NamedNode|BlankNode>} Matching executions.
     */
    getExecutionNodesForProgram(programPid) {
      return [
        ...(this.getIndex().executionNodesByProgramPid.get(
          normalizeText(programPid),
        ) || []),
      ];
    }

    /** @returns {WasDerivedFromRelationship[]} Data source relationships. */
    getWasDerivedFromLinks() {
      return this.cloneRecords("wasDerivedFrom");
    }

    /** @returns {ExecutionProgramRelationship[]} Links from programs to data they produced. */
    getGeneratedByPrograms() {
      return this.cloneRecords("generatedByPrograms");
    }

    /** @returns {ExecutionProgramRelationship[]} Links from programs to data they consumed. */
    getUsedByPrograms() {
      return this.cloneRecords("usedByPrograms");
    }

    /** @returns {ProgramLineageRelationship[]} Current/previous program links. */
    getWasInformedByPrograms() {
      return this.cloneRecords("wasInformedByPrograms");
    }
  }

  return ResourceMapState;
});

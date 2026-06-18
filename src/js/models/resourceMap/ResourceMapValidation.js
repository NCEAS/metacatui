"use strict";

define([
  "rdflib",
  "common/DateUtilities",
  "common/ValidationUtilities",
  "common/ValueUtilities",
], (rdf, DateUtilities, ValidationUtilities, ValueUtilities) => {
  const { createValidationIssue } = ValidationUtilities;
  const { isNonEmptyString } = ValueUtilities;

  /**
   * Check whether the graph contains at least one matching statement.
   * @param {IndexedFormula} graph RDF graph to search.
   * @param {NamedNode|BlankNode|undefined} subject Subject filter.
   * @param {NamedNode|undefined} predicate Predicate filter.
   * @param {NamedNode|BlankNode|Literal|undefined} object Object filter.
   * @returns {boolean} True when a matching statement exists.
   */
  function hasStatement(graph, subject, predicate, object) {
    return !!graph.statementsMatching(subject, predicate, object, undefined)
      .length;
  }

  /**
   * Validate that the graph matches the canonical DataONE package structure.
   * @param {object} context Validation context from
   * {@link ResourceMap#getValidationContext}.
   * @returns {object[]} Validation issues, or an empty array when valid.
   */
  function validatePackageStructure(context) {
    const {
      aggregationNode,
      graph,
      memberPids,
      ns,
      resourceMap,
      resourceMapNode,
    } = context;
    const graphState = resourceMap.getGraphState();
    const problems = [];
    const addProblem = (reason, details = {}) =>
      problems.push({ reason, ...details });

    if (
      !resourceMap.constructor.isResolveUriForPid(
        resourceMap.resourceMapUri,
        resourceMap.resourceMapPid,
        { allowFragment: false },
      )
    ) {
      addProblem("invalidResourceMapUri", {
        resourceMapUri: resourceMap.resourceMapUri,
      });
    }
    [
      [
        "missingResourceMapType",
        resourceMapNode,
        ns.RDF("type"),
        ns.ORE("ResourceMap"),
      ],
      [
        "missingDescribes",
        resourceMapNode,
        ns.ORE("describes"),
        aggregationNode,
      ],
      [
        "missingAggregationType",
        aggregationNode,
        ns.RDF("type"),
        ns.ORE("Aggregation"),
      ],
      [
        "missingIsDescribedBy",
        aggregationNode,
        ns.ORE("isDescribedBy"),
        resourceMapNode,
      ],
    ].forEach(([reason, subject, predicate, object]) => {
      if (!hasStatement(graph, subject, predicate, object)) addProblem(reason);
    });

    if (!graphState.nodeHasIdentifier(resourceMapNode, resourceMap.resourceMapPid)) {
      addProblem("missingResourceMapIdentifier");
    }
    if (
      isNonEmptyString(resourceMap.aggregationUri) &&
      !resourceMap.aggregationUri.startsWith(`${resourceMap.resourceMapUri}#`)
    ) {
      addProblem("nonHashAggregationUri", {
        aggregationUri: resourceMap.aggregationUri,
      });
    }

    graph
      .statementsMatching(aggregationNode, ns.ORE("aggregates"), undefined)
      .forEach(({ object }) => {
        if (!graphState.pidFromNode(object)) {
          addProblem("aggregatedResourceMissingPid", {
            resourceUri: object?.value || null,
          });
        }
      });

    memberPids.forEach((pid) => {
      const memberUri = resourceMap.getNodeUriForPid(pid);
      const memberNode = rdf.sym(memberUri);
      if (!resourceMap.constructor.isResolveUriForPid(memberUri, pid)) {
        addProblem("invalidMemberUri", { pid, memberUri });
      }
      if (
        !hasStatement(
          graph,
          aggregationNode,
          ns.ORE("aggregates"),
          memberNode,
        )
      ) {
        addProblem("missingAggregates", { pid });
      }
      if (!graphState.nodeHasIdentifier(memberNode, pid)) {
        addProblem("missingMemberIdentifier", { pid });
      }
    });

    return problems.length
      ? [
          createValidationIssue({
            field: "resourceMap",
            code: "invalidPackageStructure",
            message:
              "The resource map does not match the canonical DataONE package structure.",
            reasons: problems.map(({ reason }) => reason),
            problems,
          }),
        ]
      : [];
  }

  /**
   * Build a validation issue for an invalid documentation link.
   * @param {string} reason Machine-readable reason code.
   * @param {object} [details] Extra fields to merge into the issue.
   * @returns {object} A documentation-link validation issue.
   */
  function invalidDocumentationLink(reason, details = {}) {
    return createValidationIssue({
      field: "documentationLinks",
      code: "invalidDocumentationLink",
      message: "A documentation link is incomplete or has invalid endpoints.",
      reason,
      ...details,
    });
  }

  /**
   * Validate the CiTO documentation links between metadata and data members.
   * @param {object} context Validation context from
   * {@link ResourceMap#getValidationContext}.
   * @returns {object[]} Validation issues, or an empty array when valid.
   */
  function validateDocumentationLinks(context) {
    const {
      documentationLinks,
      graph,
      hasSoloMemberSelfDocumentationCandidate,
      memberSet,
      ns,
      resourceMap,
    } = context;
    const graphState = resourceMap.getGraphState();
    const issues = [];

    if (
      !documentationLinks.length &&
      !hasSoloMemberSelfDocumentationCandidate
    ) {
      issues.push(
        createValidationIssue({
          field: "documentationLinks",
          code: "missingPackageStructure",
          message:
            "A DataONE resource map must contain at least one documented aggregated object.",
        }),
      );
    }

    [
      [ns.CITO("documents"), "subject", "missingMetadataPid"],
      [ns.CITO("documents"), "object", "missingDataPid"],
      [ns.CITO("isDocumentedBy"), "subject", "missingDataPid"],
      [ns.CITO("isDocumentedBy"), "object", "missingMetadataPid"],
    ].forEach(([predicate, endpoint, reason]) => {
      graph
        .statementsMatching(undefined, predicate, undefined)
        .forEach((statement) => {
          if (!graphState.pidFromNode(statement[endpoint])) {
            issues.push(
              invalidDocumentationLink(reason, {
                predicate: predicate.value,
                endpoint,
                value: statement[endpoint]?.value || null,
              }),
            );
          }
        });
    });

    documentationLinks.forEach((link) => {
      const metadataNode = rdf.sym(resourceMap.getNodeUriForPid(link.metadataPid));
      const dataNode = rdf.sym(resourceMap.getNodeUriForPid(link.dataPid));
      if (!memberSet.has(link.metadataPid)) {
        issues.push(invalidDocumentationLink("metadataNotAggregated", link));
      }
      if (!memberSet.has(link.dataPid)) {
        issues.push(invalidDocumentationLink("dataNotAggregated", link));
      }
      if (
        !hasStatement(
          graph,
          metadataNode,
          ns.CITO("documents"),
          dataNode,
        )
      ) {
        issues.push(invalidDocumentationLink("missingDocuments", link));
      }
      if (
        !hasStatement(
          graph,
          dataNode,
          ns.CITO("isDocumentedBy"),
          metadataNode,
        )
      ) {
        issues.push(invalidDocumentationLink("missingIsDocumentedBy", link));
      }
    });

    return issues;
  }

  /**
   * Validate that every `prov:atLocation` subject is an aggregated member.
   * @param {object} context Validation context from
   * {@link ResourceMap#getValidationContext}.
   * @returns {object[]} Validation issues, or an empty array when valid.
   */
  function validateAtLocations(context) {
    const { graph, memberSet, ns, resourceMap } = context;
    const graphState = resourceMap.getGraphState();
    return graph
      .statementsMatching(undefined, ns.PROV("atLocation"), undefined)
      .flatMap((statement) => {
        const pid = graphState.pidFromNode(statement.subject);
        let reason = null;
        if (!pid) {
          reason = "missingPid";
        } else if (!memberSet.has(pid)) {
          reason = "memberNotAggregated";
        }
        return reason
          ? [
              createValidationIssue({
                field: "atLocations",
                code: "invalidAtLocationReference",
                message:
                  "A prov:atLocation statement does not reference an aggregated member.",
                reason,
                pid: pid || null,
                subjectUri: statement.subject?.value || null,
                atLocationValue: statement.object?.value || null,
              }),
            ]
          : [];
      });
  }

  /**
   * Validate that the `modified` value, when present, is a valid date-time.
   * @param {object} context Validation context from
   * {@link ResourceMap#getValidationContext}.
   * @returns {object[]} Validation issues, or an empty array when valid.
   */
  function validateModifiedDate(context) {
    const modified = context.resourceMap.getGraphState().getModifiedValue();
    return modified !== null && !DateUtilities.toDate(modified)
      ? [
          createValidationIssue({
            field: "modified",
            severity: "warning",
            code: "invalidModifiedDate",
            message: "modified must be a valid date-time value when present.",
            modified,
          }),
        ]
      : [];
  }

  /**
   * Run all resource-map validators and collect their issues.
   * @param {ResourceMap} resourceMap Resource map to validate.
   * @returns {object[]} All validation issues across every validator.
   */
  function validateResourceMap(resourceMap) {
    const context = resourceMap.getValidationContext();
    return [
      ...validatePackageStructure(context),
      ...validateDocumentationLinks(context),
      ...validateAtLocations(context),
      ...validateModifiedDate(context),
      ...resourceMap.provenance.validate(),
    ];
  }

  return { validateResourceMap };
});

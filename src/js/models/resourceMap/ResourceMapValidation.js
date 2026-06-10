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
   * Shared validation inputs reused across the local validation passes.
   * @typedef {object} ResourceMapValidationContext
   * @property {ResourceMap} resourceMap Resource map being validated.
   * @property {IndexedFormula} graph RDF graph owned by the resource map.
   * @property {object} ns Namespace helper map used to build RDF predicates.
   * @property {NamedNode} resourceMapNode Named node for the resource map URI.
   * @property {NamedNode} aggregationNode Named node for the aggregation URI.
   * @property {string[]} memberPids Aggregated member PIDs.
   * @property {Set<string>} memberSet Aggregated member PID lookup.
   * @property {ResMapDocLink[]} documentationLinks Normalized documentation
   * links recovered from the graph.
   * @property {boolean} hasSoloMemberSelfDocumentationCandidate Whether the
   * graph is using the implicit one-member package-structure fallback.
   */

  /**
   * Exact root/aggregation RDF statements that must exist for the canonical ORE
   * backbone of a DataONE resource map.
   *
   * These are the checks that used to be repeated as hand-written
   * `statementsMatching(...).length` blocks.
   */
  const REQUIRED_CORE_STATEMENTS = Object.freeze([
    {
      subject: "resourceMapNode",
      predicate: (ns) => ns.RDF("type"),
      object: (ns) => ns.ORE("ResourceMap"),
      field: "resourceMapUri",
      code: "missingResourceMapType",
      message:
        "The resource map is missing its rdf:type ore:ResourceMap statement.",
      payload: (_, { resourceMap }) => ({ pid: resourceMap.resourceMapPid }),
    },
    {
      subject: "resourceMapNode",
      predicate: (ns) => ns.ORE("describes"),
      object: "aggregationNode",
      field: "aggregationUri",
      code: "missingDescribes",
      message:
        "The resource map is missing the ore:describes link to its aggregation.",
      payload: (_, { resourceMap }) => ({ pid: resourceMap.resourceMapPid }),
    },
    {
      subject: "aggregationNode",
      predicate: (ns) => ns.RDF("type"),
      object: (ns) => ns.ORE("Aggregation"),
      field: "aggregationUri",
      code: "missingAggregationType",
      message:
        "The aggregation is missing its rdf:type ore:Aggregation statement.",
      payload: (_, { resourceMap }) => ({ pid: resourceMap.resourceMapPid }),
    },
    {
      subject: "aggregationNode",
      predicate: (ns) => ns.ORE("isDescribedBy"),
      object: "resourceMapNode",
      field: "aggregationUri",
      code: "missingIsDescribedBy",
      message:
        "The aggregation is missing the ore:isDescribedBy link back to the resource map.",
      payload: (_, { resourceMap }) => ({ pid: resourceMap.resourceMapPid }),
    },
  ]);

  /**
   * CiTO statement-endpoint checks that require one end of a statement to
   * resolve to a DataONE PID.
   *
   * Each rule says which predicate to scan, whether the failing endpoint is the
   * `subject` or `object`, and which validation issue to emit when that
   * endpoint cannot be resolved back to a DataONE object.
   */
  const ENDPOINT_PID_RULES = Object.freeze([
    {
      predicate: (ns) => ns.CITO("documents"),
      endpoint: "subject",
      field: "documentationLinks",
      code: "documentsMissingMetadataPid",
      message:
        "A cito:documents statement does not resolve its subject to a DataONE identifier.",
      payloadKey: "subjectUri",
    },
    {
      predicate: (ns) => ns.CITO("documents"),
      endpoint: "object",
      field: "documentationLinks",
      code: "documentsMissingDataPid",
      message:
        "A cito:documents statement does not resolve its object to a DataONE identifier.",
      payloadKey: "objectUri",
    },
    {
      predicate: (ns) => ns.CITO("isDocumentedBy"),
      endpoint: "subject",
      field: "documentationLinks",
      code: "isDocumentedByMissingDataPid",
      message:
        "A cito:isDocumentedBy statement does not resolve its subject to a DataONE identifier.",
      payloadKey: "subjectUri",
    },
    {
      predicate: (ns) => ns.CITO("isDocumentedBy"),
      endpoint: "object",
      field: "documentationLinks",
      code: "isDocumentedByMissingMetadataPid",
      message:
        "A cito:isDocumentedBy statement does not resolve its object to a DataONE identifier.",
      payloadKey: "objectUri",
    },
  ]);

  /**
   * Documentation-link participant checks that require both ends of a
   * normalized documentation link to be aggregated members.
   */
  const DOCUMENTATION_LINK_PARTICIPANT_RULES = Object.freeze([
    {
      pidKey: "metadataPid",
      field: "documentationLinks",
      code: "documentationMetadataNotAggregated",
      message: (link) =>
        `Documentation metadata "${link.metadataPid}" is not aggregated by the resource map.`,
    },
    {
      pidKey: "dataPid",
      field: "documentationLinks",
      code: "documentationDataNotAggregated",
      message: (link) =>
        `Documented data "${link.dataPid}" is not aggregated by the resource map.`,
    },
  ]);

  /**
   * Reciprocal CiTO statements that must exist for each normalized
   * documentation link recovered from the graph.
   */
  const DOCUMENTATION_LINK_STATEMENT_RULES = Object.freeze([
    {
      subject: "metadataNode",
      predicate: (ns) => ns.CITO("documents"),
      object: "dataNode",
      field: "documentationLinks",
      code: "missingDocumentsLink",
      message: (link) =>
        `Documentation metadata "${link.metadataPid}" is missing its cito:documents link to "${link.dataPid}".`,
      payload: (link) => ({ ...link }),
    },
    {
      subject: "dataNode",
      predicate: (ns) => ns.CITO("isDocumentedBy"),
      object: "metadataNode",
      field: "documentationLinks",
      code: "missingIsDocumentedByLink",
      message: (link) =>
        `Documented data "${link.dataPid}" is missing its cito:isDocumentedBy link back to "${link.metadataPid}".`,
      payload: (link) => ({ ...link }),
    },
  ]);

  /**
   * Per-member validation rules for aggregated package members.
   *
   * `kind: "statement"` rules check for an exact RDF triple. `kind: "custom"`
   * rules handle member checks that need custom PID or identifier logic.
   */
  const MEMBER_RULES = Object.freeze([
    {
      kind: "custom",
      validate(context, pid, memberUri) {
        if (
          context.resourceMap.constructor.isResolveUriForPid(memberUri, pid)
        ) {
          return null;
        }

        return {
          field: "memberPids",
          code: "invalidMemberUri",
          message:
            "Each aggregated DataONE object must use a resolve service URI whose final path segment is the encoded PID. Hash-form aggregation URIs are only valid when based on such a resource map URI.",
          pid,
          memberUri,
        };
      },
    },
    {
      kind: "statement",
      subject: "aggregationNode",
      predicate: (ns) => ns.ORE("aggregates"),
      object: "memberNode",
      field: "memberPids",
      code: "missingAggregates",
      message: ({ pid }) =>
        `The aggregation is missing ore:aggregates for member "${pid}".`,
      payload: ({ pid }) => ({ pid }),
    },
    {
      kind: "custom",
      validate(context, pid, _memberUri, memberNode) {
        if (
          context.resourceMap.getGraphState().nodeHasIdentifier(memberNode, pid)
        ) {
          return null;
        }

        return {
          field: "memberPids",
          code: "missingMemberIdentifier",
          message: `Member "${pid}" is missing a dcterms:identifier statement.`,
          pid,
        };
      },
    },
  ]);

  /**
   * Append one validation issue to the shared issue list.
   * @private
   * @param {object[]} issues Mutable issue accumulator.
   * @param {object} payload Validation issue payload passed to
   * `createValidationIssue()`.
   */
  function pushIssue(issues, payload) {
    issues.push(createValidationIssue(payload));
  }

  /**
   * Test whether an exact RDF statement exists in the graph.
   * @private
   * @param {IndexedFormula} graph RDF graph to inspect.
   * @param {NamedNode|BlankNode|Literal} subject Statement subject.
   * @param {NamedNode} predicate Statement predicate.
   * @param {NamedNode|BlankNode|Literal} object Statement object.
   * @returns {boolean} True when the exact statement exists.
   */
  function hasExactStatement(graph, subject, predicate, object) {
    return !!graph.statementsMatching(subject, predicate, object, undefined)
      .length;
  }

  /**
   * Resolve one rule-table node reference into a concrete RDF node.
   * @private
   * @param {ResourceMapValidationContext} context Shared validation context.
   * @param {string|Function|NamedNode|BlankNode|Literal} value Rule-table node
   * reference.
   * @returns {*} Resolved rule-table value.
   */
  function resolveRuleNode(context, value) {
    if (typeof value === "function") {
      return value(context.ns, context);
    }
    if (typeof value === "string") {
      return context[value];
    }
    return value;
  }

  /**
   * Validate one rule-table entry that expects an exact RDF statement.
   * @private
   * @param {ResourceMapValidationContext} context Shared validation context.
   * @param {object} rule Required-statement rule.
   * @param {object[]} issues Mutable issue accumulator.
   * @param {object} [extraPayload] Extra payload forwarded to rule message and
   * payload builders.
   */
  function validateExactStatementRule(
    context,
    rule,
    issues,
    extraPayload = {},
  ) {
    if (
      hasExactStatement(
        context.graph,
        resolveRuleNode(context, rule.subject),
        resolveRuleNode(context, rule.predicate),
        resolveRuleNode(context, rule.object),
      )
    ) {
      return;
    }

    pushIssue(issues, {
      field: rule.field,
      code: rule.code,
      message:
        typeof rule.message === "function"
          ? rule.message(extraPayload, context)
          : rule.message,
      ...(typeof rule.payload === "function"
        ? rule.payload(extraPayload, context)
        : rule.payload || {}),
    });
  }

  /**
   * Validate the resource map root and aggregation backbone.
   * @private
   * @param {ResourceMapValidationContext} context Shared validation context.
   * @param {object[]} issues Mutable issue accumulator.
   *
   * This pass checks the resource map URI shape, the required ORE root
   * statements, the root identifier, and the canonical `#aggregation` form.
   */
  function validateCoreRootStructure(context, issues) {
    const { resourceMap } = context;

    if (
      !resourceMap.constructor.isResolveUriForPid(
        resourceMap.resourceMapUri,
        resourceMap.resourceMapPid,
        { allowFragment: false },
      )
    ) {
      pushIssue(issues, {
        field: "resourceMapUri",
        code: "invalidResourceMapUri",
        message:
          "The resource map URI must be a DataONE resolve service URI whose final path segment is the encoded resource map PID.",
        pid: resourceMap.resourceMapPid,
        resourceMapUri: resourceMap.resourceMapUri,
      });
    }

    REQUIRED_CORE_STATEMENTS.forEach((rule) =>
      validateExactStatementRule(context, rule, issues),
    );

    if (
      !resourceMap
        .getGraphState()
        .nodeHasIdentifier(context.resourceMapNode, resourceMap.resourceMapPid)
    ) {
      pushIssue(issues, {
        field: "resourceMapPid",
        code: "missingResourceMapIdentifier",
        message:
          "The resource map is missing its dcterms:identifier statement.",
        pid: resourceMap.resourceMapPid,
      });
    }

    if (
      isNonEmptyString(resourceMap.aggregationUri) &&
      !resourceMap.aggregationUri.startsWith(`${resourceMap.resourceMapUri}#`)
    ) {
      pushIssue(issues, {
        field: "aggregationUri",
        code: "nonHashAggregationUri",
        message:
          "The aggregation URI must be a hash URI based on the resource map URI.",
        aggregationUri: resourceMap.aggregationUri,
        resourceMapUri: resourceMap.resourceMapUri,
      });
    }
  }

  /**
   * Validate aggregated members and their direct ORE membership structure.
   * @private
   * @param {ResourceMapValidationContext} context Shared validation context.
   * @param {object[]} issues Mutable issue accumulator.
   */
  function validateMembers(context, issues) {
    const { aggregationNode, graph, memberPids, ns, resourceMap } = context;

    graph
      .statementsMatching(aggregationNode, ns.ORE("aggregates"), undefined)
      .forEach((statement) => {
        if (resourceMap.getGraphState().pidFromNode(statement.object)) {
          return;
        }
        pushIssue(issues, {
          field: "memberPids",
          code: "aggregatedResourceMissingPid",
          message:
            "An ore:aggregates statement references a resource that does not resolve to a DataONE identifier.",
          resourceUri: statement.object?.value || null,
        });
      });

    memberPids.forEach((pid) => {
      const memberUri = resourceMap.getNodeUriForPid(pid);
      const memberNode = rdf.sym(memberUri);

      MEMBER_RULES.forEach((rule) => {
        if (rule.kind === "statement") {
          validateExactStatementRule(context, rule, issues, {
            pid,
            memberUri,
            memberNode,
          });
          return;
        }

        const issue = rule.validate(context, pid, memberUri, memberNode);
        if (issue) {
          pushIssue(issues, issue);
        }
      });
    });
  }

  /**
   * Validate that one statement endpoint resolves to a DataONE PID.
   * @private
   * @param {ResourceMapValidationContext} context Shared validation context.
   * @param {object} rule Endpoint-resolution rule.
   * @param {object[]} issues Mutable issue accumulator.
   */
  function validateStatementEndpointPid(context, rule, issues) {
    context.graph
      .statementsMatching(undefined, rule.predicate(context.ns), undefined)
      .forEach((statement) => {
        if (
          context.resourceMap
            .getGraphState()
            .pidFromNode(statement[rule.endpoint])
        ) {
          return;
        }

        pushIssue(issues, {
          field: rule.field,
          code: rule.code,
          message: rule.message,
          [rule.payloadKey]: statement[rule.endpoint]?.value || null,
        });
      });
  }

  /**
   * Validate the package's CiTO documentation structure.
   * @private
   * @param {ResourceMapValidationContext} context Shared validation context.
   * @param {object[]} issues Mutable issue accumulator.
   *
   * This pass covers:
   * - missing package structure
   * - malformed CiTO endpoints that do not resolve to PIDs
   * - documentation links whose metadata/data objects are not aggregated
   * - missing reciprocal `cito:documents` / `cito:isDocumentedBy` triples
   */
  function validateDocumentationLinks(context, issues) {
    const { documentationLinks, hasSoloMemberSelfDocumentationCandidate } =
      context;

    if (
      !documentationLinks.length &&
      !hasSoloMemberSelfDocumentationCandidate
    ) {
      pushIssue(issues, {
        field: "documentationLinks",
        code: "missingPackageStructure",
        message:
          "A DataONE resource map must contain at least one documented aggregated object.",
      });
    }

    ENDPOINT_PID_RULES.forEach((rule) =>
      validateStatementEndpointPid(context, rule, issues),
    );

    documentationLinks.forEach((link) => {
      const metadataNode = rdf.sym(
        context.resourceMap.getNodeUriForPid(link.metadataPid),
      );
      const dataNode = rdf.sym(
        context.resourceMap.getNodeUriForPid(link.dataPid),
      );

      DOCUMENTATION_LINK_PARTICIPANT_RULES.forEach((rule) => {
        if (context.memberSet.has(link[rule.pidKey])) {
          return;
        }

        pushIssue(issues, {
          field: rule.field,
          code: rule.code,
          message: rule.message(link),
          ...link,
        });
      });

      DOCUMENTATION_LINK_STATEMENT_RULES.forEach((rule) =>
        validateExactStatementRule(
          {
            ...context,
            metadataNode,
            dataNode,
          },
          rule,
          issues,
          link,
        ),
      );
    });
  }

  /**
   * Validate `prov:atLocation` statements for resolvable, aggregated members.
   * @private
   * @param {ResourceMapValidationContext} context Shared validation context.
   * @param {object[]} issues Mutable issue accumulator.
   */
  function validateAtLocation(context, issues) {
    context.graph
      .statementsMatching(undefined, context.ns.PROV("atLocation"), undefined)
      .forEach((statement) => {
        const pid = context.resourceMap
          .getGraphState()
          .pidFromNode(statement.subject);
        if (!pid) {
          pushIssue(issues, {
            field: "atLocations",
            code: "atLocationWithoutPid",
            message:
              "A prov:atLocation statement could not be resolved to a PID.",
            subjectUri: statement.subject?.value || null,
            atLocationValue: statement.object?.value || null,
          });
          return;
        }

        if (!context.memberSet.has(pid)) {
          pushIssue(issues, {
            field: "atLocations",
            code: "atLocationMemberNotAggregated",
            message: `prov:atLocation references "${pid}", which is not aggregated by the resource map.`,
            pid,
          });
        }
      });
  }

  /**
   * Validate the optional modified timestamp on the resource map root.
   * @private
   * @param {ResourceMapValidationContext} context Shared validation context.
   * @param {object[]} issues Mutable issue accumulator.
   */
  function validateModifiedDate(context, issues) {
    const modified = context.resourceMap.getGraphState().getModifiedValue();
    if (modified !== null && !DateUtilities.toDate(modified)) {
      pushIssue(issues, {
        field: "modified",
        severity: "warning",
        code: "invalidModifiedDate",
        message: "modified must be a valid date-time value when present.",
        modified,
      });
    }
  }

  /**
   * Validate a resource map graph and return a flat issue list.
   * @param {ResourceMap} resourceMap Resource map instance to validate.
   * @returns {object[]} Flat list of validation issues.
   * @example
   * // Required core XML:
   * // <rdf:Description rdf:about="https://cn.dataone.org/cn/v2/resolve/resource_map_urn%3Auuid%3Arm.1">
   * //   <rdf:type rdf:resource="http://www.openarchives.org/ore/terms/ResourceMap"/>
   * //   <dcterms:identifier>resource_map_urn:uuid:rm.1</dcterms:identifier>
   * //   <ore:describes rdf:resource="https://cn.dataone.org/cn/v2/resolve/resource_map_urn%3Auuid%3Arm.1#aggregation"/>
   * // </rdf:Description>
   * //
   * // validation checks that this root structure, the aggregation, the member
   * // URIs, and the package links all still match the canonical DataONE shape.
   */
  function validateResourceMap(resourceMap) {
    const issues = [];
    const context = resourceMap.getValidationContext();

    validateCoreRootStructure(context, issues);
    validateMembers(context, issues);
    validateDocumentationLinks(context, issues);
    validateAtLocation(context, issues);
    validateModifiedDate(context, issues);

    return [...issues, ...resourceMap.provenance.validate()];
  }

  return { validateResourceMap };
});

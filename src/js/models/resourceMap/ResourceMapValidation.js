"use strict";

/**
 * Check Resource Map identity, structure, documentation, dates, and provenance.
 * @module ResourceMapValidation
 * @since 0.0.0
 */

define([
  "common/DateUtilities",
  "common/ValidationUtilities",
  "common/ValueUtilities",
  "models/resourceMap/RDFGraph",
  "models/resourceMap/ResourceMapCommon",
  "models/resourceMap/ResourceMapNormalization",
], (
  DateUtilities,
  ValidationUtilities,
  ValueUtilities,
  RDFGraph,
  ResourceMapCommon,
  ResourceMapNormalization,
) => {
  const { createValidationIssue } = ValidationUtilities;
  const { isNonEmptyString } = ValueUtilities;
  const { NS, describeTerm, identifierLiteralPid, isAbsoluteNamedNode } =
    ResourceMapCommon;

  /**
   * Read PID claims only when the node URI exactly matches a configured DataONE
   * resolve or object service.
   * @param {ResourceMap} resourceMap Resource Map being inspected
   * @param {NamedNode} node Managed node
   * @returns {string[]} Distinct PIDs read from configured service URLs
   */
  function configuredEndpointPids(resourceMap, node) {
    return Array.from(
      new Set(
        [
          ResourceMapCommon.configuredEndpointPid(
            node.value,
            resourceMap.resolveServiceUrl,
          ),
          ResourceMapCommon.configuredEndpointPid(
            node.value,
            resourceMap.objectServiceUrl,
          ),
        ].filter(isNonEmptyString),
      ),
    );
  }

  /**
   * Collect every original identifier statement and PID claim for one Resource
   * Map or package member node.
   * @param {ResourceMap} resourceMap Resource Map being inspected
   * @param {NamedNode} node Managed node
   * @returns {object} Raw identifier claims
   */
  function inspectIdentifiers(resourceMap, node) {
    const statements = resourceMap.graph.findStatements({
      subject: node,
      predicate: NS.DCTERMS("identifier"),
    });
    const literalStatements = statements.filter(({ object }) =>
      RDFGraph.isLiteral(object),
    );
    const literalValues = literalStatements.map(({ object }) =>
      RDFGraph.getLiteralValue(object),
    );
    return {
      statements,
      literalValues,
      literalPids: Array.from(
        new Set(
          literalStatements
            .map(({ object }) => identifierLiteralPid(object))
            .filter(isNonEmptyString),
        ),
      ),
      invalidLiteralValues: literalStatements
        .filter(({ object }) => !isNonEmptyString(identifierLiteralPid(object)))
        .map(({ object }) => describeTerm(object)),
      resourceValues: statements
        .filter(({ object }) => !RDFGraph.isLiteral(object))
        .map(({ object }) => describeTerm(object)),
      endpointPids: configuredEndpointPids(resourceMap, node),
    };
  }

  /**
   * Add a validation issue about an original Resource Map or member identity.
   * @param {object[]} issues Target issue list
   * @param {string} code Stable issue code
   * @param {string} message Human readable message
   * @param {object} [details] Diagnostic details
   */
  function addIdentityIssue(issues, code, message, details = {}) {
    issues.push(
      createValidationIssue({
        field: "resourceMap",
        code,
        message,
        ...details,
      }),
    );
  }

  /**
   * Collect package member RDF nodes from both directions of the ORE membership
   * relationship before building a summary keyed by PID.
   * @param {ResourceMap} resourceMap Resource Map being inspected
   * @param {object[]} issues Target issue list
   * @returns {Array<{node:NamedNode,forward:boolean,inverse:boolean}>} Package
   * member nodes and the membership directions in which each was found
   */
  function collectRawMembers(resourceMap, issues) {
    const aggregationNode = RDFGraph.createNamedNode(
      resourceMap.aggregationUri,
    );
    const byKey = new Map();
    const addMember = (node, source) => {
      if (!isAbsoluteNamedNode(node)) {
        const relative =
          RDFGraph.isNamedNode(node) &&
          !ResourceMapCommon.isAbsoluteIri(node.value);
        addIdentityIssue(
          issues,
          relative ? "relativeMember" : "invalidMemberTerm",
          relative
            ? "A package member has a relative RDF identity and cannot be edited safely."
            : "A package membership statement does not identify a URI resource.",
          {
            source,
            member: describeTerm(node),
          },
        );
        return;
      }

      const key = RDFGraph.buildTermKey(node);
      const member = byKey.get(key) || {
        node,
        forward: false,
        inverse: false,
      };
      member[source] = true;
      byKey.set(key, member);
    };

    resourceMap.graph
      .findStatements({
        subject: aggregationNode,
        predicate: NS.ORE("aggregates"),
      })
      .forEach(({ object }) => addMember(object, "forward"));

    resourceMap.graph
      .findStatements({
        predicate: NS.ORE("isAggregatedBy"),
        object: aggregationNode,
      })
      .forEach(({ subject }) => addMember(subject, "inverse"));

    return Array.from(byKey.values());
  }

  /**
   * Check the original Resource Map and member identity statements before any
   * repair or summary keyed by PID can hide contradictions.
   * @param {ResourceMap} resourceMap Resource Map being inspected
   * @returns {{issues:object[],root:object,members:object[]}} Raw identity
   */
  function inspectRawIdentity(resourceMap) {
    const issues = [];
    const rootNode = RDFGraph.createNamedNode(resourceMap.resourceMapUri);
    const rootIdentifiers = inspectIdentifiers(resourceMap, rootNode);
    const rootLiteralPid =
      rootIdentifiers.literalPids.length === 1
        ? rootIdentifiers.literalPids[0]
        : null;

    if (rootIdentifiers.resourceValues.length) {
      addIdentityIssue(
        issues,
        "resourceValuedIdentifier",
        "The Resource Map identifier must be a literal value.",
        {
          resourceUri: rootNode.value,
          identifiers: rootIdentifiers.resourceValues,
        },
      );
    }
    if (
      rootIdentifiers.literalPids.length > 1 ||
      (rootIdentifiers.invalidLiteralValues.length > 0 &&
        rootIdentifiers.literalPids.length > 0) ||
      (rootLiteralPid && rootLiteralPid !== resourceMap.resourceMapPid)
    ) {
      addIdentityIssue(
        issues,
        "resourceMapIdentifierMismatch",
        "The Resource Map contains contradictory identifier claims.",
        {
          resourceUri: rootNode.value,
          outerPid: resourceMap.resourceMapPid,
          literalValues: rootIdentifiers.literalValues,
          literalPids: rootIdentifiers.literalPids,
          invalidLiteralValues: rootIdentifiers.invalidLiteralValues,
        },
      );
    }
    if (
      rootIdentifiers.endpointPids.some(
        (pid) =>
          pid !== resourceMap.resourceMapPid ||
          (rootLiteralPid && pid !== rootLiteralPid),
      )
    ) {
      addIdentityIssue(
        issues,
        "resourceMapIdentifierMismatch",
        "The configured endpoint, embedded identifier, and Resource Map object PID do not agree.",
        {
          resourceUri: rootNode.value,
          outerPid: resourceMap.resourceMapPid,
          literalPids: rootIdentifiers.literalPids,
          endpointPids: rootIdentifiers.endpointPids,
        },
      );
    }
    if (
      rootIdentifiers.statements.length > 0 &&
      rootIdentifiers.literalPids.length === 0 &&
      rootIdentifiers.resourceValues.length === 0
    ) {
      addIdentityIssue(
        issues,
        "missingResourceMapIdentifier",
        "The Resource Map identifier literal is empty.",
        { resourceUri: rootNode.value },
      );
    }

    const members = collectRawMembers(resourceMap, issues).map((member) => {
      const identifiers = inspectIdentifiers(resourceMap, member.node);
      const literalMemberPid =
        identifiers.literalPids.length === 1
          ? identifiers.literalPids[0]
          : null;
      const endpointPid =
        identifiers.endpointPids.length === 1
          ? identifiers.endpointPids[0]
          : null;

      if (identifiers.resourceValues.length) {
        addIdentityIssue(
          issues,
          "resourceValuedIdentifier",
          "A package member identifier must be a literal value.",
          {
            memberUri: member.node.value,
            identifiers: identifiers.resourceValues,
          },
        );
      }
      if (
        identifiers.literalPids.length > 1 ||
        identifiers.endpointPids.length > 1 ||
        (identifiers.invalidLiteralValues.length > 0 &&
          identifiers.literalPids.length > 0) ||
        (literalMemberPid && endpointPid && literalMemberPid !== endpointPid)
      ) {
        addIdentityIssue(
          issues,
          "memberIdentifierMismatch",
          "A package member contains contradictory identifier claims.",
          {
            memberUri: member.node.value,
            literalValues: identifiers.literalValues,
            literalPids: identifiers.literalPids,
            invalidLiteralValues: identifiers.invalidLiteralValues,
            endpointPids: identifiers.endpointPids,
          },
        );
      }

      const mayRepairMissingIdentifier =
        identifiers.statements.length === 0 && isNonEmptyString(endpointPid);
      const pid =
        literalMemberPid || (mayRepairMissingIdentifier ? endpointPid : null);
      if (!isNonEmptyString(pid) && identifiers.resourceValues.length === 0) {
        addIdentityIssue(
          issues,
          "missingMemberIdentifier",
          "A package member does not declare a DataONE PID.",
          { memberUri: member.node.value },
        );
      }

      return {
        ...member,
        pid,
        identifiers,
      };
    });

    const membersByPid = new Map();
    members.forEach(({ node, pid }) => {
      if (!isNonEmptyString(pid)) return;
      const values = membersByPid.get(pid) || [];
      values.push(node.value);
      membersByPid.set(pid, values);
    });
    membersByPid.forEach((memberUris, pid) => {
      if (memberUris.length > 1) {
        addIdentityIssue(
          issues,
          "ambiguousMemberPid",
          "More than one exact package member claims the same PID.",
          { pid, memberUris: memberUris.sort() },
        );
      }
    });

    return {
      issues,
      root: {
        node: rootNode,
        pid: resourceMap.resourceMapPid,
        identifiers: rootIdentifiers,
      },
      members,
    };
  }

  /**
   * Require the Resource Map document node and each package member that
   * MetacatUI edits to have exactly one identifier literal equal to its PID.
   *
   * The loader is allowed to turn equivalent imported values, such as `data.1`
   * and a resolver URL ending in `data.1`, into one literal containing
   * `data.1`. That repair happens only after the original statements have been
   * checked for contradictions. A later custom graph edit can add the resolver
   * form again. Both literals still claim the same PID, so the contradiction
   * check alone sees one logical value and would let both be published.
   *
   * Normal validation must not repair that later edit because doing so would
   * hide the raw statements needed to diagnose it. Instead, every managed
   * Resource Map document node and member must have exactly one identifier
   * literal, and the text of that literal must exactly equal the PID.
   *
   * This validator runs only after import repair. Running it during the original
   * identity inspection would reject safe equivalent forms before the loader
   * has a chance to replace them.
   * @param {object} identity Managed Resource Map identity
   * @returns {object[]} Validation issues
   */
  function validateCanonicalIdentifiers(identity) {
    return [identity.root, ...identity.members]
      .filter(
        ({ pid, identifiers }) =>
          identifiers.literalValues.length !== 1 ||
          identifiers.literalValues[0] !== pid,
      )
      .map(({ node, pid, identifiers }) =>
        createValidationIssue({
          field: "resourceMap",
          code: "noncanonicalIdentifier",
          message:
            "A Resource Map document or package member must have exactly one identifier literal equal to its PID.",
          nodeUri: node.value,
          pid,
          literalValues: identifiers.literalValues,
        }),
      );
  }

  /**
   * Check that the selected Resource Map, aggregation, and members have every
   * required package statement in both directions after import repair.
   * @param {object} context Resource Map validation context
   * @param {object} identity Raw identity inspection
   * @returns {object[]} Validation issues
   */
  function validatePackageStructure(context, identity) {
    const { aggregationNode, ns, resourceMap, resourceMapNode } = context;
    const { graph, graphState } = resourceMap;
    const problems = [];
    const addProblem = (reason, details = {}) =>
      problems.push({ reason, ...details });

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
      if (!graph.hasStatement({ subject, predicate, object })) {
        addProblem(reason);
      }
    });

    if (!identity.members.length) {
      // A package may omit CiTO metadata documentation links, but it must
      // contain at least one resource.
      addProblem("missingAggregatedResource");
    }

    identity.members.forEach(({ node, pid }) => {
      if (
        !graph.hasStatement({
          subject: aggregationNode,
          predicate: ns.ORE("aggregates"),
          object: node,
        })
      ) {
        addProblem("missingAggregates", { pid, memberUri: node.value });
      }
      if (
        !graph.hasStatement({
          subject: node,
          predicate: ns.ORE("isAggregatedBy"),
          object: aggregationNode,
        })
      ) {
        addProblem("missingIsAggregatedBy", {
          pid,
          memberUri: node.value,
        });
      }
      if (isNonEmptyString(pid) && !graphState.nodeHasIdentifier(node, pid)) {
        addProblem("missingMemberIdentifier", {
          pid,
          memberUri: node.value,
        });
      }
    });

    return problems.length
      ? [
          createValidationIssue({
            field: "resourceMap",
            code: "invalidPackageStructure",
            message:
              "The Resource Map is missing a required statement between its document, aggregation, or members.",
            reasons: problems.map(({ reason }) => reason),
            problems,
          }),
        ]
      : [];
  }

  /**
   * Build a validation issue for a link from metadata to documented data that
   * cannot be represented safely.
   * @param {string} reason Machine readable reason
   * @param {object} details Diagnostic details
   * @returns {object} Validation issue
   */
  function invalidDocumentationLink(reason, details) {
    return createValidationIssue({
      field: "documentationLinks",
      code: "invalidDocumentationLink",
      message:
        "A metadata documentation statement starts or ends at an RDF node that is not an exact package member.",
      reason,
      ...details,
    });
  }

  /**
   * Check that each link from metadata to documented data starts from an exact
   * package member, points to another package member, and has the matching RDF
   * statement in the opposite direction. The DataONE indexer reads only this
   * complete member to member form.
   * @param {object} context Resource Map validation context
   * @param {object} identity Raw identity inspection
   * @returns {object[]} Validation issues
   */
  function validateDocumentationLinks(context, identity) {
    const { ns, resourceMap } = context;
    const { graph } = resourceMap;
    const memberKeys = new Set(
      identity.members.map(({ node }) => RDFGraph.buildTermKey(node)),
    );
    const singletonMemberKey =
      identity.members.length === 1
        ? RDFGraph.buildTermKey(identity.members[0].node)
        : null;
    const issues = [];

    [
      [ns.CITO("documents"), ns.CITO("isDocumentedBy")],
      [ns.CITO("isDocumentedBy"), ns.CITO("documents")],
    ].forEach(([predicate, inversePredicate]) => {
      graph.findStatements({ predicate }).forEach((statement) => {
        // The current indexer scans CiTO only when the statement subject is an
        // exact package member. Preserve statements with any other subject as
        // imported RDF that MetacatUI does not manage.
        if (!memberKeys.has(RDFGraph.buildTermKey(statement.subject))) return;

        if (!memberKeys.has(RDFGraph.buildTermKey(statement.object))) {
          issues.push(
            invalidDocumentationLink("objectNotAggregated", {
              predicate: predicate.value,
              subject: describeTerm(statement.subject),
              object: describeTerm(statement.object),
            }),
          );
          return;
        }

        if (
          !graph.hasStatement({
            subject: statement.object,
            predicate: inversePredicate,
            object: statement.subject,
          })
        ) {
          const subjectKey = RDFGraph.buildTermKey(statement.subject);
          const objectKey = RDFGraph.buildTermKey(statement.object);
          // During serialization, a package with one member receives either
          // missing CiTO direction so the current DataONE indexer can read it.
          if (
            singletonMemberKey &&
            subjectKey === singletonMemberKey &&
            objectKey === singletonMemberKey
          ) {
            return;
          }
          issues.push(
            invalidDocumentationLink("missingReciprocal", {
              predicate: predicate.value,
              subject: describeTerm(statement.subject),
              object: describeTerm(statement.object),
            }),
          );
        }
      });
    });

    return issues;
  }

  /**
   * Validate that `modified`, when present, is a valid date and time.
   * @param {object} context Resource Map validation context
   * @returns {object[]} Validation issues
   */
  function validateModifiedDate(context) {
    const { ns, resourceMap, resourceMapNode } = context;
    const invalidModifiedObject = [ns.DC("modified"), ns.DCTERMS("modified")]
      .flatMap((predicate) =>
        resourceMap.graph
          .findStatements({ subject: resourceMapNode, predicate })
          .map(({ object }) => object),
      )
      .find((object) => {
        const value = RDFGraph.getLiteralValue(object);
        return !isNonEmptyString(value) || !DateUtilities.toDate(value);
      });
    const modified =
      RDFGraph.getLiteralValue(invalidModifiedObject) ||
      invalidModifiedObject?.value ||
      null;
    return invalidModifiedObject
      ? [
          createValidationIssue({
            field: "modified",
            severity: "warning",
            code: "invalidModifiedDate",
            message: "modified must be a valid date and time when present.",
            modified,
          }),
        ]
      : [];
  }

  /**
   * Check the Resource Map document and aggregation pair, member identities,
   * package structure, documentation links, dates, and provenance.
   * @param {ResourceMap} resourceMap Resource Map to validate
   * @returns {object[]} Validation issues
   */
  function validateResourceMap(resourceMap) {
    try {
      // mutateGraph() can add another `ore:describes` pair after construction.
      ResourceMapNormalization.selectImportedRoot(
        resourceMap.graph,
        resourceMap.resourceMapPid,
      );
    } catch (error) {
      if (error.code === "ambiguousResourceMapRoot") return error.issues;
      throw error;
    }

    const identity = inspectRawIdentity(resourceMap);
    // Raw contradictions must stop validation before State projects the graph
    // by PID and could hide the exact assertions that made editing unsafe.
    if (identity.issues.length) {
      return identity.issues;
    }
    const context = resourceMap.graphState.createValidationContext();
    return [
      ...validateCanonicalIdentifiers(identity),
      ...validatePackageStructure(context, identity),
      ...validateDocumentationLinks(context, identity),
      ...validateModifiedDate(context),
      ...resourceMap.provenance.validate(),
    ];
  }

  return { inspectRawIdentity, validateResourceMap };
});

"use strict";

/**
 * Validation helpers for provenance graph shapes the PID-based Provenance API
 * cannot represent safely.
 * @since 0.0.0
 */

define([
  "common/ValidationUtilities",
  "common/ValueUtilities",
  "models/resourceMap/ResourceMapCommon",
], (ValidationUtilities, ValueUtilities, ResourceMapCommon) => {
  const { createValidationWarning } = ValidationUtilities;
  const { dedupeStrings, isNonEmptyString, normalizeText } = ValueUtilities;

  /**
   * Build a warning for a provenance relationship with an unsupported endpoint.
   * @param {object} details Fields to merge into the warning.
   * @returns {object} A provenance-endpoint validation warning.
   */
  function invalidEndpoint(details) {
    return createValidationWarning({
      field: "provenance",
      code: "invalidProvenanceEndpoint",
      message: "A provenance relationship has an unsupported endpoint.",
      ...details,
    });
  }

  /**
   * Classify one provenance endpoint node for validation. Literals and
   * malformed external-client literal artifacts can never resolve to a PID;
   * everything else is judged by whether the graph index recovers a PID.
   * @param {Provenance} provenance Provenance instance whose graph is
   * inspected.
   * @param {NamedNode|BlankNode|Literal|null|undefined} node Endpoint node.
   * @returns {{value: string|null, reason: string|null}} Display value and
   * validation failure reason (`null` reason when the endpoint is valid).
   */
  function inspectEndpoint(provenance, node) {
    const malformedLiteral = ResourceMapCommon.extractMalformedResourceValue(
      node?.value,
    );
    const isLiteralLike =
      node?.termType === "Literal" ||
      (node?.termType === "NamedNode" && !!malformedLiteral);
    if (isLiteralLike) {
      return {
        value: malformedLiteral?.lexicalValue || normalizeText(node?.value),
        reason: "literalEndpoint",
      };
    }

    const pid = provenance.resourceMap.getGraphState().pidFromNode(node);
    return {
      value: normalizeText(node?.value) || null,
      reason: isNonEmptyString(pid) ? null : "missingPid",
    };
  }

  /**
   * Validate `prov:wasDerivedFrom` statements and their endpoints.
   * @param {Provenance} provenance Provenance instance whose graph is inspected.
   * @param {Set<string>} memberSet PIDs of the package's aggregated members.
   * @returns {object[]} Validation warnings, or an empty array when valid.
   */
  function validateWasDerivedFrom(provenance, memberSet) {
    const issues = [];
    provenance.graph
      .statementsMatching(
        undefined,
        provenance.ns.PROV("wasDerivedFrom"),
        undefined,
      )
      .forEach((statement) => {
        const endpoints = [
          ["derived", statement.subject],
          ["source", statement.object],
        ].map(([endpointName, node]) => ({
          endpointName,
          ...inspectEndpoint(provenance, node),
        }));

        endpoints.forEach(({ endpointName, value, reason }) => {
          if (reason) {
            issues.push(
              invalidEndpoint({
                predicate: "wasDerivedFrom",
                endpoint: endpointName,
                reason,
                value: value || null,
              }),
            );
          }
        });

        const graphState = provenance.resourceMap.getGraphState();
        const derivedPid = graphState.pidFromNode(statement.subject);
        const sourcePid = graphState.pidFromNode(statement.object);
        if (
          derivedPid &&
          sourcePid &&
          !memberSet.has(derivedPid) &&
          !memberSet.has(sourcePid)
        ) {
          issues.push(
            invalidEndpoint({
              predicate: "wasDerivedFrom",
              reason: "disconnectedFromPackage",
              derivedPid,
              sourcePid,
            }),
          );
        }
      });
    return issues;
  }

  /**
   * Validate the data endpoints of `wasGeneratedBy` and `used` statements.
   * @param {Provenance} provenance Provenance instance whose graph is inspected.
   * @returns {object[]} Validation warnings, or an empty array when valid.
   */
  function validateExecutionRelationshipEndpoints(provenance) {
    const issues = [];
    [
      // [predicate, data node position within the statement]
      ["wasGeneratedBy", "subject"],
      ["used", "object"],
    ].forEach(([predicate, dataPosition]) => {
      provenance.graph
        .statementsMatching(undefined, provenance.ns.PROV(predicate), undefined)
        .forEach((statement) => {
          const { value, reason } = inspectEndpoint(
            provenance,
            statement[dataPosition],
          );
          if (reason) {
            issues.push(
              invalidEndpoint({
                predicate,
                endpoint: "data",
                reason,
                value: value || null,
              }),
            );
          }
        });
    });
    return issues;
  }

  /**
   * Find execution nodes whose identifiers collide or duplicate one another.
   * @param {Provenance} provenance Provenance instance whose graph is inspected.
   * @param {Array<NamedNode|BlankNode>} executionNodes Execution nodes to check.
   * @returns {Map<string, string[]>} Reason codes keyed by execution node key.
   */
  function collectExecutionIdentifierProblems(provenance, executionNodes) {
    const graphState = provenance.resourceMap.getGraphState();
    const problemsByNodeKey = new Map();
    const addProblem = (node, reason) => {
      const key = ResourceMapCommon.nodeKey(node);
      if (!problemsByNodeKey.has(key)) {
        problemsByNodeKey.set(key, []);
      }
      problemsByNodeKey.get(key).push(reason);
    };

    dedupeStrings(
      executionNodes
        .map((node) => graphState.getExecutionIdentifier(node))
        .filter(Boolean),
    ).forEach((identifier) => {
      const nodes = graphState.findNodesByIdentifier(identifier);
      const executions = nodes.filter((node) =>
        graphState.isExecutionNode(node),
      );
      const nonExecutions = nodes.filter(
        (node) => !graphState.isExecutionNode(node),
      );
      if (nonExecutions.length) {
        executions.forEach((node) => addProblem(node, "identifierCollision"));
      }
      if (executions.length > 1) {
        executions.forEach((node) => addProblem(node, "duplicateIdentifier"));
      }
    });

    return problemsByNodeKey;
  }

  /**
   * Validate that each execution uses a graph shape the API can represent.
   * @param {Provenance} provenance Provenance instance whose graph is inspected.
   * @returns {object[]} Validation warnings, or an empty array when valid.
   */
  function validateExecutionShapes(provenance) {
    const graphState = provenance.resourceMap.getGraphState();
    const executionNodes = graphState.getExecutionNodes();
    const identifierProblems = collectExecutionIdentifierProblems(
      provenance,
      executionNodes,
    );

    return executionNodes.flatMap((executionNode) => {
      const inspection = graphState.getExecutionSummary(executionNode);
      if (!inspection) return [];

      const reasons = [
        ...(identifierProblems.get(ResourceMapCommon.nodeKey(executionNode)) ||
          []),
      ];
      if (!inspection.isExecution) reasons.push("missingType");
      if (!inspection.hasIdentifierLiteral) reasons.push("missingIdentifier");
      if (!inspection.programPids.length) reasons.push("missingProgram");
      if (inspection.associations.length > 1) {
        reasons.push("multipleAssociations");
      }
      if (inspection.programPids.length > 1) reasons.push("multiplePrograms");
      if (
        inspection.associations.some(({ planNodes }) => planNodes.length > 1)
      ) {
        reasons.push("multiplePlans");
      }
      if (
        !inspection.hasGeneratedLinks &&
        !inspection.hasUsedLinks &&
        !inspection.hasWasInformedByLinks
      ) {
        reasons.push("standaloneExecution");
      }

      const uniqueReasons = dedupeStrings(reasons);
      return uniqueReasons.length
        ? [
            createValidationWarning({
              field: "provenance.executionGraph",
              code: "unsupportedExecutionShape",
              message:
                "An execution uses a graph shape the Provenance API cannot represent safely.",
              executionId: inspection.identifier || inspection.label,
              reasons: uniqueReasons,
              programPids: inspection.programPids,
            }),
          ]
        : [];
    });
  }

  /**
   * Validate that programs referenced by provenance are aggregated members.
   * @param {Provenance} provenance Provenance instance whose graph is inspected.
   * @param {Set<string>} memberSet PIDs of the package's aggregated members.
   * @returns {object[]} Validation warnings, or an empty array when valid.
   */
  function validateNonAggregatedPrograms(provenance, memberSet) {
    const issues = [];
    const validations = [
      {
        relationships: provenance.getGeneratedByPrograms(),
        predicate: "wasGeneratedBy",
        pidFields: ["programPid"],
      },
      {
        relationships: provenance.getUsedByPrograms(),
        predicate: "used",
        pidFields: ["programPid"],
      },
      {
        relationships: provenance.getWasInformedByPrograms(),
        predicate: "wasInformedBy",
        pidFields: ["programPid", "previousProgramPid"],
      },
    ];

    validations.forEach(({ relationships, predicate, pidFields }) => {
      relationships.forEach((relationship) => {
        pidFields.forEach((pidField) => {
          const pid = relationship[pidField];
          if (isNonEmptyString(pid) && !memberSet.has(pid)) {
            issues.push(
              invalidEndpoint({
                predicate,
                endpoint: pidField,
                reason: "programNotAggregated",
                pid,
                ...relationship,
              }),
            );
          }
        });
      });
    });

    return issues;
  }

  /**
   * Run all provenance validators and collect their warnings.
   * @param {Provenance} provenance Provenance instance to validate.
   * @returns {object[]} All validation warnings across every validator.
   */
  function validateProvenance(provenance) {
    const memberSet = new Set(provenance.resourceMap.getMemberPids());
    return [
      ...validateWasDerivedFrom(provenance, memberSet),
      ...validateExecutionRelationshipEndpoints(provenance),
      ...validateExecutionShapes(provenance),
      ...validateNonAggregatedPrograms(provenance, memberSet),
    ];
  }

  return { validateProvenance };
});

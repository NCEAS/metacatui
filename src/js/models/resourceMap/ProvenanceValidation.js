"use strict";

/**
 * Check provenance relationships that MetacatUI cannot read or edit safely
 * through methods that use PIDs instead of exact RDF nodes.
 * @since 0.0.0
 * @module ProvenanceValidation
 */

define([
  "common/ValidationUtilities",
  "common/ValueUtilities",
  "models/resourceMap/RDFGraph",
  "models/resourceMap/ResourceMapCommon",
], (ValidationUtilities, ValueUtilities, RDFGraph, ResourceMapCommon) => {
  const { createValidationWarning } = ValidationUtilities;
  const { isNonEmptyString, normalizeText } = ValueUtilities;
  const { NS, PROV_EDGE_SPECS } = ResourceMapCommon;

  /**
   * Build a warning when one end of a provenance relationship does not identify
   * usable data or a usable program.
   * @param {object} details Fields to merge into the warning.
   * @returns {object} Warning about one end of a provenance relationship.
   */
  function invalidEndpoint(details) {
    return createValidationWarning({
      field: "provenance",
      code: "invalidProvenanceEndpoint",
      message:
        "One end of a provenance relationship is a literal or cannot be resolved to a PID.",
      ...details,
    });
  }

  /**
   * Determine which PID, if any, is represented by one end of a provenance
   * relationship. Literal values are invalid because relationship ends must
   * identify resources; other nodes are valid only when they resolve to a PID.
   * @param {Provenance} provenance Provenance instance whose graph is
   * inspected.
   * @param {NamedNode|BlankNode|Literal|null|undefined} node Endpoint node.
   * @returns {{pid: string|null, value: string|null, reason: string|null}}
   * Resolved PID, display value, and validation failure reason (`null` reason
   * when the endpoint is valid)
   */
  function inspectEndpoint(provenance, node) {
    const literalValue = RDFGraph.getLiteralValue(node);
    const malformedLiteral = RDFGraph.isNamedNode(node)
      ? ResourceMapCommon.extractMalformedResourceValue(node.value)
      : null;
    const pid = provenance.resourceMap.graphState.pidFromNode(node);
    if (literalValue !== null || malformedLiteral) {
      return {
        pid,
        value:
          malformedLiteral?.lexicalValue ||
          normalizeText(literalValue ?? node?.value),
        reason: "literalEndpoint",
      };
    }

    return {
      pid,
      value: normalizeText(node?.value) || null,
      reason: isNonEmptyString(pid) ? null : "missingPid",
    };
  }

  /**
   * Check that both data objects in each "was derived from" relationship have
   * usable PIDs and that at least one belongs to the package.
   * @param {Provenance} provenance Provenance instance whose graph is inspected.
   * @param {Set<string>} memberSet PIDs of the package members.
   * @returns {object[]} Validation warnings, or an empty array when valid.
   */
  function validateWasDerivedFrom(provenance, memberSet) {
    const issues = [];
    provenance.resourceMap.graph
      .findStatements({ predicate: NS.PROV("wasDerivedFrom") })
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

        const [derivedPid, sourcePid] = endpoints.map(({ pid }) => pid);
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
   * Check that data produced or consumed by a program run has a usable PID.
   * @param {Provenance} provenance Provenance instance whose graph is inspected.
   * @returns {object[]} Validation warnings, or an empty array when valid.
   */
  function validateExecutionRelationshipEndpoints(provenance) {
    const issues = [];
    [PROV_EDGE_SPECS.generatedByProgram, PROV_EDGE_SPECS.usedByProgram].forEach(
      ({ predicate, dataFromObject }) => {
        provenance.resourceMap.graph
          .findStatements({ predicate: NS.PROV(predicate) })
          .forEach((statement) => {
            const { value, reason } = inspectEndpoint(
              provenance,
              dataFromObject ? statement.object : statement.subject,
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
      },
    );
    return issues;
  }

  /**
   * Test whether a program has no recorded run yet or exactly one run that can
   * be edited safely. Multiple or structurally ambiguous imported runs remain
   * read only because choosing among them would require guessing.
   * @param {Provenance} provenance Provenance instance whose graph is inspected
   * @param {string} programPid Program PID whose execution is inspected
   * @returns {boolean} Whether the program's provenance can be edited
   */
  function isProgramExecutionEditable(provenance, programPid) {
    const { graphState } = provenance.resourceMap;
    const executionNodes = graphState.getExecutionNodesForProgram(programPid);
    if (!executionNodes.length) return true;
    if (executionNodes.length !== 1) return false;

    const inspection = graphState.getExecutionSummary(executionNodes[0]);
    // Extra statements on a clear execution do not block editing because these
    // mutations touch only the managed data relationships. The checks below
    // reject structures where selecting one execution would require guessing.
    if (
      inspection.hasAmbiguousIdentifier ||
      inspection.associations.length !== 1 ||
      inspection.programPids.length !== 1 ||
      inspection.associations[0].planNodes.length !== 1
    ) {
      return false;
    }
    if (!inspection.identifier) return true;

    return graphState.findNodesByIdentifier(inspection.identifier).length === 1;
  }

  /**
   * Check that every program referenced by provenance is a package member.
   * @param {Provenance} provenance Provenance instance whose graph is inspected.
   * @param {Set<string>} memberSet PIDs of the package members.
   * @returns {object[]} Validation warnings, or an empty array when valid.
   */
  function validateNonAggregatedPrograms(provenance, memberSet) {
    const issues = [];
    const validations = [
      {
        relationships: provenance.getGeneratedByPrograms(),
        predicate: PROV_EDGE_SPECS.generatedByProgram.predicate,
        pidFields: ["programPid"],
      },
      {
        relationships: provenance.getUsedByPrograms(),
        predicate: PROV_EDGE_SPECS.usedByProgram.predicate,
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
   * Check all supported provenance relationships and return every warning.
   * @param {Provenance} provenance Provenance instance to validate.
   * @returns {object[]} All validation warnings across every validator.
   */
  function validateProvenance(provenance) {
    const memberSet = new Set(provenance.resourceMap.getMemberPids());
    return [
      ...validateWasDerivedFrom(provenance, memberSet),
      ...validateExecutionRelationshipEndpoints(provenance),
      ...validateNonAggregatedPrograms(provenance, memberSet),
    ];
  }

  return {
    isProgramExecutionEditable,
    validateProvenance,
  };
});

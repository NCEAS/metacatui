"use strict";

define(["common/ValueUtilities"], (ValueUtilities) => {
  const { dedupeBy, hasOwn, isPlainObject, sortBy } = ValueUtilities;

  /**
   * Error raised when a requested ResourceMap edit conflicts with graph state.
   */
  class ResourceMapConflictError extends Error {
    /**
     * @param {string} message Human-readable conflict message.
     * @param {object} [options] Conflict details.
     * @param {string} [options.code] Stable conflict code.
     * @param {object|null} [options.details] Structured conflict context.
     * @param {Error|null} [options.cause] Underlying error.
     */
    constructor(
      message = "Conflict",
      { code = "conflict", details = null, cause = null } = {},
    ) {
      super(message);
      this.name = "ResourceMapConflictError";
      this.code = code;
      if (details) this.details = details;
      if (cause) this.cause = cause;
    }
  }

  /**
   * Infer ordered key parts from one known resource-map object shape.
   * @private
   * @param {Array<*>|object|*} value Key input.
   * @param {string|null} [type] Optional explicit key shape.
   * @returns {Array<*>} Ordered key parts.
   */
  function inferKeyParts(value, type = null) {
    if (Array.isArray(value)) {
      return value;
    }

    if (!isPlainObject(value)) {
      return [value];
    }

    let inferredType = type;
    if (!inferredType) {
      if (
        hasOwn(value, "operation") &&
        hasOwn(value, "subjectPid") &&
        hasOwn(value, "predicate")
      ) {
        inferredType = "fieldEdit";
      } else if (
        hasOwn(value, "subjectPid") &&
        hasOwn(value, "predicate") &&
        hasOwn(value, "objectPid")
      ) {
        inferredType = "chartRelationship";
      } else if (hasOwn(value, "derivedPid") && hasOwn(value, "sourcePid")) {
        inferredType = "wasDerivedFrom";
      } else if (hasOwn(value, "metadataPid") && hasOwn(value, "dataPid")) {
        inferredType = "documentationLink";
      } else if (hasOwn(value, "dataPid") && hasOwn(value, "programPid")) {
        inferredType = "executionProgram";
      } else if (
        hasOwn(value, "programPid") &&
        hasOwn(value, "previousProgramPid")
      ) {
        inferredType = "programLineage";
      } else if (hasOwn(value, "pid") && hasOwn(value, "className")) {
        inferredType = "typeAssertion";
      } else if (hasOwn(value, "programPid")) {
        inferredType = "programExecution";
      }
    }

    switch (inferredType) {
      case "fieldEdit":
        return [
          value.operation,
          value.subjectPid,
          value.predicate,
          value.object,
        ];
      case "chartRelationship":
        return [value.subjectPid, value.predicate, value.objectPid];
      case "wasDerivedFrom":
        return [value.derivedPid, value.sourcePid];
      case "documentationLink":
        return [value.metadataPid, value.dataPid];
      case "executionProgram":
        return [
          value.dataPid,
          value.programPid,
          value.executionId || "",
          value.agentUri || "",
        ];
      case "programLineage":
        return [
          value.programPid,
          value.previousProgramPid,
          value.executionId || "",
          value.previousExecutionId || "",
        ];
      case "typeAssertion":
        return [value.pid, value.className];
      case "programExecution":
        return [
          value.programPid || "",
          value.executionId || "",
          value.agentUri || "",
        ];
      default:
        throw new Error("Unsupported key input");
    }
  }

  const ResourceMapCommon = {
    /**
     * Build a stable key from ordered parts or a known resource-map object
     * shape.
     * @param {Array<*>|object|*} value Ordered key parts or a supported
     * relationship/assertion object.
     * @param {object} [options] Key options.
     * @param {string} [options.type] Optional explicit key shape.
     * @returns {string} Stable serialized key.
     */
    buildKey(value, { type = null } = {}) {
      return JSON.stringify(
        inferKeyParts(value, type).map((part) =>
          part == null ? "" : String(part),
        ),
      );
    },

    /**
     * Deduplicate RDF nodes by term type and value.
     * @param {Array<NamedNode|BlankNode|Literal>} nodes Candidate RDF nodes.
     * @returns {Array<NamedNode|BlankNode|Literal>} Deduplicated nodes.
     */
    dedupeNodes(nodes) {
      return dedupeBy((nodes || []).filter(Boolean), (node) =>
        ResourceMapCommon.buildKey([node?.termType || "", node?.value || ""]),
      );
    },

    /**
     * Sort one array of keyed values by the canonical resource-map key.
     * @param {Array<object|Array<*>|*>} values Values to sort.
     * @returns {Array<object|Array<*>|*>} Sorted shallow copy.
     */
    sortByBuildKey(values) {
      return sortBy(Array.isArray(values) ? [...values] : [], (value) =>
        ResourceMapCommon.buildKey(value),
      );
    },

    /**
     * Reconcile two keyed collections by removing missing items and adding new
     * ones.
     * @param {Array<*>} currentValues Current values.
     * @param {Array<*>} nextValues Desired next values.
     * @param {object} options Reconciliation options.
     * @param {Function} [options.key] Key builder.
     * @param {Function} [options.remove] Callback for values absent from next.
     * @param {Function} [options.add] Callback for values absent from current.
     * @returns {{currentByKey: Map<string, *>, nextByKey: Map<string, *>}}
     * Reconciliation lookup maps.
     */
    reconcileByKey(
      currentValues,
      nextValues,
      {
        key = (value) => ResourceMapCommon.buildKey(value),
        remove = null,
        add = null,
      } = {},
    ) {
      const currentByKey = new Map(
        (Array.isArray(currentValues) ? currentValues : []).map((value) => [
          key(value),
          value,
        ]),
      );
      const nextByKey = new Map(
        (Array.isArray(nextValues) ? nextValues : []).map((value) => [
          key(value),
          value,
        ]),
      );

      currentByKey.forEach((value, valueKey) => {
        if (!nextByKey.has(valueKey)) {
          remove?.(value, valueKey);
        }
      });
      nextByKey.forEach((value, valueKey) => {
        if (!currentByKey.has(valueKey)) {
          add?.(value, valueKey);
        }
      });

      return { currentByKey, nextByKey };
    },

    ResourceMapConflictError,
  };

  return ResourceMapCommon;
});

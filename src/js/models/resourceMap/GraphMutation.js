"use strict";

define([
  "rdflib",
  "common/ValueUtilities",
  "models/resourceMap/ResourceMapCommon",
], (rdf, ValueUtilities, ResourceMapCommon) => {
  const { isNonEmptyString, normalizeText, requireNonEmptyString } =
    ValueUtilities;

  /**
   * Add one RDF statement to the graph.
   * @param {ResourceMap} resourceMap Resource map whose graph is updated.
   * @param {NamedNode|BlankNode} subject RDF subject.
   * @param {NamedNode} predicate RDF predicate.
   * @param {NamedNode|BlankNode|Literal} object RDF object.
   */
  function addStatement(resourceMap, subject, predicate, object) {
    resourceMap.graph.add(subject, predicate, object);
    resourceMap.markGraphDirty?.();
  }

  /**
   * Remove one RDF statement from the graph.
   * @param {ResourceMap} resourceMap Resource map whose graph is updated.
   * @param {Statement|null|undefined} statement Statement to remove.
   */
  function removeStatement(resourceMap, statement) {
    if (!statement) {
      return;
    }

    resourceMap.graph.remove(statement);
    resourceMap.markGraphDirty?.();
  }

  /**
   * Add an RDF statement only when the exact triple is not already present.
   * @param {ResourceMap} resourceMap Resource map whose graph is updated.
   * @param {NamedNode|BlankNode} subject RDF subject.
   * @param {NamedNode} predicate RDF predicate.
   * @param {NamedNode|BlankNode|Literal} object RDF object.
   */
  function addStatementIfMissing(resourceMap, subject, predicate, object) {
    if (
      !resourceMap.graph.statementsMatching(
        subject,
        predicate,
        object,
        undefined,
      ).length
    ) {
      addStatement(resourceMap, subject, predicate, object);
    }
  }

  /**
   * Remove all statements matching a triple pattern.
   * @param {ResourceMap} resourceMap Resource map whose graph is updated.
   * @param {NamedNode|BlankNode|Literal|undefined} subject Subject filter.
   * @param {NamedNode|undefined} predicate Predicate filter.
   * @param {NamedNode|BlankNode|Literal|undefined} object Object filter.
   */
  function removeStatementsMatching(resourceMap, subject, predicate, object) {
    const statements = resourceMap.graph
      .statementsMatching(subject, predicate, object, undefined)
      .slice();
    statements.forEach((statement) => {
      removeStatement(resourceMap, statement);
    });
  }

  /**
   * Add reciprocal CiTO documentation statements.
   * @param {ResourceMap} resourceMap Resource map whose graph is updated.
   * @param {NamedNode} metadataNode Documenting metadata node.
   * @param {NamedNode} dataNode Documented data node.
   */
  function addDocumentationLink(resourceMap, metadataNode, dataNode) {
    addStatementIfMissing(
      resourceMap,
      metadataNode,
      resourceMap.ns.CITO("documents"),
      dataNode,
    );
    addStatementIfMissing(
      resourceMap,
      dataNode,
      resourceMap.ns.CITO("isDocumentedBy"),
      metadataNode,
    );
  }

  /**
   * Remove reciprocal CiTO documentation statements.
   * @param {ResourceMap} resourceMap Resource map whose graph is updated.
   * @param {NamedNode} metadataNode Documenting metadata node.
   * @param {NamedNode} dataNode Documented data node.
   */
  function removeDocumentationLink(resourceMap, metadataNode, dataNode) {
    removeStatementsMatching(
      resourceMap,
      metadataNode,
      resourceMap.ns.CITO("documents"),
      dataNode,
    );
    removeStatementsMatching(
      resourceMap,
      dataNode,
      resourceMap.ns.CITO("isDocumentedBy"),
      metadataNode,
    );
  }

  /**
   * Replace multiple node values in one graph pass.
   * @param {ResourceMap} resourceMap Resource map whose graph is updated.
   * @param {Map<string, string>|Object<string, string>} replacements Old-to-new
   * node value map.
   */
  function replaceNodeValues(resourceMap, replacements) {
    const normalizedReplacements = new Map(
      Array.from(
        replacements instanceof Map
          ? replacements.entries()
          : Object.entries(replacements || {}),
      )
        .map(([oldValue, newValue]) => [
          normalizeText(oldValue),
          normalizeText(newValue),
        ])
        .filter(
          ([oldValue, newValue]) =>
            isNonEmptyString(oldValue) &&
            isNonEmptyString(newValue) &&
            oldValue !== newValue,
        ),
    );

    if (!normalizedReplacements.size) {
      return;
    }

    // Only named nodes are replaced; literals and blank nodes whose values
    // happen to match a replaced URI must keep their original identity.
    resourceMap.graph.statements.slice().forEach((statement) => {
      const nextSubjectValue = normalizedReplacements.get(
        statement.subject?.termType === "NamedNode"
          ? statement.subject.value
          : null,
      );
      const nextObjectValue = normalizedReplacements.get(
        statement.object?.termType === "NamedNode"
          ? statement.object.value
          : null,
      );

      if (!nextSubjectValue && !nextObjectValue) {
        return;
      }

      const nextSubject = nextSubjectValue
        ? rdf.sym(nextSubjectValue)
        : statement.subject;
      const nextObject = nextObjectValue
        ? rdf.sym(nextObjectValue)
        : statement.object;

      removeStatement(resourceMap, statement);
      addStatementIfMissing(
        resourceMap,
        nextSubject,
        statement.predicate,
        nextObject,
      );
    });
  }

  /**
   * Replace every subject/object node value that matches one URI with another.
   * @param {ResourceMap} resourceMap Resource map whose graph is updated.
   * @param {string} oldValue Old node value.
   * @param {string} newValue New node value.
   */
  function replaceNodeValue(resourceMap, oldValue, newValue) {
    replaceNodeValues(resourceMap, new Map([[oldValue, newValue]]));
  }

  /**
   * Remove all incoming and outgoing references for one RDF node.
   * @param {ResourceMap} resourceMap Resource map whose graph is updated.
   * @param {NamedNode|BlankNode|Literal|null|undefined} node Node whose
   * references are removed.
   */
  function removeNodeReferences(resourceMap, node) {
    if (!node) return;

    removeStatementsMatching(resourceMap, node, undefined, undefined);
    removeStatementsMatching(resourceMap, undefined, undefined, node);
  }

  /**
   * Remove blank-node subtrees that have no incoming references.
   * @param {ResourceMap} resourceMap Resource map whose graph is updated.
   */
  function removeOrphanedBlankNodes(resourceMap) {
    const blankNodesByValue = new Map();
    resourceMap.graph.statements.forEach((statement) => {
      if (statement.subject?.termType === "BlankNode") {
        blankNodesByValue.set(statement.subject.value, statement.subject);
      }
      if (statement.object?.termType === "BlankNode") {
        blankNodesByValue.set(statement.object.value, statement.object);
      }
    });

    const queue = Array.from(blankNodesByValue.values()).filter((blankNode) => {
      const incoming = resourceMap.graph.statementsMatching(
        undefined,
        undefined,
        blankNode,
        undefined,
      );
      return incoming.length === 0;
    });

    const visited = new Set();

    while (queue.length) {
      const blankNode = queue.pop();
      const blankNodeKey = ResourceMapCommon.nodeKey(blankNode);
      if (!visited.has(blankNodeKey)) {
        visited.add(blankNodeKey);

        const childNodes = resourceMap.graph
          .statementsMatching(blankNode, undefined, undefined, undefined)
          .map((statement) => statement.object)
          .filter((node) => node?.termType === "BlankNode");

        removeNodeReferences(resourceMap, blankNode);

        childNodes.forEach((childNode) => {
          const incoming = resourceMap.graph.statementsMatching(
            undefined,
            undefined,
            childNode,
            undefined,
          );
          if (!incoming.length) {
            queue.push(childNode);
          }
        });
      }
    }
  }

  /**
   * Ensure a named node has the expected `dcterms:identifier` literal.
   * @param {ResourceMap} resourceMap Resource map whose graph is updated.
   * @param {string} uri Named-node URI to annotate.
   * @param {string} pid PID literal to attach.
   */
  function ensureIdentifierForUri(resourceMap, uri, pid) {
    const node = rdf.sym(uri);
    const hasIdentifier = resourceMap.graph
      .statementsMatching(
        node,
        resourceMap.ns.DCTERMS("identifier"),
        undefined,
        undefined,
      )
      .some(
        (statement) =>
          ResourceMapCommon.getLiteralObjectValue(statement.object) === pid,
      );
    if (!hasIdentifier) {
      addStatementIfMissing(
        resourceMap,
        node,
        resourceMap.ns.DCTERMS("identifier"),
        rdf.literal(pid, undefined, resourceMap.ns.XSD("string")),
      );
    }
  }

  /**
   * Resolve or synthesize the named-node URI used for a PID.
   * @param {ResourceMap} resourceMap Resource map whose graph is updated.
   * @param {string} pid PID whose node URI is needed.
   * @param {object} [options] Node-resolution options.
   * @param {boolean} [options.createIdentifier] Whether to ensure the
   * identifier literal exists.
   * @returns {string} Resolved or synthesized node URI.
   */
  function ensureNodeUriForPid(
    resourceMap,
    pid,
    { createIdentifier = false } = {},
  ) {
    const normalizedPid = requireNonEmptyString(
      pid,
      "A PID is required to find or create a node URI.",
    );
    const uri =
      resourceMap.getGraphState().findNodeUriForPid(normalizedPid) ||
      resourceMap.pidToUri(normalizedPid);

    if (createIdentifier) {
      ensureIdentifierForUri(resourceMap, uri, normalizedPid);
    }

    return uri;
  }

  /**
   * Remove conflicting identifier values and ensure the expected one exists.
   * @param {ResourceMap} resourceMap Resource map whose graph is updated.
   * @param {string} uri Named-node URI to annotate.
   * @param {string} pid PID literal to keep.
   * @param {object} [options] Identifier-update options.
   * @param {string|string[]} [options.removeValues] Identifier values to remove
   * first.
   */
  function setIdentifierForUri(
    resourceMap,
    uri,
    pid,
    { removeValues = [] } = {},
  ) {
    const node = rdf.sym(uri);
    const valuesToRemove = new Set(
      (Array.isArray(removeValues) ? removeValues : [removeValues])
        .map((value) => normalizeText(value))
        .filter(
          (value) =>
            isNonEmptyString(value) &&
            normalizeText(value) !== normalizeText(pid),
        ),
    );

    if (valuesToRemove.size) {
      const removedStatements = resourceMap.graph
        .statementsMatching(
          node,
          resourceMap.ns.DCTERMS("identifier"),
          undefined,
          undefined,
        )
        .filter((statement) =>
          valuesToRemove.has(normalizeText(statement.object?.value)),
        );
      removedStatements.forEach((statement) => {
        removeStatement(resourceMap, statement);
      });
    }

    ensureIdentifierForUri(resourceMap, uri, pid);
  }

  return {
    addStatement,
    addStatementIfMissing,
    addDocumentationLink,
    ensureIdentifierForUri,
    ensureNodeUriForPid,
    removeNodeReferences,
    removeDocumentationLink,
    removeOrphanedBlankNodes,
    removeStatement,
    removeStatementsMatching,
    replaceNodeValue,
    replaceNodeValues,
    setIdentifierForUri,
  };
});

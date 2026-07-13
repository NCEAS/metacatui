"use strict";

define(["rdflib", "common/ValueUtilities"], (rdf, ValueUtilities) => {
  const { addMapArrayValue, dedupeBy, isNonEmptyString, normalizeText } =
    ValueUtilities;

  /**
   * One RDF triple stored in the graph. A triple is one directed fact: `subject
   * --predicate--> object`.
   * @typedef {object} RDFGraphStatement
   * @property {object} subject RDF term the fact is about. Subjects are usually
   * named nodes with a URI, such as a package, member, or execution, but may be
   * blank nodes for unnamed local graph structure.
   * @property {object} predicate RDF named node that identifies the
   * relationship or property, such as `ore:aggregates`, `cito:documents`, or
   * `rdf:type`.
   * @property {object} object RDF term on the far side of the relationship.
   * Objects may be named nodes, blank nodes, or literals such as strings,
   * dates, and numbers.
   * @property {object} [why] Optional rdflib graph/context attached to the
   * statement. MetacatUI does not set this directly, but preserves it when
   * restoring existing rdflib statements during rollback.
   */

  /**
   * An RDFGraphStatement where one or more of the subject, predicate, and
   * object values may be undefined. Used for searching for statements.
   * @typedef {object} PartialRDFGraphStatement
   * @property {object} [subject] See {@link RDFGraphStatement.subject}
   * @property {object} [predicate] See {@link RDFGraphStatement.predicate}
   * @property {object} [object] See {@link RDFGraphStatement.object}
   */

  /** @enum {string} RDF term types */
  const NODE_TYPES = {
    BLANK: "BlankNode",
    NAMED: "NamedNode",
    LITERAL: "Literal",
  };

  /**
   * @class RDFGraph
   * @classdesc Wrapper for an rdflib graph store that provides convenient
   * access to statements and nodes. Keeps direct rdflib store access in one
   * place and makes it easier to update or replace the underlying library in
   * the future.
   * @since 0.0.0
   */
  class RDFGraph {
    /**
     * Create a namespace helper for building named RDF terms.
     * @param {string} uri Namespace URI
     * @returns {Function} Namespace function
     */
    static createNamespace(uri) {
      return rdf.Namespace(uri);
    }

    /**
     * Create a named RDF node from a URI. Named nodes are resources with stable
     * identifiers, so two statements using the same URI refer to the same RDF
     * resource.
     * @param {string} uri Node URI
     * @returns {object} RDF named node
     */
    static createNamedNode(uri) {
      return rdf.sym(uri);
    }

    /**
     * Create an RDF literal. Literals are concrete values, such as strings,
     * dates, or numbers, stored as data instead of as links to another
     * resource.
     * @param {*} value Literal value
     * @param {string|object} [languageOrDatatype] Language tag or datatype node
     * that describes the literal value, such as `en` or `xsd:string`.
     * @param {object} [datatype] Datatype node
     * @returns {object} RDF literal
     */
    static createLiteral(value, languageOrDatatype, datatype) {
      return rdf.literal(value, datatype || languageOrDatatype);
    }

    /**
     * Read the raw lexical value from a literal term. Returns null for named
     * nodes and blank nodes because those terms identify resources instead of
     * storing concrete values.
     * @param {NamedNode|BlankNode|Literal|null|undefined} term RDF term
     * @returns {*|null} Literal value, or null for non-literals.
     */
    static getLiteralValue(term) {
      return RDFGraph.isLiteral(term) ? term.value : null;
    }

    /**
     * Create an RDF blank node. Blank nodes are unnamed resources whose
     * identity only matters inside this graph, often used for nested structures
     * that do not have their own URI or PID.
     * @param {string} [id] Optional local blank node identifier
     * @returns {object} RDF blank node
     */
    static createBlankNode(id) {
      return rdf.blankNode(id);
    }

    /**
     * Create an RDF statement.
     * @param {object} subject Named node or blank node the statement is about
     * @param {object} predicate Named node that identifies the relationship
     * @param {object} object Named node, blank node, or literal value
     * @param {object} [why] Optional graph/context
     * @returns {RDFGraphStatement} RDF statement
     */
    static createStatement(subject, predicate, object, why) {
      return rdf.st(subject, predicate, object, why);
    }

    /**
     * Build a stable serialized key from ordered string-like parts.
     * @param {Array<*>} parts Ordered key parts
     * @returns {string} Stable serialized key
     */
    static buildKey(parts) {
      return JSON.stringify(
        parts.map((part) => (part == null ? "" : String(part))),
      );
    }

    /**
     * Build a stable identity key for one RDF term, including literal type.
     * @param {NamedNode|BlankNode|Literal|null|undefined} term RDF term
     * @returns {string} Stable term key
     */
    static buildTermKey(term) {
      if (!term) {
        return "null";
      }

      return RDFGraph.buildKey([
        term.termType || "",
        term.value || "",
        RDFGraph.isLiteral(term) ? term.lang || "" : "",
        RDFGraph.isLiteral(term) ? term.datatype?.value || "" : "",
      ]);
    }

    /**
     * Build a stable identity key for one RDF statement or statement pattern.
     * @param {{subject: *, predicate: *, object: *}} statement RDF statement
     * @returns {string} Stable statement key
     */
    static buildStatementKey(statement) {
      return RDFGraph.buildKey([
        RDFGraph.buildTermKey(statement?.subject),
        RDFGraph.buildTermKey(statement?.predicate),
        RDFGraph.buildTermKey(statement?.object),
      ]);
    }

    /**
     * Deduplicate RDF terms by exact RDF term identity.
     * @param {Array<NamedNode|BlankNode|Literal>} terms Candidate RDF terms
     * @returns {Array<NamedNode|BlankNode|Literal>} Deduplicated terms
     */
    static dedupeTerms(terms) {
      return dedupeBy((terms || []).filter(Boolean), RDFGraph.buildTermKey);
    }

    /**
     * Check whether a term is of a specific RDF term type.
     * @param {NamedNode|BlankNode|Literal|null|undefined} term RDF term
     * @param {string} type RDF term type
     * @returns {boolean} True if the term is of the specified type
     */
    static isTermOfType(term, type) {
      return term?.termType === type;
    }

    /**
     * Check whether a term is a blank node.
     * @param {NamedNode|BlankNode|Literal|null|undefined} term RDF term
     * @returns {boolean} True if the term is a blank node
     */
    static isBlankNode(term) {
      return this.isTermOfType(term, NODE_TYPES.BLANK);
    }

    /**
     * Check whether a term is a named node.
     * @param {NamedNode|BlankNode|Literal|null|undefined} term RDF term
     * @returns {boolean} True if the term is a named node
     */
    static isNamedNode(term) {
      return this.isTermOfType(term, NODE_TYPES.NAMED);
    }

    /**
     * Check whether a term is a literal node.
     * @param {NamedNode|BlankNode|Literal|null|undefined} term RDF term
     * @returns {boolean} True if the term is a literal node
     */
    static isLiteral(term) {
      return this.isTermOfType(term, NODE_TYPES.LITERAL);
    }

    /**
     * Create an RDF graph wrapper
     * @param {object} [store] An rdflib graph store
     */
    constructor(store = rdf.graph()) {
      if (
        !store ||
        typeof store.add !== "function" ||
        typeof store.remove !== "function" ||
        typeof store.statementsMatching !== "function"
      ) {
        throw new Error("RDFGraph requires an rdflib graph store.");
      }
      this.store = store;
    }

    /**
     * Parse RDF/XML into this graph.
     * @param {string} xml RDF/XML string
     * @param {string} baseUri Parser base URI
     * @returns {RDFGraph} This graph
     */
    parseXml(xml, baseUri) {
      rdf.parse(xml, this.store, baseUri, "application/rdf+xml");
      return this;
    }

    /**
     * Serialize statements to RDF/XML.
     * @param {Array<RDFGraphStatement>} statements Statements to serialize
     * @returns {string} RDF/XML
     */
    serializeStatementsToXml(statements) {
      const serializer = rdf.Serializer();
      serializer.store = this.store;
      const serializableStatements = statements.slice();
      const blankNodeSubjects = new Set();
      const incomingByBlankNode = new Map();

      statements.forEach((statement) => {
        if (RDFGraph.isBlankNode(statement.subject)) {
          blankNodeSubjects.add(RDFGraph.buildTermKey(statement.subject));
        }
        if (RDFGraph.isBlankNode(statement.object)) {
          addMapArrayValue(
            incomingByBlankNode,
            RDFGraph.buildTermKey(statement.object),
            statement,
          );
        }
      });

      incomingByBlankNode.forEach((incoming, key) => {
        if (incoming.length === 1 && !blankNodeSubjects.has(key)) {
          // The vendored rdflib.js serializer throws when a blank node has one
          // incoming edge but no statements describing it as a subject.
          // Repeating the edge makes rdflib emit rdf:nodeID instead of
          // recursing; parsing the result collapses the duplicate triple again.
          serializableStatements.push(incoming[0]);
        }
      });

      return serializer.statementsToXML(serializableStatements);
    }

    /**
     * Add a statement to the graph.
     * @param {RDFGraphStatement} statement The statement to add.
     * @returns {RDFGraph} This graph
     */
    addStatement({ subject, predicate, object, why }) {
      this.store.add(subject, predicate, object, why);
      return this;
    }

    /**
     * Add a statement only when the exact statement is missing.
     * @param {RDFGraphStatement} statement The statement to add.
     * @returns {RDFGraph} This graph
     */
    addStatementIfMissing(statement) {
      if (!this.hasStatement(statement)) {
        this.addStatement(statement);
      }
      return this;
    }

    /**
     * Remove a statement from the graph.
     * @param {RDFGraphStatement} statement The rdflib statement to remove.
     * @returns {RDFGraph} This graph
     */
    removeStatement(statement) {
      if (statement) {
        this.store.remove(statement);
      }
      return this;
    }

    /**
     * Find statements matching the provided pattern.
     * @param {PartialRDFGraphStatement} [pattern] Subject, predicate, and/or
     * object values to match.
     * @returns {Array<RDFGraphStatement>} Matching rdflib statements.
     */
    findStatements({ subject, predicate, object } = {}) {
      return this.store.statementsMatching(
        subject,
        predicate,
        object,
        undefined,
      );
    }

    /**
     * Check whether a matching statement exists.
     * @param {PartialRDFGraphStatement} [pattern] Subject, predicate, and/or
     * object values to match.
     * @returns {boolean} True if at least one statement matches.
     */
    hasStatement(pattern = {}) {
      const { subject, predicate, object } = pattern;
      return (
        this.store.statementsMatching(
          subject,
          predicate,
          object,
          undefined,
          true,
        ).length > 0
      );
    }

    /**
     * Get all statements.
     * @param {object} [options] Read options.
     * @param {boolean} [options.copy] Return a shallow copy.
     * @returns {Array<RDFGraphStatement>} The graph statements.
     */
    getStatements({ copy = false } = {}) {
      const statements = this.store.statements || [];
      return copy ? statements.slice() : statements;
    }

    /**
     * Replace current statements with a previous statement snapshot.
     * @param {Array<RDFGraphStatement>} snapshot Statements to restore.
     * @returns {RDFGraph} This graph
     */
    restoreStatements(snapshot = []) {
      this.getStatements({ copy: true }).forEach((statement) => {
        this.removeStatement(statement);
      });
      snapshot.forEach((statement) => {
        this.addStatement(statement);
      });
      return this;
    }

    /**
     * Build generic term indexes from statement subjects and objects.
     * @returns {{termByKey: Map<string, object>, namedNodeByUri: Map<string,
     * object>}} Generic graph indexes.
     */
    createIndex() {
      const termByKey = new Map();
      const namedNodeByUri = new Map();
      const registerTerm = (term) => {
        if (!term) {
          return;
        }
        const key = RDFGraph.buildTermKey(term);
        if (!termByKey.has(key)) {
          termByKey.set(key, term);
        }
        if (RDFGraph.isNamedNode(term) && !namedNodeByUri.has(term.value)) {
          namedNodeByUri.set(term.value, term);
        }
      };

      this.getStatements().forEach((statement) => {
        registerTerm(statement.subject);
        registerTerm(statement.object);
      });

      return { termByKey, namedNodeByUri };
    }

    /**
     * Remove duplicate RDF statements from the graph.
     * @returns {RDFGraph} This graph
     */
    dedupeStatements() {
      const seen = new Set();
      this.getStatements({ copy: true }).forEach((statement) => {
        const key = RDFGraph.buildStatementKey(statement);
        if (seen.has(key)) {
          this.removeStatement(statement);
          return;
        }

        seen.add(key);
      });
      return this;
    }

    /**
     * Remove all statements matching the provided pattern.
     * @param {PartialRDFGraphStatement} [pattern] Subject, predicate, and/or
     * object values to match.
     * @returns {RDFGraph} This graph
     */
    removeStatementsMatching({ subject, predicate, object } = {}) {
      this.findStatements({ subject, predicate, object })
        .slice()
        .forEach((statement) => this.removeStatement(statement));
      return this;
    }

    /**
     * Replace all references to one URI node with another URI node.
     * @param {string} oldValue The URI to replace.
     * @param {string} newValue The replacement URI.
     * @returns {RDFGraph} This graph
     */
    replaceNodeValue(oldValue, newValue) {
      return this.replaceNodeValues(new Map([[oldValue, newValue]]));
    }

    /**
     * Replace all references to URI nodes from a replacement map.
     * @param {Map<string, string>} replacements Old URI to new URI.
     * @returns {RDFGraph} This graph
     */
    replaceNodeValues(replacements) {
      if (!replacements || replacements.size === 0) {
        return this;
      }

      const normalizedReplacements = new Map();
      replacements.forEach((newUriValue, oldUriValue) => {
        const currentUri = normalizeText(oldUriValue);
        const replacementUri = normalizeText(newUriValue);
        if (
          isNonEmptyString(currentUri) &&
          isNonEmptyString(replacementUri) &&
          currentUri !== replacementUri
        ) {
          normalizedReplacements.set(
            currentUri,
            RDFGraph.createNamedNode(replacementUri),
          );
        }
      });

      if (normalizedReplacements.size === 0) {
        return this;
      }

      this.getStatements({ copy: true }).forEach((statement) => {
        const subjectReplacement = RDFGraph.isNamedNode(statement.subject)
          ? normalizedReplacements.get(statement.subject.value)
          : null;
        const objectReplacement = RDFGraph.isNamedNode(statement.object)
          ? normalizedReplacements.get(statement.object.value)
          : null;

        if (!subjectReplacement && !objectReplacement) {
          return;
        }

        this.removeStatement(statement);
        this.addStatementIfMissing({
          subject: subjectReplacement || statement.subject,
          predicate: statement.predicate,
          object: objectReplacement || statement.object,
        });
      });

      return this;
    }

    /**
     * Remove every statement where the node is subject or object.
     * @param {object} node The node to remove.
     * @returns {RDFGraph} This graph
     */
    removeNodeReferences(node) {
      if (!node) return this;
      this.removeStatementsMatching({ subject: node });
      this.removeStatementsMatching({ object: node });
      return this;
    }
  }

  RDFGraph.NODE_TYPES = NODE_TYPES;

  return RDFGraph;
});

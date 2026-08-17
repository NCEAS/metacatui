define(["rdflib", "models/resourceMap/RDFGraph"], (rdf, RDFGraph) => {
  chai.should();
  const XSD = rdf.Namespace("http://www.w3.org/2001/XMLSchema#");

  describe("RDFGraph", () => {
    it("builds distinct keys when values contain separators", () => {
      RDFGraph.buildKey(["a::b", "c"]).should.not.equal(
        RDFGraph.buildKey(["a", "b::c"]),
      );
    });

    it("wraps an rdflib store and exposes statement reads", () => {
      const store = rdf.graph();
      const graph = new RDFGraph(store);
      const subject = rdf.sym("https://example.org/subject");
      const predicate = rdf.sym("https://example.org/predicate");
      const object = rdf.literal("value");

      graph.store.should.equal(store);
      graph.addStatement({
        subject: subject,
        predicate: predicate,
        object: object,
      });

      graph
        .findStatements({ subject, predicate, object })
        .length.should.equal(1);
      graph.hasStatement({ subject, predicate, object }).should.equal(true);

      const copy = graph.getStatements({ copy: true });
      copy.length.should.equal(1);
      copy.pop();
      graph.getStatements().length.should.equal(1);

      graph.removeStatementsMatching({ subject, predicate, object });
      graph.hasStatement({ subject, predicate, object }).should.equal(false);
    });

    it("asks rdflib to stop after the first hasStatement match", () => {
      const calls = [];
      const subject = rdf.sym("https://example.org/subject");
      const predicate = rdf.sym("https://example.org/predicate");
      const object = rdf.literal("value");
      const store = {
        add() {},
        remove() {},
        statementsMatching(
          subjectArg,
          predicateArg,
          objectArg,
          whyArg,
          justOne,
        ) {
          calls.push({
            subject: subjectArg,
            predicate: predicateArg,
            object: objectArg,
            why: whyArg,
            justOne,
          });
          return [rdf.st(subjectArg, predicateArg, objectArg)];
        },
      };
      const graph = new RDFGraph(store);

      graph.hasStatement({ subject, predicate, object }).should.equal(true);

      calls.should.have.lengthOf(1);
      calls[0].should.deep.equal({
        subject,
        predicate,
        object,
        why: undefined,
        justOne: true,
      });
    });

    it("snapshots and restores statements with graph context", () => {
      const graph = new RDFGraph();
      const subject = rdf.sym("https://example.org/subject");
      const predicate = rdf.sym("https://example.org/predicate");
      const object = rdf.literal("value");
      const context = rdf.sym("https://example.org/context");
      const extraObject = rdf.literal("extra");

      graph.addStatement({ subject, predicate, object, why: context });
      const snapshot = graph.getStatements({ copy: true });
      graph.addStatement({ subject, predicate, object: extraObject });

      graph.restoreStatements(snapshot);

      graph.getStatements().length.should.equal(1);
      graph
        .findStatements({ subject, predicate, object: extraObject })
        .length.should.equal(0);
      graph
        .findStatements({ subject, predicate, object })[0]
        .why.should.equal(context);
    });

    it("builds exact RDF term and statement identity keys", () => {
      const namedNode = rdf.sym("shared-value");
      const blankNode = rdf.blankNode("shared-value");
      const stringLiteral = rdf.literal("shared-value", XSD("string"));
      const integerLiteral = rdf.literal("shared-value", XSD("integer"));
      const predicate = rdf.sym("https://example.org/test#key");

      RDFGraph.buildTermKey(namedNode).should.not.equal(
        RDFGraph.buildTermKey(blankNode),
      );
      RDFGraph.buildTermKey(stringLiteral).should.not.equal(
        RDFGraph.buildTermKey(integerLiteral),
      );
      RDFGraph.buildStatementKey(
        rdf.st(namedNode, predicate, stringLiteral),
      ).should.not.equal(
        RDFGraph.buildStatementKey(
          rdf.st(namedNode, predicate, integerLiteral),
        ),
      );
    });

    it("reads raw literal values and ignores non-literals", () => {
      RDFGraph.getLiteralValue(rdf.literal("  value  ")).should.equal(
        "  value  ",
      );
      RDFGraph.getLiteralValue(rdf.literal("bonjour", "fr")).should.equal(
        "bonjour",
      );
      RDFGraph.getLiteralValue(
        rdf.literal("42", undefined, XSD("integer")),
      ).should.equal("42");
      (
        RDFGraph.getLiteralValue(rdf.sym("https://example.org/node")) === null
      ).should.equal(true);
      (RDFGraph.getLiteralValue(rdf.blankNode()) === null).should.equal(true);
    });

    it("identifies RDF term types", () => {
      const namedNode = rdf.sym("https://example.org/node");
      const blankNode = rdf.blankNode();
      const literal = rdf.literal("value");

      RDFGraph.isNamedNode(namedNode).should.equal(true);
      RDFGraph.isBlankNode(blankNode).should.equal(true);
      RDFGraph.isLiteral(literal).should.equal(true);
      RDFGraph.isNamedNode(blankNode).should.equal(false);
      RDFGraph.isBlankNode(literal).should.equal(false);
      RDFGraph.isLiteral(namedNode).should.equal(false);
      RDFGraph.isLiteral(null).should.equal(false);
    });

    it("creates literals with an explicit third-argument datatype", () => {
      const datatype = XSD("integer");
      const literal = RDFGraph.createLiteral("42", undefined, datatype);

      literal.datatype.equals(datatype).should.equal(true);
    });

    it("dedupes RDF terms by exact identity", () => {
      const namedNode = rdf.sym("shared-value");
      const blankNode = rdf.blankNode("shared-value");
      const stringLiteral = rdf.literal("shared-value", XSD("string"));
      const integerLiteral = rdf.literal("shared-value", XSD("integer"));

      RDFGraph.dedupeTerms([
        namedNode,
        blankNode,
        namedNode,
        stringLiteral,
        integerLiteral,
        stringLiteral,
        null,
      ]).should.deep.equal([
        namedNode,
        blankNode,
        stringLiteral,
        integerLiteral,
      ]);
    });

    it("builds generic term indexes", () => {
      const graph = new RDFGraph();
      const namedSubject = rdf.sym("https://example.org/subject");
      const namedObject = rdf.sym("https://example.org/object");
      const blankSubject = rdf.blankNode("blank-subject");
      const predicateOne = rdf.sym("https://example.org/predicate/one");
      const predicateTwo = rdf.sym("https://example.org/predicate/two");
      const languageLiteral = rdf.literal("shared-value", "en");
      const typedLiteral = rdf.literal(
        "shared-value",
        undefined,
        XSD("string"),
      );

      graph.addStatement({
        subject: namedSubject,
        predicate: predicateOne,
        object: languageLiteral,
      });
      graph.addStatement({
        subject: blankSubject,
        predicate: predicateOne,
        object: namedObject,
      });
      graph.addStatement({
        subject: namedSubject,
        predicate: predicateTwo,
        object: typedLiteral,
      });

      const index = graph.createIndex();

      index.termByKey
        .get(RDFGraph.buildTermKey(namedSubject))
        .should.equal(namedSubject);
      index.termByKey
        .get(RDFGraph.buildTermKey(blankSubject))
        .should.equal(blankSubject);
      index.termByKey
        .get(RDFGraph.buildTermKey(languageLiteral))
        .should.equal(languageLiteral);
      index.termByKey
        .get(RDFGraph.buildTermKey(typedLiteral))
        .should.equal(typedLiteral);
      index.namedNodeByUri.get(namedSubject.value).should.equal(namedSubject);
      index.namedNodeByUri.get(namedObject.value).should.equal(namedObject);
      index.namedNodeByUri.has(predicateOne.value).should.equal(false);
    });

    it("dedupes statements without merging distinct literal datatypes", () => {
      const graph = new RDFGraph();
      const subject = rdf.sym("https://example.org/subject");
      const predicate = rdf.sym("https://example.org/predicate");
      const stringLiteral = rdf.literal("shared-value", XSD("string"));
      const integerLiteral = rdf.literal("shared-value", XSD("integer"));
      const contextOne = rdf.sym("https://example.org/context/1");
      const contextTwo = rdf.sym("https://example.org/context/2");

      graph.addStatement({
        subject: subject,
        predicate: predicate,
        object: stringLiteral,
        why: contextOne,
      });
      graph.addStatement({
        subject: subject,
        predicate: predicate,
        object: integerLiteral,
      });
      graph.addStatement({
        subject: subject,
        predicate: predicate,
        object: stringLiteral,
        why: contextTwo,
      });

      graph.dedupeStatements();

      graph.getStatements().length.should.equal(2);
      graph
        .findStatements({ subject, predicate, object: stringLiteral })
        .length.should.equal(1);
      graph
        .findStatements({ subject, predicate, object: integerLiteral })
        .length.should.equal(1);
    });

    it("does not rewrite literal values that match a replaced node URI", () => {
      const graph = new RDFGraph();
      const oldUri = "https://example.org/old-node";
      const newUri = "https://example.org/new-node";
      const literalSubject = rdf.sym("https://example.org/subject");
      const literalPredicate = rdf.sym("https://example.org/test#literal");

      graph.addStatement({
        subject: literalSubject,
        predicate: literalPredicate,
        object: rdf.literal(oldUri),
      });

      graph.replaceNodeValue(oldUri, newUri);

      graph
        .findStatements({
          subject: literalSubject,
          predicate: literalPredicate,
          object: rdf.literal(oldUri),
        })
        .length.should.equal(1);
    });

    it("does not rewrite blank nodes whose values collide with a replaced URI", () => {
      const graph = new RDFGraph();
      const oldUri = "https://example.org/old-node";
      const newUri = "https://example.org/new-node";
      // A hostile or buggy graph can contain a blank node whose internal
      // value equals a named node's URI; only the named node may be replaced.
      const collidingBlankNode = rdf.blankNode(oldUri);
      collidingBlankNode.value.should.equal(oldUri);
      const payloadPredicate = rdf.sym("https://example.org/test#payload");

      graph.addStatement({
        subject: collidingBlankNode,
        predicate: payloadPredicate,
        object: rdf.literal("blank node payload"),
      });

      graph.replaceNodeValue(oldUri, newUri);

      graph
        .findStatements({
          subject: collidingBlankNode,
          predicate: payloadPredicate,
        })
        .length.should.equal(1);
      graph
        .findStatements({
          subject: rdf.sym(newUri),
          predicate: payloadPredicate,
        })
        .length.should.equal(0);
    });

    it("matches blank nodes by subject and object position", () => {
      const graph = new RDFGraph();
      const subjectNode = rdf.blankNode();
      const objectNode = rdf.blankNode();
      const resourceMapNode = rdf.sym("https://example.org/resource-map");
      const predicate = rdf.sym("https://example.org/test#position");

      graph.addStatement({
        subject: subjectNode,
        predicate: predicate,
        object: rdf.literal("subject payload"),
      });
      graph.addStatement({
        subject: resourceMapNode,
        predicate: predicate,
        object: objectNode,
      });

      graph.hasStatement({ subject: subjectNode }).should.equal(true);
      graph.hasStatement({ subject: objectNode }).should.equal(false);
      graph.hasStatement({ object: objectNode }).should.equal(true);
      graph.hasStatement({ object: subjectNode }).should.equal(false);
    });
  });
});

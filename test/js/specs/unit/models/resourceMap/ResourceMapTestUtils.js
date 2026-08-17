"use strict";

define(["rdflib", "models/resourceMap/ResourceMap"], (rdf, ResourceMap) => {
  const TEST_RESOLVE_BASE = "https://cn.test.com/resolve/base/url";
  const resolveUrl = (path) => `${TEST_RESOLVE_BASE}/${path}`;

  function joinXml(lines) {
    return lines.join("\n");
  }

  function getIssueCodes(issues) {
    return issues.map((issue) => issue.code);
  }

  /**
   * Create a canonical ResourceMap fixture. By default the first member
   * documents the second (or itself for one-member packages) so the fixture
   * validates cleanly.
   * @param {object} [options] Fixture options.
   * @returns {ResourceMap} Test resource map.
   */
  function createBaseResourceMap({
    resourceMapPid = "resource_map_urn:uuid:test.1",
    memberPids = ["meta.1", "data.1"],
    documentationLinks = null,
    creatorName = "Test User",
    resolveServiceUrl = TEST_RESOLVE_BASE,
    objectServiceUrl,
  } = {}) {
    const normalizedDocumentationLinks =
      documentationLinks ??
      (memberPids.length
        ? [
            {
              metadataPid: memberPids[0],
              dataPid: memberPids[1] || memberPids[0],
            },
          ]
        : []);

    return ResourceMap.create({
      resourceMapPid,
      members: memberPids.map((pid) => ({ pid })),
      documentationLinks: normalizedDocumentationLinks,
      creatorName,
      resolveServiceUrl,
      objectServiceUrl,
    });
  }

  /**
   * Write raw execution scaffolding statements directly into the graph,
   * bypassing the Provenance API. Used to simulate executions found in
   * parsed legacy resource maps.
   * @param {ResourceMap} resourceMap Test resource map.
   * @param {object} [options] Scaffold options.
   * @param {string} [options.executionId] Named-node URI and identifier value.
   * Ignored when `executionNode` is given.
   * @param {object} [options.executionNode] Pre-built execution node, e.g. a
   * blank node.
   * @param {object} [options.associationNode] Pre-built association node.
   * @param {string} [options.programPid] Program to link via
   * `prov:qualifiedAssociation`/`prov:hadPlan`.
   * @param {boolean} [options.typed] Add the `provone:Execution` type triple.
   * @param {boolean} [options.identified] Add the `dcterms:identifier`
   * literal.
   * @returns {{executionNode: object, associationNode: object}} Created nodes.
   */
  function addExecutionScaffold(
    resourceMap,
    {
      executionId,
      executionNode = null,
      associationNode = null,
      programPid = null,
      typed = true,
      identified = true,
    } = {},
  ) {
    const execution = executionNode || rdf.sym(executionId);
    const association = associationNode || rdf.blankNode();

    resourceMap.mutateGraph(
      () => {
        const add = (subject, predicate, object) =>
          resourceMap.graph.addStatementIfMissing({
            subject: subject,
            predicate: predicate,
            object: object,
          });

        if (typed) {
          add(
            execution,
            resourceMap.ns.RDF("type"),
            resourceMap.ns.PROVONE("Execution"),
          );
        }
        if (identified) {
          add(
            execution,
            resourceMap.ns.DCTERMS("identifier"),
            rdf.literal(
              executionId || execution.value,
              undefined,
              resourceMap.ns.XSD("string"),
            ),
          );
        }
        if (programPid || associationNode) {
          add(
            execution,
            resourceMap.ns.PROV("qualifiedAssociation"),
            association,
          );
        }
        if (programPid) {
          add(
            association,
            resourceMap.ns.PROV("hadPlan"),
            rdf.sym(resourceMap.pidToUri(programPid)),
          );
        }
      },
      { markDirty: false },
    );

    return { executionNode: execution, associationNode: association };
  }

  const COMPREHENSIVE_XML = joinXml([
    '<?xml version="1.0" encoding="utf-8"?>',
    '<rdf:RDF xmlns:cito="http://purl.org/spar/cito/"',
    '         xmlns:dc="http://purl.org/dc/elements/1.1/"',
    '         xmlns:dcterms="http://purl.org/dc/terms/"',
    '         xmlns:foaf="http://xmlns.com/foaf/0.1/"',
    '         xmlns:ore="http://www.openarchives.org/ore/terms/"',
    '         xmlns:prov="http://www.w3.org/ns/prov#"',
    '         xmlns:provone="http://purl.dataone.org/provone/2015/01/15/ontology#"',
    '         xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"',
    '         xmlns:xsd="http://www.w3.org/2001/XMLSchema#">',
    `  <rdf:Description rdf:about="${resolveUrl("resource_map_urn%3Auuid%3Arm.1")}">`,
    '    <rdf:type rdf:resource="http://www.openarchives.org/ore/terms/ResourceMap"/>',
    '    <dcterms:identifier rdf:datatype="http://www.w3.org/2001/XMLSchema#string">resource_map_urn:uuid:rm.1</dcterms:identifier>',
    `    <ore:describes rdf:resource="${resolveUrl("resource_map_urn%3Auuid%3Arm.1#aggregation")}"/>`,
    '    <dcterms:modified rdf:datatype="http://www.w3.org/2001/XMLSchema#dateTime">2026-03-24T10:00:00.000Z</dcterms:modified>',
    '    <dc:creator rdf:nodeID="creator-1"/>',
    "  </rdf:Description>",
    '  <rdf:Description rdf:nodeID="creator-1">',
    '    <rdf:type rdf:resource="http://purl.org/dc/terms/Agent"/>',
    '    <foaf:name rdf:datatype="http://www.w3.org/2001/XMLSchema#string">Example Creator</foaf:name>',
    "  </rdf:Description>",
    `  <rdf:Description rdf:about="${resolveUrl("resource_map_urn%3Auuid%3Arm.1#aggregation")}">`,
    '    <rdf:type rdf:resource="http://www.openarchives.org/ore/terms/Aggregation"/>',
    `    <ore:isDescribedBy rdf:resource="${resolveUrl("resource_map_urn%3Auuid%3Arm.1")}"/>`,
    `    <ore:aggregates rdf:resource="${resolveUrl("meta.1")}"/>`,
    `    <ore:aggregates rdf:resource="${resolveUrl("data.1")}"/>`,
    `    <ore:aggregates rdf:resource="${resolveUrl("derived.1")}"/>`,
    `    <ore:aggregates rdf:resource="${resolveUrl("script.1")}"/>`,
    `    <ore:aggregates rdf:resource="${resolveUrl("script.2")}"/>`,
    `    <ore:aggregates rdf:resource="${resolveUrl("resource_map_doi%3A10.18739%2FA2NESTED")}"/>`,
    "  </rdf:Description>",
    `  <rdf:Description rdf:about="${resolveUrl("meta.1")}">`,
    '    <dcterms:identifier rdf:datatype="http://www.w3.org/2001/XMLSchema#string">meta.1</dcterms:identifier>',
    `    <cito:documents rdf:resource="${resolveUrl("data.1")}"/>`,
    `    <cito:documents rdf:resource="${resolveUrl("resource_map_doi%3A10.18739%2FA2NESTED")}"/>`,
    "  </rdf:Description>",
    `  <rdf:Description rdf:about="${resolveUrl("data.1")}">`,
    '    <dcterms:identifier rdf:datatype="http://www.w3.org/2001/XMLSchema#string">data.1</dcterms:identifier>',
    `    <cito:isDocumentedBy rdf:resource="${resolveUrl("meta.1")}"/>`,
    "    <prov:atLocation>data/data.csv</prov:atLocation>",
    '    <rdf:type rdf:resource="http://purl.dataone.org/provone/2015/01/15/ontology#Data"/>',
    "  </rdf:Description>",
    `  <rdf:Description rdf:about="${resolveUrl("derived.1")}">`,
    '    <dcterms:identifier rdf:datatype="http://www.w3.org/2001/XMLSchema#string">derived.1</dcterms:identifier>',
    '    <rdf:type rdf:resource="http://purl.dataone.org/provone/2015/01/15/ontology#Data"/>',
    `    <prov:wasDerivedFrom rdf:resource="${resolveUrl("data.1")}"/>`,
    '    <prov:wasGeneratedBy rdf:resource="urn:uuid:execution-1"/>',
    "  </rdf:Description>",
    `  <rdf:Description rdf:about="${resolveUrl("script.1")}">`,
    '    <dcterms:identifier rdf:datatype="http://www.w3.org/2001/XMLSchema#string">script.1</dcterms:identifier>',
    '    <rdf:type rdf:resource="http://purl.dataone.org/provone/2015/01/15/ontology#Program"/>',
    "  </rdf:Description>",
    `  <rdf:Description rdf:about="${resolveUrl("script.2")}">`,
    '    <dcterms:identifier rdf:datatype="http://www.w3.org/2001/XMLSchema#string">script.2</dcterms:identifier>',
    '    <rdf:type rdf:resource="http://purl.dataone.org/provone/2015/01/15/ontology#Program"/>',
    "  </rdf:Description>",
    `  <rdf:Description rdf:about="${resolveUrl("resource_map_doi%3A10.18739%2FA2NESTED")}">`,
    '    <dcterms:identifier rdf:datatype="http://www.w3.org/2001/XMLSchema#string">resource_map_doi:10.18739/A2NESTED</dcterms:identifier>',
    `    <cito:isDocumentedBy rdf:resource="${resolveUrl("meta.1")}"/>`,
    "  </rdf:Description>",
    '  <rdf:Description rdf:about="urn:uuid:execution-1">',
    '    <dcterms:identifier rdf:datatype="http://www.w3.org/2001/XMLSchema#string">urn:uuid:execution-1</dcterms:identifier>',
    '    <rdf:type rdf:resource="http://purl.dataone.org/provone/2015/01/15/ontology#Execution"/>',
    '    <prov:qualifiedAssociation rdf:nodeID="assoc-1"/>',
    `    <prov:used rdf:resource="${resolveUrl("data.1")}"/>`,
    '    <prov:wasInformedBy rdf:resource="urn:uuid:execution-2"/>',
    "  </rdf:Description>",
    '  <rdf:Description rdf:nodeID="assoc-1">',
    `    <prov:hadPlan rdf:resource="${resolveUrl("script.1")}"/>`,
    '    <prov:agent rdf:resource="https://orcid.org/0000-0001-0000-0001"/>',
    "  </rdf:Description>",
    '  <rdf:Description rdf:about="urn:uuid:execution-2">',
    '    <dcterms:identifier rdf:datatype="http://www.w3.org/2001/XMLSchema#string">urn:uuid:execution-2</dcterms:identifier>',
    '    <rdf:type rdf:resource="http://purl.dataone.org/provone/2015/01/15/ontology#Execution"/>',
    '    <prov:qualifiedAssociation rdf:nodeID="assoc-2"/>',
    "  </rdf:Description>",
    '  <rdf:Description rdf:nodeID="assoc-2">',
    `    <prov:hadPlan rdf:resource="${resolveUrl("script.2")}"/>`,
    "  </rdf:Description>",
    "</rdf:RDF>",
  ]);

  const DCTERMS_CREATOR_XML = joinXml([
    '<?xml version="1.0" encoding="utf-8"?>',
    '<rdf:RDF xmlns:cito="http://purl.org/spar/cito/"',
    '         xmlns:dc="http://purl.org/dc/elements/1.1/"',
    '         xmlns:dcterms="http://purl.org/dc/terms/"',
    '         xmlns:foaf="http://xmlns.com/foaf/0.1/"',
    '         xmlns:ore="http://www.openarchives.org/ore/terms/"',
    '         xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"',
    '         xmlns:xsd="http://www.w3.org/2001/XMLSchema#">',
    `  <rdf:Description rdf:about="${resolveUrl("resource_map_urn%3Auuid%3Arm.creator.1")}">`,
    '    <rdf:type rdf:resource="http://www.openarchives.org/ore/terms/ResourceMap"/>',
    '    <dcterms:identifier rdf:datatype="http://www.w3.org/2001/XMLSchema#string">resource_map_urn:uuid:rm.creator.1</dcterms:identifier>',
    `    <ore:describes rdf:resource="${resolveUrl("resource_map_urn%3Auuid%3Arm.creator.1#aggregation")}"/>`,
    '    <dcterms:creator rdf:nodeID="creator-1"/>',
    "  </rdf:Description>",
    '  <rdf:Description rdf:nodeID="creator-1">',
    '    <rdf:type rdf:resource="http://purl.org/dc/terms/Agent"/>',
    '    <foaf:name rdf:datatype="http://www.w3.org/2001/XMLSchema#string">DCTERMS Creator</foaf:name>',
    '    <foaf:mbox rdf:datatype="http://www.w3.org/2001/XMLSchema#string">mailto:creator@example.org</foaf:mbox>',
    "  </rdf:Description>",
    `  <rdf:Description rdf:about="${resolveUrl("resource_map_urn%3Auuid%3Arm.creator.1#aggregation")}">`,
    '    <rdf:type rdf:resource="http://www.openarchives.org/ore/terms/Aggregation"/>',
    `    <ore:isDescribedBy rdf:resource="${resolveUrl("resource_map_urn%3Auuid%3Arm.creator.1")}"/>`,
    `    <ore:aggregates rdf:resource="${resolveUrl("meta.creator.1")}"/>`,
    "  </rdf:Description>",
    `  <rdf:Description rdf:about="${resolveUrl("meta.creator.1")}">`,
    '    <dcterms:identifier rdf:datatype="http://www.w3.org/2001/XMLSchema#string">meta.creator.1</dcterms:identifier>',
    `    <cito:documents rdf:resource="${resolveUrl("meta.creator.1")}"/>`,
    `    <cito:isDocumentedBy rdf:resource="${resolveUrl("meta.creator.1")}"/>`,
    "  </rdf:Description>",
    "</rdf:RDF>",
  ]);

  const PREFIX_ALIAS_CREATOR_XML = joinXml([
    '<?xml version="1.0" encoding="utf-8"?>',
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"',
    '         xmlns:n0="http://purl.org/dc/elements/1.1/"',
    '         xmlns:n1="http://xmlns.com/foaf/0.1/"',
    '         xmlns:terms="http://purl.org/dc/terms/"',
    '         xmlns:ter="http://www.openarchives.org/ore/terms/"',
    '         xmlns:cito="http://purl.org/spar/cito/">',
    `  <rdf:Description rdf:about="${resolveUrl("urn%3Auuid%3Arm.prefixed.1")}">`,
    "    <n0:creator>",
    "      <rdf:Description>",
    '        <rdf:type rdf:resource="http://purl.org/dc/terms/Agent"/>',
    "        <n1:name>Prefixed Creator</n1:name>",
    "      </rdf:Description>",
    "    </n0:creator>",
    "    <terms:identifier>urn:uuid:rm.prefixed.1</terms:identifier>",
    `    <ter:describes rdf:resource="${resolveUrl("urn%3Auuid%3Arm.prefixed.1#aggregation")}"/>`,
    '    <rdf:type rdf:resource="http://www.openarchives.org/ore/terms/ResourceMap"/>',
    "  </rdf:Description>",
    `  <rdf:Description rdf:about="${resolveUrl("urn%3Auuid%3Arm.prefixed.1#aggregation")}">`,
    '    <rdf:type rdf:resource="http://www.openarchives.org/ore/terms/Aggregation"/>',
    `    <ter:aggregates rdf:resource="${resolveUrl("urn%3Auuid%3Amember.prefixed.1")}"/>`,
    `    <ter:isDescribedBy rdf:resource="${resolveUrl("urn%3Auuid%3Arm.prefixed.1")}"/>`,
    "  </rdf:Description>",
    `  <rdf:Description rdf:about="${resolveUrl("urn%3Auuid%3Amember.prefixed.1")}">`,
    "    <terms:identifier>urn:uuid:member.prefixed.1</terms:identifier>",
    `    <cito:documents rdf:resource="${resolveUrl("urn%3Auuid%3Amember.prefixed.1")}"/>`,
    `    <cito:isDocumentedBy rdf:resource="${resolveUrl("urn%3Auuid%3Amember.prefixed.1")}"/>`,
    `    <ter:isAggregatedBy rdf:resource="${resolveUrl("urn%3Auuid%3Arm.prefixed.1#aggregation")}"/>`,
    "  </rdf:Description>",
    "</rdf:RDF>",
  ]);

  const MISSING_IDENTIFIER_XML = joinXml([
    '<?xml version="1.0" encoding="utf-8"?>',
    '<rdf:RDF xmlns:cito="http://purl.org/spar/cito/"',
    '         xmlns:dcterms="http://purl.org/dc/terms/"',
    '         xmlns:ore="http://www.openarchives.org/ore/terms/"',
    '         xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"',
    '         xmlns:xsd="http://www.w3.org/2001/XMLSchema#">',
    `  <rdf:Description rdf:about="${resolveUrl("resource_map_urn%3Auuid%3Arm.fix.1")}">`,
    '    <rdf:type rdf:resource="http://www.openarchives.org/ore/terms/ResourceMap"/>',
    '    <dcterms:identifier rdf:datatype="http://www.w3.org/2001/XMLSchema#string">resource_map_urn:uuid:rm.fix.1</dcterms:identifier>',
    `    <ore:describes rdf:resource="${resolveUrl("resource_map_urn%3Auuid%3Arm.fix.1#aggregation")}"/>`,
    "  </rdf:Description>",
    `  <rdf:Description rdf:about="${resolveUrl("resource_map_urn%3Auuid%3Arm.fix.1#aggregation")}">`,
    '    <rdf:type rdf:resource="http://www.openarchives.org/ore/terms/Aggregation"/>',
    `    <ore:aggregates rdf:resource="${resolveUrl("meta.fix.1")}"/>`,
    `    <ore:aggregates rdf:resource="${resolveUrl("resource_map_doi:10.18739%2FA22Z9V")}"/>`,
    "  </rdf:Description>",
    `  <rdf:Description rdf:about="${resolveUrl("meta.fix.1")}">`,
    '    <dcterms:identifier rdf:datatype="http://www.w3.org/2001/XMLSchema#string">meta.fix.1</dcterms:identifier>',
    `    <cito:documents rdf:resource="${resolveUrl("resource_map_doi:10.18739%2FA22Z9V")}"/>`,
    "  </rdf:Description>",
    `  <rdf:Description rdf:about="${resolveUrl("resource_map_doi:10.18739%2FA22Z9V")}">`,
    `    <cito:isDocumentedBy rdf:resource="${resolveUrl("meta.fix.1")}"/>`,
    "  </rdf:Description>",
    "</rdf:RDF>",
  ]);

  return {
    COMPREHENSIVE_XML,
    DCTERMS_CREATOR_XML,
    MISSING_IDENTIFIER_XML,
    PREFIX_ALIAS_CREATOR_XML,
    TEST_RESOLVE_BASE,
    addExecutionScaffold,
    createBaseResourceMap,
    getIssueCodes,
  };
});

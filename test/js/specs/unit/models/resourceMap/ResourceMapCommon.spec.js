define(["models/resourceMap/ResourceMapCommon"], (ResourceMapCommon) => {
  chai.should();
  const expect = chai.expect;

  describe("ResourceMapCommon", () => {
    it("extracts PIDs from resolve URIs", () => {
      expect(
        ResourceMapCommon.uriToPid(
          "https://cn.dataone.org/cn/v2/resolve/data.1",
        ),
      ).to.equal("data.1");
      expect(
        ResourceMapCommon.uriToPid(
          "https://cn.dataone.org/cn/v2/resolve/doi%3A10.5063%2FF1",
        ),
      ).to.equal("doi:10.5063/F1");
      expect(
        ResourceMapCommon.uriToPid(
          "https://cn.dataone.org/cn/v2/resolve/data.1#section",
        ),
      ).to.equal("data.1");
      expect(ResourceMapCommon.uriToPid("_:b0")).to.equal(null);
      expect(ResourceMapCommon.uriToPid("https://example.org/data.1")).to.equal(
        null,
      );
    });

    it("matches canonical resolve URIs for PIDs", () => {
      expect(
        ResourceMapCommon.isResolveUriForPid(
          "https://cn.dataone.org/cn/v2/resolve/data.1",
          "data.1",
        ),
      ).to.equal(true);
      expect(
        ResourceMapCommon.isResolveUriForPid(
          "https://cn.dataone.org/cn/v2/resolve/doi%3A10.5063%2FF1",
          "doi:10.5063/F1",
        ),
      ).to.equal(true);
      expect(
        ResourceMapCommon.isResolveUriForPid(
          "https://cn.dataone.org/cn/v2/resolve/data.1#section",
          "data.1",
          { allowFragment: false },
        ),
      ).to.equal(false);
      expect(
        ResourceMapCommon.isResolveUriForPid(
          "https://cn.dataone.org/cn/v2/resolve/doi%3A10.5063%2FF1+ABC",
          "doi:10.5063/F1+ABC",
        ),
      ).to.equal(false);
    });

    it("extracts PIDs only from complete DataONE object endpoint URIs", () => {
      ResourceMapCommon.physicalUriToPid(
        "https://mn.example/mn/v2/object/doi%3A10.5063%2FF1",
      ).should.equal("doi:10.5063/F1");
      ResourceMapCommon.physicalUriToPid(
        "https://mn.example/mn/v1/object/data.1",
      ).should.equal("data.1");
      expect(
        ResourceMapCommon.physicalUriToPid("https://example.org/files/data.1"),
      ).to.equal(null);
      expect(
        ResourceMapCommon.physicalUriToPid(
          "https://mn.example/mn/v2/object/data.1?download=true",
        ),
      ).to.equal(null);
    });

    it("matches PID literals and known DataONE identifier URI forms", () => {
      ResourceMapCommon.identifierMatchesPid(
        "https://cn.example/cn/v2/resolve/data.1",
        "data.1",
      ).should.equal(true);
      ResourceMapCommon.identifierMatchesPid(
        "https://mn.example/mn/v2/object/data.1",
        "data.1",
      ).should.equal(true);
      ResourceMapCommon.identifierMatchesPid(
        "different.1",
        "data.1",
      ).should.equal(false);
    });

    it("recovers PIDs consistently from identifiers, fragments, and bare values", () => {
      const identifiedUri = "https://example.org/identified";
      const identifiers = new Map([[identifiedUri, "identified.pid"]]);

      ResourceMapCommon.recoverPidFromUri(`${identifiedUri}#fragment`, {
        identifierForUri: identifiers,
      }).should.equal("identified.pid");
      ResourceMapCommon.recoverPidFromUri(
        "https://mn.example/mn/v2/object/data.1",
      ).should.equal("data.1");
      expect(ResourceMapCommon.recoverPidFromUri("bare%2Fpid")).to.equal(null);
      ResourceMapCommon.recoverPidFromUri("bare%2Fpid", {
        allowBareValue: true,
      }).should.equal("bare/pid");
    });

    it("extracts lexical values and datatypes from malformed resource artifacts", () => {
      const malformedValue =
        'file:///tmp/RtmpArtifact/"meta.1"^^<http://www.w3.org/2001/XMLSchema#string>';

      ResourceMapCommon.extractMalformedResourceValue(
        malformedValue,
      ).should.deep.equal({
        lexicalValue: "meta.1",
        datatypeUri: "http://www.w3.org/2001/XMLSchema#string",
      });
    });

    it("decodes only canonical single-segment DataONE identifier URLs", () => {
      ResourceMapCommon.managedIdentifierValuePid(
        "https://cn.example/cn/v2/resolve/doi:10.5063%2FF1",
      ).should.equal("doi:10.5063/F1");
      ResourceMapCommon.managedIdentifierValuePid(
        "https://mn.example/mn/v2/object/literal%252Fpid",
      ).should.equal("literal%2Fpid");

      const nestedResolveValue =
        "https://example.org/resolve/collection/data.1";
      ResourceMapCommon.managedIdentifierValuePid(
        nestedResolveValue,
      ).should.equal(nestedResolveValue);
    });

    it("recognizes only exact configured endpoint paths", () => {
      const resolveServiceUrl = "https://cn.example/cn/v2/resolve";
      const objectServiceUrl = "https://mn.example/mn/v2/object";

      ResourceMapCommon.configuredEndpointPid(
        `${resolveServiceUrl}/data.1`,
        resolveServiceUrl,
      ).should.equal("data.1");
      ResourceMapCommon.configuredEndpointPid(
        `${objectServiceUrl}/doi:10.5063%2FF1`,
        objectServiceUrl,
      ).should.equal("doi:10.5063/F1");
      ResourceMapCommon.configuredEndpointPid(
        `${resolveServiceUrl}/literal%252Fpid`,
        resolveServiceUrl,
      ).should.equal("literal%2Fpid");
      expect(
        ResourceMapCommon.configuredEndpointPid(
          "https://cn.example/cn/v2/resolvedata.1",
          resolveServiceUrl,
        ),
      ).to.equal(null);
      expect(
        ResourceMapCommon.configuredEndpointPid(
          `${resolveServiceUrl}/data.1/extra`,
          resolveServiceUrl,
        ),
      ).to.equal(null);
      expect(
        ResourceMapCommon.configuredEndpointPid(
          `${resolveServiceUrl}/data.1?download=true`,
          resolveServiceUrl,
        ),
      ).to.equal(null);
    });
  });
});

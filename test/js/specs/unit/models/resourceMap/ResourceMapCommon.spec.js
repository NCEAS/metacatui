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

    it("matches PID literals and configured DataONE identifier URI forms", () => {
      const endpoints = {
        resolveServiceUrl: "https://cn.example/cn/v2/resolve",
        objectServiceUrl: "https://mn.example/mn/v2/object",
      };
      ResourceMapCommon.identifierMatchesPid(
        "https://cn.example/cn/v2/resolve/data.1",
        "data.1",
        endpoints,
      ).should.equal(true);
      ResourceMapCommon.identifierMatchesPid(
        "https://mn.example/mn/v2/object/data.1",
        "data.1",
        endpoints,
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
        { objectServiceUrl: "https://mn.example/mn/v2/object" },
      ).should.equal("data.1");
      expect(ResourceMapCommon.recoverPidFromUri("bare%2Fpid")).to.equal(null);
      ResourceMapCommon.recoverPidFromUri("bare%2Fpid", {
        allowBareValue: true,
      }).should.equal("bare/pid");
    });

    it("leaves foreign service URLs unresolved", () => {
      const endpoints = {
        resolveServiceUrl: "https://cn.example/cn/v2/resolve",
        objectServiceUrl: "https://mn.example/mn/v2/object",
      };
      for (const uri of [
        "https://archive.example/resolve/data.1",
        "https://archive.example/mn/v1/object/data.1",
        "https://archive.example/mn/v2/object/data.1",
      ]) {
        expect(ResourceMapCommon.recoverPidFromUri(uri, endpoints)).to.equal(
          null,
        );
        ResourceMapCommon.identifierMatchesPid(
          uri,
          "data.1",
          endpoints,
        ).should.equal(false);
        ResourceMapCommon.identifierMatchesPid(
          uri,
          uri,
          endpoints,
        ).should.equal(true);
        ResourceMapCommon.recoverPidFromUri(uri, {
          ...endpoints,
          identifierForUri: new Map([[uri, uri]]),
        }).should.equal(uri);
      }
      expect(
        ResourceMapCommon.recoverPidFromUri(
          "https://mn.example/mn/v2/object/data.1",
        ),
      ).to.equal(null);
    });

    it("decodes configured endpoint PIDs once and keeps full URL PIDs", () => {
      const resolveServiceUrl = "https://cn.example/cn/v2/resolve";
      for (const pid of [
        "https://archive.example/resolve/data.1",
        `${resolveServiceUrl}/data.1`,
        "literal%2Fpid",
      ]) {
        ResourceMapCommon.recoverPidFromUri(
          `${resolveServiceUrl}/${encodeURIComponent(pid)}`,
          { resolveServiceUrl },
        ).should.equal(pid);
      }
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

    it("keeps exact PID matches when the PID is a URL", () => {
      const urlPid = "https://foreign.example/cn/v2/resolve/data.1";

      // The caller expects this entire URL as the PID, so do not shorten it to
      // data.1 even when the URL starts with the configured resolver endpoint.
      ResourceMapCommon.managedIdentifierValuePid(urlPid, urlPid, {
        resolveServiceUrl: "https://foreign.example/cn/v2/resolve",
      }).should.equal(urlPid);
    });

    it("decodes identifier URLs only at configured endpoints", () => {
      const services = {
        resolveServiceUrl: "https://cn.example/cn/v2/resolve",
        objectServiceUrl: "https://mn.example/mn/v2/object",
      };
      ResourceMapCommon.managedIdentifierValuePid(
        "https://mn.example/mn/v2/object/urn%3Auuid%3Aabc",
        null,
        services,
      ).should.equal("urn:uuid:abc");
      ResourceMapCommon.managedIdentifierValuePid(
        "https://cn.example/cn/v2/resolve/doi:10.5063%2FF1",
        null,
        services,
      ).should.equal("doi:10.5063/F1");
      // Decode once: %252F becomes the literal text %2F, not a slash.
      ResourceMapCommon.managedIdentifierValuePid(
        "https://mn.example/mn/v2/object/literal%252Fpid",
        null,
        services,
      ).should.equal("literal%2Fpid");

      const nestedResolveValue =
        "https://example.org/resolve/collection/data.1";
      ResourceMapCommon.managedIdentifierValuePid(
        nestedResolveValue,
      ).should.equal(nestedResolveValue);
      for (const segment of ["invalid%2", "invalid%FF"]) {
        const identifier = `https://mn.example/mn/v2/object/${segment}`;
        ResourceMapCommon.managedIdentifierValuePid(
          identifier,
          null,
          services,
        ).should.equal(identifier);
      }
      // A matching suffix is insufficient: another host, API version, or path
      // may use data.1 as part of an unrelated identifier.
      for (const identifier of [
        "https://foreign.example/cn/v2/resolve/data.1",
        "https://cn.example/cn/v1/resolve/data.1",
        "https://mn.example/other/v2/object/data.1",
      ]) {
        ResourceMapCommon.managedIdentifierValuePid(
          identifier,
          null,
          services,
        ).should.equal(identifier);
      }
    });

    it("accepts equivalent PID encodings at the configured endpoint", () => {
      const objectServiceUrl = "https://mn.example/mn/v2/object";
      for (const [segment, expectedPid] of [
        ["urn:uuid:abc", "urn:uuid:abc"],
        ["urn%3Auuid%3Aabc", "urn:uuid:abc"],
        ["urn%3auuid%3aabc", "urn:uuid:abc"],
        ["doi:10.5063%2fF1", "doi:10.5063/F1"],
        ["literal%252Fpid", "literal%2Fpid"],
        ["invalid%2", null],
        ["invalid%FF", null],
      ]) {
        expect(
          ResourceMapCommon.configuredEndpointPid(
            `${objectServiceUrl}/${segment}`,
            objectServiceUrl,
          ),
        ).to.equal(expectedPid);
      }
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
      expect(
        ResourceMapCommon.configuredEndpointPid(
          "https://other-mn.example/mn/v2/object/urn%3Auuid%3Aabc",
          objectServiceUrl,
        ),
      ).to.equal(null);
    });
  });
});

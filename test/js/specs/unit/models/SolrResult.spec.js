define(["jquery", "collections/ObjectFormats", "models/SolrResult"], function (
  $,
  ObjectFormats,
  SolrResult,
) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;
  let solrResult, fetchStub, originalMetacatUI;

  describe("SolrResult Test Suite", function () {
    /* Set up */
    beforeEach(function () {
      originalMetacatUI = window.MetacatUI;
      window.MetacatUI = {
        ...(originalMetacatUI || {}),
        appModel: {
          get(property) {
            if (property === "metaServiceUrl")
              return "https://example.org/meta/";
            if (property === "objectServiceUrl") {
              return "https://example.org/object/";
            }
            return originalMetacatUI?.appModel?.get?.(property);
          },
          isDOI(value) {
            return originalMetacatUI?.appModel?.isDOI?.(value) || false;
          },
        },
        appUserModel: {
          get(property) {
            if (property === "token") return "";
            return originalMetacatUI?.appUserModel?.get?.(property);
          },
          createAjaxSettings() {
            return {};
          },
        },
        objectFormats: new ObjectFormats(),
      };
      solrResult = new SolrResult();
      // Create a stub for the fetch API
      fetchStub = sinon.stub(window, "fetch");
    });

    /* Tear down */
    afterEach(function () {
      solrResult = undefined;
      fetchStub.restore();
      window.MetacatUI = originalMetacatUI;
    });

    describe("The SolrResult model", function () {
      it("should be created", function () {
        solrResult.should.be.instanceof(SolrResult);
      });
    });

    describe("downloadWithCredentials", function () {
      it("should download a file with valid credentials", async function () {
        const mockBlob = new Blob(["test"], { type: "text/plain" });
        const mockResponse = new Response(mockBlob, {
          status: 200,
          headers: {
            "Content-Disposition": 'attachment; filename="testfile.txt"',
          },
        });

        // Mock fetch response
        fetchStub.resolves(mockResponse);

        // Spy on model.trigger to check if the events are triggered
        const triggerSpy = sinon.spy(solrResult, "trigger");

        // Execute the downloadWithCredentials method
        await solrResult.downloadWithCredentials();

        // Ensure that fetch was called once
        sinon.assert.calledOnce(fetchStub);

        // Check if the downloadComplete event was triggered
        sinon.assert.calledWith(triggerSpy, "downloadComplete");
      });
    });

    describe("fetchDataObjectWithCredentials", function () {
      it("should fetch the data object with valid credentials", async function () {
        const mockResponse = new Response("{}", { status: 200 });

        // Mock fetch response
        fetchStub.resolves(mockResponse);

        // Execute the fetchDataObjectWithCredentials method
        const response = await solrResult.fetchDataObjectWithCredentials();

        // Ensure that fetch was called once
        sinon.assert.calledOnce(fetchStub);

        // The response should be the mock response
        response.status.should.equal(200);
      });

      it("should throw an error for a failed fetch", async function () {
        // Mock a failed fetch response
        fetchStub.rejects(new Error("Failed to fetch"));

        try {
          await solrResult.fetchDataObjectWithCredentials();
        } catch (error) {
          error.message.should.equal("Failed to fetch");
        }

        // Ensure that fetch was called once
        sinon.assert.calledOnce(fetchStub);
      });
    });

    describe("getFileNameFromResponse", function () {
      it("should extract filename from Content-Disposition header", function () {
        const mockResponse = new Response(null, {
          headers: {
            "Content-Disposition": 'attachment; filename="testfile.txt"',
          },
        });

        // Execute getFileNameFromResponse
        const filename = solrResult.getFileNameFromResponse(mockResponse);

        // Ensure the filename is correct
        filename.should.equal("testfile.txt");
      });

      it("should fall back to model attributes for filename", function () {
        // Set model properties
        sinon.stub(solrResult, "get").callsFake(function (attr) {
          if (attr === "fileName") return "defaultFileName.txt";
          return null;
        });

        const mockResponse = new Response(null, {
          headers: {},
        });

        // Execute getFileNameFromResponse
        const filename = solrResult.getFileNameFromResponse(mockResponse);

        // Ensure the fallback filename is correct
        filename.should.equal("defaultFileName.txt");
      });
    });

    describe("getSysMeta", function () {
      function stubSysMeta(formatId) {
        return sinon.stub($, "ajax").callsFake((settings) => {
          const xml = [
            "<systemmetadata>",
            "<archived>false</archived>",
            "<size>123</size>",
            "<filename>metadata.xml</filename>",
            `<formatid>${formatId}</formatid>`,
            "</systemmetadata>",
          ].join("");
          settings.success($.parseXML(xml));
        });
      }

      it("classifies metadata via ObjectFormats", function () {
        const ajaxStub = stubSysMeta("http://www.loc.gov/METS/");

        try {
          solrResult.set("id", "meta.1");
          solrResult.getSysMeta();

          solrResult.get("formatType").should.equal("METADATA");
          ajaxStub.calledOnce.should.equal(true);
        } finally {
          ajaxStub.restore();
        }
      });

      it("does not classify data formats as metadata by substring", function () {
        const ajaxStub = stubSysMeta("http://www.cuahsi.org/waterML/1.1/");

        try {
          solrResult.set("id", "data.1");
          solrResult.getSysMeta();

          expect(solrResult.get("formatType")).to.equal(null);
          ajaxStub.calledOnce.should.equal(true);
        } finally {
          ajaxStub.restore();
        }
      });
    });
  });
});

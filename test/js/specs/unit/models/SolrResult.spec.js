define(["models/SolrResult"], function (SolrResult) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;
  let solrResult, fetchStub;

  describe("SolrResult Test Suite", function () {
    /* Set up */
    beforeEach(function () {
      solrResult = new SolrResult();
      // Create a stub for the fetch API
      fetchStub = sinon.stub(window, "fetch");
    });

    /* Tear down */
    afterEach(function () {
      solrResult = undefined;
      fetchStub.restore();
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
  });
});

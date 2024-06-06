define([
  "../../../../../../../../src/js/collections/SolrResults",
  "../../../../../../../../src/js/models/Search",
], function (SolrResults, Search) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;
  let solrResults;
  let search;

  describe("SolrResults Test Suite", function () {
    /* Set up */
    beforeEach(function () {
      solrResults = new SolrResults();
      search = new Search();
    });

    /* Tear down */
    afterEach(function () {
      solrResults = undefined;
      search = undefined;
    });

    describe("Creating the collection and models", function () {
      it("should create a SolrResults collection", function () {
        solrResults.should.be.instanceof(SolrResults);
      });
      it("should create a Search model", function () {
        search.should.be.instanceof(Search);
      });
    });

    describe("Constructing the default Data Catalog query", function () {
      it("should set a sort order", function () {
        // Set the sort order based on user choice
        let sortOrder = search.get("sortOrder");
        solrResults.setSort(sortOrder);

        solrResults.sort.should.equal("dateUploaded+desc");
      });

      it("should set return fields", function () {
        // Specify which fields to retrieve
        let fields = "";
        fields += "id,";
        fields += "seriesId,";
        fields += "title,";
        fields += "origin,";
        fields += "pubDate,";
        fields += "dateUploaded,";
        fields += "abstract,";
        fields += "resourceMap,";
        fields += "beginDate,";
        fields += "endDate,";
        fields += "read_count_i,";
        fields += "geohash_9,";
        fields += "datasource,";
        fields += "isPublic,";
        fields += "documents,";
        fields += "sem_annotation,";
        fields += "northBoundCoord,";
        fields += "southBoundCoord,";
        fields += "eastBoundCoord,";
        fields += "westBoundCoord";

        // Strip the last trailing comma if needed
        if (fields[fields.length - 1] === ",") {
          fields = fields.substr(0, fields.length - 1);
        }
        solrResults.setfields(fields);

        solrResults.fields.should.equal(
          "id,seriesId,title,origin,pubDate,dateUploaded,abstract,resourceMap,beginDate,endDate,read_count_i,geohash_9,datasource,isPublic,documents,sem_annotation,northBoundCoord,southBoundCoord,eastBoundCoord,westBoundCoord",
          `Fields is actually: ${solrResults.fields}`,
        );
        solrResults
          .url()
          .indexOf(
            "fl=id,seriesId,title,origin,pubDate,dateUploaded,abstract,resourceMap,beginDate,endDate,read_count_i,geohash_9,datasource,isPublic,documents,sem_annotation,northBoundCoord,southBoundCoord,eastBoundCoord,westBoundCoord",
          )
          .should.be.at.least(0);
      });

      it("should set a query", function () {
        // Get the query
        let query = search.getQuery();

        // Run the query
        solrResults.setQuery(query);

        solrResults.currentquery.should.equal(search.getQuery());
        solrResults
          .url()
          .indexOf("q=" + query)
          .should.be.at.least(0);
      });

      it("should set a page and start", function () {
        let page = MetacatUI.appModel.get("page");
        if (page == null) {
          page = 0;
        }

        solrResults.rows.should.be.a("number");
        page.should.be.a("number");
        solrResults.start.should.equal(0);

        solrResults.start = page * solrResults.rows;
        solrResults.start.should.be.a("number");
      });
    });
  });
});

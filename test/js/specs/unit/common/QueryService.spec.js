define([
  "/test/js/specs/shared/clean-state.js",
  "common/QueryService",
  "jquery",
], (cleanState, QueryService, $) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("QueryService Test Suite", () => {
    // Clean up Sinon sandbox and any globals after each test
    const state = cleanState(
      () => {
        const sandbox = sinon.createSandbox();
        return { sandbox };
      },
      beforeEach,
      afterEach,
    );

    afterEach(() => {
      state.sandbox.restore();
    });

    describe("Instantiation", () => {
      it("creates an instance with defaults", () => {
        const qs = new QueryService();
        qs.should.be.instanceof(QueryService);
        // QueryService is a collection of static methods, but instantiating
        // it should not throw or attach unexpected instance props.
        Object.keys(qs).length.should.equal(0);
      });
    });

    describe("queryServiceUrl()", () => {
      it("throws an error when queryServiceUrl is not configured", () => {
        const { sandbox } = state;
        // Remove MetacatUI or stub to return undefined
        sandbox.stub(window, "MetacatUI").value(undefined);
        expect(() => QueryService.queryServiceUrl()).to.throw(
          Error,
          "queryServiceUrl is not configured",
        );
      });

      it("returns the configured query service URL", () => {
        const currentUrl = MetacatUI.appModel.get("queryServiceUrl");
        const url = QueryService.queryServiceUrl();
        url.should.equal(currentUrl);
      });
    });

    describe("buildQueryObject()", () => {
      it("applies defaults and basic options", () => {
        const opts = {
          q: "title:hello",
          filterQueries: "rights:public",
          fields: ["id", "title"],
          sort: "dateUploaded+asc",
          rows: 50,
          start: 5,
        };
        const params = QueryService.buildQueryObject(opts);
        params.should.deep.include({
          q: "title:hello",
          rows: 50,
          start: 5,
          wt: "json",
        });
        params.sort.should.equal("dateUploaded asc");
        // filterQueries becomes an array of fq parameters
        params.fq.should.deep.equal(["rights:public"]);
        // fields (fl) joined by comma
        params.fl.should.equal("id,title");
      });

      it("handles multiple filterQueries and nested arrays", () => {
        const opts = {
          q: "*:*",
          filterQueries: ["type:data", ["rights:public", "format:csv"]],
        };
        const params = QueryService.buildQueryObject(opts);
        params.fq.should.deep.equal([
          "type:data",
          "rights:public",
          "format:csv",
        ]);
      });

      it("handles facet fields and sets facet params", () => {
        const opts = {
          facets: ["creator", ["format"]],
          facetLimit: 10,
          facetMinCount: 2,
        };
        const params = QueryService.buildQueryObject(opts);
        params.facet.should.equal("true");
        params["facet.field"].should.deep.equal(["creator", "format"]);
        params["facet.limit"].should.equal(10);
        params["facet.mincount"].should.equal(2);
        params["facet.sort"].should.equal("index");
      });

      it("handles facet queries without facet fields", () => {
        const opts = {
          facetQueries: ["size:[100 TO *]", "size:[* TO 100]"],
          facetLimit: -1,
          facetMinCount: 1,
        };
        const params = QueryService.buildQueryObject(opts);
        params.facet.should.equal("true");
        params["facet.query"].should.deep.equal([
          "size:[100 TO *]",
          "size:[* TO 100]",
        ]);
        // facet.limit and facet.mincount are not set when only facet queries are provided
        should.equal(params["facet.limit"], undefined);
        should.equal(params["facet.mincount"], undefined);
      });

      it("handles stats fields", () => {
        const opts = {
          statsFields: ["size", ["views"]],
        };
        const params = QueryService.buildQueryObject(opts);
        params.stats.should.equal("true");
        params["stats.field"].should.deep.equal(["size", "views"]);
      });

      it("ignores empty or falsey fields and filterQueries", () => {
        const opts = {
          fields: [],
          filterQueries: [null, ""],
        };
        const params = QueryService.buildQueryObject(opts);
        should.equal(params.fl, undefined);
        should.equal(params.fq, undefined);
      });
    });

    describe("buildQueryParams()", () => {
      it("forwards to buildQueryObject()", () => {
        const { sandbox } = state;
        const spy = sandbox.spy(QueryService, "buildQueryObject");
        const opts = { q: "x" };
        const result = QueryService.buildQueryParams(opts);
        spy.calledOnceWithExactly(opts).should.be.true;
        result.should.deep.equal(QueryService.buildQueryObject(opts));
      });
    });

    describe("toQueryString()", () => {
      it("serializes simple and array values into repeated keys", () => {
        const obj = {
          q: "*:*",
          fq: ["rights:public", "type:data"],
          rows: 5,
        };
        const qs = QueryService.toQueryString(obj);
        // Order is not strictly guaranteed, but all key-value pairs must appear
        qs.should.include("q=*%3A*");
        qs.should.include("rows=5");
        // fq appears twice
        const fqCount = qs.split("fq=").length - 1;
        fqCount.should.equal(2);
      });
    });

    describe("buildGetSettings()", () => {
      it("constructs a GET request with query string appended", () => {
        const params = { q: "*:*", rows: 1 };
        const settings = QueryService.buildGetSettings(
          "https://example.com/solr",
          params,
        );
        settings.should.deep.include({
          type: "GET",
          dataType: "json",
        });
        settings.url.should.include("?q=*%3A*");
        settings.url.should.include("&rows=1");
      });

      it("does not add a second '?' if urlBase already contains one", () => {
        const params = { q: "test" };
        const settings = QueryService.buildGetSettings(
          "https://example.com/search?",
          params,
        );
        settings.url.startsWith("https://example.com/search?q=").should.be.true;
      });
    });

    describe("buildPostSettings()", () => {
      it("constructs a POST request with FormData", () => {
        const { sandbox } = state;
        // Replace global FormData with a simple collector
        class MockFormData {
          constructor() {
            this.fields = [];
          }
          append(k, v) {
            this.fields.push({ key: k, value: v });
          }
        }
        sandbox.stub(window, "FormData").callsFake(() => new MockFormData());
        const params = { q: "x", fq: ["a", "b"], rows: 5 };
        const settings = QueryService.buildPostSettings(
          "https://example.com/api",
          params,
        );
        settings.should.deep.include({
          url: "https://example.com/api",
          type: "POST",
          contentType: false,
          processData: false,
          dataType: "json",
        });
        // Data should be our mock form data instance
        settings.data.should.be.instanceOf(MockFormData);
        // Keys should have been appended: fq twice, q once, rows once
        settings.data.fields
          .filter((f) => f.key === "fq")
          .length.should.equal(2);
        settings.data.fields
          .filter((f) => f.key === "q")
          .length.should.equal(1);
        settings.data.fields
          .filter((f) => f.key === "rows")
          .length.should.equal(1);
      });
    });

    describe("mergeAuth()", () => {
      it("returns original options when appUserModel is undefined", () => {
        const { sandbox } = state;
        sandbox.stub(window, "MetacatUI").value({});
        const opts = { url: "x", type: "GET" };
        const merged = QueryService.mergeAuth(opts);
        merged.should.deep.equal(opts);
      });

      it("merges authentication settings into ajax options", () => {
        const { sandbox } = state;
        const ajaxOpts = { url: "x", type: "GET" };
        const auth = { headers: { Authorization: "Bearer 1" }, timeout: 1000 };
        const mockGetAuth = sandbox.stub().returns(auth);
        sandbox.stub(window, "MetacatUI").value({
          appUserModel: { createAjaxSettings: mockGetAuth },
        });
        const result = QueryService.mergeAuth(ajaxOpts);
        // Should combine both objects, auth values override when keys conflict
        result.should.deep.equal({ ...ajaxOpts, ...auth });
        mockGetAuth.calledOnce.should.be.true;
      });
    });

    describe("decidePost()", () => {
      it("respects explicit boolean override", () => {
        const opts = { explicit: true, queryParams: {}, urlBase: "x" };
        QueryService.decidePost(opts).should.be.true;
        QueryService.decidePost({ ...opts, explicit: false }).should.be.false;
      });

      it("returns false when disableQueryPOSTs is enabled", () => {
        const { sandbox } = state;
        sandbox.stub(window, "MetacatUI").value({
          appModel: {
            get: sandbox.stub().withArgs("disableQueryPOSTs").returns(true),
          },
        });
        const res = QueryService.decidePost({
          queryParams: { q: "x" },
          urlBase: "http://",
        });
        res.should.be.false;
      });

      it("returns true when query string length exceeds configured max", () => {
        const { sandbox } = state;
        // max length set to 10 for easier test
        const getStub = sandbox.stub().callsFake((key) => {
          if (key === "maxQueryLength") return 10;
          return false;
        });
        sandbox.stub(window, "MetacatUI").value({
          appModel: { get: getStub },
        });
        const longParams = { q: "a".repeat(20) };
        // URL base length is 5, plus '?', plus query length (20) -> 26 > 10
        const res = QueryService.decidePost({
          queryParams: longParams,
          urlBase: "12345",
        });
        res.should.be.true;
        getStub.calledWithExactly("maxQueryLength").should.be.true;
      });

      it("uses DEFAULT_MAX_QUERY_LEN when configuration is missing", () => {
        const { sandbox } = state;
        sandbox
          .stub(window, "MetacatUI")
          .value({ appModel: { get: () => undefined } });
        // Create small query so result is false when default length is large
        const res = QueryService.decidePost({
          queryParams: { q: "abc" },
          urlBase: "",
        });
        res.should.be.false;
      });

      it("does not throw when MetacatUI is undefined", () => {
        const { sandbox } = state;
        sandbox.stub(window, "MetacatUI").value(undefined);
        const res = QueryService.decidePost({
          queryParams: { q: "a" },
          urlBase: "",
        });
        // Using default max length (2000), this should be false
        res.should.be.false;
      });
    });

    describe("query()", () => {
      it("invokes GET settings and merges auth for default options", () => {
        const { sandbox } = state;
        // stub jQuery ajax
        const ajaxStub = sandbox.stub($, "ajax").resolves("response");
        // stub internal helpers
        sandbox
          .stub(QueryService, "queryServiceUrl")
          .returns("https://example.com/api");
        sandbox.stub(QueryService, "buildQueryObject").returns({ q: "*:*" });
        sandbox.stub(QueryService, "decidePost").returns(false);
        const getSettings = {
          url: "https://example.com/api?q=*%3A*",
          type: "GET",
          dataType: "json",
        };
        sandbox.stub(QueryService, "buildGetSettings").returns(getSettings);
        const mergedSettings = { ...getSettings, headers: { Auth: "123" } };
        sandbox.stub(QueryService, "mergeAuth").returns(mergedSettings);
        return QueryService.query().then((result) => {
          result.should.equal("response");
          QueryService.buildQueryObject.calledOnce.should.be.true;
          QueryService.decidePost.calledOnce.should.be.true;
          QueryService.buildGetSettings.calledOnce.should.be.true;
          QueryService.mergeAuth.calledOnce.should.be.true;
          ajaxStub.calledOnceWithExactly(mergedSettings).should.be.true;
        });
      });

      it("invokes POST settings when decidePost() returns true", () => {
        const { sandbox } = state;
        const ajaxStub = sandbox.stub($, "ajax").resolves("ok");
        sandbox
          .stub(QueryService, "queryServiceUrl")
          .returns("https://api.test");
        sandbox.stub(QueryService, "buildQueryObject").returns({ q: "x" });
        sandbox.stub(QueryService, "decidePost").returns(true);
        const postSettings = {
          url: "https://api.test",
          type: "POST",
          data: new FormData(),
          dataType: "json",
        };
        sandbox.stub(QueryService, "buildPostSettings").returns(postSettings);
        sandbox.stub(QueryService, "mergeAuth").returns(postSettings);
        return QueryService.query().then(() => {
          QueryService.buildPostSettings.calledOnce.should.be.true;
          ajaxStub.calledOnceWithExactly(postSettings).should.be.true;
        });
      });

      it("skips mergeAuth when useAuth is false", () => {
        const { sandbox } = state;
        const ajaxStub = sandbox.stub($, "ajax").resolves("noauth");
        sandbox.stub(QueryService, "queryServiceUrl").returns("u");
        sandbox.stub(QueryService, "buildQueryObject").returns({ q: "x" });
        sandbox.stub(QueryService, "decidePost").returns(false);
        const getSettings = { url: "u?q=x", type: "GET", dataType: "json" };
        sandbox.stub(QueryService, "buildGetSettings").returns(getSettings);
        const mergeAuthSpy = sandbox.spy(QueryService, "mergeAuth");
        return QueryService.query({ useAuth: false }).then(() => {
          mergeAuthSpy.called.should.be.false;
          ajaxStub.calledOnceWithExactly(getSettings).should.be.true;
        });
      });
    });

    // Additional tests for new methods and options
    describe("getQueryConfig()", () => {
      it("returns urlBase (trimmed), queryParams from buildQueryObject, and shouldPost from decidePost", () => {
        const { sandbox } = state;
        sandbox
          .stub(QueryService, "queryServiceUrl")
          .returns("https://example.com/search?");
        const bqoStub = sandbox
          .stub(QueryService, "buildQueryObject")
          .returns({ q: "x", rows: 10 });
        const decideStub = sandbox
          .stub(QueryService, "decidePost")
          .returns(true);

        const cfg = QueryService.getQueryConfig({ q: "x", rows: 10 });

        cfg.urlBase.should.equal("https://example.com/search");
        cfg.queryParams.should.deep.equal({ q: "x", rows: 10 });
        cfg.shouldPost.should.be.true;
        bqoStub.calledOnce.should.be.true;
        decideStub.calledOnce.should.be.true;
      });
    });

    describe("queryWithFetch()", () => {
      it("performs a GET with query string and merges auth headers by default", async () => {
        const { sandbox } = state;

        sandbox
          .stub(QueryService, "queryServiceUrl")
          .returns("https://api.test");
        sandbox
          .stub(QueryService, "buildQueryObject")
          .returns({ q: "*:*", rows: 1 });
        sandbox.stub(QueryService, "decidePost").returns(false);

        const jsonStub = sandbox
          .stub()
          .resolves({ response: { numFound: 0, docs: [] } });
        const fetchStub = sandbox
          .stub(window, "fetch")
          .resolves({ ok: true, json: jsonStub });

        const cfs = sandbox
          .stub()
          .returns({ headers: { Authorization: "Bearer 1" } });

        sandbox.stub(MetacatUI, "appUserModel").value({
          createFetchSettings: cfs,
        });

        const data = await QueryService.queryWithFetch();

        fetchStub.calledOnce.should.be.true;
        const [url, opts] = fetchStub.firstCall.args;
        url.should.include("?q=*%3A*");
        url.should.include("&rows=1");
        opts.method.should.equal("GET");
        opts.headers.Authorization.should.equal("Bearer 1");
        data.should.deep.equal({ response: { numFound: 0, docs: [] } });
        cfs.calledOnce.should.be.true;
      });

      it("performs a POST with FormData when decidePost() returns true and throws on HTTP error", async () => {
        const { sandbox } = state;
        sandbox
          .stub(QueryService, "queryServiceUrl")
          .returns("https://api.test");
        sandbox
          .stub(QueryService, "buildQueryObject")
          .returns({ q: "x", fq: ["a", "b"], rows: 5 });
        sandbox.stub(QueryService, "decidePost").returns(true);

        class MockFormData {
          constructor() {
            this.fields = [];
          }
          append(k, v) {
            this.fields.push({ key: k, value: v });
          }
        }
        sandbox.stub(window, "FormData").callsFake(() => new MockFormData());

        const fetchStub = sandbox
          .stub(window, "fetch")
          .resolves({ ok: false, status: 500 });
        sandbox.stub(window, "MetacatUI").value({
          appUserModel: { createFetchSettings: sandbox.stub().returns({}) },
        });

        try {
          await QueryService.queryWithFetch();
          throw new Error("expected throw");
        } catch (e) {
          e.message.should.match(/HTTP 500/);
        }

        const [, opts] = fetchStub.firstCall.args;
        opts.method.should.equal("POST");
        opts.body.should.be.instanceOf(MockFormData);
        opts.body.fields.filter((f) => f.key === "fq").length.should.equal(2);
        opts.body.fields.filter((f) => f.key === "q").length.should.equal(1);
        opts.body.fields.filter((f) => f.key === "rows").length.should.equal(1);
      });

      it("skips auth when useAuth is false", async () => {
        const { sandbox } = state;
        sandbox
          .stub(QueryService, "queryServiceUrl")
          .returns("https://api.test");
        sandbox.stub(QueryService, "buildQueryObject").returns({ q: "x" });
        sandbox.stub(QueryService, "decidePost").returns(false);

        const jsonStub = sandbox.stub().resolves({ ok: 1 });
        const fetchStub = sandbox
          .stub(window, "fetch")
          .resolves({ ok: true, json: jsonStub });

        const cfs = sandbox
          .stub()
          .returns({ headers: { Authorization: "nope" } });
        sandbox
          .stub(MetacatUI, "appUserModel")
          .value({ createFetchSettings: cfs });

        await QueryService.queryWithFetch({ useAuth: false });
        cfs.called.should.be.false;
        const [, opts] = fetchStub.firstCall.args;
        // headers should be empty object (no merge)
        Object.keys(opts.headers).length.should.equal(0);
      });
    });

    describe("parseResponse()", () => {
      it("throws on invalid response shape", () => {
        (() => QueryService.parseResponse(null)).should.throw();
        (() => QueryService.parseResponse({})).should.throw();
      });

      it("returns [] when docs array is missing or empty", () => {
        QueryService.parseResponse({
          response: { docs: [] },
        }).should.deep.equal([]);
        QueryService.parseResponse({ response: {} }).should.deep.equal([]);
      });

      it("cleans empty values and parses resourceMap fields", () => {
        const resp = {
          response: {
            docs: [
              {
                id: "x",
                title: "",
                empty: null,
                resourceMap: ["  rm1  ", null, "rm2 "],
              },
              { id: "y", resourceMap: "  rm3  ", count: 0, flag: false },
            ],
          },
        };
        const docs = QueryService.parseResponse(resp);
        docs.should.deep.equal([
          { id: "x", resourceMap: ["rm1", "rm2"] },
          { id: "y", resourceMap: ["rm3"], count: 0, flag: false },
        ]);
      });
    });

    describe("parseResourceMapFields()", () => {
      it("returns [] for invalid input and parses resourceMap in-place for valid docs", () => {
        QueryService.parseResourceMapFields(undefined).should.deep.equal([]);
        const docs = [
          { id: 1, resourceMap: [" a ", "b ", null] },
          { id: 2, resourceMap: " c " },
          { id: 3 },
        ];
        const res = QueryService.parseResourceMapFields(docs);
        res[0].resourceMap.should.deep.equal(["a", "b"]);
        res[1].resourceMap.should.deep.equal(["c"]);
        should.equal(res[2].resourceMap, undefined);
      });
    });

    describe("buildIdQuery()", () => {
      it("builds query for PID only (search id OR seriesId)", () => {
        const pid = "urn:uuid:123";
        const q = QueryService.buildIdQuery(pid, undefined);
        q.should.equal(
          `(${QueryService.getQueryPart("id", pid)} OR ${QueryService.getQueryPart("seriesId", pid)})`,
        );
      });

      it("builds query for PID and SID (AND)", () => {
        const pid = "p1";
        const sid = "s1";
        const q = QueryService.buildIdQuery(pid, sid);
        q.should.equal(
          `(${QueryService.getQueryPart("id", pid)} AND ${QueryService.getQueryPart("seriesId", sid)})`,
        );
      });

      it("builds query for SID only (latest version; excludes obsoleted)", () => {
        const sid = "s-only";
        const q = QueryService.buildIdQuery(undefined, sid);
        q.should.equal(
          `${QueryService.getQueryPart("seriesId", sid)} -obsoletedBy:*`,
        );
      });
    });

    describe("escapeLucene()", () => {
      it("escapes Lucene metacharacters", () => {
        const input = '(title:(a+b) AND path:"/tmp")?';
        const out = QueryService.escapeLucene(input);
        console.log({
          out,
          exp: '\\(title\\:\\(a\\+b\\) AND path\\:\\"/tmp\\"\\)\\?',
          // inputttt: input,
        });
        out.should.equal(
          '\\(title\\:\\(a\\+b\\) AND path\\:\\"\\/tmp\\"\\)\\?',
        );
      });

      it("throws on non-string input", () => {
        (() => QueryService.escapeLucene(null)).should.throw(TypeError);
      });
    });

    describe("getQueryPart()", () => {
      it('formats field:"escaped"', () => {
        const part = QueryService.getQueryPart("id", 'abc"123');
        part.should.equal('id:"abc\\"123"');
      });

      it("throws when field or value is not a string", () => {
        (() => QueryService.getQueryPart(1, "x")).should.throw(TypeError);
        (() => QueryService.getQueryPart("x", 1)).should.throw(TypeError);
      });
    });

    describe("parseResourceMapField()", () => {
      it("returns [] when resourceMap is missing", () => {
        QueryService.parseResourceMapField({}).should.deep.equal([]);
      });

      it("parses string to [trimmed] array", () => {
        QueryService.parseResourceMapField({
          resourceMap: "  abc  ",
        }).should.deep.equal(["abc"]);
      });

      it("parses array of strings and filters falsy", () => {
        QueryService.parseResourceMapField({
          resourceMap: [" a ", null, "b "],
        }).should.deep.equal(["a", "b"]);
      });
    });

    describe("removeEmptyValues()", () => {
      it("removes null/undefined/empty string, but keeps 0/false", () => {
        const docs = [
          { id: 1, a: null, b: undefined, c: "", d: 0, e: false, f: "x" },
        ];
        const cleaned = QueryService.removeEmptyValues(docs);
        cleaned.should.deep.equal([{ id: 1, d: 0, e: false, f: "x" }]);
      });

      it("returns [] for non-array input or empty array", () => {
        QueryService.removeEmptyValues(undefined).should.deep.equal([]);
        QueryService.removeEmptyValues([]).should.deep.equal([]);
      });
    });

    describe("buildQueryObject() additions", () => {
      it("accepts fields as a pre-formatted string", () => {
        const params = QueryService.buildQueryObject({
          q: "*:*",
          fields: "id,title",
        });
        params.fl.should.equal("id,title");
      });

      it("sets archived and grouping options when provided", () => {
        const params = QueryService.buildQueryObject({
          q: "*:*",
          archived: true,
          group: true,
          groupField: ["seriesId", "id"],
          groupLimit: 3,
        });
        params.archived.should.equal("archived:*");
        params.group.should.equal("true");
        params["group.field"].should.equal("seriesId,id");
        params["group.limit"].should.equal(3);
      });

      it("throws when groupField is not a string or array", () => {
        (() =>
          QueryService.buildQueryObject({
            q: "*:*",
            group: true,
            groupField: 123,
          })).should.throw(TypeError);
      });
    });
  });
});

define([
  "/test/js/specs/shared/clean-state.js",
  "jquery",
  "models/CollectionModel",
  "models/dataONEServices/DataONEHttpClient",
  "common/ValueUtilities",
], (
  cleanState,
  $,
  CollectionModel,
  DataONEHttpClient,
  ValueUtilities,
) => {
  chai.should();

  describe("CollectionModel Test Suite", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      const originalMetacatUI = globalThis.MetacatUI;
      const model = new CollectionModel();
      return { sandbox, originalMetacatUI, model };
    }, beforeEach);

    afterEach(() => {
      state.sandbox.restore();
      globalThis.MetacatUI = state.originalMetacatUI;
    });

    it("waits for a pending auth token before reserving a series ID", async () => {
      const token = "test-token";
      const getTokenPromise = state.sandbox.stub().resolves(token);
      const originalAppModel = state.originalMetacatUI.appModel;

      globalThis.MetacatUI = {
        ...state.originalMetacatUI,
        appModel: {
          get(key) {
            if (key === "d1CNBaseUrl") return "https://example.org";
            if (key === "d1CNService") return "/cn/v2";
            return originalAppModel.get(key);
          },
        },
        appUserModel: {
          get(key) {
            if (key === "token") return null;
            if (key === "tokenChecked") return false;
            return null;
          },
          getTokenPromise,
          createAjaxSettings: state.sandbox.stub().returns({}),
        },
      };

      state.sandbox
        .stub(ValueUtilities, "makeUUID")
        .returns("urn:uuid:portal.1");
      state.sandbox.stub($, "ajax");
      const request = state.sandbox
        .stub(DataONEHttpClient.prototype, "request")
        .resolves({
          data: "<identifier>urn:uuid:portal.1</identifier>",
          status: 200,
        });

      await state.model.reserveSeriesId();

      getTokenPromise.calledOnce.should.equal(true);
      request.calledOnce.should.equal(true);
      request.firstCall.args[0].token.should.equal(token);
      state.model.get("seriesId").should.equal("urn:uuid:portal.1");
    });
  });
});

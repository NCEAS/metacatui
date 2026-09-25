define([
  "/test/js/specs/shared/clean-state.js",
  "jquery",
  "models/CollectionModel",
  "models/portals/PortalModel",
  "models/dataONEServices/DataONEHttpClient",
  "common/ValueUtilities",
], (
  cleanState,
  $,
  CollectionModel,
  PortalModel,
  DataONEHttpClient,
  ValueUtilities,
) => {
  chai.should();
  const expect = chai.expect;

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

    it("parses a collection XML document", () => {
      const xml = $.parseXML(
        '<col:collection xmlns:col="https://purl.dataone.org/collections-1.1.0"><name>Example</name><label>example</label><definition/></col:collection>',
      );

      const parsed = state.model.parse(xml);
      delete window.filterXML;

      expect(parsed.name).to.equal("Example");
      expect(parsed.label).to.equal("example");
    });

    it("creates collection XML that can be serialized and reparsed", () => {
      const xml = state.model.createXML();
      const reparsed = $.parseXML(new XMLSerializer().serializeToString(xml));

      expect(reparsed.documentElement.localName).to.equal("collection");
      expect(reparsed.documentElement.namespaceURI).to.equal(
        "https://purl.dataone.org/collections-1.1.0",
      );
      expect(
        reparsed.documentElement.getAttributeNS(
          "http://www.w3.org/2001/XMLSchema-instance",
          "schemaLocation",
        ),
      ).to.equal("https://purl.dataone.org/collections-1.1.0");
    });

    it("updates both collection and portal XML roots", () => {
      const collectionXML = $.parseXML(
        '<col:collection xmlns:col="https://purl.dataone.org/collections-1.1.0"><label>Old</label><definition><filter><field>formatType</field><value>METADATA</value></filter></definition></col:collection>',
      );
      const collectionRoot = collectionXML.documentElement;
      state.model.set(state.model.parse(collectionXML));
      delete window.filterXML;
      state.model.set("label", "Updated collection");

      const updatedCollection = state.model.updateCollectionDOM(collectionRoot);
      const portal = new PortalModel({});
      const portalXML = $.parseXML(
        '<por:portal xmlns:por="https://purl.dataone.org/portals-1.1.0"><label>Old</label><definition><filter><field>formatType</field><value>METADATA</value></filter></definition></por:portal>',
      );
      portal.set(portal.parse(portalXML));
      delete window.filterXML;
      portal.set("label", "Updated portal");
      const updatedPortal = portal.updateCollectionDOM(
        portalXML.documentElement,
      );

      expect(updatedCollection.localName).to.equal("collection");
      expect(
        updatedCollection.getElementsByTagName("label")[0].textContent,
      ).to.equal("Updated collection");
      expect(updatedPortal.localName).to.equal("portal");
      expect(
        updatedPortal.getElementsByTagName("label")[0].textContent,
      ).to.equal("Updated portal");
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

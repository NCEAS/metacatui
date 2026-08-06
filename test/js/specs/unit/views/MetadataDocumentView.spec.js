define([
  "jquery",
  "backbone",
  "views/MetadataDocumentView",
  "models/dataONEServices/ObjectService",
  "models/resourceMap/RDFGraph",
  "common/QueryService",
], (
  $,
  Backbone,
  MetadataDocumentView,
  ObjectService,
  RDFGraph,
  QueryService,
) => {
  const expect = chai.expect;

  describe("MetadataDocumentView", () => {
    describe("onClose()", () => {
      it("leaves page title cleanup to the landing page view", () => {
        const originalMetacatUI = globalThis.MetacatUI;
        const resetTitle = sinon.stub();
        globalThis.MetacatUI = {
          ...(originalMetacatUI || {}),
          appModel: {
            resetTitle,
            get: (key) =>
              ({
                objectServiceUrl: "https://object.test/",
                viewServiceUrl: "https://view.test/",
              })[key] || "",
          },
        };

        try {
          const view = new MetadataDocumentView({
            el: document.createElement("div"),
          });

          view.onClose();

          sinon.assert.notCalled(resetTitle);
        } finally {
          globalThis.MetacatUI = originalMetacatUI;
        }
      });
    });

    describe("insertImagePreview()", () => {
      let originalMetacatUI;
      let originalCreateObjectURL;
      let originalRevokeObjectURL;
      let sandbox;

      beforeEach(() => {
        sandbox = sinon.createSandbox();
        originalMetacatUI = globalThis.MetacatUI;
        originalCreateObjectURL = window.URL.createObjectURL;
        originalRevokeObjectURL = window.URL.revokeObjectURL;

        globalThis.MetacatUI = {
          ...(originalMetacatUI || {}),
          appModel: {
            resetTitle: sandbox.stub(),
            get: (key) =>
              ({
                objectServiceUrl: "https://object.test/",
                viewServiceUrl: "https://view.test/",
              })[key] || "",
          },
          appUserModel: {
            get: (key) => (key === "token" ? "token-1" : null),
          },
        };

        window.URL.createObjectURL = sandbox.stub().returns("blob:preview");
        window.URL.revokeObjectURL = sandbox.stub();
      });

      afterEach(() => {
        sandbox.restore();
        globalThis.MetacatUI = originalMetacatUI;
        window.URL.createObjectURL = originalCreateObjectURL;
        window.URL.revokeObjectURL = originalRevokeObjectURL;
      });

      it("uses ObjectService.download for private image members", async () => {
        const blob = new Blob(["image"], { type: "image/png" });
        const download = sandbox
          .stub(ObjectService.prototype, "download")
          .resolves(blob);
        const view = new MetadataDocumentView({
          el: document.createElement("div"),
        });
        const container = $("<section><label>Image</label></section>");
        const member = {
          pid: "image.1",
          isPublic: false,
        };

        await view.insertImagePreview(member, container);

        expect(download.calledOnceWith("image.1")).to.equal(true);
        expect(window.URL.createObjectURL.calledOnceWith(blob)).to.equal(true);
        expect(container.find("img").attr("src")).to.equal("blob:preview");

        view.onClose();
        expect(
          window.URL.revokeObjectURL.calledOnceWith("blob:preview"),
        ).to.equal(true);
      });

      it("does not create a private preview URL after the view closes", async () => {
        let resolveDownload;
        const download = sandbox
          .stub(ObjectService.prototype, "download")
          .returns(
            new Promise((resolve) => {
              resolveDownload = resolve;
            }),
          );
        const view = new MetadataDocumentView({
          el: document.createElement("div"),
        });
        const previewPromise = view.insertImagePreview(
          { pid: "image.1", isPublic: false },
          $("<section></section>"),
        );
        await Promise.resolve();
        expect(download.calledOnce).to.equal(true);

        view.onClose();
        resolveDownload(new Blob(["image"], { type: "image/png" }));
        await previewPromise;

        expect(window.URL.createObjectURL.called).to.equal(false);
      });

      it("does not start a private preview download after the view closes", async () => {
        let resolveIsPublic;
        const download = sandbox.stub(ObjectService.prototype, "download");
        const view = new MetadataDocumentView({
          el: document.createElement("div"),
        });
        const previewPromise = view.insertImagePreview(
          {
            pid: "image.1",
            isPublic: () =>
              new Promise((resolve) => {
                resolveIsPublic = resolve;
              }),
          },
          $("<section></section>"),
        );

        view.onClose();
        resolveIsPublic(false);
        await previewPromise;

        sinon.assert.notCalled(download);
      });

      it("ignores image access lookup failures", async () => {
        const download = sandbox.stub(ObjectService.prototype, "download");
        const view = new MetadataDocumentView({
          el: document.createElement("div"),
        });

        await view.insertImagePreview(
          {
            pid: "image.1",
            isPublic: sandbox.stub().rejects(new Error("access unavailable")),
          },
          $("<section></section>"),
        );

        sinon.assert.notCalled(download);
      });
    });

    describe("entity lookups", () => {
      let originalMetacatUI;

      beforeEach(() => {
        originalMetacatUI = globalThis.MetacatUI;
        globalThis.MetacatUI = {
          ...(originalMetacatUI || {}),
          appModel: {
            get: (key) =>
              ({
                objectServiceUrl: "https://object.test/",
                viewServiceUrl: "https://view.test/",
              })[key] || "",
          },
        };
      });

      afterEach(() => {
        globalThis.MetacatUI = originalMetacatUI;
      });

      it("annotates a single rendered section when one parsed entity matches", () => {
        const el = document.createElement("div");
        el.innerHTML = '<section class="entitydetails"></section>';
        const section = el.querySelector("section");
        const view = new MetadataDocumentView({ el });
        view.metadataViewDoc = {
          entities: [{ pid: "data.1", fileName: "data.csv" }],
          annotateEntitySection: sinon.stub().callsFake((target, pid) => {
            target.dataset.id = pid;
          }),
        };
        view.dataPackage = { getData: () => [] };

        const result = view.findSingleEntityDetailsContainer("data.1");

        expect(result[0]).to.equal(section);
        expect(section.dataset.id).to.equal("data.1");
        sinon.assert.calledOnceWithExactly(
          view.metadataViewDoc.annotateEntitySection,
          section,
          "data.1",
        );
      });

      it("previews provenance records in the rendered metadata", () => {
        const el = document.createElement("div");
        el.innerHTML =
          '<a class="preview" data-id="data.1"><span>View</span></a>';
        const view = new MetadataDocumentView({ el });
        const entityDetails = $("<section></section>");
        sinon
          .stub(view, "findEntityDetailsContainer")
          .withArgs("data.1")
          .returns(entityDetails);
        globalThis.MetacatUI.appView = { scrollTo: sinon.stub() };
        const event = {
          target: el.querySelector("span"),
          preventDefault: sinon.stub(),
        };

        const result = view.previewData(event);

        expect(result).to.equal(true);
        sinon.assert.calledOnce(event.preventDefault);
        sinon.assert.calledOnceWithExactly(
          globalThis.MetacatUI.appView.scrollTo,
          entityDetails,
        );
      });
    });

    describe("renderMetadataDocument()", () => {
      it("uses parsed template content when it is available", () => {
        const view = new MetadataDocumentView({
          el: document.createElement("div"),
        });
        view.metadataContainer = document.createElement("div");
        view.messageContainer = document.createElement("div");
        view.dataPackage = { addViewServiceEntities: sinon.stub() };
        const template = document.createElement("template");
        template.innerHTML = '<section id="Metadata">Parsed metadata</section>';
        const metadataViewDoc = {
          entityPids: ["data.1"],
          entities: [{ pid: "data.1" }],
          html: "<section>String metadata</section>",
          template,
        };

        view.renderMetadataDocument(metadataViewDoc);

        expect(view.metadataContainer.textContent).to.equal("Parsed metadata");
        expect(template.content.childNodes).to.have.length(0);
        expect(metadataViewDoc.template).to.equal(null);
        sinon.assert.calledOnceWithExactly(
          view.dataPackage.addViewServiceEntities,
          metadataViewDoc.entities,
        );
      });

      it("falls back to HTML when parsed template content is unavailable", () => {
        const view = new MetadataDocumentView({
          el: document.createElement("div"),
        });
        view.metadataContainer = document.createElement("div");
        view.messageContainer = document.createElement("div");
        const metadataViewDoc = {
          entityPids: [],
          entities: [],
          html: "<section>String metadata</section>",
        };

        view.renderMetadataDocument(metadataViewDoc);

        expect(view.metadataContainer.textContent).to.equal("String metadata");
      });
    });

    describe("renderMetadataFromIndex()", () => {
      let originalMetacatUI;
      let sandbox;

      beforeEach(() => {
        sandbox = sinon.createSandbox();
        originalMetacatUI = globalThis.MetacatUI;
        globalThis.MetacatUI = {
          ...(originalMetacatUI || {}),
          appModel: {
            get: (key) =>
              ({
                objectServiceUrl: "https://object.test/",
                viewServiceUrl: "https://view.test/",
              })[key] || "",
          },
        };
      });

      afterEach(() => {
        sandbox.restore();
        globalThis.MetacatUI = originalMetacatUI;
      });

      it("fetches full index metadata when seeded results only have manifest fields", async () => {
        const view = new MetadataDocumentView({
          el: document.createElement("div"),
          pid: "metadata.1",
          indexResults: [
            {
              id: "metadata.1",
              origin: "FREDERIC BRIEGER",
              formatId: "science-on-schema.org/Dataset;ld+json",
              formatType: "METADATA",
            },
          ],
        });
        sandbox.stub(view, "showMessage");
        view.dataPackage = { getData: () => [] };
        sandbox.stub(QueryService, "queryWithFetch").resolves({});
        sandbox.stub(QueryService, "parseResponse").returns([
          {
            id: "metadata.1",
            abstract: "Full abstract from Solr",
            keywords: ["Natural sciences -> Permafrost"],
          },
        ]);

        const metadataViewDoc = await view.renderMetadataFromIndex();

        sinon.assert.calledOnce(QueryService.queryWithFetch);
        expect(QueryService.queryWithFetch.firstCall.args[0].fields).to.equal(
          "*",
        );
        expect(metadataViewDoc.html).to.contain("Full abstract from Solr");
        expect(metadataViewDoc.html).to.contain(
          "Natural sciences -&gt; Permafrost",
        );
      });

      it("renders a limited fallback when fresh index metadata rejects", async () => {
        const view = new MetadataDocumentView({
          el: document.createElement("div"),
          pid: "metadata.1",
        });
        sandbox.stub(view, "showMessage");
        view.dataPackage = { getData: () => [] };
        sandbox
          .stub(QueryService, "queryWithFetch")
          .rejects(new Error("Solr unavailable"));
        sandbox.stub(QueryService, "parseResponse");

        const metadataViewDoc = await view.renderMetadataFromIndex();

        expect(metadataViewDoc.html).to.contain(
          "There is limited information about this content.",
        );
        sinon.assert.notCalled(QueryService.parseResponse);
      });

      it("renders seeded index results when fresh index metadata is empty", async () => {
        const view = new MetadataDocumentView({
          el: document.createElement("div"),
          pid: "metadata.1",
          indexResults: [{ id: "metadata.1", title: "Seeded metadata" }],
        });
        sandbox.stub(view, "showMessage");
        view.dataPackage = { getData: () => [] };
        sandbox.stub(QueryService, "queryWithFetch").resolves({});
        sandbox.stub(QueryService, "parseResponse").returns([]);

        const metadataViewDoc = await view.renderMetadataFromIndex();

        expect(metadataViewDoc.html).to.contain("Seeded metadata");
        expect(metadataViewDoc.html).to.not.contain(
          "There is limited information about this content.",
        );
      });

      it("keeps the limited metadata warning after index fallback renders", async () => {
        const view = new MetadataDocumentView({
          el: document.createElement("div"),
          pid: "metadata.1",
        });
        view.dataPackage = {
          addViewServiceEntities: sandbox.stub(),
          getData: () => [],
        };
        sandbox
          .stub(view.viewService, "download")
          .rejects(new Error("offline"));
        sandbox.stub(QueryService, "queryWithFetch").resolves({});
        sandbox.stub(QueryService, "parseResponse").returns([]);
        sandbox.stub(view, "initializeAttributeListTables");
        sandbox.stub(view, "renderAltIdentifierHelpText");
        sandbox.stub(view, "insertDataDetails");
        sandbox.stub(view, "checkForProv");
        sandbox.stub(view, "insertSpatialCoverageMap");
        sandbox.stub(view, "insertCopiables");
        sandbox.stub(view, "createAnnotationViews");
        sandbox.stub(view, "insertMarkdownViews");

        await view.render();

        expect(view.messageContainer.textContent).to.contain(
          "There is limited metadata about this dataset.",
        );
      });

      it("uses View Service metadata when rendering succeeds", async () => {
        const view = new MetadataDocumentView({
          el: document.createElement("div"),
          pid: "metadata.1",
        });
        const metadataViewDoc = {};
        const renderFromViewService = sandbox
          .stub(view, "renderMetadataFromViewService")
          .resolves(metadataViewDoc);
        const renderFromIndex = sandbox
          .stub(view, "renderMetadataFromIndex")
          .resolves({});
        const renderMetadataDocument = sandbox.stub(
          view,
          "renderMetadataDocument",
        );
        sandbox.stub(view, "initializeAttributeListTables");
        sandbox.stub(view, "renderAltIdentifierHelpText");
        sandbox.stub(view, "insertDataDetails");
        sandbox.stub(view, "checkForProv");
        sandbox.stub(view, "insertSpatialCoverageMap");
        sandbox.stub(view, "insertCopiables");
        sandbox.stub(view, "createAnnotationViews");
        sandbox.stub(view, "insertMarkdownViews");

        await view.render();

        sinon.assert.calledOnce(renderFromViewService);
        sinon.assert.notCalled(renderFromIndex);
        sinon.assert.calledOnceWithExactly(
          renderMetadataDocument,
          metadataViewDoc,
        );
      });
    });

    describe("provenance redraws", () => {
      let originalMetacatUI;

      beforeEach(() => {
        originalMetacatUI = globalThis.MetacatUI;
        globalThis.MetacatUI = {
          ...(originalMetacatUI || {}),
          root: "",
          appModel: {
            get: (key) =>
              ({
                objectServiceUrl: "https://object.test/",
                viewServiceUrl: "https://view.test/",
              })[key] || "",
          },
        };
      });

      afterEach(() => {
        globalThis.MetacatUI = originalMetacatUI;
      });

      it("waits until the view is attached before drawing provenance charts", async () => {
        const view = new MetadataDocumentView({
          el: document.createElement("div"),
          pid: "metadata.1",
        });
        sinon.stub(view, "showMessage");
        sinon.stub(view, "renderMetadataFromViewService").resolves({});
        sinon.stub(view, "renderMetadataDocument");
        sinon.stub(view, "initializeAttributeListTables");
        sinon.stub(view, "renderAltIdentifierHelpText");
        sinon.stub(view, "insertDataDetails");
        const checkForProv = sinon.stub(view, "checkForProv");
        sinon.stub(view, "insertSpatialCoverageMap");
        sinon.stub(view, "insertCopiables");
        sinon.stub(view, "createAnnotationViews");
        sinon.stub(view, "insertMarkdownViews");

        await view.render();

        sinon.assert.notCalled(checkForProv);

        document.body.appendChild(view.el);
        await view.render();
        view.el.remove();

        sinon.assert.calledOnce(checkForProv);
      });

      it("coalesces synchronous provenance change redraws", async () => {
        const dataPackage = new Backbone.Model();
        dataPackage.events = { ...Backbone.Events };
        dataPackage.getResourceMapModel = () => ({});
        const el = document.createElement("div");
        el.innerHTML = '<div class="metadata-view__metadata"></div>';
        const view = new MetadataDocumentView({
          el,
          dataPackage,
        });
        view.metadataContainer = el.querySelector(".metadata-view__metadata");
        view.metadataViewDoc = {};
        const redraw = sinon.stub(view, "redrawProvCharts");

        dataPackage.events.trigger("provenance:changed");
        dataPackage.events.trigger("provenance:changed");
        dataPackage.events.trigger("provenance:changed");

        expect(redraw.callCount).to.equal(0);
        await Promise.resolve();
        expect(redraw.callCount).to.equal(1);
      });

      it("does not insert empty editors for a read-only program", () => {
        const member = {
          pid: "program.1",
          isData: () => true,
          isMetadata: () => false,
          getFileName: () => "analysis.R",
          getFormatId: () => "text/plain",
        };
        const resourceMap = {
          getMemberPids: () => ["program.1"],
          graphState: {
            getMemberUris: () => ["https://object.test/program.1"],
            getExecutionNodesForProgram: () => [
              {
                termType: RDFGraph.NODE_TYPES.NAMED,
                value: "execution.1",
              },
              {
                termType: RDFGraph.NODE_TYPES.NAMED,
                value: "execution.2",
              },
            ],
          },
          provenance: {
            toJSON: () => ({
              typeAssertions: [{ pid: "program.1", className: "Program" }],
              generatedByPrograms: [],
              usedByPrograms: [],
              wasDerivedFrom: [],
              wasInformedByPrograms: [],
            }),
          },
        };
        resourceMap.provenance.resourceMap = resourceMap;
        const dataPackage = new Backbone.Model();
        dataPackage.getData = () => [member];
        dataPackage.getMember = () => member;
        dataPackage.getResourceMapModel = () => resourceMap;
        dataPackage.toArray = () => [member];

        const el = document.createElement("div");
        el.innerHTML = [
          '<div class="metadata-view__metadata">',
          '<section class="entitydetails" data-id="program.1"></section>',
          "</div>",
        ].join("");
        const view = new MetadataDocumentView({
          el,
          dataPackage,
          editModeOn: true,
        });
        view.metadataContainer = el.querySelector(".metadata-view__metadata");
        const entitySection =
          view.metadataContainer.querySelector(".entitydetails");
        view.metadataViewDoc = {
          findAndAnnotateEntitySection: () => entitySection,
        };

        view.drawProvCharts();

        expect(view.el.querySelectorAll(".prov-chart")).to.have.lengthOf(0);
        expect(view.metadataContainer.classList.contains("gutters")).to.equal(
          false,
        );
      });
    });
  });
});

define([
  "jquery",
  "backbone",
  "views/MetadataDocumentView",
  "models/dataPackage/DataPackage",
  "models/dataONEServices/ObjectService",
  "models/resourceMap/RDFGraph",
  "models/viewService/ViewServiceDoc",
  "common/QueryService",
], (
  $,
  Backbone,
  MetadataDocumentView,
  DataPackage,
  ObjectService,
  RDFGraph,
  ViewServiceDoc,
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
      let dataPackage;
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
        dataPackage = {
          events: { ...Backbone.Events },
          getSysMetaService: sandbox.stub().returns({}),
        };
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
          dataPackage,
        });
        const container = $("<section><label>Image</label></section>");
        const member = {
          pid: "image.1",
          isPublic: sandbox.stub().returns(false),
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
          dataPackage,
        });
        const previewPromise = view.insertImagePreview(
          { pid: "image.1", isPublic: sandbox.stub().returns(false) },
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
          dataPackage,
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
          dataPackage,
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

      const renderTestView = async ({
        dataPackage = new DataPackage(),
        indexDocuments = [{ id: "metadata.1", title: "Indexed dataset" }],
        viewServiceHtml,
      } = {}) => {
        const view = new MetadataDocumentView({
          el: document.createElement("div"),
          pid: "metadata.1",
          dataPackage,
        });
        if (viewServiceHtml) {
          sandbox
            .stub(view.viewService, "download")
            .resolves(
              ViewServiceDoc.fromHtml(viewServiceHtml, { pid: "metadata.1" }),
            );
        } else {
          sandbox
            .stub(view.viewService, "download")
            .rejects(new Error("offline"));
          sandbox.stub(QueryService, "queryWithFetch").resolves({});
          sandbox.stub(QueryService, "parseResponse").returns(indexDocuments);
        }
        sandbox.stub(view, "initializeAttributeListTables");
        sandbox.stub(view, "renderAltIdentifierHelpText");
        sandbox.stub(view, "insertSpatialCoverageMap");
        sandbox.stub(view, "insertCopiables");
        sandbox.stub(view, "createAnnotationViews");
        sandbox.stub(view, "insertMarkdownViews");

        await view.render();
        return view;
      };

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

      it("defers package-dependent work until one explicit enhancement", async () => {
        const dataPackage = {
          events: { ...Backbone.Events },
          addViewServiceEntities: sandbox.stub(),
        };
        const view = new MetadataDocumentView({
          el: document.createElement("div"),
          pid: "metadata.1",
          dataPackage,
        });
        const metadataViewDoc = {
          entities: [{ pid: "data.1" }],
          html: '<section id="Metadata">Dataset</section>',
        };
        sandbox
          .stub(view, "renderMetadataFromViewService")
          .resolves(metadataViewDoc);
        sandbox.stub(view, "initializeAttributeListTables");
        sandbox.stub(view, "renderAltIdentifierHelpText");
        const insertDataDetails = sandbox.stub(view, "insertDataDetails");
        const checkForProv = sandbox.stub(view, "checkForProv");
        sandbox.stub(view, "insertSpatialCoverageMap");
        sandbox.stub(view, "insertCopiables");
        sandbox.stub(view, "createAnnotationViews");
        sandbox.stub(view, "insertMarkdownViews");

        await view.render();

        sinon.assert.notCalled(dataPackage.addViewServiceEntities);
        sinon.assert.notCalled(insertDataDetails);
        sinon.assert.notCalled(checkForProv);

        document.body.appendChild(view.el);
        view.enhanceWithPackage({ editModeOn: true });
        view.enhanceWithPackage({ editModeOn: false });
        view.el.remove();

        expect(view.editModeOn).to.equal(true);
        sinon.assert.calledOnceWithExactly(
          dataPackage.addViewServiceEntities,
          metadataViewDoc.entities,
        );
        sinon.assert.calledOnce(insertDataDetails);
        sinon.assert.calledOnce(checkForProv);
      });

      it("adds fallback file sections after package membership loads", async () => {
        const dataPackage = new DataPackage();
        const view = await renderTestView({ dataPackage });
        expect(view.el.querySelectorAll(".entitydetails")).to.have.lengthOf(0);

        dataPackage.members.add({
          pid: "data.1",
          fileName: "data.csv",
          formatType: "DATA",
        });
        view.enhanceWithPackage({ editModeOn: false });

        expect(view.el.querySelectorAll(".entitydetails")).to.have.lengthOf(1);
        expect(
          view.el.querySelectorAll(".data-interaction-buttons"),
        ).to.have.lengthOf(1);
      });

      it("adds fallback file sections without indexed metadata", async () => {
        const dataPackage = new DataPackage();
        const view = await renderTestView({
          dataPackage,
          indexDocuments: [],
        });
        expect(view.el.querySelector("#metadata-index-details")).to.equal(null);

        dataPackage.members.add({
          pid: "data.1",
          fileName: "data.csv",
          formatType: "DATA",
        });
        expect(() =>
          view.enhanceWithPackage({ editModeOn: false }),
        ).to.not.throw();

        expect(
          view.el.querySelectorAll("#Metadata .entitydetails"),
        ).to.have.lengthOf(1);
      });

      it("does not duplicate fallback file sections", async () => {
        const dataPackage = new DataPackage({
          members: [
            {
              pid: "data.1",
              fileName: "data.csv",
              formatType: "DATA",
            },
          ],
        });
        const view = await renderTestView({ dataPackage });
        expect(view.el.querySelectorAll(".entitydetails")).to.have.lengthOf(1);

        view.enhanceWithPackage({ editModeOn: false });

        expect(view.el.querySelectorAll(".entitydetails")).to.have.lengthOf(1);
      });

      it("keeps fallback sections distinct when file names match", async () => {
        const dataPackage = new DataPackage({
          members: [
            {
              pid: "data.1",
              fileName: "shared.csv",
              formatType: "DATA",
            },
          ],
        });
        const view = await renderTestView({ dataPackage });

        dataPackage.members.add({
          pid: "data.2",
          fileName: "shared.csv",
          formatType: "DATA",
        });
        view.enhanceWithPackage({ editModeOn: false });

        const sections = [...view.el.querySelectorAll(".entitydetails")];
        const secondContainer = view.findEntityDetailsContainer({
          pid: "data.2",
          fileName: "shared.csv",
        });
        expect(secondContainer[0]).to.equal(sections[1]);
        expect(sections.map((section) => section.dataset.id)).to.deep.equal([
          "data.1",
          "data.2",
        ]);
        sections.forEach((section) => {
          expect(
            section.querySelectorAll(".data-interaction-buttons"),
          ).to.have.lengthOf(1);
        });
      });

      it("does not add fallback sections to View Service documents", async () => {
        const dataPackage = new DataPackage({
          members: [
            {
              pid: "data.1",
              fileName: "data.csv",
              formatType: "DATA",
            },
          ],
        });
        const view = await renderTestView({
          dataPackage,
          viewServiceHtml: '<article id="Metadata">Dataset</article>',
        });
        view.enhanceWithPackage({ editModeOn: false });

        expect(view.el.querySelectorAll(".entitydetails")).to.have.lengthOf(0);
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

      it("coalesces synchronous provenance change redraws", async () => {
        const dataPackage = new Backbone.Model();
        dataPackage.events = { ...Backbone.Events };
        dataPackage.addViewServiceEntities = sinon.stub();
        dataPackage.getResourceMapModel = () => ({});
        const el = document.createElement("div");
        el.innerHTML = '<div class="metadata-view__metadata"></div>';
        const view = new MetadataDocumentView({
          el,
          dataPackage,
        });
        view.metadataContainer = el.querySelector(".metadata-view__metadata");
        view.metadataViewDoc = {};
        sinon.stub(view, "insertDataDetails");
        sinon.stub(view, "checkForProv");
        const redraw = sinon.stub(view, "redrawProvCharts");
        view.enhanceWithPackage({ editModeOn: false });

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

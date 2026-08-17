define(["models/viewService/ViewServiceDoc"], (ViewServiceDoc) => {
  const expect = chai.expect;
  chai.should();

  const RENDERED_HTML = `
    <div id="Metadata">
      <div class="entitydetails">
        <span class="entityName" data-entity-name="Measurements"></span>
        <span data-object-name="measurements.csv"></span>
        <a
          href="https://example.org/object/doi:10.5063%2Fdata.1"
          data-pid="doi:10.5063/data.1"
        >Download</a>
        <table class="attributeListTable">
          <tbody>
            <tr><td>temperature</td></tr>
          </tbody>
        </table>
      </div>
      <div>
        <h4>Taxonomic Range</h4>
      </div>
      <a>ecogrid://knb/doi:10.5063/data.2</a>
    </div>
  `;

  describe("ViewServiceDoc", () => {
    describe("parse", () => {
      it("marks empty and transform-error responses", () => {
        const empty = ViewServiceDoc.fromHtml(" ");
        empty.status.should.equal(ViewServiceDoc.STATUS.EMPTY);
        empty.isEmpty().should.equal(true);

        const error = ViewServiceDoc.fromHtml("Error transforming document");
        error.status.should.equal(ViewServiceDoc.STATUS.TRANSFORM_ERROR);
        error.hasTransformError().should.equal(true);
      });

      it("marks unstyled HTML when the metadata root is missing", () => {
        const doc = ViewServiceDoc.fromHtml(
          "<div>Rendered without wrapper</div>",
        );

        doc.status.should.equal(ViewServiceDoc.STATUS.UNSTYLED);
        doc.isUnstyled().should.equal(true);
        doc.hasMetadataRoot.should.equal(false);
      });

      it("normalizes rendered metadata markup and collects entity summaries", () => {
        const doc = ViewServiceDoc.fromHtml(RENDERED_HTML, {
          pid: " metadata.1 ",
          url: "https://example.org/views/metacatui/metadata.1",
          contentType: " text/html ",
          resolveBaseUrl: "https://example.org/resolve/",
        });
        const root = doc.template.content;
        const section = root.querySelector(".entitydetails");
        const row = root.querySelector(".attributeListTable tr");
        const taxonomicHeading = root.querySelector("h4");
        const rewritten = Array.from(root.querySelectorAll("a")).find(
          (link) => link.textContent === "doi:10.5063/data.2",
        );

        doc.pid.should.equal("metadata.1");
        doc.url.should.equal("https://example.org/views/metacatui/metadata.1");
        doc.contentType.should.equal("text/html");
        doc.status.should.equal(ViewServiceDoc.STATUS.OK);
        doc.hasMetadataRoot.should.equal(true);
        doc.entityPids.should.deep.equal(["doi:10.5063/data.1"]);
        doc.entities.should.have.length(1);
        doc.entities[0].should.include({
          pid: "doi:10.5063/data.1",
          entityName: "Measurements",
          objectName: "measurements.csv",
          fileName: "measurements.csv",
          objectUrl: "https://example.org/object/doi:10.5063%2Fdata.1",
        });
        section.getAttribute("data-id").should.equal("doi:10.5063/data.1");
        section.getAttribute("data-filename").should.equal("measurements.csv");
        section.getAttribute("data-entity-name").should.equal("Measurements");
        row.classList.contains("active").should.equal(true);
        taxonomicHeading.parentElement.classList
          .contains("taxonomicCoverage")
          .should.equal(true);
        rewritten
          .getAttribute("href")
          .should.equal("https://example.org/resolve/doi:10.5063%2Fdata.2");
        doc.mutations
          .map((mutation) => mutation.type)
          .should.include.members([
            "markLegacyTaxonomicCoverage",
            "rewriteEcoGridLinks",
            "markAttributeTableDefaults",
            "annotateEntitySections",
          ]);
      });
    });

    describe("entity lookup helpers", () => {
      it("finds and annotates a legacy distribution-link section", () => {
        const doc = new ViewServiceDoc({ pid: "metadata.1" });
        const template = document.createElement("template");
        template.innerHTML = `
          <form>
            <div>
              <div class="control-label">Object Name</div>
              <div class="controls-well">measurements.csv</div>
              <div class="control-label">Online Distribution Info</div>
              <div class="controls-well">
                <a href="https://example.org/resolve/doi:10.5063%2Fdata.1">
                  data object
                </a>
              </div>
            </div>
          </form>
        `;

        const section = doc.findAndAnnotateEntitySection({
          pid: "doi:10.5063/data.1",
          root: template.content,
        });

        expect(section).to.not.equal(null);
        section.classList.contains("entitydetails").should.equal(true);
        section.getAttribute("data-id").should.equal("doi:10.5063/data.1");
        section.textContent.should.contain("measurements.csv");
        section.querySelectorAll(".controls-well").length.should.equal(2);
        expect(
          section.querySelector(
            'a[href="https://example.org/resolve/doi:10.5063%2Fdata.1"]',
          ),
        ).to.not.equal(null);
      });

      it("matches object and resolve href PIDs exactly", () => {
        expect(
          ViewServiceDoc.hrefMatchesPid(
            "https://example.org/resolve/data.10",
            "data.1",
          ),
        ).to.equal(false);
        expect(
          ViewServiceDoc.hrefMatchesPid(
            "https://example.org/resolve/doi:10.5063%2Fdata.1?view=html#data",
            "doi:10.5063/data.1",
          ),
        ).to.equal(true);
      });

      it("does not annotate a distribution-link section for a PID prefix match", () => {
        const doc = new ViewServiceDoc({ pid: "metadata.1" });
        const template = document.createElement("template");
        template.innerHTML = `
          <form>
            <div>
              <div class="control-label">Online Distribution Info</div>
              <div class="controls-well">
                <a href="https://example.org/resolve/data.10">data object</a>
              </div>
            </div>
          </form>
        `;

        const section = doc.findAndAnnotateEntitySection({
          pid: "data.1",
          root: template.content,
        });

        expect(section).to.equal(null);
        expect(template.content.querySelector(".entitydetails")).to.equal(null);
      });

      it("builds selectors from normalized PID and file-name criteria", () => {
        const selector = ViewServiceDoc.getSelector({
          pid: "urn-uuid-test.1",
          fileName: "data.csv",
        });

        selector.should.equal(
          '.entitydetails[data-id="urn:uuid:test.1"], .entitydetails[data-filename="data.csv"], .entitydetails[data-object-name="data.csv"]',
        );
      });
    });
  });
});

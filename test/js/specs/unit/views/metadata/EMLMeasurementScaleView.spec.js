define([
  "jquery",
  "collections/Units",
  "models/dataPackage/DataPackage",
  "models/metadata/eml211/EML211",
  "models/metadata/eml211/EMLMeasurementScale",
  "views/metadata/EMLAttributeView",
], ($, Units, DataPackage, EML211, EMLMeasurementScale, EMLAttributeView) => {
  const expect = chai.expect;

  describe("EMLMeasurementScaleView numeric scales", () => {
    let view;
    let attributeView;
    let originalMetacatUI;
    let dataPackage;

    const TestEML = EML211.extend({
      units: new Units([
        { _name: "celsius", description: "Degrees Celsius" },
        { _name: "meter", description: "Length in metres" },
      ]),
    });

    function renderScale(
      scale,
      unitXML = "<standardUnit>celsius</standardUnit>",
    ) {
      const eml = new TestEML();
      eml.set(
        eml.parse(
          `<eml:eml xmlns:eml="eml://ecoinformatics.org/eml-2.1.1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" packageId="metadata_1" system="test">
          <dataset><title>Test</title><dataTable id="table"><entityName>data.csv</entityName>
            <attributeList><attribute id="attr"><attributeName>temperature</attributeName>
              <attributeDefinition>Air temperature</attributeDefinition>
              ${
                scale
                  ? `<measurementScale><${scale}>
                <unit>${unitXML}</unit><precision>0.1</precision>
                <numericDomain><numberType>real</numberType>
                  <bounds><minimum exclusive="true">-40</minimum><maximum exclusive="false">40</maximum></bounds>
                </numericDomain>
              </${scale}></measurementScale>`
                  : ""
              }
            </attribute></attributeList>
          </dataTable></dataset>
        </eml:eml>`,
        ),
      );
      const attribute = eml
        .get("entities")
        .first()
        .get("attributeList")
        .get("emlAttributes")
        .first();
      attributeView = new EMLAttributeView({ model: attribute });
      attributeView.render();
      $(document.body).append(attributeView.el);
      view = attributeView.measurementScaleView;
      const initialRevision = dataPackage.draftRevision;
      view.postRender();
      return { attribute, eml, initialRevision };
    }

    beforeEach(() => {
      originalMetacatUI = globalThis.MetacatUI;
      dataPackage = new DataPackage();
      globalThis.MetacatUI = {
        ...originalMetacatUI,
        rootDataPackage: dataPackage,
      };
    });

    afterEach(() => {
      view?.remove();
      attributeView?.remove();
      globalThis.MetacatUI = originalMetacatUI;
    });

    for (const scale of ["ratio", "interval"]) {
      it(`shows a saved ${scale} choice without marking the package edited`, () => {
        const { attribute, initialRevision } = renderScale(scale);

        expect(view.$(".category:checked").val()).to.equal("ratio");
        expect(view.$(".numeric-scale:checked").val()).to.equal(scale);
        expect(view.$("select.units").val()).to.equal("celsius");
        expect(
          attribute.get("measurementScale").get("measurementScale"),
        ).to.equal(scale);
        expect(dataPackage.draftRevision).to.equal(initialRevision);
      });
    }

    for (const [from, to] of [
      ["ratio", "interval"],
      ["interval", "ratio"],
    ]) {
      it(`saves ${to} after changing a saved ${from} attribute`, () => {
        const { eml, initialRevision } = renderScale(from);

        view.$(`.numeric-scale[value="${to}"]`)[0].click();

        const xml = $.parseXML(eml.serialize());
        const numericScale = $(xml).find("measurementScale").children();
        expect(numericScale[0].localName).to.equal(to);
        expect(numericScale.find("standardUnit").text()).to.equal("celsius");
        expect(numericScale.find("precision").text()).to.equal("0.1");
        expect(numericScale.find("numberType").text()).to.equal("real");
        expect(numericScale.find("minimum").text()).to.equal("-40");
        expect(numericScale.find("minimum").attr("exclusive")).to.equal("true");
        expect(numericScale.find("maximum").text()).to.equal("40");
        expect(dataPackage.draftRevision).to.be.greaterThan(initialRevision);

        const reloadedScale = EMLMeasurementScale.getInstance(
          $(xml).find("measurementScale")[0].outerHTML,
        );
        expect(reloadedScale.get("measurementScale")).to.equal(to);
      });
    }

    it("preserves a custom unit when changing the numeric scale", () => {
      const { eml } = renderScale("ratio", "<customUnit>siteUnit</customUnit>");

      view.$(".numeric-scale[value='interval']")[0].click();

      const xml = $.parseXML(eml.serialize());
      expect($(xml).find("interval customUnit").text()).to.equal("siteUnit");
      expect(view.$("select.units").val()).to.equal("siteUnit");
    });

    it("restores the interval choice after leaving and returning to Numeric", () => {
      const { eml } = renderScale("interval");

      view.$(".category[value='datetime']")[0].click();
      view.$(".category[value='ratio']")[0].click();

      expect(view.$(".numeric-scale:checked").val()).to.equal("interval");
      expect(view.$("select.units").val()).to.equal("celsius");
      expect($(eml.serialize()).find("interval")).to.have.lengthOf(1);
    });

    it("labels the unit dropdown with its visible heading", () => {
      renderScale("ratio");

      const unit = view.$("select.units")[0];
      const label = document.getElementById(
        unit.getAttribute("aria-labelledby"),
      );
      expect(label).to.exist;
      expect(label.textContent.trim()).to.equal("Standard Unit");
    });

    it("shows the numeric radios below Standard Unit", () => {
      renderScale("ratio");

      const radios = view.$("input.numeric-scale[type='radio']");
      expect(radios).to.have.lengthOf(2);
      expect(view.$("select.numeric-scale")).to.have.lengthOf(0);
      const unit = view.$("select.units")[0];
      expect(
        unit.compareDocumentPosition(radios[0]) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).to.not.equal(0);
    });

    it("keeps radio selections independent between attribute editors", () => {
      renderScale("interval");
      const firstView = view;
      const firstAttributeView = attributeView;
      try {
        renderScale("interval");
        view.$(".numeric-scale[value='ratio']")[0].click();

        expect(firstView.$(".numeric-scale:checked").val()).to.equal(
          "interval",
        );
        expect(view.$(".numeric-scale:checked").val()).to.equal("ratio");
      } finally {
        firstView.remove();
        firstAttributeView.remove();
      }
    });

    it("lets a new numeric attribute save an interval scale and unit", () => {
      const { eml } = renderScale(null);

      view.$(".category[value='ratio']")[0].click();
      expect(view.$(".numeric-scale:checked").val()).to.equal("ratio");
      view.$("select.units").val("meter").trigger("change");
      view.$(".numeric-scale[value='interval']")[0].click();

      const xml = $.parseXML(eml.serialize());
      expect(
        $(xml).find("measurementScale interval standardUnit").text(),
      ).to.equal("meter");
      expect($(xml).find("numberType").text()).to.equal("real");
    });

    it("shows a missing unit error in the visible interval options", () => {
      renderScale("interval");
      view.model.set("unit", null);

      view.showValidation();

      expect(view.$(".options:visible .notification.error")).to.have.lengthOf(
        1,
      );
      expect(
        view.$(".options:visible select.units").hasClass("error"),
      ).to.equal(true);
    });
  });
});

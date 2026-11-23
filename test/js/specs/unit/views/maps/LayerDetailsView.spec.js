define([
  "views/maps/LayerDetailsView",
  "views/maps/LayerNavigationView",
  "views/maps/LayerOpacityView",
  "views/maps/VectorFilterView",
  "models/maps/assets/MapAsset",
  "collections/maps/VectorFilters",
], (
  LayerDetailsView,
  LayerNavigationView,
  LayerOpacityView,
  VectorFilterView,
  MapAsset,
  VectorFilters,
) => {
  const { expect } = chai;
  const CLASS_NAMES = {
    infoDescription: "layer-info__description",
    infoLinks: "layer-info__links",
  };
  const zoomButton = `.${LayerNavigationView.prototype.classes.extentButton}`;
  const opacityClasses = LayerOpacityView.prototype.classes;
  const opacitySlider = `.${opacityClasses.sliderContainer}`;
  const filterValues = `.${VectorFilterView.prototype.classes.valuesDropdownContainer}`;

  describe("LayerDetailsView Test Suite", () => {
    let view;

    function openPanel(asset) {
      view = new LayerDetailsView({ model: asset });
      document.body.append(view.el);
      view.render();
      view.open();
    }

    afterEach(() => {
      view.remove();
    });

    function expectControlsVisible(visible) {
      expect(view.$(zoomButton).is(":visible"), "Zoom to extent").to.equal(
        visible,
      );
      expect(view.$(opacitySlider).is(":visible"), "opacity slider").to.equal(
        visible,
      );
    }

    it("shows a hidden layer before zooming to its extent", () => {
      const zoomTo = sinon.stub();
      const asset = new MapAsset({ visible: false, mapModel: { zoomTo } });
      openPanel(asset);
      expect(asset.isVisible()).to.be.false;
      const shown = sinon.spy();
      asset.once("change:visible", shown);

      view.el.querySelector(zoomButton).click();

      expect(asset.isVisible()).to.be.true;
      expect(zoomTo.calledOnceWithExactly(asset)).to.be.true;
      expect(shown.calledBefore(zoomTo)).to.be.true;
    });

    for (const hasFilters of [false, true]) {
      it(`keeps metadata visible through an error and restores controls for a layer ${hasFilters ? "with" : "without"} filters`, () => {
        const description = "Monthly streamflow observations";
        const moreInfoLink = "https://example.org/dataset";
        const downloadLink = "https://example.org/streamflow.csv";
        const asset = new MapAsset({
          status: "ready",
          description,
          moreInfoLink,
          downloadLink,
          filters: hasFilters
            ? new VectorFilters([
                { property: "year", allValues: [2020, 2021], values: [2020] },
              ])
            : undefined,
        });
        openPanel(asset);

        function expectPanelState(controlsVisible) {
          expect(
            view.$(`.${CLASS_NAMES.infoDescription}:visible`).text(),
          ).to.equal(description);
          const links = view.$(`.${CLASS_NAMES.infoLinks} a:visible`).get();
          expect(links.map((link) => link.href)).to.have.members([
            moreInfoLink,
            downloadLink,
          ]);
          expectControlsVisible(controlsVisible);
          expect(view.$(filterValues).is(":visible"), "filter values").to.equal(
            hasFilters && controlsVisible,
          );
        }

        expectPanelState(true);

        asset.setError("Layer unavailable");
        expectPanelState(false);

        asset.setReady();
        expectPanelState(true);
      });
    }

    it("keeps the current layer's controls visible when the previous layer reports an error", () => {
      const rivers = new MapAsset({ label: "Rivers", status: "ready" });
      const lakes = new MapAsset({
        label: "Lakes",
        status: "ready",
        filters: new VectorFilters([{ property: "depth" }]),
      });
      openPanel(rivers);
      view.updateModel(lakes);
      expectControlsVisible(true);

      rivers.setError("Layer unavailable");

      expect(
        view.el.querySelector(`.${view.classes.label}`).textContent,
      ).to.equal("Lakes");
      expectControlsVisible(true);
      expect(view.$(filterValues).is(":visible")).to.be.true;
    });

    it("shows 0% opacity and keeps an initially transparent layer hidden when the panel opens", () => {
      const asset = new MapAsset({ opacity: 0, visible: true });
      expect(asset.get("visible")).to.be.false;
      openPanel(asset);

      expect(view.$(opacitySlider).slider("value")).to.equal(0);
      expect(
        view.el.querySelector(`.${opacityClasses.label}`).textContent,
      ).to.equal("0%");
      expect(asset.get("opacity")).to.equal(0);
      expect(asset.get("visible")).to.be.false;
    });
  });
});

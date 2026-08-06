define(["backbone", "views/MetricView"], (Backbone, MetricView) => {
  const { expect } = chai;

  describe("MetricView", () => {
    let originalMetacatUI;
    let view;

    beforeEach(() => {
      originalMetacatUI = globalThis.MetacatUI;
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        appModel: new Backbone.Model({
          displayDatasetMetricsTooltip: false,
        }),
        appView: {
          numberAbbreviator: (value) => String(value),
        },
      };
    });

    afterEach(() => {
      view?.onClose();
      view?.remove();
      view = null;
      globalThis.MetacatUI = originalMetacatUI;
    });

    it("renders results that synchronized before the view rendered", () => {
      const model = new Backbone.Model({
        synced: true,
        totalDownloads: 42,
      });
      view = new MetricView({
        metricName: "downloads",
        model,
        pid: "dataset.1",
      }).render();

      expect(view.$(".metric-value").text()).to.equal("42");
    });
  });
});

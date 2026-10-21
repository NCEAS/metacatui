define([
  "models/metadata/eml211/EMLGeoCoverage",
  "views/metadata/EMLGeoCoverageView",
], function (EMLGeoCoverage, EMLGeoCoverageView) {
  const expect = chai.expect;

  describe("EMLGeoCoverageView", function () {
    let view;

    beforeEach(function () {
      view = new EMLGeoCoverageView({
        model: new EMLGeoCoverage(),
        edit: true,
      }).render();
    });

    afterEach(function () {
      view.remove();
    });

    it("clears errors for an empty location", function () {
      view.$("textarea").val("Second site").trigger("change");
      expect(view.$(".notification").text()).to.include("coordinates");

      view.$("textarea").val("").trigger("change");
      view.showValidation();

      expect(view.$(".notification").text()).to.equal("");
      expect(view.$(".error").length).to.equal(0);
    });
  });
});

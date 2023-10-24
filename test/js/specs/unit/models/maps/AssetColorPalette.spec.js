define([
  "../../../../../../../../src/js/models/maps/AssetColorPalette"
], function (AssetColorPalette) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("AssetColorPalette Test Suite", function () {
    /* Set up */
    beforeEach(function () {
      this.colorPaletteCategorical = {
        "paletteType": "categorical",
        "property": "WWA",
        "label": "Test Categorical colorPalette",
        "colors": [
          { "value": "Test B", "color": "#e80000" },
          { "value": "Test A", "color": "#ffab00" },
        ]
      };
      this.colorPaletteContinuous = {
        "paletteType": "continuous",
        "property": "WWA",
        "label": "Test Continuous colorPalette",
        "colors": [
          { "value": 1, "label": "Test B", "color": "#e80000" },
          { "value": 0, "label": "Test A", "color": "#ffab00" },
        ]
      };
      this.opts = {sort: false}
      var categoricalColors = this.colorPaletteCategorical.get("colors")
      this.categoricalPalette = new AssetColorPalette(categoricalColors, opts)

      var continuousColors = this.colorPaletteContinuous.get("colors")
      this.continuousPalette = new AssetColorPalette(continuousColors)
    })

    /* Tear down */
    afterEach(function () {
      this.categoricalPalette = undefined;
      this.continuousPalette = undefined;
    })
    
    describe("The categorical AssetColorPalette model", function () {
      it("should create an AssetColorPalette model",
        function () {
          this.categoricalPalette.should.be.instanceof(AssetColorPalette)
      });
    });

    describe("The continuous AssetColorPalette model", function () {
      it("should create an AssetColorPalette model",
        function () {
          this.continuousPalette.should.be.instanceof(AssetColorPalette)
      });
    });

  });
});
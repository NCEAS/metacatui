define([
  "../../../../../../../../src/js/models/metadata/eml211/EMLNumericDomain",
], function (EMLNumericDomain) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("EMLNumericDomain Test Suite", function () {
    var emlNumericDomain = new EMLNumericDomain();
    var intervalDomainXML; // mock response from the server
    var ratioDomainXML; // mock response from the server
    var intervalDomainAttrs; // object returned by EMLNumericDomain.parse()
    var ratioDomainAttrs; // object returned by EMLNumericDomain.parse()
    /* Setup */
    before(function () {
      // Parse a nominal textDomain fragment
      intervalDomainXML = NumericDomainUtil.getTestIntervalNumericDomainXML();
      intervalDomainAttrs = emlNumericDomain.parse({
        objectXML: intervalDomainXML,
      });

      // Parse an ordinal enumeratedDomain fragment
      ratioDomainXML = NumericDomainUtil.getTestRatioNumericDomainXML();
      ratioDomainAttrs = emlNumericDomain.parse({ objectXML: ratioDomainXML });
    });

    /* Tear down */
    after(function () {
      intervalDomainXML = undefined;
      intervalDomainAttrs = undefined;
      ratioDomainXML = undefined;
      ratioDomainAttrs = undefined;
    });

    describe("The EMLNumericDomain object", function () {
      it("should exist", function () {
        expect(emlNumericDomain).to.exist;
        emlNumericDomain.should.exist;
      });
    });

    describe(".updateDOM() after changing the scale", function () {
      for (const scale of ["ratio", "interval"]) {
        it(`preserves a parsed bare ${scale} element`, function () {
          const model = new EMLNumericDomain(
            {
              objectXML: scale === "ratio" ? ratioDomainXML : intervalDomainXML,
            },
            { parse: true },
          );

          expect(model.updateDOM().localName).to.equal(scale);
        });
      }

      it("keeps the allowed value ranges unchanged when empty bounds are skipped", function () {
        const model = new EMLNumericDomain(
          {
            objectXML: `<measurementScale><ratio><unit><standardUnit>meter</standardUnit></unit>
            <numericDomain><numberType>real</numberType>
              <bounds></bounds>
              <bounds><minimum exclusive="true">0</minimum><maximum exclusive="false">100</maximum></bounds>
              <bounds><minimum exclusive="false">200</minimum></bounds>
              <bounds></bounds>
              <bounds><maximum exclusive="true">300</maximum></bounds>
            </numericDomain></ratio></measurementScale>`,
          },
          { parse: true },
        );
        model.set("measurementScale", "interval");

        const bounds = Array.from(model.updateDOM().querySelectorAll("bounds"));
        expect(bounds.map((bound) => bound.outerHTML)).to.deep.equal([
          '<bounds><minimum exclusive="true">0</minimum><maximum exclusive="false">100</maximum></bounds>',
          '<bounds><minimum exclusive="false">200</minimum></bounds>',
          '<bounds><maximum exclusive="true">300</maximum></bounds>',
        ]);
      });

      for (const [from, to] of [
        ["ratio", "interval"],
        ["interval", "ratio"],
      ]) {
        it(`serializes a parsed ${from} domain as ${to}`, function () {
          const model = new EMLNumericDomain(
            {
              objectXML: `<measurementScale><${from}><unit><standardUnit>celsius</standardUnit></unit><precision>0.1</precision><numericDomain><numberType>real</numberType><bounds><minimum exclusive="true">-40</minimum></bounds></numericDomain></${from}></measurementScale>`,
            },
            { parse: true },
          );
          model.set("measurementScale", to);

          const xml = model.updateDOM();

          expect(xml.localName).to.equal(to);
          expect(xml.querySelector("standardUnit").textContent).to.equal(
            "celsius",
          );
          expect(xml.querySelector("precision").textContent).to.equal("0.1");
          expect(
            xml.querySelector("minimum").getAttribute("exclusive"),
          ).to.equal("true");
        });
      }
    });

    describe("For an interval scale, .parse()", function () {
      it("should return an attributes object", function () {
        intervalDomainAttrs.should.be.an("object");
      });

      it("should return a unit object", function () {
        intervalDomainAttrs.unit.should.be.an("object");
        intervalDomainAttrs.unit.standardUnit.should.be.a("string");
        intervalDomainAttrs.unit.standardUnit.should.equal("meter");
      });

      it("should return a precision string", function () {
        intervalDomainAttrs.precision.should.be.a("string");
        intervalDomainAttrs.precision.should.equal("1");
      });

      it("should return a numericDomain object", function () {
        intervalDomainAttrs.numericDomain.should.be.an("object");
        intervalDomainAttrs.numericDomain.numberType.should.be.a("string");
        intervalDomainAttrs.numericDomain.numberType.should.equal("real");
        intervalDomainAttrs.numericDomain.bounds.should.be.an("array");
        intervalDomainAttrs.numericDomain.bounds.length.should.equal(2);
        intervalDomainAttrs.numericDomain.bounds[0].minimum.should.equal("0");
        intervalDomainAttrs.numericDomain.bounds[0].maximum.should.equal("100");
        intervalDomainAttrs.numericDomain.bounds[1].minimum.should.equal("200");
        expect(intervalDomainAttrs.numericDomain.bounds[1].maximum).to.not
          .exist;
      });
    });

    describe("For a ratio scale, .parse()", function () {
      it("should return an attributes object", function () {
        ratioDomainAttrs.should.be.an("object");
      });

      it("should return a unit object", function () {
        ratioDomainAttrs.unit.should.be.an("object");
        ratioDomainAttrs.unit.standardUnit.should.be.a("string");
        ratioDomainAttrs.unit.standardUnit.should.equal("celsius");
      });

      it("should return a numericDomain object", function () {
        ratioDomainAttrs.numericDomain.should.be.an("object");
        ratioDomainAttrs.numericDomain.numberType.should.be.a("string");
        ratioDomainAttrs.numericDomain.numberType.should.equal("float");
        ratioDomainAttrs.numericDomain.bounds.should.be.an("array");
        ratioDomainAttrs.numericDomain.bounds.length.should.equal(2);
        ratioDomainAttrs.numericDomain.bounds[0].minimum.should.equal("-40.0");
        ratioDomainAttrs.numericDomain.bounds[0].maximum.should.equal("0.0");
        ratioDomainAttrs.numericDomain.bounds[1].maximum.should.equal("40.0");
        expect(ratioDomainAttrs.numericDomain.bounds[1].minimum).to.not.exist;
      });
    });
  });

  var NumericDomainUtil = {
    /* Returns a nominal non-numeric text domain fragment */
    getTestIntervalNumericDomainXML: function () {
      var xml = [];
      xml.push(
        "<interval>\n",
        "\t<unit>\n",
        "\t\t<standardUnit>meter</standardUnit>\n",
        "\t</unit>\n",
        "\t<precision>1</precision>\n",
        "\t<numericDomain>\n",
        "\t\t<numberType>real</numberType>\n",
        "\t\t<bounds>\n",
        "\t\t\t<minimum>0</minimum>\n",
        "\t\t\t<maximum>100</maximum>\n",
        "\t\t</bounds>\n",
        "\t\t<bounds>\n",
        "\t\t\t<minimum>200</minimum>\n",
        "\t\t</bounds>\n",
        "\t</numericDomain>\n",
        "</interval>\n",
      );

      return xml.join("");
    },

    /* Returns an ordinal non-numeric enumerated domain fragment */
    getTestRatioNumericDomainXML: function () {
      var xml = [];
      xml.push(
        "<ratio>\n",
        "\t<unit>\n",
        "\t\t<standardUnit>celsius</standardUnit>\n",
        "\t</unit>\n",
        "\t<numericDomain>\n",
        "\t\t<numberType>float</numberType>\n",
        "\t\t<bounds>\n",
        "\t\t\t<minimum>-40.0</minimum>\n",
        "\t\t\t<maximum>0.0</maximum>\n",
        "\t\t</bounds>\n",
        "\t\t<bounds>\n",
        "\t\t\t<maximum>40.0</maximum>\n",
        "\t\t</bounds>\n",
        "\t</numericDomain>\n",
        "</ratio>\n",
      );

      return xml.join("");
    },
  };
});

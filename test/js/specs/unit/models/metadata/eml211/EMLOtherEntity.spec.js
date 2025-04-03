define([
  "models/metadata/eml211/EMLOtherEntity",
  "collections/metadata/eml/EMLAttributes",
  "models/metadata/eml211/EMLAttribute",
], function (EMLOtherEntity, EMLAttributes, EMLAttribute) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("EMLOtherEntity Test Suite", function () {
    var otherEntityXML;
    var emlOtherEntity;

    /* Setup */
    before(function () {
      // If needed
      emlOtherEntity = new EMLOtherEntity(
        {
          objectDOM: $(OtherEntityUtil.getTestOtherEntityXML())[0],
        },
        { parse: true },
      );
    });

    /* Tear down */
    after(function () {
      // If needed
    });

    describe("The EMLOtherEntity object", function () {
      it("should exist", function () {
        expect(emlOtherEntity).to.exist;
        emlOtherEntity.should.exist;
      });

      it("should have a type attribute of otherEntity", function () {
        emlOtherEntity.get("type").should.equal("otherEntity");
      });
    });

    describe(".parse()", function () {
      it("should return an attribute object", function () {
        emlOtherEntity.attributes.should.be.an("object");
      });

      it("should return an xml id attribute", function () {
        emlOtherEntity.get("xmlID").should.be.a("string");
        emlOtherEntity.get("xmlID").should.equal("entity.1.1");
      });

      it("should return an alternate identifier array", function () {
        emlOtherEntity.get("alternateIdentifier").should.be.an("array");
        emlOtherEntity
          .get("alternateIdentifier")[0]
          .should.equal("altid.1.1.png");
        emlOtherEntity
          .get("alternateIdentifier")[1]
          .should.equal("altid2.1.1.png");
      });

      it("should return an entity name", function () {
        emlOtherEntity.get("entityName").should.be.a("string");
        emlOtherEntity.get("entityName").should.equal("temps.1.1.png");
      });

      it("should return an entity description", function () {
        emlOtherEntity.get("entityDescription").should.be.a("string");
        emlOtherEntity
          .get("entityDescription")
          .should.equal("Temperatures at sites");
      });

      it("should return an attribute list", function () {
        emlOtherEntity
          .get("attributeList")
          .should.be.an.instanceof(EMLAttributes);
        emlOtherEntity.get("attributeList").length.should.equal(2);
        emlOtherEntity
          .get("attributeList")
          .at(0)
          .should.be.an.instanceof(EMLAttribute);
        emlOtherEntity
          .get("attributeList")
          .at(1)
          .should.be.an.instanceof(EMLAttribute);
      });

      it("should return a nominal non-numeric site attribute", function () {
        var site = emlOtherEntity.get("attributeList").at(0);
        site.get("xmlID").should.equal("attr.1.1");
        site.get("attributeName").should.equal("site");
        site.get("attributeLabel")[0].should.equal("Site Code");
        site
          .get("attributeDefinition")
          .should.equal("The code given for each collection site");
        site.get("storageType")[0].should.equal("string");
        var mScale = site.get("measurementScale");
        mScale.should.be.an("object");
        mScale.get("measurementScale").should.equal("nominal");
        var domain = mScale.get("nonNumericDomain");
        domain.should.be.an("array");
        domain[0].should.be.an("object");
        domain[0].textDomain.should.be.an("object");
        domain[0].textDomain.definition.should.equal("Any text");
        domain[0].textDomain.pattern.should.be.an("array");
        domain[0].textDomain.pattern[0].should.equal("*");
        domain[0].textDomain.source.should.equal("Any source");
        var temp = emlOtherEntity.get("attributeList").at(1);
        temp.get("xmlID").should.equal("attr.2.1");
        temp.get("attributeName").should.equal("temp");
        temp.get("attributeLabel")[0].should.equal("Temperature");
        temp
          .get("attributeDefinition")
          .should.equal("Air temperature at the site");
        temp.get("storageType")[0].should.equal("float");
        mScale = temp.get("measurementScale");
        mScale.should.be.an("object");
        mScale.get("measurementScale").should.equal("ratio");
        mScale.get("unit").should.be.an("object");
        mScale.get("unit").standardUnit.should.equal("celsius");
        expect(mScale.get("precision")).to.be.null;
        mScale.get("numericDomain").should.be.an("object");
        mScale.get("numericDomain").numberType.should.equal("float");
        mScale.get("numericDomain").bounds.should.be.an("array");
        mScale.get("numericDomain").bounds[0].should.be.an("object");
        mScale.get("numericDomain").bounds[0].minimum.should.equal("-40.0");
        mScale.get("numericDomain").bounds[0].maximum.should.equal("40.0");
      });

      it("should return an entity type", function () {
        emlOtherEntity.get("entityType").should.be.a("string");
        emlOtherEntity
          .get("entityType")
          .should.equal("Portable Network graphic image");
      });
    });
  });

  var OtherEntityUtil = {
    getTestOtherEntityXML: function () {
      var xml = [];
      xml.push(
        '<otherEntity id="entity.1.1">\n',
        "\t<alternateIdentifier>altid.1.1.png</alternateIdentifier>\n",
        "\t<alternateIdentifier>altid2.1.1.png</alternateIdentifier>\n",
        "\t<entityName>temps.1.1.png</entityName>\n",
        "\t<entityDescription>Temperatures at sites</entityDescription>\n",
        "\t<attributeList>\n",
        '\t\t<attribute id="attr.1.1">\n',
        "\t\t\t<attributeName>site</attributeName>\n",
        "\t\t\t<attributeLabel>Site Code</attributeLabel>\n",
        "\t\t\t<attributeDefinition>The code given for each collection site</attributeDefinition>\n",
        "\t\t\t<storageType>string</storageType>\n",
        "\t\t\t<measurementScale>\n",
        "\t\t\t\t<nominal>\n",
        "\t\t\t\t\t<nonNumericDomain>\n",
        "\t\t\t\t\t\t<textDomain>\n",
        "\t\t\t\t\t\t\t<definition>Any text</definition>\n",
        "\t\t\t\t\t\t\t<pattern>*</pattern>\n",
        "\t\t\t\t\t\t\t<sourced>Any source</sourced>\n",
        "\t\t\t\t\t\t</textDomain>\n",
        "\t\t\t\t\t</nonNumericDomain>\n",
        "\t\t\t\t</nominal>\n",
        "\t\t\t</measurementScale>\n",
        "\t\t</attribute>\n",
        '\t\t<attribute id="attr.2.1">\n',
        "\t\t\t<attributeName>temp</attributeName>\n",
        "\t\t\t<attributeLabel>Temperature</attributeLabel>\n",
        "\t\t\t<attributeDefinition>Air temperature at the site</attributeDefinition>\n",
        "\t\t\t<storageType>float</storageType>\n",
        "\t\t\t<measurementScale>\n",
        "\t\t\t\t<ratio>\n",
        "\t\t\t\t\t<unit>\n",
        "\t\t\t\t\t\t<standardUnit>celsius</standardUnit>\n",
        "\t\t\t\t\t</unit>\n",
        "\t\t\t\t\t<numericDomain>\n",
        "\t\t\t\t\t\t<numberType>float</numberType>\n",
        "\t\t\t\t\t\t<bounds>\n",
        "\t\t\t\t\t\t\t<minimum>-40.0</minimum>\n",
        "\t\t\t\t\t\t\t<maximum>40.0</maximum>\n",
        "\t\t\t\t\t\t</bounds>\n",
        "\t\t\t\t\t</numericDomain>\n",
        "\t\t\t\t</ratio>\n",
        "\t\t\t</measurementScale>\n",
        "\t\t</attribute>\n",
        "\t</attributeList>\n",
        "\t<entityType>Portable Network graphic image</entityType>\n",
        "</otherEntity>",
      );

      return xml.join("");
    },
  };
});

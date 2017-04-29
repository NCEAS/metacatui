"use strict";

define(["chai", "chai-jquery", "chai-backbone",
"../../../../../../src/main/webapp/js/models/metadata/eml211/EMLAttribute"],
    function(chai, chaiJquery, chaiBackbone, EMLAttribute) {

        // Configure the Chai assertion library
        var should =  chai.should();
        var expect = chai.expect;

        // Pull in Jquery and Backbone-specific assertion libraries
        chai.use(chaiJquery); // exported from chai-jquery.js
        chai.use(chaiBackbone); // exported from chai-backbone.js

        describe("EMLAttribute Test Suite", function (){
            var emlAttribute = new EMLAttribute();
            var responseXML; // mock response from the server
            var attributes; // object returned by EMLAttribute.parse()

            /* Setup */
            before(function() {
                // If needed
                responseXML = AttributeUtil.getTestNominalAttributeXML();
                attributes = emlAttribute.parse(responseXML);

            });

            /* Tear down */
            after(function() {
                // If needed
            });

            describe("The EMLAttribute object", function() {
                it('should exist', function() {
                    expect(emlAttribute).to.exist;
                    emlAttribute.should.exist;
                });
            });

            describe(".parse()", function() {
                it("should return an attributes object", function() {
                    attributes.should.be.an("object");

                });

                it("should return an xml id attribute", function() {
                    attributes.xmlID.should.be.a("string");
                    attributes.xmlID.should.equal("12345");

                });

                it("should return an attribute name", function() {
                    attributes.attributeName.should.be.a("string");
                    attributes.attributeName.should.equal("site");
                });

                it("should return an attribute label array", function() {
                    attributes.attributeLabel.should.be.an("array");
                    attributes.attributeLabel[0].should.equal("Site Code");
                    attributes.attributeLabel[1].should.equal("Site Name");
                });

                it("should return an attribute definition", function() {
                    attributes.attributeDefinition.should.be.a("string");
                    attributes.attributeDefinition.should.equal("The code given for each collection site");
                });

                it("should return storage type and type system arrays", function() {
                    attributes.storageType.should.be.an("array");
                    attributes.storageType[0].should.equal("string");
                    attributes.storageType[1].should.equal("special_string");
                    attributes.typeSystem.should.be.an("array");
                    expect(attributes.typeSystem[0]).to.be.null;
                    attributes.typeSystem[1].should.equal("http://schema.org/customTypes");
                    attributes.typeSystem.length.should.equal(attributes.storageType.length);
                });

            });

            describe("For an attribute with nominal measurement scale, .parse()", function() {

                it("should return a measurementscale object", function() {
                    attributes.measurementScale.should.be.an("object");
                });
            });
        });

        var AttributeUtil = {
            /* Returns an attribute of nominal measurement scale */
            getTestNominalAttributeXML: function() {
                var xml = [];
                xml.push(
                    "<attribute id=\"12345\">\n",
                    "\t<attributeName>site</attributeName>\n",
                    "\t<attributeLabel>Site Code</attributeLabel>\n",
                    "\t<attributeLabel>Site Name</attributeLabel>\n",
                    "\t<attributeDefinition>The code given for each collection site</attributeDefinition>\n",
                    "\t<storageType>string</storageType>\n",
                    "\t<storageType typeSystem=\"http://schema.org/customTypes\">special_string</storageType>\n",
                    "\t<measurementScale>\n",
                    "\t\t<nominal>\n",
                    "\t\t\t<nonNumericDomain>\n",
                    "\t\t\t\t<textDomain>\n",
                    "\t\t\t\t\t<definition>Any text</definition>\n",
                    "\t\t\t\t\t<pattern>*</pattern>\n",
                    "\t\t\t\t\t<source>Any source</source>\n",
                    "\t\t\t\t</textDomain>\n",
                    "\t\t\t</nonNumericDomain>\n",
                    "\t\t</nominal>\n",
                    "\t</measurementScale>\n",
                    "</attribute>");

                return xml.join('');
            }
        }
    });

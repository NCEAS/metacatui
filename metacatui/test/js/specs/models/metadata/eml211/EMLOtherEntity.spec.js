"use strict";

define(["chai", "chai-jquery", "chai-backbone",
    "../../../../../../src/main/webapp/js/models/metadata/eml211/EMLOtherEntity"],
    function(chai, chaiJquery, chaiBackbone, EMLOtherEntity) {

        // Configure the Chai assertion library
        var should =  chai.should();
        var expect = chai.expect;

        // Pull in Jquery and Backbone-specific assertion libraries
        chai.use(chaiJquery); // exported from chai-jquery.js
        chai.use(chaiBackbone); // exported from chai-backbone.js

        describe("EMLOtherEntity Test Suite", function (){
            var otherEntityXML;
            var emlOtherEntity;

            /* Setup */
            before(function() {
                // If needed
                emlOtherEntity = new EMLOtherEntity({
                    objectXML: OtherEntityUtil.getTestOtherEntityXML()
                }, {parse: true});
            });

            /* Tear down */
            after(function() {
                // If needed
            });

            describe("The EMLOtherEntity object", function() {
                it('should exist', function() {
                    expect(emlOtherEntity).to.exist;
                    emlOtherEntity.should.exist;
                });

                it('should have a type attribute of otherEntity', function() {
                    emlOtherEntity.get("type").should.equal("otherEntity");
                });
            });

            describe(".parse()", function() {
                it("should return an attribute object", function() {
                    emlOtherEntity.attributes.should.be.an("object");

                });

                it("should return an xml id attribute", function() {
                    emlOtherEntity.get("xmlID").should.be.a("string");
                    emlOtherEntity.get("xmlID").should.equal("12345");

                });

                it("should return an alternate identifier array", function() {
                    emlOtherEntity.get("alternateIdentifier").should.be.an("array");
                    emlOtherEntity.get("alternateIdentifier")[0].should.equal("altid.1.1.png");
                    emlOtherEntity.get("alternateIdentifier")[1].should.equal("altid2.1.1.png");
                });

                it("should return an entity name", function() {
                    emlOtherEntity.get("entityName").should.be.a("string");
                    emlOtherEntity.get("entityName").should.equal("entity.1.1.png");
                });

                it("should return an entity description", function() {
                    emlOtherEntity.get("entityDescription").should.be.a("string");
                    emlOtherEntity.get("entityDescription").should.equal("A description of entity.1.1.png");
                });

                it("should return an entity type", function() {
                    emlOtherEntity.get("entityType").should.be.a("string");
                    emlOtherEntity.get("entityType").should.equal("Portable Network graphic image");
                });
            });
        });

        var OtherEntityUtil = {
            getTestOtherEntityXML: function() {
                var xml = [];
                xml.push(
                    "<otherEntity id=\"12345\">\n",
                    "\t<alternateIdentifier>altid.1.1.png</alternateIdentifier>\n",
                    "\t<alternateIdentifier>altid2.1.1.png</alternateIdentifier>\n",
                    "\t<entityName>entity.1.1.png</entityName>\n",
                    "\t<entityDescription>A description of entity.1.1.png</entityDescription>\n",
                    "\t<entityType>Portable Network graphic image</entityType>\n",
                    "</otherEntity>");

                return xml.join("");
            }
        }
    });

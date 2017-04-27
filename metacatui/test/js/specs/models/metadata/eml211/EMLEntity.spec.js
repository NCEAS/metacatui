"use strict";

define(["chai", "chai-jquery", "chai-backbone",
    "../../../../../../src/main/webapp/js/models/metadata/eml211/EMLEntity"],
    function(chai, chaiJquery, chaiBackbone, EMLEntity) {

        // Configure the Chai assertion library
        var should =  chai.should();
        var expect = chai.expect;

        // Pull in Jquery and Backbone-specific assertion libraries
        chai.use(chaiJquery); // exported from chai-jquery.js
        chai.use(chaiBackbone); // exported from chai-backbone.js

        describe("EMLEntity Test Suite", function (){
            var emlEntity = new EMLEntity();
            var responseXML; // mock response from the server
            var attributes; // object returned by EMLEntity.parse()

            /* Setup */
            before(function() {
                // If needed
                responseXML = EntityUtil.getTestEntityXML();
                attributes = emlEntity.parse(responseXML);

            });

            /* Tear down */
            after(function() {
                // If needed
            });

            describe("The EMLEntity object", function() {
                it('should exist', function() {
                    expect(emlEntity).to.exist;
                    emlEntity.should.exist;
                });
            });

            describe(".parse()", function() {
                it("should return an attribute object", function() {
                    attributes.should.be.an("object");

                });

                it("should return an xml id attribute", function() {
                    attributes.xmlID.should.be.a("string");
                    attributes.xmlID.should.equal("12345");

                });

                it("should return an alternate identifier array", function() {
                    attributes.alternateidentifier.should.be.an("array");
                    attributes.alternateidentifier[0].should.equal("altid.1.1.png");
                    attributes.alternateidentifier[1].should.equal("altid2.1.1.png");
                });

                it("should return an entity name", function() {
                    attributes.entityname.should.be.a("string");
                    attributes.entityname.should.equal("entity.1.1.png");
                });

                it("should return an entity description", function() {
                    attributes.entitydescription.should.be.a("string");
                    attributes.entitydescription.should.equal("A descrition of entity.1.1.png");
                });

                it("should return an entity type", function() {
                    attributes.entitytype.should.be.a("string");
                    attributes.entitytype.should.equal("Portable Network graphic image");
                });
            });
        });

        var EntityUtil = {
            getTestEntityXML: function() {
                var xml = [];
                xml.push(
                    "<otherEntity id=\"12345\">\n",
                    "\t<alternateIdentifier>altid.1.1.png</alternateIdentifier>\n",
                    "\t<alternateIdentifier>altid2.1.1.png</alternateIdentifier>\n",
                    "\t<entityName>entity.1.1.png</entityName>\n",
                    "\t<entityDescription>A descrition of entity.1.1.png</entityDescription>\n",
                    "\t<entityType>Portable Network graphic image</entityType>\n",
                    "</otherEntity>");

                return xml.join('');
            }
        }
    });

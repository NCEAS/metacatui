"use strict";

define(["chai", "chai-jquery", "chai-backbone",
    "../../../../../../src/js/models/metadata/eml211/EMLEntity"],
    function(chai, chaiJquery, chaiBackbone, EMLEntity) {

        // Configure the Chai assertion library
        var should =  chai.should();
        var expect = chai.expect;

        // Pull in Jquery and Backbone-specific assertion libraries
        chai.use(chaiJquery); // exported from chai-jquery.js
        chai.use(chaiBackbone); // exported from chai-backbone.js

        describe("EMLEntity Test Suite", function (){

            describe("The EMLEntity object", function() {
                var emlEntity;
                /* Setup */
                before(function() {
                    emlEntity = new EMLEntity();

                });

                /* Tear down */
                after(function() {
                    emlEntity = undefined;
                });

                it('should exist', function() {
                    expect(emlEntity).to.exist;
                    emlEntity.should.exist;
                });
            });

            describe(".parse()", function() {
                var emlEntity;

                /* Setup */
                before(function() {
                    emlEntity = new EMLEntity({
                        objectXML: EntityUtil.getTestEntityXML()
                    }, {parse: true});

                });

                /* Tear down */
                after(function() {
                    emlEntity = undefined;
                });

                it("should return an attribute object", function() {
                    emlEntity.attributes.should.be.an("object");

                });

                it("should return an xml id attribute", function() {
                    emlEntity.get("xmlID").should.be.a("string");
                    emlEntity.get("xmlID").should.equal("12345");

                });

                it("should return an alternate identifier array", function() {
                    emlEntity.get("alternateIdentifier").should.be.an("array");
                    emlEntity.get("alternateIdentifier")[0].should.equal("altid.1.1.png");
                    emlEntity.get("alternateIdentifier")[1].should.equal("altid2.1.1.png");
                });

                it("should return an entity name", function() {
                    emlEntity.get("entityName").should.be.a("string");
                    emlEntity.get("entityName").should.equal("entity.1.1.png");
                });

                it("should return an entity description", function() {
                    emlEntity.get("entityDescription").should.be.a("string");
                    emlEntity.get("entityDescription").should.equal("A description of entity.1.1.png");
                });
            });

            describe(".updateDOM()", function() {
                var emlEntity;
                var updatedDOM;
                var options;

                /* Setup */
                before(function() {
                    emlEntity = new EMLEntity({
                        objectXML: EntityUtil.getTestEntityXML()
                    }, {parse: true});

                    // Change fields silently (MetacatUI app is not defined in testing)
                    options = {silent: true};
                    emlEntity.set("xmlID", "54321", options);
                    emlEntity.set("alternateIdentifier", ["altid.3.1.png", "altid.4.1.png"], options);
                    emlEntity.set("entityName", "entity.2.1.png", options);
                    emlEntity.set("entityDescription", "Changed description", options);
                    updatedDOM = emlEntity.updateDOM();
                });

                /* Tear down */
                after(function() {
                    emlEntity = undefined;
                    updatedDOM = undefined;
                });


                it("should return an otherEntity id", function() {
                    $(updatedDOM).attr("id").should.equal("54321");
                });

                it("should return an two alternateIdentifier elements", function() {
                    $(updatedDOM).children("alternateIdentifier")[0].textContent.should.equal("altid.3.1.png");
                    $(updatedDOM).children("alternateIdentifier")[1].textContent.should.equal("altid.4.1.png");
                });

                it("should return an an entityName element", function() {
                    $(updatedDOM).children("entityName").text().should.be.a("string");
                    $(updatedDOM).children("entityName").text().should.equal("entity.2.1.png");
                });

                it("should return an an entityDescription element", function() {
                    $(updatedDOM).children("entityDescription").text().should.be.a("string");
                    $(updatedDOM).children("entityDescription").text().should.equal("Changed description");
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
                    "\t<entityDescription>A description of entity.1.1.png</entityDescription>\n",
                    "\t<entityType>Portable Network graphic image</entityType>\n",
                    "</otherEntity>");

                return xml.join('');
            }
        }
    });

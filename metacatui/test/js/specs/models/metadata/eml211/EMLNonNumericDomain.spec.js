"use strict";

define(["chai", "chai-jquery", "chai-backbone",
    "../../../../../../src/main/webapp/js/models/metadata/eml211/EMLNonNumericDomain"],
    function(chai, chaiJquery, chaiBackbone, EMLNonNumericDomain) {

        // Configure the Chai assertion library
        var should =  chai.should();
        var expect = chai.expect;

        // Pull in Jquery and Backbone-specific assertion libraries
        chai.use(chaiJquery); // exported from chai-jquery.js
        chai.use(chaiBackbone); // exported from chai-backbone.js

        describe("EMLNonNumericDomain Test Suite", function (){
            var emlNonNumericDomain = new EMLNonNumericDomain();
            var textDomainXML; // mock response from the server
            var enumDomainCodeDefXML; // mock response from the server
            var textDomainAttrs; // object returned by EMLNonNumericDomain.parse()
            var enumDomainCodeDefAttrs; // object returned by EMLNonNumericDomain.parse()
            /* Setup */
            before(function() {
                // Parse a nominal textDomain fragment
                textDomainXML = NonNumericDomainUtil.getTestNominalTextDomainXML();
                textDomainAttrs = emlNonNumericDomain.parse({objectDOM: textDomainXML});

                // Parse an ordinal enumeratedDomain fragment
                enumDomainCodeDefXML = NonNumericDomainUtil.getTestOrdinalEnumeratedCodeDefinitionDomainXML();
                //enumDomainCodeDefAttrs = emlNonNumericDomain.parse({objectDOM: enumDomainCodeDefXML});
            });

            /* Tear down */
            after(function() {
                textDomainXML = undefined;
                textDomainAttrs = undefined;
                enumDomainCodeDefXML = undefined;
                enumDomainCodeDefAttrs = undefined;
            });

            describe("The EMLNonNumericDomain object", function() {
                it('should exist', function() {
                    expect(emlNonNumericDomain).to.exist;
                    emlNonNumericDomain.should.exist;
                });
            });

            describe("For a nominal scale with a text domain, .parse()", function() {

                it("should return an attributes object", function() {
                    textDomainAttrs.should.be.an("object");
                });

                it("should return a nonNumericDomain array", function() {
                    textDomainAttrs.nonNumericDomain.should.be.an("array");
                    textDomainAttrs.nonNumericDomain.length.should.equal(1);
                    textDomainAttrs.nonNumericDomain[0].should.have.all.keys("textDomain");
                });

                it("should return a textDomain object", function() {
                    textDomainAttrs.nonNumericDomain[0].textDomain.should.be.an("object");
                    textDomainAttrs.nonNumericDomain[0].textDomain.should.have.all.keys("definition", "pattern", "source");
                });

                it("should return a textDomain definition string", function() {
                    textDomainAttrs.nonNumericDomain[0].textDomain.definition.should.be.a("string");
                    textDomainAttrs.nonNumericDomain[0].textDomain.definition.should.equal("Any text");
                });

                it("should return a textDomain pattern array", function() {
                    textDomainAttrs.nonNumericDomain[0].textDomain.pattern.should.be.an("array");
                    textDomainAttrs.nonNumericDomain[0].textDomain.pattern.length.should.equal(1);
                    textDomainAttrs.nonNumericDomain[0].textDomain.pattern[0].should.equal("*");
                    // TODO: test other regex patterns
                });

                it("should return a textDomain source string", function() {
                    textDomainAttrs.nonNumericDomain[0].textDomain.source.should.be.a("string");
                    textDomainAttrs.nonNumericDomain[0].textDomain.source.should.equal("Any source");
                });
            });

            xdescribe("For an ordinal scale with an enumerated domain code definition, .parse()", function() {

                it("should return an attributes object", function() {
                    enumDomainCodeDefAttrs.should.be.an("object");
                });

                it("should return a nonNumericDomain object", function() {
                    enumDomainCodeDefAttrs.nonNumericDomain.should.be.an("object");
                    enumDomainCodeDefAttrs.nonNumericDomain.should.have.all.keys("enumeratedDomain");
                });

                it("should return an enumeratedDomain object", function() {
                    enumDomainCodeDefAttrs.nonNumericDomain.enumeratedDomain.should.be.an("object");
                    enumDomainCodeDefAttrs.nonNumericDomain.enumeratedDomain.should.have.all.keys("codeDefinition");
                });

                it("should return an enumeratedDomain codeDefinition object ", function() {
                    enumDomainCodeDefAttrs.nonNumericDomain.enumeratedDomain.codeDefinition.should.be.an("object");
                    enumDomainCodeDefAttrs.nonNumericDomain.enumeratedDomain.codeDefinition.should.have.all.keys("code", "definition", "source");
                });

                it("should return a textDomain pattern array", function() {
                    enumDomainCodeDefAttrs.nonNumericDomain.textDomain.pattern.should.be.an("array");
                    enumDomainCodeDefAttrs.nonNumericDomain.textDomain.pattern.length.should.equal(1);
                    enumDomainCodeDefAttrs.nonNumericDomain.textDomain.pattern[0].should.equal("*");
                    // TODO: test other regex patterns
                });

                it("should return a textDomain source string", function() {
                    enumDomainCodeDefAttrs.nonNumericDomain.textDomain.source.should.be.a("string");
                    enumDomainCodeDefAttrs.nonNumericDomain.textDomain.source.should.equal("Any source");
                });
            });
        });

        var NonNumericDomainUtil = {
            /* Returns a nominal non-numeric text domain fragment */
            getTestNominalTextDomainXML: function() {
                var xml = [];
                xml.push(
                    "<nominal>\n",
                    "\t<nonNumericDomain>\n",
                    "\t\t<textDomain>\n",
                    "\t\t\t<definition>Any text</definition>\n",
                    "\t\t\t<pattern>*</pattern>\n",
                    "\t\t\t<source>Any source</source>\n",
                    "\t\t</textDomain>\n",
                    "\t</nonNumericDomain>\n",
                    "</nominal>\n");

                return xml.join('');
            },

            /* Returns an ordinal non-numeric enumerated domain fragment */
            getTestOrdinalEnumeratedCodeDefinitionDomainXML: function() {
                var xml = [];
                xml.push(
                    "<ordinal>\n",
                    "\t<nonNumericDomain>\n",
                    "\t\t<enumeratedDomain>\n",
                    "\t\t\t<codeDefinition>\n",
                    "\t\t\t\t<code>JAL</code>\n",
                    "\t\t\t\t<definition>Jalama Beach, California</definition>\n",
                    "\t\t\t\t<source>USGS Place Name Gazateer</source>\n",
                    "\t\t\t</codeDefinition>\n",
                    "\t\t\t<codeDefinition>\n",
                    "\t\t\t\t<code>ALE</code>\n",
                    "\t\t\t\t<definition>Alegria, California</definition>\n",
                    "\t\t\t\t<source>USGS Place Name Gazateer</source>\n",
                    "\t\t\t</codeDefinition>\n",
                    "\t\t</enumeratedDomain>\n",
                    "\t</nonNumericDomain>\n",
                    "</ordinal>\n");

                return xml.join('');
            }

        }
    });

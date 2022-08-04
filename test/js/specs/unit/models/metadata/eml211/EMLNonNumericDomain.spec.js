define(["../../../../../../../../src/js/models/metadata/eml211/EMLNonNumericDomain"],
    function(EMLNonNumericDomain) {

        // Configure the Chai assertion library
        const should =  chai.should();
        const expect = chai.expect;

        describe("EMLNonNumericDomain Test Suite", function (){
            let emlNonNumericDomain = new EMLNonNumericDomain();
            let textDomainXML; // mock response from the server
            let enumDomainCodeDefXML; // mock response from the server
            let textDomainAttrs; // object returned by EMLNonNumericDomain.parse()
            let enumDomainCodeDefAttrs; // object returned by EMLNonNumericDomain.parse()
            /* Setup */
            before(function() {
                // Parse a nominal textDomain fragment
                textDomainXML = NonNumericDomainUtil.getTestNominalTextDomainXML();
                textDomainAttrs = emlNonNumericDomain.parse({
                    objectDOM: $(textDomainXML)[0],
                    objectXML: textDomainXML
                });

                // Parse an ordinal enumeratedDomain fragment
                enumDomainCodeDefXML = NonNumericDomainUtil.getTestOrdinalEnumeratedCodeDefinitionDomainXML();
                enumDomainCodeDefAttrs = emlNonNumericDomain.parse({
                    objectDOM: $(enumDomainCodeDefXML)[0],
                    objectXML: enumDomainCodeDefXML
                });
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
                    textDomainAttrs.nonNumericDomain[0].textDomain.should.have.all.keys("xmlID", "definition", "pattern", "source");
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

            describe("For a nominal scale with a text domain, updateDOM()", function() {
                let emlNonNumericDomain;
                let updatedDOM;
                let options;
                let nonNumericDomain;
                let textDomain;

                /* Set up */
                before(function() {
                    emlNonNumericDomain = new EMLNonNumericDomain({
                        measurementScale: "nominal",
                        objectDOM: $(NonNumericDomainUtil.getTestNominalTextDomainXML())
                    }, {parse: true});

                    options = {silent: true};
                    nonNumericDomain = emlNonNumericDomain.get("nonNumericDomain");
                    textDomain = nonNumericDomain[0].textDomain;
                    textDomain.definition = "Another definition";
                    textDomain.pattern[0] = "{0-9}{0-9}{0-9}";
                    textDomain.source = "Another source";
                    nonNumericDomain[0].textDomain = textDomain;
                    emlNonNumericDomain.set("nonNumericDomain", nonNumericDomain);
                    updatedDOM = emlNonNumericDomain.updateDOM();
                });

                /* Tear down*/
                after(function() {
                    emlNonNumericDomain = undefined;
                    nonNumericDomain = undefined;
                    updatedDOM = undefined;
                });



                it("should update the text domain definition", function() {
                    $(updatedDOM).children("nonNumericDomain").children("textdomain").children("definition")[0].textContent.should.equal("Another definition");
                });

                it("should update the text domain pattern", function() {
                    $(updatedDOM).children("nonNumericDomain").children("textdomain").children("pattern")[0].textContent.should.equal("{0-9}{0-9}{0-9}");
                });

            });

            describe("For an ordinal scale with an enumerated domain code definition, .parse()", function() {

                it("should return an attributes object", function() {
                    enumDomainCodeDefAttrs.should.be.an("object");
                });

                it("should return a nonNumericDomain object", function() {
                    enumDomainCodeDefAttrs.nonNumericDomain.should.be.an("array");
                    enumDomainCodeDefAttrs.nonNumericDomain.length.should.equal(1);
                    enumDomainCodeDefAttrs.nonNumericDomain[0].should.have.all.keys("enumeratedDomain");
                });

                it("should return an enumeratedDomain object", function() {
                    enumDomainCodeDefAttrs.nonNumericDomain[0].enumeratedDomain.should.be.an("object");
                    enumDomainCodeDefAttrs.nonNumericDomain[0].enumeratedDomain.should.have.all.keys("codeDefinition", "xmlID");
                });

                it("should return an enumeratedDomain codeDefinition array ", function() {
                    enumDomainCodeDefAttrs.nonNumericDomain[0].enumeratedDomain.codeDefinition.should.be.an("array");
                    enumDomainCodeDefAttrs.nonNumericDomain[0].enumeratedDomain.codeDefinition.length.should.equal(2);
                    enumDomainCodeDefAttrs.nonNumericDomain[0].enumeratedDomain.codeDefinition[0].should.be.an("object");
                    enumDomainCodeDefAttrs.nonNumericDomain[0].enumeratedDomain.codeDefinition[0].should.have.all.keys("code", "definition", "source");
                    enumDomainCodeDefAttrs.nonNumericDomain[0].enumeratedDomain.codeDefinition[0].code.should.equal("JAL");
                    enumDomainCodeDefAttrs.nonNumericDomain[0].enumeratedDomain.codeDefinition[0].definition.should.equal("Jalama Beach, California");
                    enumDomainCodeDefAttrs.nonNumericDomain[0].enumeratedDomain.codeDefinition[0].source.should.equal("USGS Place Name Gazateer");
                    enumDomainCodeDefAttrs.nonNumericDomain[0].enumeratedDomain.codeDefinition[1].code.should.equal("ALE");
                    enumDomainCodeDefAttrs.nonNumericDomain[0].enumeratedDomain.codeDefinition[1].definition.should.equal("Alegria, California");
                    expect(enumDomainCodeDefAttrs.nonNumericDomain[0].enumeratedDomain.codeDefinition[1].source).to.not.exist;
                });
            });
        });

        let NonNumericDomainUtil = {
            /* Returns a nominal non-numeric text domain fragment */
            getTestNominalTextDomainXML: function() {
                let xml = [];
                xml.push(
                    "<nominal>\n",
                    "\t<nonNumericDomain>\n",
                    "\t\t<textDomain>\n",
                    "\t\t\t<definition>Any text</definition>\n",
                    "\t\t\t<pattern>*</pattern>\n",
                    "\t\t\t<sourced>Any source</sourced>\n",
                    "\t\t</textDomain>\n",
                    "\t</nonNumericDomain>\n",
                    "</nominal>\n");

                return xml.join('');
            },

            /* Returns an ordinal non-numeric enumerated domain fragment */
            getTestOrdinalEnumeratedCodeDefinitionDomainXML: function() {
                let xml = [];
                xml.push(
                    "<ordinal>\n",
                    "\t<nonNumericDomain>\n",
                    "\t\t<enumeratedDomain>\n",
                    "\t\t\t<codeDefinition>\n",
                    "\t\t\t\t<code>JAL</code>\n",
                    "\t\t\t\t<definition>Jalama Beach, California</definition>\n",
                    "\t\t\t\t<sourced>USGS Place Name Gazateer</sourced>\n",
                    "\t\t\t</codeDefinition>\n",
                    "\t\t\t<codeDefinition>\n",
                    "\t\t\t\t<code>ALE</code>\n",
                    "\t\t\t\t<definition>Alegria, California</definition>\n",
                    "\t\t\t\t<!-- Second codeDef has no source -->\n",
                    "\t\t\t</codeDefinition>\n",
                    "\t\t</enumeratedDomain>\n",
                    "\t</nonNumericDomain>\n",
                    "</ordinal>\n");

                return xml.join('');
            }

        }
    });

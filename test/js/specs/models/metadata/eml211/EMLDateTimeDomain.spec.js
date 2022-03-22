define(["../../../../../../../src/js/models/metadata/eml211/EMLDateTimeDomain"], function(EMLDateTimeDomain) {

        // Configure the Chai assertion library
        var should =  chai.should();
        var expect = chai.expect;

        describe("EMLDateTimeDomain Test Suite", function (){
            var emlDateTimeDomain = new EMLDateTimeDomain();
            var responseXML; // mock response from the server
            var attributes; // object returned by EMLDateTimeDomain.parse()

            /* Setup */
            before(function() {
                // If needed
                responseXML = DateTimeDomainUtil.getTestDateTimeDomainXML();
                attributes = emlDateTimeDomain.parse({objectXML: responseXML});

            });

            /* Tear down */
            after(function() {
                // If needed
            });

            describe("The EMLDateTimeDomain object", function() {
                it('should exist', function() {
                    expect(emlDateTimeDomain).to.exist;
                    emlDateTimeDomain.should.exist;
                });
            });

            describe(".parse()", function() {
                it("should return an attributes object", function() {
                    attributes.should.be.an("object");

                });

                it("should return a format string", function() {
                    attributes.formatString.should.be.a("string");
                    attributes.formatString.should.equal("YYYY-mm-DDTHH:MM:SS");
                });

                it("should return a date time precision value", function() {
                    attributes.dateTimePrecision.should.be.a("string");
                    attributes.dateTimePrecision.should.equal("second");
                });

                it("should return a date time domain object", function() {
                    attributes.dateTimeDomain.should.be.an("object");
                    attributes.dateTimeDomain.should.have.all.keys("bounds");
                    attributes.dateTimeDomain.bounds.should.be.an("array");
                    attributes.dateTimeDomain.bounds.length.should.equal(3);
                    attributes.dateTimeDomain.bounds[0].should.be.an("object");
                    attributes.dateTimeDomain.bounds[1].should.be.an("object");
                    attributes.dateTimeDomain.bounds[2].should.be.an("object");
                    attributes.dateTimeDomain.bounds[0].minimum.should.equal("2017-01-01T00:00:00");
                    attributes.dateTimeDomain.bounds[0].maximum.should.equal("2017-01-31T11:59:59");
                    attributes.dateTimeDomain.bounds[1].minimum.should.equal("2017-02-01T00:00:00");
                    attributes.dateTimeDomain.bounds[2].maximum.should.equal("2017-03-31T11:59:59");
                });
            });
        });

        var DateTimeDomainUtil = {
            /* Returns a dateTime EMLMeasurementScale */
            getTestDateTimeDomainXML: function() {
                var xml = [];
                xml.push(
                    "<dateTime>\n",
                    "\t<formatString>YYYY-mm-DDTHH:MM:SS</formatString>\n",
                    "\t<dateTimePrecision>second</dateTimePrecision>\n",
                    "\t<dateTimeDomain>\n",
                    "\t\t<bounds>\n",
                    "\t\t\t<minimum>2017-01-01T00:00:00</minimum>\n",
                    "\t\t\t<maximum>2017-01-31T11:59:59</maximum>\n",
                    "\t\t</bounds>\n",
                    "\t\t<bounds>\n",
                    "\t\t\t<minimum>2017-02-01T00:00:00</minimum>\n",
                    "\t\t</bounds>\n",
                    "\t\t<bounds>\n",
                    "\t\t\t<maximum>2017-03-31T11:59:59</maximum>\n",
                    "\t\t</bounds>\n",
                    "\t</dateTimeDomain>\n",
                    "</dateTime>");

                return xml.join('');
            }
        }
    });

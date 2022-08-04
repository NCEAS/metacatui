define(["../../../../../../../../src/js/models/metadata/eml211/EMLMeasurementScale",
        "../../../../../../../../src/js/models/metadata/eml211/EMLNonNumericDomain",
        "../../../../../../../../src/js/models/metadata/eml211/EMLNumericDomain",
        "../../../../../../../../src/js/models/metadata/eml211/EMLDateTimeDomain",
],
    function(EMLMeasurementScale,
        EMLNonNumericDomain, EMLNumericDomain, EMLDateTimeDomain) {

        // Configure the Chai assertion library
        var should =  chai.should();
        var expect = chai.expect;

        describe("EMLMeasurementScale Factory Test Suite", function (){
            var emlMeasurementScale;
            var domainName;
            var xml;

            /* Setup */
            before(function() {
                // If needed

            });

            /* Tear down */
            afterEach(function() {
                // Clear the variables after each test
                emlMeasurementScale = undefined;
                domainName = undefined;
                xml = undefined;
            });

            describe(".getInstance()", function() {

                it('should return a nominal instance of EMLNonNumericDomain', function() {
                    xml = EMLMeasurementScaleUtil.getTestNominalMeasurementScaleXML();
                    emlMeasurementScale = EMLMeasurementScale.getInstance(xml);
                    domainName = emlMeasurementScale.get("measurementScale");
                    expect(emlMeasurementScale).to.be.an("Object");
                    domainName.should.equal("nominal");
                });

                it('should return an ordinal instance of EMLNonNumericDomain', function() {
                    xml = EMLMeasurementScaleUtil.getTestOrdinalMeasurementScaleXML();
                    emlMeasurementScale = EMLMeasurementScale.getInstance(xml);
                    domainName = emlMeasurementScale.get("measurementScale");
                    expect(emlMeasurementScale).to.be.an.an("Object");
                    domainName.should.equal("ordinal");
                });

                it('should return an interval instance of EMLNumericDomain', function() {
                    xml = EMLMeasurementScaleUtil.getTestIntervalMeasurementScaleXML();
                    emlMeasurementScale = EMLMeasurementScale.getInstance(xml);
                    domainName = emlMeasurementScale.get("measurementScale");
                    expect(emlMeasurementScale).to.be.an.an("Object");
                    domainName.should.equal("interval");
                });

                it('should return a ratio instance of EMLNumericDomain', function() {
                    xml = EMLMeasurementScaleUtil.getTestRatioMeasurementScaleXML();
                    emlMeasurementScale = EMLMeasurementScale.getInstance(xml);
                    domainName = emlMeasurementScale.get("measurementScale");
                    expect(emlMeasurementScale).to.be.an.an("Object");
                    domainName.should.equal("ratio");
                });

                it('should return a dateTime instance of EMLDateTimeDomain', function() {
                    xml = EMLMeasurementScaleUtil.getTestDateTimeMeasurementScaleXML();
                    emlMeasurementScale = EMLMeasurementScale.getInstance(xml);
                    domainName = emlMeasurementScale.get("measurementScale");
                    expect(emlMeasurementScale).to.be.an.an("Object");
                    domainName.should.equal("datetime");
                });
            });
        });

        var EMLMeasurementScaleUtil = {

            /* Returns a nominal measurement scale fragment */
            getTestNominalMeasurementScaleXML: function() {
                var xml = [];
                xml.push(
                    "<measurementScale>\n",
                    "\t<nominal>\n",
                    "\t\t<nonNumericDomain>\n",
                    "\t\t\t<textDomain>\n",
                    "\t\t\t\t<definition>Any text</definition>\n",
                    "\t\t\t\t<pattern>*</pattern>\n",
                    "\t\t\t\t<sourced>Any source</sourced>\n",
                    "\t\t\t</textDomain>\n",
                    "\t\t</nonNumericDomain>\n",
                    "\t</nominal>\n",
                    "</measurementScale>\n");

                return xml.join('');
            },

            /* Returns an ordinal measurement scale fragment */
            getTestOrdinalMeasurementScaleXML: function() {
                var xml = [];
                xml.push(
                    "<measurementScale>\n",
                    "\t<ordinal>\n",
                    "\t\t<nonNumericDomain>\n",
                    "\t\t\t<textDomain>\n",
                    "\t\t\t\t<definition>Any text</definition>\n",
                    "\t\t\t\t<pattern>*</pattern>\n",
                    "\t\t\t\t<sourced>Any source</sourced>\n",
                    "\t\t\t</textDomain>\n",
                    "\t\t</nonNumericDomain>\n",
                    "\t</ordinal>\n",
                    "</measurementScale>\n");

                return xml.join('');
            },

            /* Returns an interval measurement scale fragment */
            getTestIntervalMeasurementScaleXML: function() {
                var xml = [];
                xml.push(
                    "<measurementScale>\n",
                    "\t<interval>\n",
                    "\t\t<unit>\n",
                    "\t\t\t<standardUnit>meter</standardUnit>\n",
                    "\t\t</unit>\n",
                    "\t\t<numericDomain>\n",
                    "\t\t\t<numberType>whole</numberType>\n",
                    "\t\t</numericDomain>\n",
                    "\t</interval>\n",
                    "</measurementScale>\n");

                return xml.join('');
            },

            /* Returns a ratio measurement scale fragment */
            getTestRatioMeasurementScaleXML: function() {
                var xml = [];
                xml.push(
                    "<measurementScale>\n",
                    "\t<ratio>\n",
                    "\t\t<unit>\n",
                    "\t\t\t<standardUnit>meter</standardUnit>\n",
                    "\t\t</unit>\n",
                    "\t\t<numericDomain>\n",
                    "\t\t\t<numberType>float</numberType>\n",
                    "\t\t</numericDomain>\n",
                    "\t</ratio>\n",
                    "</measurementScale>\n");

                return xml.join('');
            },

            /* Returns a dateTime measurement scale fragment */
            getTestDateTimeMeasurementScaleXML: function() {
                var xml = [];
                xml.push(
                    "<measurementScale>\n",
                    "\t<dateTime>\n",
                    "\t\t<formatString>YYYY-mm-DDTHH:MM:SS</formatString>\n",
                    "\t\t<dateTimePrecision>second</dateTimePrecision>\n",
                    "\t\t<dateTimeDomain>\n",
                    "\t\t\t<bounds>\n",
                    "\t\t\t\t<minimum>2017-01-01T00:00:00</minimum>\n",
                    "\t\t\t\t<maximum>2017-01-31T11:59:59</maximum>\n",
                    "\t\t\t</bounds>\n",
                    "\t\t\t<bounds>\n",
                    "\t\t\t\t<minimum>2017-02-01T00:00:00</minimum>\n",
                    "\t\t\t</bounds>\n",
                    "\t\t\t<bounds>\n",
                    "\t\t\t\t<maximum>2017-03-31T11:59:59</maximum>\n",
                    "\t\t\t</bounds>\n",
                    "\t\t</dateTimeDomain>\n",
                    "\t</dateTime>",
                    "</measurementScale>\n");

                return xml.join('');
            }
        };
    });

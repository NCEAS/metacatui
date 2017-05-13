define(["jquery", "underscore", "backbone",
    "models/metadata/eml211/EMLNonNumericDomain",
    "models/metadata/eml211/EMLNumericDomain",
        "models/metadata/eml211/EMLDateTimeDomain"],
    function($, _, Backbone, EMLNonNumericDomain, EMLNumericDomain, EMLDateTimeDomain) {

        /*
         * EMLMeasurementScale is a measurement scale factory that returns
         * an EMLMeasurementScale subclass of either EMLNonNumericDomain,
         * EMLNumericDomain, or EMLDateTimeDomain, depending on the
         * domain name found in the given measurementScaleXML
         */
        var EMLMeasurementScale = Backbone.Model.extend({},

        {
            /*
             * Get an instance of an EMLMeasurementScale subclass
             * given the measurementScaleXML fragment
             */
            getInstance: function(measurementScaleXML) {
                var instance = {};
                
                /* JQuery seems to have a bug handling XML elements named "source"
                 * $objectDOM = $(attributes.objectDOM) gives us:
                 * <nominal>
                 * ....<nonnumericdomain>
                 * ........<textdomain>
                 * ............<definition>Any text</definition>
                 * ............<pattern>*</pattern>
                 * ............<source>Any source
                 * ........</textdomain>
                 * ....</nonnumericdomain>
                 * </nominal>
                 * Note the lost </source>. Changing the element name to "sourced" works fine.
                 * Use the DOMParser instead
                 */
                if(measurementScaleXML && measurementScaleXML.indexOf("<") > -1){
                    var parser = new DOMParser();
                    var parsedDOM = parser.parseFromString(measurementScaleXML, "text/xml");
                	var domainName = $(parsedDOM).find("measurementscale").children()[0].localName;
                	var options = {parse: true};
                }
                //If it's not an XML string, then it must be the domainName itself
                else if(measurementScaleXML && measurementScaleXML.indexOf("<") == -1){
                	var domainName = measurementScaleXML;
                	var options = {};
                	measurementScaleXML = null;
                }
                else
                	return false;
                
                // Return the appropriate sub class of EMLMeasurementScale
                switch ( domainName ) {
                    case "nominal":
                        instance = new EMLNonNumericDomain({
                            "measurementScale": domainName,
                            "objectXML": measurementScaleXML
                        }, options);
                        break;
                    case "ordinal":
                        instance = new EMLNonNumericDomain({
                            "measurementScale": domainName,
                            "objectXML": measurementScaleXML
                        }, options);
                        break;
                    case "interval":
                        instance = new EMLNumericDomain({
                            "measurementScale": domainName,
                            "objectXML": measurementScaleXML
                        }, options);
                        break;
                    case "ratio":
                        instance = new EMLNumericDomain({
                            "measurementScale": domainName,
                            "objectXML": measurementScaleXML
                        }, options);
                        break;
                    case "dateTime":
                        instance = new EMLDateTimeDomain({
                            "measurementScale": domainName,
                            "objectXML": measurementScaleXML
                        }, options);
                        break;
                    default:
                        instance = new EMLNonNumericDomain({
                            "measurementScale": domainName,
                            "objectXML": measurementScaleXML
                        }, options);
                }

                return instance;
            }
        });

        return EMLMeasurementScale;
    }
);

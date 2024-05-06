define(["jquery", "underscore", "backbone",
    "models/metadata/eml211/EMLNonNumericDomain",
    "models/metadata/eml211/EMLNumericDomain",
        "models/metadata/eml211/EMLDateTimeDomain"],
    function($, _, Backbone, EMLNonNumericDomain, EMLNumericDomain, EMLDateTimeDomain) {

        /**
        * @class EMLMeasurementScale
         * @classdesc EMLMeasurementScale is a measurement scale factory that returns
         * an EMLMeasurementScale subclass of either EMLNonNumericDomain,
         * EMLNumericDomain, or EMLDateTimeDomain, depending on the
         * domain name found in the given measurementScaleXML
         * @classcategory Models/Metadata/EML211
         * @extends Backbone.Model
         */
        var EMLMeasurementScale = Backbone.Model.extend({},
          /** @lends EMLMeasurementScale.prototype */
        {
            /*
             * Get an instance of an EMLMeasurementScale subclass
             * given the measurementScaleXML fragment
             */
            getInstance: function(measurementScaleXML) {
                var instance = {};

                if(measurementScaleXML && measurementScaleXML.indexOf("<") > -1){
                    var objectDOM = $(measurementScaleXML)[0];
                	var domainName = $(objectDOM).children()[0].localName;
                	var options = {parse: true};
                }
                //If it's not an XML string, then it must be the domainName itself
                else if(measurementScaleXML && measurementScaleXML.indexOf("<") == -1){
                	var domainName = measurementScaleXML;
                	var options = {};
                	measurementScaleXML = null;
                }

                // Return the appropriate sub class of EMLMeasurementScale
                switch ( domainName ) {
                    case "nominal":
                        instance = new EMLNonNumericDomain({
                            "measurementScale": domainName,
                            "objectDOM": $(measurementScaleXML)[0]
                        }, options);
                        break;
                    case "ordinal":
                        instance = new EMLNonNumericDomain({
                            "measurementScale": domainName,
                            "objectDOM": $(measurementScaleXML)[0]
                        }, options);
                        break;
                    case "interval":
                        instance = new EMLNumericDomain({
                            "measurementScale": domainName,
                            "objectDOM": $(measurementScaleXML)[0]
                        }, options);
                        break;
                    case "ratio":
                        instance = new EMLNumericDomain({
                            "measurementScale": domainName,
                            "objectDOM": $(measurementScaleXML)[0]
                        }, options);
                        break;
                    case "datetime":
                        instance = new EMLDateTimeDomain({
                            "measurementScale": domainName,
                            "objectDOM": $(measurementScaleXML)[0]
                        }, options);
                        break;
                    default:
                        instance = new EMLNonNumericDomain({
                            "measurementScale": domainName,
                            "objectDOM": $(measurementScaleXML)[0]
                        }, options);
                }

                return instance;
            }
        });

        return EMLMeasurementScale;
    }
);

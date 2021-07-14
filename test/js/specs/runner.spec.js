"use strict";

/* Configure the tests to use requirejs, and map dependency aliases to their
   directory location (.js is ommitted). Shim libraries that don't natively
   support requirejs. */
require.config({
    baseUrl: "../test",
    waitSeconds: 180,
    // urlArgs: "buster=" + (new Date()).getTime(),
    paths: {
        // Pull common libs from the app components library
        "async": '../src/components/async',
        "text": '../src/components/require-text',
        "jquery": "../src/components/jquery-1.9.1.min",
        "underscore": "../src/components/underscore-min",
        "backbone": "../src/components/backbone",
        "mocha": "./js/mocha",
        "chai": "./js/chai",
        "chai-jquery": "./js/chai-jquery",
        "chai-backbone": "./js/chai-backbone",
        "he": "../src/components/he",
        "uuid": "../src/components/uuid",
        "md5": "../src/components/md5",
        "x2js": "../src/components/xml2json",
        // The paths to the app components
        "models": "../src/js/models",
        "collections": "../src/js/collections",
        "views": "../src/js/views",
        "routers": "../src/js/routers",
        "templates": "../src/js/templates",
        "themes": "../src/js/themes",
        "common": "../src/js/common"
    },
    shim: {
        "mocha": {
            init: function() {
                this.mocha.setup({
                    ui: "bdd"
                });
                return this.mocha;
            }
        }
    }
});

/* Set up the test suite */
define(["require", "mocha"], function(require, mocha) {
        // The array of tests in the suite
        var tests = [
            "js/specs/models/metadata/eml211/EMLEntity.spec",
            "js/specs/models/metadata/eml211/EMLOtherEntity.spec",
            "js/specs/models/metadata/eml211/EMLAttribute.spec",
            "js/specs/models/metadata/eml211/EMLMeasurementScale.spec",
            "js/specs/models/metadata/eml211/EMLNonNumericDomain.spec",
            "js/specs/models/metadata/eml211/EMLNumericDomain.spec",
            "js/specs/models/metadata/eml211/EMLDateTimeDomain.spec",
            "js/specs/models/metadata/eml211/EMLTemporalCoverage.spec",
            "js/specs/common/EntityUtils.spec"
        ];

        // Include model and view tests
        require(tests, function(require) {
            mocha.run();
        });
    }
);

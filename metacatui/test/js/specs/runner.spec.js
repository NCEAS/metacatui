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
        "jquery": "../src/main/webapp/components/jquery",
        "underscore": "../src/main/webapp/components/underscore-min",
        "backbone": "../src/main/webapp/components/backbone",
        "mocha": "./js/mocha",
        "chai": "./js/chai",
        "chai-jquery": "./js/chai-jquery",
        "chai-backbone": "./js/chai-backbone"
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
            "js/specs/models/metadata/eml211/EMLEntity.spec"
        ];

        // Include model and view tests
        require(tests, function(require) {
            mocha.run();
        });
    }
);

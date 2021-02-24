/*global define */
define(['jquery', 'underscore'],
	function($, _) {
	'use strict';

	/**
  * @namespace {object} Utilities
  * @description A generic utility object that contains functions used throughout MetacatUI to perform useful functions,
  * but not used to store or manipulate any state about the application.
  * @since 2.14.0
  */
	var Utilities = {

    /**
    * HTML-encodes the given string so it can be inserted into an HTML page without running
    * any embedded Javascript.
    * @param {string} s
    * @returns {string}
    */
    encodeHTML: function(s) {

      try{
        if( !s || typeof s !== "string" ){
          return "";
        }

        return s.replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/'/g, "&apos;")
                .replace(/\//g, "/")
                .replace(/"/g, '&quot;');
      }
      catch(e){
        console.error("Could not encode HTML: ", e);
        return "";
      }
    },

    /**
    * Validates that the given string is a valid DOI
    * @param {string} identifier
    * @returns {boolean}
    * @since 2.15.0
    */
    isValidDOI: function(identifier) {
      // generate doi regex
      var doiRGEX = new RegExp(/^\s*(http:\/\/|https:\/\/)?(doi.org\/|dx.doi.org\/)?(doi: ?|DOI: ?)?(10\.\d{4,}(\.\d)*)\/(\w+).*$/ig)

      return doiRGEX.test(identifier);
    }

  }

  return Utilities;
});

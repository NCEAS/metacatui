/*global define */
define(['jquery', 'underscore'],
	function($, _) {
	'use strict';

	/**
  * @namespace {object} Utilities
  * A generic utility object that contains functions used throughout MetacatUI to perform useful functions,
  * but not used to store or manipulate any state about the application.
  */
	var Utilities = {

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
    }

  }

  return Utilities;
});

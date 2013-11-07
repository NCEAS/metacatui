/*global require */
/*jshint unused:false */
'use strict';

/** NOTE: The theme name and themeMap are specified in the loader.js file **/

console.log("Using theme: " + theme);
console.log("Using themeMap: " + themeMap);
console.log("Using metacatContext: " + metacatContext);

/* Configure the app to use requirejs, and map dependency aliases to their
   directory location (.js is ommitted). Shim libraries that don't natively 
   support requirejs. */
require.config({
  baseUrl: 'js/',
  map: themeMap,
  paths: {
    jquery: '../components/jquery',
    jqueryui: '../components/jquery-ui-1.10.3.custom.min',
    underscore: '../components/underscore',
    backbone: '../components/backbone',
    bootstrap: '../components/bootstrap.min',
    text: '../components/require-text',
    moment: '../components/moment',
    recaptcha: 'https://www.google.com/recaptcha/api/js/recaptcha_ajax',
    registry: [ 
               // use the path fallback in case there is no metacat installed here
               '/' + metacatContext + '/style/common/templates/metacatui/entryForm',
               // fallback to local version
               'scripts/entryForm'
                ],
    domReady: '../components/domready',
    async: '../components/async'
  },
  shim: { /* used for libraries without native AMD support */
    underscore: {
      exports: '_'
    },
    backbone: {
      deps: ['underscore', 'jquery'],
      exports: 'Backbone'
    },
    bootstrap: { 
    	deps: ['jquery'],
    	exports: 'Bootstrap'
    },
    registry: {
    	exports: 'Registry'
    }
  }
});

var appModel = appModel || {};
var appView = appView || {};
var uiRouter = uiRouter || {};
var appSearchResults = appSearchResults || {};
var searchModel = searchModel || {};
var registryModel = registryModel || {};


//Define Google Maps API
define('gmaps', ['async!https://maps.googleapis.com/maps/api/js?v=3&key=AIzaSyCcGB6lZHoq2Isp0ugdqsCPTDpl_ryo8Pk&sensor=false'], function() {
    return google.maps;
});


/* Setup the application scaffolding first  */
require(['bootstrap', 'views/AppView', 'models/AppModel'],
function(Bootstrap, AppView, AppModel) {
	'use strict';  
    		
	// initialize the application to get the index.html scaffolding in place
	appModel = new AppModel({context: '/' + metacatContext});
	appView = new AppView();

	
	/* Now require the rest of the libraries for the application */
	require(['backbone', 'routers/router', 'collections/SolrResults', 'models/Search', 'models/RegistryModel'],
	function(Backbone, UIRouter, SolrResultList, Search, RegistryModel) {
		'use strict';  
	    		
		appSearchResults = new SolrResultList([], {});
		
		searchModel = new Search();
		
		registryModel = new RegistryModel();
		
		// Initialize routing and start Backbone.history()
		uiRouter = new UIRouter();
		Backbone.history.start();  
		
	    	
	});
    	
});


/*global require */
/*jshint unused:false */
'use strict';

/** NOTE: The theme name and themeMap are specified in the loader.js file **/

console.log("Using theme: " + theme);
console.log("Using themeMap: " + themeMap);
console.log("Using metacatContext: " + metacatContext);

var recaptchaURL = 'https://www.google.com/recaptcha/api/js/recaptcha_ajax';
if (mapKey){
	var gmapsURL = 'https://maps.googleapis.com/maps/api/js?v=3&sensor=false&key=' + mapKey;
}

/* Configure the app to use requirejs, and map dependency aliases to their
   directory location (.js is ommitted). Shim libraries that don't natively 
   support requirejs. */
require.config({
  baseUrl: 'js/',
  waitSeconds: 180, //wait 3 minutes before throwing a timeout error
  map: themeMap,
  paths: {
    jquery: '../components/jquery',
    jqueryui: '../components/jquery-ui-1.10.3.custom.min',
    underscore: '../components/underscore',
    backbone: '../components/backbone',
    bootstrap: '../components/bootstrap.min',
    text: '../components/require-text',
    moment: '../components/moment',
    registry: [ 
               // use the path fallback in case there is no metacat installed here
               //'/' + metacatContext + '/style/common/templates/metacatui/entryForm',
               // fallback to local version
               'scripts/entryForm'
                ],
    domReady: '../components/domready',
    async: '../components/async',
    recaptcha: [recaptchaURL, 'scripts/placeholder'],
    gmapsAPI: gmapsURL,
	markerClusterer: '../components/markerclustererplus_2.1.2',
	d3: '../components/d3.v3.min'

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
    },
    markerClusterer: {
		exports: "MarkerClusterer"
	}
  }
});

/** 
 * Define Google Maps API if we can load the first script for it
 * Allows running without internet connection
 */
require(['gmapsAPI'],
	function(gmapsAPI) {
		console.log("Loaded gmapsAPI...continuing with asynchronous load");
		define('gmaps', 
				['async!' + gmapsURL], 
				function() {
					return google.maps;
				}
			);
	},
	function(err) {
		console.log("Error loading gmapsAPI, falling back to placeholder");
		define('gmaps', 
				[null], 
				function() {
					return null;
				}
			);
	}
);

var appModel = appModel || {};
var appView = appView || {};
var uiRouter = uiRouter || {};
var appSearchResults = appSearchResults || {};
var searchModel = searchModel || {};
var registryModel = registryModel || {};
var statsModel = statsModel || {};

/* Setup the application scaffolding first  */
require(['bootstrap', 'views/AppView', 'models/AppModel'],
function(Bootstrap, AppView, AppModel) {
	'use strict';  
    		
	// initialize the application to get the index.html scaffolding in place
	appModel = new AppModel({context: '/' + metacatContext});
	appView = new AppView();

	
	/* Now require the rest of the libraries for the application */
	require(['backbone', 'routers/router', 'collections/SolrResults', 'models/Search', 'models/RegistryModel', 'models/Stats', 'd3'],
	function(Backbone, UIRouter, SolrResultList, Search, RegistryModel, Stats, d3) {
		'use strict';  
	    		
		appSearchResults = new SolrResultList([], {});
		
		searchModel = new Search();
		
		registryModel = new RegistryModel();
		
		statsModel = new Stats();
		
		// Initialize routing and start Backbone.history()
		uiRouter = new UIRouter();
		Backbone.history.start();
	  
	});
    	
});


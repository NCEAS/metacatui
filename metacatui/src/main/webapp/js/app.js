/*global require */
/*jshint unused:false */
'use strict';

/** NOTE: The theme name and themeMap are specified in the loader.js file

console.log("Using theme: " + theme);
console.log("Using themeMap: " + themeMap);

/* Configure the app to use requirejs, and map dependency aliases to their
   directory location (.js is ommitted). Shim libraries that don't natively 
   support requirejs. */
require.config({
  baseUrl: 'js/',
  map: themeMap,
  paths: {
    jquery: '../components/jquery',
    underscore: '../components/underscore',
    backbone: '../components/backbone',
    bootstrap: '../components/bootstrap.min',
    text: '../components/require-text',
    moment: '../components/moment',
    registry: '/knb/style/common/templates/metacatui/entryForm'
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

/* Setup the application scaffolding first  */
require(['bootstrap', 'views/AppView', 'models/AppModel'],
function(Bootstrap, AppView, AppModel) {
	'use strict';  
    		
	// initialize the application to get the index.html scaffolding in place
	appModel = new AppModel();
	appView = new AppView();
	
	/* Now require the rest of the libraries for the application */
	require(['backbone', 'routers/router', 'collections/SolrResults'],
	function(Backbone, UIRouter, SolrResultList) {
		'use strict';  
	    		
		appSearchResults = new SolrResultList([], {});
				
		// Initialize routing and start Backbone.history()
		uiRouter = new UIRouter();
		Backbone.history.start();   
	    	
	});
    	
});


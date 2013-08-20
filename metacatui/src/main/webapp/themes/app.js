/*global require */
/*jshint unused:false */
'use strict';

// NOTE: change this to your skin name and then update the "map" config below
// to include your overrides
// NOTE 2: update the index.html file to use your CSS (TODO)
//var skin = 'aoos';

console.log("Using skin: " + skin);
console.log("Using skinMap: " + skinMap);

/* Configure the app to use requirejs, and map dependency aliases to their
   directory location (.js is ommitted). Shim libraries that don't natively 
   support requirejs. */
require.config({
  baseUrl: 'themes/default/',
  map: skinMap,
  paths: {
    jquery: '../../components/jquery',
    underscore: '../../components/underscore',
    backbone: '../../components/backbone',
    bootstrap: '../../components/bootstrap.min',
    text: '../../components/require-text',
    moment: '../../components/moment',
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

var app = app || {};
var appView = appView || {};
var uiRouter = uiRouter || {};
var appModel = appModel || {};
var aboutModel = aboutModel || {};
var toolsModel = toolsModel || {};
var appSearchResults = appSearchResults || {};

//this function allows us to override modules for a skin, but fall back to the default when no override is present
var loader = function(err) {    
	if (err.requireModules) {
		for(var i = 0; i < err.requireModules.length; i++) {
			var module = err.requireModules[i];
			console.log("1. Could not find: " + module);
			requirejs.undef(module);
//			requirejs.config({
//				baseUrl: 'js/skins/'
//			});
			// find the module manually
			if (module.indexOf("/") == 0) {
				throw err;
			}
			var modulePath = null;
			if (module.indexOf("!") < 0) {
				modulePath = "/themes/default/" + module + ".js";
			} else {
				var parts = module.split("!");
				modulePath = parts[0] + "!" + "../themes/default/" + parts[1];
			}
			
			console.log("2. Loading default from: " + modulePath);
			var errBack = function(err) {
				console.log("Err: " + err.message);
				loader(err);
			};
			require(
					[modulePath], 
					function() {
						console.log("Callback loaded: " + modulePath);
					},
					errBack);
			
			// map to the new source to the same module
			// PRIVATE API
			var originalMap = requirejs.s.contexts._.config.map;
			originalMap['*'][module] = modulePath;
			requirejs.config(originalMap);
		}
	} else {
		console.log("0. " + err.requireType + " - " + err.message);
		throw err;
	}
};

// set it to handle global errors
//requirejs.onError = loader;

/* require libraries that are needed  */
require(['backbone', 'routers/router', 'views/AppView', 'models/AppModel', 'models/AboutModel', 'models/ToolsModel', 'collections/SolrResults'],
function(Backbone, UIRouter, AppView, AppModel, AboutModel, ToolsModel, SolrResultList) {
	'use strict';  
    		
	appModel = new AppModel();
	aboutModel = new AboutModel();
	toolsModel = new ToolsModel();
	appView = new AppView();
	appSearchResults = new SolrResultList([], {});
			
	// Initialize routing and start Backbone.history()
	uiRouter = new UIRouter();
	Backbone.history.start();   
    	
});
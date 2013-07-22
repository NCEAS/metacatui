/*global require */
/*jshint unused:false */
'use strict';

/* Configure the app to use requirejs, and map dependency aliases to their
   directory location (.js is ommitted). Shim libraries that don't natively 
   support requirejs. */
require.config({
  baseUrl: 'js',
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
    	exports: "$.fn.modal"
    },
    registry: {
    	exports: 'Registry'
    }
  },
  enforceDefine: true
});

var app = app || {};
var appView = appView || {};
var uiRouter = uiRouter || {};
var appModel = appModel || {};
var appSearchResults = appSearchResults || {};

/* require libraries that are needed  */
require(['backbone', 'routers/router', 'views/AppView', 'models/AppModel', 'collections/SolrResults'],
function(Backbone, UIRouter, AppView, AppModel, SolrResultList) {
	'use strict';  
    		
	appModel = new AppModel();
	appView = new AppView();
	appSearchResults = new SolrResultList([], {});
			
	// Initialize routing and start Backbone.history()
	uiRouter = new UIRouter();
	Backbone.history.start();   
    	
  }
);
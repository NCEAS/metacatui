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
    text: '../components/require-text'
  },
  shim: { /* used for libraries without native AMD support */
    underscore: {
      exports: '_'
    },
    backbone: {
      deps: ['underscore', 'jquery'],
      exports: 'Backbone'
    }
  }
});

var app = app || {};
var appView = appView || {};
var uiRouter = uiRouter || {};

/* require libraries that are needed  */
require(['backbone', 'routers/router', 'views/AppView'],
function(Backbone, UIRouter, AppView) {
      'use strict';  
    				
			appView = new AppView();
			
			// Initialize routing and start Backbone.history()
      uiRouter = new UIRouter();
      Backbone.history.start();   
    	
  }
);
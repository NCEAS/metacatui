/*global require */
/*jshint unused:false */
'use strict';

/** NOTE: The theme name and themeMap are specified in the loader.js file **/
var recaptchaURL = 'https://www.google.com/recaptcha/api/js/recaptcha_ajax';
if(mapKey){
	var gmapsURL = 'https://maps.googleapis.com/maps/api/js?v=3&sensor=false&key=' + mapKey;
	define('gmaps', 
			['async!' + gmapsURL], 
			function() {
				return google.maps;
			}
		);
}
else{
	define('gmaps', null);
}
if(useD3) var d3URL = '../components/d3.v3.min';
else 	  var d3URL = null;

/* Configure the app to use requirejs, and map dependency aliases to their
   directory location (.js is ommitted). Shim libraries that don't natively 
   support requirejs. */
require.config({
  baseUrl: 'js/',
  waitSeconds: 180, //wait 3 minutes before throwing a timeout error
  map: themeMap,
  urlArgs: "v=" + window.metacatUIVersion,
  paths: {
    jquery: '../components/jquery',
    jqueryui: '../components/jquery-ui-1.10.3.custom.min',
    jqueryform: '../components/jquery.form',
    jquerysidr: '../components/jquery.sidr.min',
    underscore: '../components/underscore',
    backbone: '../components/backbone-min',
    bootstrap: '../components/bootstrap.min',
    text: '../components/require-text',
    moment: '../components/moment.min',
    jws: '../components/jws-3.2.min',
    jsrasign: '../components/jsrsasign-4.9.0.min',    
    registry: [ 
               // use the path fallback in case there is no metacat installed here
               //'/' + metacatContext + '/style/common/templates/metacatui/entryForm',
               // fallback to local version
               'scripts/entryForm'
                ],
    domReady: '../components/domready',
    async: '../components/async',
    recaptcha: [recaptchaURL, 'scripts/placeholder'],
	nGeohash: '../components/geohash/main',
	fancybox: '../components/fancybox/jquery.fancybox.pack', //v. 2.1.5
    annotator: '../components/annotator/v1.2.10/annotator-full',
	//Have a null fallback for our d3 components for browsers that don't support SVG
	d3: d3URL,
	LineChart: ['views/LineChartView', null],
	BarChart: ['views/BarChartView', null],
	CircleBadge: ['views/CircleBadgeView', null],
	DonutChart: ['views/DonutChartView', null]
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
    annotator: {
    	exports: 'Annotator'
    },
    jquerysidr: {
    	deps: ['jquery'],
    	exports: 'jquerysidr'
    },
    jws: {
    	exports: 'JWS',
        deps: ['jsrasign'],
    },
	nGeohash: {
		exports: "geohash"
	}
  }
});

var appModel = appModel || {};
var appView = appView || {};
var uiRouter = uiRouter || {};
var appSearchResults = appSearchResults || {};
var appSearchModel = appSearchModel || {};
var registryModel = registryModel || {};
var statsModel = statsModel || {};
var mapModel = mapModel || {};
var appLookupModel = appLookupModel || {};
var nodeModel = nodeModel || {};
var appUserModel = appUserModel || {};

/* Setup the application scaffolding first  */
require(['bootstrap', 'views/AppView', 'models/AppModel'],
function(Bootstrap, AppView, AppModel) {
	'use strict';  
    		
	// initialize the application
	appModel = new AppModel({context: '/' + metacatContext});
	
	//Check for custom settings in the theme config file
	if(typeof customAppConfig == "function") customAppConfig();
	
	/* Now require the rest of the libraries for the application */
	require(['backbone', 
	         'routers/router', 
	         'collections/SolrResults', 
	         'models/Search', 'models/RegistryModel', 'models/Stats', 'models/Map', 'models/LookupModel', 'models/NodeModel', "models/UserModel"
	         ],
	function(Backbone, UIRouter, SolrResultList, Search, RegistryModel, Stats, MapModel, LookupModel, NodeModel, UserModel) {
		'use strict';  
	    		
		//Create all the other models first
		appSearchResults = new SolrResultList([], {});
		
		appSearchModel = new Search();
		
		registryModel = new RegistryModel();
		
		statsModel = new Stats();
		
		mapModel = new MapModel();
		
		appLookupModel = new LookupModel();
		
		nodeModel = new NodeModel();
		
		appUserModel = new UserModel();
		
		//Load the App View now
		appView = new AppView();
			
		// Initialize routing and start Backbone.history()
		(function() {
		  /**
		   * Backbone.routeNotFound
		   *
		   * Simple plugin that listens for false returns on Backbone.history.loadURL and fires an event
		   * to let the application know that no routes matched.
		   *
		   * @author STRML
		   */
		  var oldLoadUrl = Backbone.History.prototype.loadUrl;

		  _.extend(Backbone.History.prototype, {

		    /**
		     * Override loadUrl & watch return value. Trigger event if no route was matched.
		     * @return {Boolean} True if a route was matched
		     */
		    loadUrl : function() {
		      var matched = oldLoadUrl.apply(this, arguments);
		      if(!matched){
		        this.trigger('routeNotFound', arguments);
		      }
		      return matched;
		    }
		  });
		}).call(this);
		
		//Make the router and begin the Backbone history
		//The router will figure out which view to load first based on window location
		uiRouter = new UIRouter();
		Backbone.history.start();
	  
	});
    	
});


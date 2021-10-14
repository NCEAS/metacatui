/**
 *   MetacatUI
 *   https://github.com/NCEAS/metacatui
 *   MetacatUI is a client-side web interface for querying Metacat servers and other servers that implement the DataONE REST API.
 **/

/**
* @namespace MetacatUI
* @description The global object that contains all of the MetacatUI top-level classes, variables, and functions.
* @type {object}
*/
var MetacatUI = MetacatUI || {};

/**
* This function gets configuration settings from the {@see AppConfig}, such as `root`,
* `theme`, etc. and loads the theme configuration file. When the theme configuration file is
* loaded, the rest of the app is initialized, in {@see MetacatUI.initApp}
*/
MetacatUI.loadTheme = function() {
  //---- Get the MetacatUI root ----/
  // Find out of MetacatUI is deployed in a sub-directory off the top level of
  // the domain. This value is used throughout the app to determin the location
  // of assets and, if not set correctly, a lot of things break. Your web server
  // should also set a FallbackResource directive accordingly in order to support
  // users entering MetacatUI from URLs other than the root
  /**
  * The root path of this MetacatUI deployment. This should point to the `src` directory
  * that was deployed, which contains the `index.html` file for MetacatUI. This root path
  * is used throughout the app to construct URLs to pages, images, etc.
  * @type {string}
  * @default "/metacatui"
  * @readonly
  */
  MetacatUI.root = (typeof MetacatUI.AppConfig.root == "string")? MetacatUI.AppConfig.root : "/metacatui";
  // Remove trailing slash if one is present
  MetacatUI.root = MetacatUI.root.replace(/\/$/, "");

  //Get the loader element from index.html, which was used to configure the app pre-MetacatUI 2.12.0
  //Configurations should go in the AppConfig file, as of MetacatUI 2.12.0
  var loaderEl = document.getElementById("loader");

  /**
  * @name MetacatUI.theme
  * @type {string}
  * @default "default"
  * @readonly
  * @description The theme name for this MetacatUI deployment. This is defined in the {@link AppConfig#theme}.
  * If no theme is defined, the default theme is used.
  */
  //---- Get the theme name ----/
  //Get the the name from the AppConfig file (the recommended way as of MetacatUI 2.12.0)
  if(typeof MetacatUI.AppConfig.theme == "string" && MetacatUI.AppConfig.theme.length > 0){
    MetacatUI.theme = MetacatUI.AppConfig.theme;
  }
  //Get the the name from the index.html file (old way - will be deprecated in the future!)
  else if( loaderEl && typeof loaderEl.getAttribute("data-theme") == "string" ){
    MetacatUI.theme = loaderEl.getAttribute("data-theme");
  }
  //Default to the "default" theme if one isn't specified
  else{
    MetacatUI.theme = "default";
  }

  //---Get the metacat context ---
  // Use the metacat context from the index.html file if it is NOT in the AppConfig. (old way - will be deprecated in the future!)
  // As of MetacatUI 2.12.0, it is recommended to put the metacatContext in the AppConfig file.
  if( loaderEl && typeof loaderEl.getAttribute("data-metacat-context") == "string" &&
      typeof MetacatUI.AppConfig.metacatContext == "undefined" ){
    MetacatUI.AppConfig.metacatContext = loaderEl.getAttribute("data-metacat-context");
  }
  //Add a leading forward slash to the context
  if( MetacatUI.AppConfig.metacatContext && MetacatUI.AppConfig.metacatContext.charAt(0) !== "/" ){
    MetacatUI.AppConfig.metacatContext = "/" + MetacatUI.AppConfig.metacatContext;
  }

  /**
  * @name MetacatUI.mapKey
  * @type {string}
  * @readonly
  * @see {AppConfig#mapKey}
  * @description The Google Maps API key for this MetacatUI deployment. This should be set in the
  * {@see AppConfig} object.
  */
  //---Get the Google Maps API Key---
  //The recommended way to set the Google Maps API Key is in the AppConfig file, as of MetacatUI 2.12.0
  MetacatUI.mapKey = loaderEl? loaderEl.getAttribute("data-map-key") : null;
  if( typeof MetacatUI.mapKey !== "string" || typeof MetacatUI.AppConfig.mapKey == "string" ){
    MetacatUI.mapKey = MetacatUI.AppConfig.mapKey;
    if( (MetacatUI.mapKey == "YOUR-GOOGLE-MAPS-API-KEY") || (!MetacatUI.mapKey) ){
      MetacatUI.mapKey = null;
    }
  }

  //---- Load the theme config file ----
  var script = document.createElement("script");
  script.setAttribute("type", "text/javascript");
  script.setAttribute("src", MetacatUI.root + "/js/themes/" + MetacatUI.theme + "/config.js?v=" + MetacatUI.metacatUIVersion);
  document.getElementsByTagName("body")[0].appendChild(script);

  //When the theme config file is loaded, intialize the application
  script.onload = function(){
    //If this theme has a custom function to start the app, then use it
    if(typeof MetacatUI.customInitApp == "function") {
          MetacatUI.customInitApp();
      }
    //Start the app
    else MetacatUI.initApp();
  }
}

/**
* Loads the RequireJS library and the `app.js` file, which contains all of the RequireJS
* configurations. The appjs is where the bulk of the application initialization happens
* (for example, creating top-level models and views, initializing the application router,
*  and rendering the top-level {@see AppView}).
*/
MetacatUI.initApp = function () {
    var script = document.createElement("script");
    script.setAttribute("data-main", MetacatUI.root + "/js/app.js?v=" + MetacatUI.metacatUIVersion);
    script.src = MetacatUI.root + "/components/require.js";
    document.getElementsByTagName("body")[0].appendChild(script);
}

/**
* @namespace AppConfig
* @description An object that contains the configuration for this MetacatUI application.
  These values are set directly on the AppModel when it is initialized and can be accessed
  from anywhere in the application through the AppModel. (e.g. `MetacatUI.appModel.get("attribute")`` )
* @type {object}
*/
MetacatUI.AppConfig = MetacatUI.AppConfig || {};

//Load the theme files
MetacatUI.loadTheme();

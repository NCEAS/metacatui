// Step 1: Find the data-theme specified in the script include
var theme 		   = document.getElementById("loader").getAttribute("data-theme");
var metacatContext = document.getElementById("loader").getAttribute("data-metacat-context");
var mapKey 		   = document.getElementById("loader").getAttribute("data-map-key");
if ((mapKey == "YOUR-GOOGLE-MAPS-API-KEY") || (!mapKey)) mapKey = null;

// Step 2: let everything else be taken care of by the app
preventCompatibilityIssues();
loadTheme(theme);
loadIcons(theme);
initApp();

function loadTheme(theme) {
    var script = document.createElement("script");
    script.setAttribute("type", "text/javascript");
    script.setAttribute("src", "js/themes/" + theme + "/config.js");
    document.getElementsByTagName("body")[0].appendChild(script);
}
function loadIcons(theme) {
	var url = "./js/themes/" + theme + "/img/favicon-32.png";
    var link = document.createElement("link");
    link.type = "image/png";
    link.rel = "shortcut icon";
    link.href = url;
    document.getElementsByTagName("head")[0].appendChild(link);
}
function initApp() {
    var script = document.createElement("script");
    script.setAttribute("data-main", "js/app.js");
    script.src = "components/require.js";
    document.getElementsByTagName("body")[0].appendChild(script);
}
// Fix compatibility issues with mainly IE 8 and earlier. Do this before the rest of the app loads since even common
// functions are missing, such as console.log
function preventCompatibilityIssues(){	
	/* Add trim() function for IE*/
	if(typeof String.prototype.trim !== 'function') {
		  String.prototype.trim = function() {
		    return this.replace(/^\s+|\s+$/g, ''); 
		  }
	}
	
	/**
	 * Protect window.console method calls, e.g. console is not defined on IE
	 * unless dev tools are open, and IE doesn't define console.debug
	 */
	(function() {
	  if (!window.console) {
	    window.console = {};
	  }
	  // union of Chrome, FF, IE, and Safari console methods
	  var m = [
	    "log", "info", "warn", "error", "debug", "trace", "dir", "group",
	    "groupCollapsed", "groupEnd", "time", "timeEnd", "profile", "profileEnd",
	    "dirxml", "assert", "count", "markTimeline", "timeStamp", "clear"
	  ];
	  // define undefined methods as noops to prevent errors
	  for (var i = 0; i < m.length; i++) {
	    if (!window.console[m[i]]) {
	      window.console[m[i]] = function() {};
	    }    
	  } 
	})();
}
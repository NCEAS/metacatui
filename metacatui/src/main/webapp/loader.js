// Step 1: Find the data-theme specified in the script include
var theme 		   = document.getElementById("loader").getAttribute("data-theme") 			|| "default";
var metacatContext = document.getElementById("loader").getAttribute("data-metacat-context") || "metacat";
var mapKey 		   = document.getElementById("loader").getAttribute("data-map-key") 		|| "";
if (mapKey == "YOUR-GOOGLE-MAPS-API-KEY") mapKey = "";

// Step 2: let everything else be taken care of by the app
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
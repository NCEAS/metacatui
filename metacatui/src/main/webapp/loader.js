// Step 1: Choose the theme here
var theme = "default";
var title = theme.toUpperCase() + " | Data Catalog";

// Step 2: let everything else be taken care of by the app
loadTheme(theme);
loadCss(theme);
loadIcons(theme);
initApp(theme);

function loadTheme(theme) {
    var script = document.createElement("script");
    script.setAttribute("type", "text/javascript");
    script.setAttribute("src", "themes/" + theme + "/config.js");
    document.getElementsByTagName("body")[0].appendChild(script);
    // the title
    if (title) {
	    document.getElementsByTagName("title")[0].innerHTML=title;
    }
}
function loadCss(theme) {
	var url = "./themes/" + theme + "/css/metacatui.css";
    var link = document.createElement("link");
    link.type = "text/css";
    link.rel = "stylesheet";
    link.href = url;
    document.getElementsByTagName("head")[0].appendChild(link);
}
function loadIcons(theme) {
	var url = "./themes/" + theme + "/img/favicon-32.png";
    var link = document.createElement("link");
    link.type = "image/png";
    link.rel = "shortcut icon";
    link.href = url;
    document.getElementsByTagName("head")[0].appendChild(link);
}
function initApp(theme) {
    var script = document.createElement("script");
    script.setAttribute("data-main", "themes/app.js");
    script.src = "components/require.js";
    document.getElementsByTagName("body")[0].appendChild(script);
}
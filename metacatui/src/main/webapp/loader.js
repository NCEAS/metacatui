// Step 1: Choose the theme here
var skin = "default";
var title = skin.toUpperCase() + " | Data Catalog";

// Step 2: let everything else be taken care of by the app
loadSkin(skin);
loadCss(skin);
loadIcons(skin);
initApp(skin);

function loadSkin(skin) {
    var script = document.createElement("script");
    script.setAttribute("type", "text/javascript");
    script.setAttribute("src", "themes/" + skin + "/config.js");
    document.getElementsByTagName("body")[0].appendChild(script);
    // the title
    if (title) {
	    document.getElementsByTagName("title")[0].innerHTML=title;
    }
}
function loadCss(skin) {
	var url = "./themes/" + skin + "/css/metacatui.css";
    var link = document.createElement("link");
    link.type = "text/css";
    link.rel = "stylesheet";
    link.href = url;
    document.getElementsByTagName("head")[0].appendChild(link);
}
function loadIcons(skin) {
	var url = "./themes/" + skin + "/img/favicon-32.png";
    var link = document.createElement("link");
    link.type = "image/png";
    link.rel = "shortcut icon";
    link.href = url;
    document.getElementsByTagName("head")[0].appendChild(link);
}
function initApp(skin) {
    var script = document.createElement("script");
    script.setAttribute("data-main", "themes/app.js");
    script.src = "components/require.js";
    document.getElementsByTagName("body")[0].appendChild(script);
}
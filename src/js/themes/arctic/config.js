MetacatUI.theme = MetacatUI.theme || "arctic";
MetacatUI.themeTitle = "NSF Arctic Data Center";
MetacatUI.themeMap =
{
	'*': {
		// Templates include extension
		'templates/navbar.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/navbar.html',
		'templates/featuredData.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/featuredData.html',
		'templates/footer.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/footer.html',
		'templates/mainContent.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/mainContent.html',
		'templates/altHeader.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/altHeader.html',
		'templates/defaultHeader.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/defaultHeader.html',
		'templates/userProfileMenu.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/userProfileMenu.html',
		'templates/noResults.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/noResults.html',
		'templates/loginButtons.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/loginButtons.html',
		'templates/metadata.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/metadata.html',
		'templates/insertProgress.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/insertProgress.html',
    'templates/editorSubmitMessage.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/editorSubmitMessage.html',
		'models/AppModel' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/models/AppModel.js',
		'models/Map' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/models/Map.js',
		'routers/router' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/routers/router.js'
		}
};

MetacatUI.customMapModelOptions = {
	tileHue: "231"
}

MetacatUI.customAppConfig = function(){
	//Gmaps key: AIzaSyCYoTkUEpMAiOoWx5M61ButwgNGX8fIHUs

	//Check that slaask didn't fail before getting its dependency, Pusher
	/*if(window._slaask){
		//Override _slaask.createScriptTag to use requireJS to load injected module 'Pusher'
	    window._slaask.createScriptTag = function (url) {
	        var t = {};
	        require([url], function(Pusher) {
	        	t.onload();
	        	});
	        return t;
	    };
	}
	*/
	if(MetacatUI.appModel.get("baseUrl").indexOf("arcticdata.io") > -1 &&
	   MetacatUI.appModel.get("baseUrl").indexOf("test") == -1 &&
	   MetacatUI.appModel.get("baseUrl").indexOf("demo") == -1){

		MetacatUI.appModel.set("nodeId", "urn:node:ARCTIC");
		MetacatUI.appModel.set("googleAnalyticsKey", "UA-75482301-1");

	}
}

/*
var customInitApp = function(){
	var slaaskScript = document.createElement("script");
	slaaskScript.setAttribute("type", "text/javascript");
	slaaskScript.setAttribute("src",  "https://cdn.slaask.com/chat.js");
	document.getElementsByTagName("body")[0].appendChild(slaaskScript);

	//Give the slaask script 3 seconds to load or move on without it!
	var slaaskTimeout = window.setTimeout(function(){
		initApp();

		//Don't check again
		window.clearTimeout(slaaskTimeout);
	}, 3000);
}*/

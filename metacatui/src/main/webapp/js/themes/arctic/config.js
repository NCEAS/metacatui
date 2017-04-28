MetacatUI.theme = MetacatUI.theme || "arctic";
MetacatUI.themeTitle = "NSF Arctic Data Center";
MetacatUI.themeMap = 
{
	'*': {
		// Templates include extension
		'templates/app.html' : 'themes/' + MetacatUI.theme + '/templates/app.html',
		'templates/navbar.html' : 'themes/' + MetacatUI.theme + '/templates/navbar.html',
		'templates/featuredData.html' : 'themes/' + MetacatUI.theme + '/templates/featuredData.html',
		'templates/footer.html' : 'themes/' + MetacatUI.theme + '/templates/footer.html',
		'templates/mainContent.html' : 'themes/' + MetacatUI.theme + '/templates/mainContent.html',
		'templates/altHeader.html' : 'themes/' + MetacatUI.theme + '/templates/altHeader.html',
		'templates/defaultHeader.html' : 'themes/' + MetacatUI.theme + '/templates/defaultHeader.html',
		'templates/tools.html' : 'themes/' + MetacatUI.theme + '/templates/tools.html',
		'templates/about.html' : 'themes/' + MetacatUI.theme + '/templates/about.html',
		'templates/userProfileMenu.html' : 'themes/' + MetacatUI.theme + '/templates/userProfileMenu.html',
		'templates/publishDOI.html' : 'themes/' + MetacatUI.theme + '/templates/publishDOI.html',
		'templates/resultsItem.html' : 'themes/' + MetacatUI.theme + '/templates/resultsItem.html',
		'templates/noResults.html' : 'themes/' + MetacatUI.theme + '/templates/noResults.html',
		'templates/loginButtons.html' : 'themes/' + MetacatUI.theme + '/templates/loginButtons.html',
		'templates/metadata.html' : 'themes/' + MetacatUI.theme + '/templates/metadata.html',
		'templates/insertProgress.html' : 'themes/' + MetacatUI.theme + '/templates/insertProgress.html',
		'models/AppModel' : 'js/themes/' + MetacatUI.theme + '/models/AppModel.js',
		'models/Map' : 'js/themes/' + MetacatUI.theme + '/models/Map.js',
		'models/Search' : 'js/themes/' + MetacatUI.theme + '/models/Search.js',
		'routers/router' : 'js/themes/' + MetacatUI.theme + '/routers/router.js'
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
	if(MetacatUI.appModel.get("baseUrl").indexOf("arcticdata.io") > -1 && MetacatUI.appModel.get("baseUrl").indexOf("test") == -1){
		MetacatUI.appModel.set("nodeId", "urn:node:ARCTIC");
		MetacatUI.appModel.set("googleAnalyticsKey", "UA-75482301-1");
	}
}

/*
MetacatUI.customInitApp = function(){
	var slaaskScript = document.createElement("script");
	slaaskScript.setAttribute("type", "text/javascript");
	slaaskScript.setAttribute("src",  "https://cdn.slaask.com/chat.js");
	document.getElementsByTagName("body")[0].appendChild(slaaskScript);
	
	//Give the slaask script 3 seconds to load or move on without it!
	var slaaskTimeout = window.setTimeout(function(){
		MetacatUI.initApp();	
		
		//Don't check again
		window.clearTimeout(slaaskTimeout);
	}, 3000);
}*/
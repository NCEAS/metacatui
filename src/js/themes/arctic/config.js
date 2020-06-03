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

	if(MetacatUI.appModel.get("baseUrl").indexOf("arcticdata.io") > -1 &&
	   MetacatUI.appModel.get("baseUrl").indexOf("test") == -1 &&
	   MetacatUI.appModel.get("baseUrl").indexOf("demo") == -1){

		MetacatUI.appModel.set("nodeId", "urn:node:ARCTIC");
		MetacatUI.appModel.set("googleAnalyticsKey", "UA-75482301-1");

	}
}

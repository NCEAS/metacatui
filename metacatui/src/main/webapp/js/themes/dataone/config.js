var theme = theme || "default";
var themeTitle = "DataONE Data Catalog"; 
var themeMap = 
{
	'*': {
		// example overrides are provided here
		'templates/app.html' : 'themes/' + theme + '/templates/app.html',
		'templates/navbar.html' : 'themes/' + theme + '/templates/navbar.html',
		'templates/footer.html' : 'themes/' + theme + '/templates/footer.html',
		'templates/about.html' : 'themes/' + theme + '/templates/about.html',
		'templates/alert.html' : 'themes/' + theme + '/templates/alert.html',
		'templates/resultsItem.html' : 'themes/' + theme + '/templates/resultsItem.html',
		'templates/noResults.html' : 'themes/' + theme + '/templates/noResults.html',
		'models/AppModel' : 'js/themes/' + theme + '/models/AppModel.js',
		'models/Search' : 'js/themes/' + theme + '/models/Search.js',
		'routers/router' : 'js/themes/' + theme + '/routers/router.js'
		}
};

var customAppConfig = function(){
	//Only apply these settings when we are in production
	if(!appModel || (appModel.get("d1CNBaseUrl").indexOf("cn.dataone.org") < 0)) return;

	appModel.set("googleAnalyticsKey", "UA-15017327-17");
}
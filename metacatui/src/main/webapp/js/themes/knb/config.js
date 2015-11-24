var theme = theme || "knb";
var themeTitle = "KNB | The Knowledge Network";
var themeMap = 
{
	'*': {
		// Template overrides are provided here
		
		// Resources (js) omit extension
		//'views/AboutView' : 'themes/' + theme + '/views/AboutView',
		//'routers/router' : 'themes/' + theme + '/routers/router',
		
		// Templates include extension
		'templates/app.html' : 'themes/' + theme + '/templates/app.html',
		'templates/navbar.html' : 'themes/' + theme + '/templates/navbar.html',
		'templates/featuredData.html' : 'themes/' + theme + '/templates/featuredData.html',
		'templates/footer.html' : 'themes/' + theme + '/templates/footer.html',
		'templates/mainContent.html' : 'themes/' + theme + '/templates/mainContent.html',
		'templates/altHeader.html' : 'themes/' + theme + '/templates/altHeader.html',
		'templates/defaultHeader.html' : 'themes/' + theme + '/templates/defaultHeader.html',
		'templates/tools.html' : 'themes/' + theme + '/templates/tools.html',
		'templates/about.html' : 'themes/' + theme + '/templates/about.html'
		}
};

var customAppConfig = function(){
	//Only apply these settings when we are in production
	if(!appModel || (appModel.get("baseUrl").indexOf("knb.ecoinformatics.org") < 0)) return;

	appModel.set("nodeId", "urn:node:KNB");
	appModel.set("googleAnalyticsKey", "UA-1588494-14");
}
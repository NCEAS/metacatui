MetacatUI.theme = MetacatUI.theme || "knb";
MetacatUI.themeTitle = "KNB | The Knowledge Network";
MetacatUI.themeMap = 
{
	'*': {
		// Template overrides are provided here
		
		// Resources (js) omit extension
		//'views/AboutView' : 'MetacatUI.themes/' + theme + '/views/AboutView',
		//'routers/router' : 'themes/' + MetacatUI.theme + '/routers/router',
		
		// Templates include extension
		'templates/app.html' : 'themes/' + MetacatUI.theme + '/templates/app.html',
		'templates/navbar.html' : 'themes/' + MetacatUI.theme + '/templates/navbar.html',
		'templates/featuredData.html' : 'themes/' + MetacatUI.theme + '/templates/featuredData.html',
		'templates/footer.html' : 'themes/' + MetacatUI.theme + '/templates/footer.html',
		'templates/mainContent.html' : 'themes/' + MetacatUI.theme + '/templates/mainContent.html',
		'templates/altHeader.html' : 'themes/' + MetacatUI.theme + '/templates/altHeader.html',
		'templates/defaultHeader.html' : 'themes/' + MetacatUI.theme + '/templates/defaultHeader.html',
		'templates/tools.html' : 'themes/' + MetacatUI.theme + '/templates/tools.html',
		'templates/about.html' : 'themes/' + MetacatUI.theme + '/templates/about.html'
		}
};

MetacatUI.customAppConfig = function(){
	//Only apply these settings when we are in production
	if(! MetacatUI.appModel || (MetacatUI.appModel.get("baseUrl").indexOf("knb.ecoinformatics.org") < 0)) return;

	//Gmaps key  AIzaSyA6-jiEs5rmEqKk70bigvnwuvhdZbt4tJs
	
	MetacatUI.appModel.set("nodeId", "urn:node:KNB");
	MetacatUI.appModel.set("googleAnalyticsKey", "UA-1588494-14");
}
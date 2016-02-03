var theme = theme || "arctica";
var themeTitle = "Arctica: Data and Software about the Arctic";
var themeMap = 
{
	'*': {
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

var customMapModelOptions = {
	tileHue: "231"
}

var customAppConfig = function(){
	//Only apply these settings when we are in production
	

}
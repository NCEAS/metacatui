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
		'templates/about.html' : 'themes/' + theme + '/templates/about.html',
		'templates/userProfileMenu.html' : 'themes/' + theme + '/templates/userProfileMenu.html',
		'models/AppModel' : 'js/themes/' + theme + '/models/AppModel.js',
		'routers/router' : 'js/themes/' + theme + '/routers/router.js'
		}
};

var customMapModelOptions = {
	tileHue: "231"
}

var customAppConfig = function(){	
	//Gmaps key: AIzaSyCYoTkUEpMAiOoWx5M61ButwgNGX8fIHUs
	
	//Check that slaask didn't fail before getting its dependency, Pusher
	if(window._slaask){
		//Override _slaask.createScriptTag to use requireJS to load injected module 'Pusher'
	    window._slaask.createScriptTag = function (url) {
	        var t = {};
	        require([url], function(Pusher) { 
	        	t.onload(); 
	        	});
	        return t;
	    };
	}
}

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
}
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
	//Only apply these settings when we are in production	
	//Gmaps key: AIzaSyCYoTkUEpMAiOoWx5M61ButwgNGX8fIHUs
}

//Load the Slaask Chat widget here since it does not work with RequireJS
//Taken from https://gist.github.com/sbilodeau/29c8016b67485614944e
var loadSlaask = function(){
	var slaaskScript = document.createElement("script");
	slaaskScript.setAttribute("type", "text/javascript");
	slaaskScript.setAttribute("src",  "https://cdn.slaask.com/chat.js");
	document.getElementsByTagName("body")[0].appendChild(slaaskScript);

	slaaskScript.onload = function(){
		//Override _slaask.createScriptTag to use requireJS to load injected module 'Pusher'
	    window._slaask.createScriptTag = function (url) {
	    	console.log('chat.js loaded');
	        var t = {};
	        require([url], function() { 
	        	console.log('pusher loaded');
	        	t.onload(); 
	        	
	        	});
	        return t;
	    };
	    
	    if(window.location.hostname == "arcticdata.io")
	    	_slaask.init("ea2a2170250e8b9f9c98da3df4f0f15b");
	    else
	    	_slaask.init('XXXX'); //Use your own widget key	for development	
	}
}();
MetacatUI Themes
-----------------
All the default models, collections, views, routers, and templates required to run a default 
Metacat UI are in the 'js/' directory.
The "default" theme is included in the 'js/themes/' directory and is used to style the default 
resources with CSS and images.

Additional themes (e.g., "knb") provide alternative resources for 
items that will override the default theme. Each theme is a subdirectory in 'js/themes'
named to match the theme name and mimics the structure of the default resources in 'js/'.

To switch themes:
-Edit the top-level 'loader.js' file and specify the name of the theme to use.
That's it!

Required items for a theme:
	'js/themes/<theme>/config.js'
	'js/themes/<theme>/css/metacatui.css'

About CSS:
Each theme uses a 'js/themes/<theme>/css/metacatui.css' file that is pulled in during the initial
application loading. A copy of the default can be used and modified as needed.

To override html templates (or any other resource, like a Model or View):
-Copy the resource into the same child location, but in the new theme subdirectory.
-Edit that resource as needed.
-Add an entry to the theme's config.js file specifying that new resource.

Example (using navbar):
-Copy 'js/templates/navbar.html' to 'js/themes/<theme>/templates/navbar.html'
-Edit 'js/themes/<theme>/config.js' to include:
	'templates/navbar.html' : 'themes/' + MetacatUI.theme + '/templates/navbar.html',
	
## Configuring MetacatUI

### Setting a default access policy for uploads
In the `AppModel.js`, set the default access policy via the `defaultAccessPolicy` attribute. The default access policy is an array of literal objects 
with the following attributes:
`subject`, `read`, `write`, and `changePermission`.

The values of these attributes will be serialized to the system metadata of each object uploaded via the MetacatUI editor.
Example access policy that makes all objects publicly readable:
```Javascript
[{
	subject: "public",
	read: true,
	write: false,
	changePermission: false
}]
```

This access policy will be serialized into the system metadata as:
```xml
	<accessPolicy>
		<allow>
			<subject>public</subject>
			<permission>read</permission>
		</allow>
	</accessPolicy>
```
	
	

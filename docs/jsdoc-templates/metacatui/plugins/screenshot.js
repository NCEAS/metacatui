/*
* Screenshot JSDoc plugin
* This is a simple JSDoc plugin that inserts images into the JSDoc HTML files.
* This plugin creates a new tag, named @screenshot, whose value is an absolute or relative
*  URL to an image file. Although the image contents don't need to be of a screenshot,
*  the tag name (@screenshot) was chosen to provide context tto the image contents
*  when looking at the code itself.
*
* ----- To use -----
* Step 1. Add this screenshot.js file as a plugin to your JSDoc configuration, and specify a
* directory where your screenshot images will be stored.
*
* JSDoc config file snippet:
*   "plugins": ["jsdoc-plugins/screenshot"],
*  "screenshot": {
*    "dir": "../screenshots"
*  }
*
* Step 2. Add the following code to your JSDoc template(s) to show the screenshot image.
* <?js if (doc.screenshot) { ?>
*    <div class="screenshot">
*      <h3>Screenshot</h3>
*      <img src="<?js= doc.screenshot ?>" />
*    </div>
* <?js } ?>
*
* Step 3. Use the new @screenshot tag in your JSDoc comments.
* Example @screenshot tags:
* @screenshot MyView.png
* @screenshot https://my-site.com/MyView.png
*
* Author: Lauren Walker https://github.com/laurenwalker
* @todo: Create a template partial for the screenshot image
* @todo: Externalize this documentation
*/

exports.defineTags = function(dictionary) {
  /* Define the @screenshot tag */
  dictionary.defineTag('screenshot', {
      canHaveType: false,
      canHaveName: false,
      isNamespace: false,
      mustHaveValue: true,
      mustNotHaveDescription: false,
      onTagged: function(doclet, tag){

        var imageURL = "";

        //Relative links will use the "screenshot.dir" attribute from the JSDoc configuration file.
        if(env.conf.screenshot && env.conf.screenshot.dir && tag.value.substring(0,4) != "http"){
          imageURL = env.conf.screenshot.dir + "/" + tag.value;
        }
        //Use the tag value as-is if it starts with "http" (absolute URL), or if there is no screenshot directory configured
        else{
          imageURL = tag.value;
        }

        doclet.screenshot = imageURL;
      }
  });
};

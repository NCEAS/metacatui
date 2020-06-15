/* ==== SHOWDOWN IMAGES ==== */
/*  this is an extension for showdown, a markdown to html converter.
    This extension makes HTML images for all markdown images. When an image is
    referenced via identifier, a URL is constructed from the DataONE Object API
*/

define(['showdown'], function (showdown) {

    return showdown.extension('showdown-images', function() {

        var extension = {
          type: "lang",
          filter: function filter(markdown) {

            //Create a regular expression that matches all markdown images
            var imgRegEx = /!\[.*\]\(\S+\)/g;

            //Replace each markdown image with an HTML image
            var newMarkdown = markdown.replace(imgRegEx, function(imgMarkdown){

              //Create a regular expression that retrieves the URL of the image
              var imgURLRegExp = /\(.*\)/;
              var imgURL = imgMarkdown.match(imgURLRegExp);

              //If no image URL is found, return the markdown as is
              if(!imgURL || !imgURL.length || !imgURL[0]){
                return imgMarkdown;
              }

              //Get the substring between the parenthesis which is the URL or identifier only
              imgURL = imgURL[0].substring(1, imgURL[0].length-1);

              //If the image URL doesn't start with 'http', then assume this is an image
              // identifier and make a URL with the DataONE object API
              if( !imgURL.indexOf("http") == 0 ){
                // Use the resolve service if there is no object service url
                // (e.g. in DataONE theme)
                var urlBase = MetacatUI.appModel.get("objectServiceUrl") ||
                  MetacatUI.appModel.get("resolveServiceUrl");
                imgURL = urlBase + encodeURIComponent(imgURL);
              }

              //Create a regular expression that retrieves the name of the image
              var imgNameRegExp = /\[.*\]/;
              var imgName = imgMarkdown.match(imgNameRegExp);

              //If no image name is found, just use a blank string
              if(!imgName || !imgName.length || !imgName[0]){
                imgName = "";
              }
              else{
                //Get the substring between the brackets which is the name only
                imgName = imgName[0].substring(1, imgName[0].length-1);
              }

              return '<img src="' + imgURL + '" alt="' + imgName + '" />'
            });

            return newMarkdown;
          }
        }

        return [extension];

    });

});

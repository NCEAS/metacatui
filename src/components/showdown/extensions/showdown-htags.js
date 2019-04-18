/* ==== SHOWDOWN H-TAGS ==== */
/*  this is an extension for showdown, a markdown to html converter.                  */
/*  This extension decreases <h> tags by one level (.e.g. <h1> --> <h2>) */

define(['showdown'], function (showdown) {

    return showdown.extension('showdown-htags', function() {

        // headerMap defines where to inject which bootstrap classes
        // htmlElement: bootstrap class to add
        var headerMap = {
            // list must go in descending order, or all h tags converted to h6
            h5: 'h6',
            h4: 'h5',
            h3: 'h4',
            h2: 'h3',
            h1: 'h2'
            // h6 stays as 'h6'
        };

        var extensions = Object.keys(headerMap).map(key => ({
            type: 'output',
            regex: new RegExp(`<(\/?)${key}(.*?)>`, 'g'),
            replace: `<$1${headerMap[key]}$2>`
        }));

        return extensions;

    });

});

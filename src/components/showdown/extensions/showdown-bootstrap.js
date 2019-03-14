/* ==== SHOWDOWN BOOTSTRAP ==== */
/*  this is an extension for showdown, a markdown to html converter.                  */
/*  This extension injects Bootstrap 2.3.2 classes into the appropriate HTML elements */

define(['showdown'], function (showdown) {

    return showdown.extension('bootstrap', function() {

        // bootstrapMap defines where to inject which bootstrap classes
        // htmlElement: bootstrap class to add
        var bootstrapMap = {
            table: 'table table-hover',
            // TODO: what other bootstrap classes to inject?
        };

        var extensions = Object.keys(bootstrapMap).map(key => ({
            type: 'output',
            regex: new RegExp(`<${key}(.*)>`, 'g'),
            replace: `<${key} class="${bootstrapMap[key]}" $1>`
        }));

        return extensions;

    });

});

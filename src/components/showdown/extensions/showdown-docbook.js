/* ==== SHOWDOWN DOCBOOK ==== */
/*      this is an extension for showdown, a markdown to html converter.             */
/*      This extension converts the docbook tags that are allowed in EML to HTML     */

define(['showdown'], function (showdown) {

    showdown.extension('docbook', function() {

        // docbookMap defines how to translate docbook tags to html tags
        // docbooktag: htmltag

        var docbookMap = {

            title: 'h2', // or h1, or h3 ...
            citetitle: 'em',
            emphasis: 'em', // or strong?
            para: 'p',
            'ulink url': 'a href',
            ulink: 'a',

            literallayout: 'pre',

            itemizedlist: 'ul',
            orderedlist: 'ol',
            listitem: 'li',

            subscript: 'sub',
            superscript: 'sup'

            // the docbook "section" tag is not included, since this is already an HTML tag
        };

        var extensions = Object.keys(docbookMap).map(key => ({
                type: "lang",
                regex: new RegExp(`<(\/?)${key}(.*?)>`, 'g'),
                replace: `<$1${docbookMap[key]}$2>`
        }));

        return extensions;

    });

});

/* === SHOWDOWN HIGHLIGHT === */
/*  this is an extension for showdown, a markdown to html converter.                */
/*  this extension adds syntax highlighting using highlightJS (a dependency)        */
/*  from: https://github.com/showdownjs/showdown/issues/215#issuecomment-168679324  */

define(['showdown', 'highlight'], function (showdown, hljs) {

    return showdown.extension('highlight', function() {
        var htmlunencode = function (text) {
            return (
                text
                  .replace(/&amp;/g, '&')
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                );
        };

        var extension = {
            type: 'output',
            filter: function (text, converter, options) {
                // use showdown's regexp engine to conditionally parse codeblocks
                var left  = '<pre><code\\b[^>]*>',
                    right = '</code></pre>',
                    flags = 'g',
                    replacement = function (wholeMatch, match, left, right) {
                        // unescape match to prevent double escaping
                        match = htmlunencode(match);
                        return left + hljs.highlightAuto(match).value + right;
                    };
                return showdown.helper.replaceRecursiveRegExp(text, replacement, left, right, flags);
            }
        };

        return [ extension ];

    })

});

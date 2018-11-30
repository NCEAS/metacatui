/* === SHOWDOWN FOOTNOTES === */
/*  this is an extension for showdown, a markdown to html converter.    */
/*  this extension converts markdown style footnotes into HTML          */
/*  adapted from https://github.com/Kriegslustig/showdown-footnotes     */

define(['showdown'], function (showdown) {

    var converter = new showdown.Converter();

    return showdown.extension('footnotes', function() {

        var extension1 = {
            type: 'lang',
            filter: function filter(text) {
                    return text.replace(/^\[\^([\d\w]+)\]:\s*((\n+(\s{2,4}|\t).+)+)$/mg, function (str, name, rawContent, _, padding) {
                        var content = converter.makeHtml(rawContent.replace(new RegExp('^' + padding, 'gm'), ''));
                        return '<div class="footnote" id="footnote-' + name + '"><a href="#footnote-' + name + '"><sup>[' + name + ']</sup></a>:' + content + '</div>';
                    });
                }
            };

        var extension2 = {
            type: 'lang',
            filter: function filter(text) {
                    return text.replace(/^\[\^([\d\w]+)\]:( |\n)((.+\n)*.+)$/mg, function (str, name, _, content) {
                        return '<small class="footnote" id="footnote-' + name + '"><a href="#footnote-' + name + '"><sup>[' + name + ']</sup></a>: ' + content + '</small>';
                    });
                }
            };

        var extension3 = {
            type: 'lang',
            filter: function filter(text) {
                return text.replace(/\[\^([\d\w]+)\]/m, function (str, name) {
                    return '<a href="#footnote-' + name + '"><sup>[' + name + ']</sup></a>';
                });
            }
        };

        return [ extension1, extension2, extension3 ];

    });

});

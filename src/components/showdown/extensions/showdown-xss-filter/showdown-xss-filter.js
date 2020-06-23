/*
 *  Modified from:
 *  Showdown XSS Filter extension
 *  https://github.com/VisionistInc/showdown-xss-filter
 *  2015, Visionist, Inc.
 */
define(['showdown', 'xss'], function (showdown, xss) {

        return showdown.extension('xssfilter', function() {

            // custom rules
            var options = {
                css: false,
                allowList: {
                    a: ["target", "href", "title", "class", "target"],
                    abbr: ["title"],
                    address: [],
                    area: ["shape", "coords", "href", "alt"],
                    article: [],
                    aside: [],
                    audio: ["autoplay", "controls", "loop", "preload", "src"],
                    b: [],
                    bdi: ["dir"],
                    bdo: ["dir"],
                    big: [],
                    blockquote: ["cite"],
                    br: [],
                    caption: [],
                    center: [],
                    cite: [],
                    code: [],
                    col: ["align", "valign", "span", "width"],
                    colgroup: ["align", "valign", "span", "width"],
                    dd: [],
                    del: ["datetime"],
                    details: ["open"],
                    div: [],
                    dl: [],
                    dt: [],
                    em: [],
                    font: ["color", "size", "face"],
                    footer: [],
                    h1: ["id"],
                    h2: ["id"],
                    h3: ["id"],
                    h4: ["id"],
                    h5: ["id"],
                    h6: ["id"],
                    header: [],
                    hr: [],
                    i: [],
                    img: ["src", "alt", "title", "width", "height"],
                    input: ["type", "style", "disabled", "checked"],
                    ins: ["datetime"],
                    li: ["class", "style"],
                    mark: [],
                    nav: [],
                    ol: [],
                    p: [],
                    pre: [],
                    s: [],
                    section: [],
                    small: [],
                    span: [],
                    sub: [],
                    sup: [],
                    strong: [],
                    table: ["width", "border", "align", "valign"],
                    tbody: ["align", "valign", "style"],
                    td: ["width", "rowspan", "colspan", "align", "valign", "style"],
                    tfoot: ["align", "valign"],
                    th: ["width", "rowspan", "colspan", "align", "valign", "style"],
                    thead: ["align", "valign"],
                    tr: ["rowspan", "align", "valign"],
                    tt: [],
                    u: [],
                    ul: [],
                    video: ["autoplay", "controls", "loop", "preload", "src", "height", "width"]
                }
            };

            //myxss = new xss.FilterXSS(options);

            var extensions = {
                  type: "output",
                  filter: function(text) {
                    return xss(text, options);
                  }
                };

            return extensions;

        });

});

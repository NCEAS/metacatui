/*
 *  Modified from:
 *  Showdown XSS Filter extension
 *  https://github.com/VisionistInc/showdown-xss-filter
 *  2015, Visionist, Inc.
 */
define(['showdown', 'xss'], function (showdown, xss) {

  return showdown.extension('xssfilter', function () {

    // custom rules
    var options = {
      css: false,
      allowList: {
        iframe: ["src", "width", "height", "frameborder", "allowfullscreen"],
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
        circle: ["cx", "cy", "r", "mask"],
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
        ellipse: ["cx", "cy", "rx", "ry", "mask"],
        font: ["color", "size", "face"],
        footer: [],
        g: ["mask"],
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
        line: ["x1", "x2", "y1", "y2", "mask"],
        mark: [],
        mask: ["id"],
        nav: [],
        ol: [],
        p: [],
        path: ["d", "mask"],
        polygon: ["points", "mask"],
        polyline: ["points", "mask"],
        pre: [],
        rect: ["x", "y", "width", "height", "rx", "ry", "mask"],
        s: [],
        section: [],
        small: [],
        span: [],
        sub: [],
        sup: [],
        strong: [],
        summary: [],
        svg: ["viewbox", "xmlns", "preserveAspectRatio"],
        table: ["width", "border", "align", "valign"],
        tbody: ["align", "valign", "style"],
        td: ["width", "rowspan", "colspan", "align", "valign", "style"],
        text: ["x", "y", "dx", "dy", "rotate", "lengthAdjust", "textLength", "mask"],
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
      filter: function (text) {
        return xss(text, options);
      }
    };

    return extensions;

  });

});

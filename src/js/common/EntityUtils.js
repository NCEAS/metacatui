define(["jquery"], function ($) {
  return {
    /**
     * Read the first part of a file
     *
     * @param {File} file - A reference to a file
     * @param {Backbone.View} context - The View to bind `callback` to
     * @param {function} callback - A function to run after the read is
     *   complete. The function is bound to `context`.
     * @param {number} bytes - The number of bytes to read from the start of the
     *   file
     */
    readSlice: function (file, context, callback, bytes = 1024) {
      if (typeof callback !== "function") {
        return;
      }

      var reader = new FileReader(),
        blob = file.slice(0, bytes);

      reader.onloadend = callback.bind(context);
      reader.readAsBinaryString(blob);
    },
    /**
     * Attempt to parse the header/column names from a chunk of a CSV file
     *
     * Doesn't handle:
     * - UTF BOM (garbles first col name)
     * - Commas inside quoted headers
     *
     * @param {string} text - A chunk of a file
     * @return {Array} A list of names
     */
    tryParseCSVHeader: function (text) {
      // The order is important here
      var strategies = ["\r\\n", "\r", "\n"];

      var index = -1;

      for (var i = 1; i < strategies.length; i++) {
        var result = text.indexOf(strategies[i]);

        if (result >= 0) {
          index = result;

          break;
        }
      }

      if (index === -1) {
        return [];
      }

      var header_line = text.slice(0, index);
      var names = header_line.split(",");

      // Remove surrounding parens and double-quotes
      names = names.map(function(name) {
        return name.replaceAll(/^["']|["']$/gm, "");
      });

      // Filter out zero-length values (headers like a,b,c,,,,,)
      names = names.filter(function(name) {
        return name.length > 0;
      });

      return names;
    }
  };
});

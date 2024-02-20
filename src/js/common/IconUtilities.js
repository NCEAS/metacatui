/*global define */
define([
  "models/portals/PortalImage",
  "showdown",
  "showdownXssFilter"
],
	function(PortalImage, showdown, showdownXss) {
	'use strict';

	/**
  * @namespace IconUtilities
  * @description A generic utility object that contains functions used throughout
  * MetacatUI to perform useful functions related to icons, but not used to store or
  * manipulate any state about the application.
  * @type {object}
  //  TODO: yvonneshi - update
  * @since x.x.x
  */
	const IconUtilities = /** @lends IconUtilities.prototype */ {

    /**
     * Simple test to see if a string is an SVG
     * @param {string} str The string to check
     * @returns {Boolean} Returns true if the string starts with `<svg` and ends with
     * `</svg>`, regardless of case
     */
    isSVG(str) {
      const strLower = str.toLowerCase();
      return strLower.startsWith("<svg") && strLower.endsWith("</svg>");
    },

    /**
     * Fetches an SVG given a pid, sanitizes it, then returns the SVG string (after
     * sanitizing it).
     * @param {string} pid
     * @returns {string} The icon data.
     */
    fetchIcon(pid) {
      try {
        // Use the portal image model to get the correct baseURL for an image
        const imageURL = new PortalImage({
          identifier: pid,
        }).get("imageURL");

        fetch(imageURL)
          .then(response => response.text())
          .then(data => {
            if (this.isSVG(data)) {
              return data;
            }
          });
      } catch (error) {
        console.log(
          "Failed to fetch an icon. Error details: " + error
        );
      }
    },

    /**
     * Takes an SVG string and returns it with only the allowed tags and attributes
     * @param {string} icon The SVG icon string to sanitize
     * @param {function} callback Function to call once the icon has been sanitized.
     * Will pass the sanitized icon string.
     */
    sanitizeIcon(icon, callback) {
      try {
        const converter = new showdown.Converter({
          extensions: ["xssfilter"],
        });
        let sanitizedIcon = converter.makeHtml(icon);
        // Remove the <p></p> tags that showdown wraps the string in
        sanitizedIcon = sanitizedIcon.replace(/^(<p>)/, "");
        sanitizedIcon = sanitizedIcon.replace(/(<\/p>)$/, "");
        // Call the callback
        if (callback && typeof callback === "function") {
          callback(sanitizedIcon);
        }
      } catch (error) {
        console.log(
          "There was an error sanitizing an SVG icon. Error details: " + error
        );
      }
    },
  }

  return IconUtilities;
});

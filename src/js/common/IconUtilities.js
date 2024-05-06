/*global define */
define([
  "models/portals/PortalImage",
  "showdown",
  "showdownXssFilter"
],
	function(PortalImage, showdown, showdownXss) {
	'use strict';

  // The start of a base64 encoded SVG string
  const B64_START = 'data:image/svg+xml;base64,';

	/**
  * @namespace IconUtilities
  * @description A generic utility object that contains functions used throughout
  * MetacatUI to perform useful functions related to icons, but not used to store or
  * manipulate any state about the application.
  * @type {object}
  * @since 2.28.0
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
      // Use the portal image model to get the correct baseURL for an image
      const imageURL = new PortalImage({
        identifier: pid,
      }).get("imageURL");

      return fetch(imageURL)
        .then(response => response.text())
        .then(data => {
          if (this.isSVG(data)) {
            return data;
          }
        });
    },

    /**
     * Takes an SVG string and returns it with only the allowed tags and attributes
     * @param {string} icon The SVG icon string to sanitize
     * @returns {string} Sanitized icon string.
     */
    sanitizeIcon(icon, callback) {
      const converter = new showdown.Converter({
        extensions: ["xssfilter"],
      });
      let sanitizedIcon = converter.makeHtml(icon);
      // Remove the <p></p> tags that showdown wraps the string in
      sanitizedIcon = sanitizedIcon.replace(P_TAG_START, "");
      sanitizedIcon = sanitizedIcon.replace(P_TAG_END, "");

      return sanitizedIcon;
    },

    /**
     * Converts an SVG icon string into an SVG element suitable for use
     * as an image in a Cesium billboard. This function enhances the SVG by
     * applying optional stroke properties and ensures the viewBox is adjusted
     * to accommodate the stroke. It is designed in particular to work with
     * Font Awesome 6 solid icons, but may work with other SVGs as well.
     * @param {string} svgString - The SVG markup as a string.
     * @param {number} [strokeWidth=0] - The stroke width to apply to the SVG (in pixels).
     * @param {string} [strokeColor="white"] - The stroke color.
     * @returns {SVGElement|null} - The modified SVG element or null if an error occurs.
     * @since x.x.x
     */
    formatSvgForCesiumBillboard(svgString, strokeWidth = 0, strokeColor = "white") {
      const svgElement = this.parseSvg(svgString);
      if (!svgElement) {
        console.error("No SVG element found in the SVG string or failed to parse.");
        return null;
      }
  
      this.removeCommentNodes(svgElement);
      this.setStrokeProperties(svgElement, strokeWidth, strokeColor);
      this.adjustViewBox(svgElement, strokeWidth);
  
      return svgElement;
    },
    
    /**
     * Parses an SVG string and returns the SVG element.
     * @param {string} svgString - The SVG markup as a string.
     * @returns {SVGElement} - The SVG element.
     * @since x.x.x
     */
    parseSvg(svgString) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, "image/svg+xml");
      const svgElement = doc.querySelector("svg");
      return svgElement;
    },
    
    /**
     * Removes comment nodes from an SVG element.
     * @param {SVGElement} svgElement - The SVG element.
     * @since x.x.x
     */
    removeCommentNodes(svgElement) {
      while (svgElement.firstChild && svgElement.firstChild.nodeType === Node.COMMENT_NODE) {
        svgElement.removeChild(svgElement.firstChild);
      }
    },
    
    /**
     * Sets stroke properties on an SVG element.
     * @param {SVGElement} svgElement - The SVG element.
     * @param {number} strokeWidth - The stroke width to apply to the SVG (in pixels).
     * @param {string} strokeColor - The stroke color as a CSS color value.
     * @since x.x.x
     */
    setStrokeProperties(svgElement, strokeWidth, strokeColor) {
      svgElement.setAttribute("stroke-width", strokeWidth);
      svgElement.setAttribute("stroke", strokeColor);
    },
    
    /**
     * Adjusts the viewBox of an SVG element to accommodate a stroke width.
     * @param {SVGElement} svgElement - The SVG element.
     * @param {number} strokeWidth - The stroke width applied to the SVG (in pixels).
     * @since x.x.x
     */
    adjustViewBox(svgElement, strokeWidth) {
      const viewBox = svgElement.getAttribute("viewBox");
      if (viewBox) {
        const [x, y, width, height] = viewBox.split(" ").map(parseFloat);
        const newX = x - strokeWidth;
        const newY = y - strokeWidth;
        const newWidth = width + 2 * strokeWidth;
        const newHeight = height + 2 * strokeWidth;
        svgElement.setAttribute("viewBox", `${newX} ${newY} ${newWidth} ${newHeight}`);
      } else {
        console.warn("SVG element does not have a 'viewBox' attribute; viewBox adjustment skipped.");
      }
    },

    /**
     * Takes a SVG element and converts it to a base64 encoded string
     * that can be used as a data URI in an image tag.
     * @param {SVGElement} svgElement - The SVG element to convert.
     * @returns {string} - The base64 encoded SVG string.
     * @since x.x.x
     */
    svgToBase64(svgElement) {
      const base64 = btoa(svgElement.outerHTML);
      return B64_START + base64;
    }

  }

  return IconUtilities;
});

const P_TAG_START = /^(<p>)/;
const P_TAG_END = /(<\/p>)$/;

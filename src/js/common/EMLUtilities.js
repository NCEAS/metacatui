"use strict";

define(["common/XMLUtilities"], (XMLUtilities) => {
  /**
   * @namespace EMLUtilities
   * @description A generic utility object that contains functions used
   * throughout MetacatUI to perform useful functions related to EML, but not
   * used to store or manipulate any state about the application.
   * @type {object}
   * @since 2.34.0
   */
  const EMLUtilities = /** @lends EMLUtilities.prototype */ {
    /**
     * Validate a year with four digits or a YYYY-MM-DD calendar date.
     * @param {string} dateString Date text to check
     * @returns {boolean} True if the format and calendar date are valid
     * @since 2.41.0
     */
    isDateFormatValid(dateString) {
      if (/^\d{4}$/.test(dateString)) return true;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;

      const [year, month, day] = dateString.split("-").map(Number);
      if (month < 1 || month > 12 || day < 1) return false;

      if (month === 2) {
        const leapYear =
          year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
        return day <= (leapYear ? 29 : 28);
      }
      return day <= ([4, 6, 9, 11].includes(month) ? 30 : 31);
    },

    /**
     * Parse an EML xs:time value without rounding fractional seconds or
     * assuming a time zone when none is given.
     * @param {string} time HH:MM:SS with optional fractional seconds and Z or
     * a signed HH:MM offset. Surrounding whitespace is trimmed before parsing
     * @returns {{seconds: number, fraction: string, offset: number|null}|null}
     * Parsed time, or null for an invalid value. seconds counts whole seconds
     * from midnight (86400 for 24:00:00); fraction contains the digits after the
     * decimal point, or ""; offset is seconds ahead of UTC, or null if no time
     * zone is given
     * @see https://eml.ecoinformatics.org/schema/eml-coverage_xsd
     * @see https://www.w3.org/TR/xmlschema-2/#time
     * @since 2.41.0
     */
    parseTime(time) {
      // Match the whole HH:MM:SS value, with optional .fraction and optional
      // Z or ±HH:MM offset. Clock hours allow 00-24, offset hours allow 00-14,
      // and minutes/seconds allow 00-59. Check the special 24/14 rules below.
      const match = time
        .trim()
        .match(
          /^([01]\d|2[0-4]):([0-5]\d):([0-5]\d)(?:\.(\d+))?(Z|([+-])(0\d|1[0-4]):([0-5]\d))?$/,
        );
      if (!match) return null;

      const [
        ,
        hours,
        minutes,
        seconds,
        fraction = "",
        zone,
        sign,
        offHours,
        offMinutes,
      ] = match;
      // XML Schema allows hour 24 and offset hour 14 only when the remaining
      // components are zero; the regex alone does not enforce these limits.
      if (
        (hours === "24" &&
          (minutes !== "00" || seconds !== "00" || /[1-9]/.test(fraction))) ||
        (offHours === "14" && offMinutes !== "00")
      ) {
        return null;
      }

      let offset = null;
      if (zone === "Z") offset = 0;
      else if (zone) {
        offset = (sign === "-" ? -1 : 1) * (offHours * 3600 + offMinutes * 60);
      }

      return {
        seconds: hours * 3600 + minutes * 60 + Number(seconds),
        fraction,
        offset,
      };
    },

    /**
     * Clean text so it can be safely serialized into EML XML.
     * @param {*} value Candidate text value.
     * @returns {*} Cleaned text, or the original non-string value.
     * @since 2.39.0
     */
    cleanXMLText(value) {
      if (typeof value !== "string") return value;

      const text = value
        .trim()
        .replace(/<\s*[^>]*>/g, (xmlNode) =>
          xmlNode.replace(/>/g, "&gt;").replace(/</g, "&lt;"),
        );
      return XMLUtilities.removeInvalidXmlCharacters(text);
    },

    /**
     * Climbs up the model hierarchy until it finds the EML model
     * @param {Backbone.Model} model - The starting model
     * @param {number} [maxTries] - The maximum number of levels to climb
     * @returns {EML211|false} - Returns the EML 211 Model or null if not found
     */
    getParentEML(model, maxTries = 6) {
      let emlModel = model.get("parentModel");
      let tries = 0;

      while (emlModel && emlModel.type !== "EML" && tries < maxTries) {
        emlModel = emlModel.get("parentModel");
        tries += 1;
      }

      return emlModel && emlModel.type === "EML" ? emlModel : false;
    },

    /**
     * Serialize a DOM element to a string, removing the XML declaration and any
     * namespace declarations. Namespaces are added to the elements because the
     * codebase currently combines older ways of handling XML (using jQuery's
     * parseHTML and document.createElement) with newer ways (using DOMParser).
     * While we transition to using modern methods, this function can be used to
     * clean up the serialized XML.
     * @param {Element} dom - The DOM element to serialize
     * @returns {string} The serialized XML string
     * @since 2.35.0
     */
    serializeDOM(dom) {
      const serializer = new XMLSerializer();
      let str = serializer.serializeToString(dom);
      // Remove the XML declaration if it exists
      str = str.replace(/<\?xml.*?\?>/g, "");
      // Remove any namespace declarations
      str = str.replace(/xmlns(:\w+)?="[^"]*"/g, "");
      return str;
    },

    /**
     * Mark the active package as edited after an EML model or view change.
     * @since 2.39.0
     */
    markRootDataPackageChanged() {
      const dataPackage = MetacatUI.rootDataPackage;
      if (typeof dataPackage?.recordUserEdit === "function") {
        if (!dataPackage.isEditLocked?.()) {
          dataPackage.recordUserEdit("metadata:changed", {});
        }
        return;
      }

      // Older editor paths expose a collection with a packageModel.
      dataPackage?.packageModel?.set?.("changed", true);
    },
  };

  return EMLUtilities;
});

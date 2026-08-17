"use strict";

define([
  "common/XMLUtilities",
  "common/ValidationUtilities",
], (XMLUtilities, ValidationUtilities) => {
  const { cloneValidationErrors } = ValidationUtilities;

  /**
   * Helpers for DataONE XML response conventions.
   * @namespace DataONEXmlUtilities
   * @since 0.0.0
   */
  const DataONEXmlUtilities = {
    /**
     * Parse a DataONE `<error>` XML response into a plain structured object.
     * For malformed XML, returns a structured parse error with
     * `status="invalid_xml"`.
     * @param {string|Document|null|undefined} xmlInput XML text or parsed
     * document.
     * @param {string} [context="DataONE XML response"] Context label for parse
     * errors.
     * @returns {{name:string, message:string, status:string,
     * detailCode:(string|null)}|null} Structured error data, or null when no
     * DataONE error is present.
     */
    parseErrorXml(xmlInput, context = "DataONE XML response") {
      if (xmlInput === null || xmlInput === undefined) return null;

      let xml = null;
      try {
        xml = xmlInput?.documentElement
          ? xmlInput
          : XMLUtilities.parseXmlString(xmlInput, context);
      } catch (error) {
        if (error instanceof XMLUtilities.ParseError) {
          return {
            name: error.name || "ParseError",
            message: error.message || String(error),
            status: "invalid_xml",
            detailCode: null,
          };
        }
        throw error;
      }

      if (!xml?.documentElement) return null;

      const root = xml.documentElement;
      if (XMLUtilities.getNormalizedElementName(root) !== "error") {
        return null;
      }

      return {
        name: root.getAttribute("name") || "DataONEError",
        message:
          XMLUtilities.getDirectChildText(root, "description") ||
          "Unknown error",
        status: root.getAttribute("errorCode") || "unknown",
        detailCode: root.getAttribute("detailCode") || null,
      };
    },

    /**
     * Convert structured DataONE error data into an Error instance.
     * @param {{name?:string, message?:string, status?:string,
     * detailCode?:string|null}} errorData Structured error data.
     * @returns {Error} Error instance with DataONE metadata attached.
     */
    toError(errorData = {}) {
      const error = new Error(errorData.message || "Unknown error");
      error.name = errorData.name || "DataONEError";
      if (errorData.status !== undefined) {
        error.status = errorData.status;
      }
      if (errorData.detailCode !== undefined && errorData.detailCode !== null) {
        error.detailCode = errorData.detailCode;
      }
      return error;
    },

    /**
     * Convert an error-like value into a JSON-safe plain object.
     * @param {*} error Error-like value to serialize.
     * @returns {object} Plain error data.
     */
    toPlainError(error) {
      const errorJson = {
        name: error?.name || "Error",
        message: error?.message || String(error),
      };

      if (error?.status !== undefined) errorJson.status = error.status;
      if (error?.detailCode !== undefined) {
        errorJson.detailCode = error.detailCode;
      }
      if (error?.field !== undefined) errorJson.field = error.field;
      if (Array.isArray(error?.validationErrors)) {
        errorJson.validationErrors = cloneValidationErrors(
          error.validationErrors,
        );
      }

      return errorJson;
    },

    /**
     * Parse required XML and throw parsed DataONE service errors when present.
     * @param {string|Document} xmlInput XML text or parsed document.
     * @param {string} [context="DataONE XML response"] Context label for parse
     * errors.
     * @returns {Document} Parsed XML document.
     */
    parseRequiredDocument(xmlInput, context = "DataONE XML response") {
      const xml = xmlInput?.documentElement
        ? xmlInput
        : XMLUtilities.parseRequiredXmlString(xmlInput, context);
      const parsedError = this.parseErrorXml(xml, context);
      if (parsedError) {
        throw this.toError(parsedError);
      }
      return xml;
    },

    /**
     * Parse a DataONE XML response and extract required element text. Throws a
     * parsed DataONE service error when the response body contains `<error>`.
     * @param {string} xmlString XML response text.
     * @param {string} elementName Local element name to extract.
     * @param {string} [context="DataONE XML response"] Context label for parse
     * errors.
     * @returns {{value:string, xml:Document}} Parsed XML and extracted value.
     */
    parseXmlStringForRequiredElementText(
      xmlString,
      elementName,
      context = "DataONE XML response",
    ) {
      const xml = this.parseRequiredDocument(xmlString, context);

      return {
        value: XMLUtilities.getRequiredElementText(xml, elementName, context),
        xml,
      };
    },

    /**
     * Parse a DataONE identifier XML response into the normalized service
     * payload shape.
     * @param {string} xmlString XML response text.
     * @param {string} [context="DataONE XML response"] Context label for parse
     * errors.
     * @returns {{identifier:string, xml:Document}} Parsed identifier response.
     */
    parseIdentifierResponse(
      xmlString,
      context = "DataONE XML response",
    ) {
      const parsed = this.parseXmlStringForRequiredElementText(
        xmlString,
        "identifier",
        context,
      );

      return {
        identifier: parsed.value,
        xml: parsed.xml,
      };
    },
  };

  return DataONEXmlUtilities;
});

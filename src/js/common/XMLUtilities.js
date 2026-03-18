"use strict";

define([], () => {
  // Utility function to check if a value is a string
  const isString = (value) =>
    typeof value === "string" || value instanceof String;

  // Custom error class for XML parsing errors
  const ParseError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "ParseError";
    }
  };

  /**
   * @namespace XMLUtilities
   * @description A generic utility object that contains functions used
   * throughout MetacatUI to perform useful functions related to XML, but not
   * used to store or manipulate any state about the application.
   * @type {object}
   * @since 2.33.0
   */
  const XMLUtilities = /** @lends XMLUtilities.prototype */ {
    /**
     * Checks if a Unicode code point is valid according to the XML 1.0
     * specification. See https://www.w3.org/TR/xml/#charsets for the valid
     * character ranges.
     * @param {number} codePoint The Unicode code point to check
     * @returns {boolean} True if the code point is valid in XML, false
     * otherwise
     * @since 0.0.0
     */
    isValidXmlCodePoint(codePoint) {
      return (
        codePoint === 0x9 ||
        codePoint === 0xa ||
        codePoint === 0xd ||
        (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
        (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
        (codePoint >= 0x10000 && codePoint <= 0x10ffff)
      );
    },

    /**
     * Remove XML 1.0-invalid characters from text intended for XML text nodes.
     * This helper does not escape `&`, `<`, or other XML syntax characters;
     * those are handled by XMLSerializer during DOM serialization.
     * See https://www.w3.org/TR/xml/#charsets
     * @param {*} textString Value to normalize. Non-null values are coerced to a
     * string before invalid XML characters are removed.
     * @returns {string|null} The normalized string, or null for nullish values.
     * @since 0.0.0
     */
    removeInvalidXmlCharacters(textString) {
      if (textString === undefined || textString === null) {
        return null;
      }

      return Array.from(String(textString))
        .filter((character) =>
          this.isValidXmlCodePoint(character.codePointAt(0)),
        )
        .join("");
    },

    /**
     * Parse an XML string into a Document.
     * @param {string} xmlString XML text to parse.
     * @param {string} [context] Context label for parse errors.
     * @returns {Document|null} Parsed XML Document, or null for empty,
     * whitespace-only, or nullish input.
     */
    parseXmlString(xmlString, context = "XML response") {
      if (xmlString === null || xmlString === undefined) {
        return null;
      }
      if (!isString(xmlString)) {
        throw new ParseError(
          `${context}: expected a string but got ${typeof xmlString}`,
        );
      }
      let doc = null;
      const trimmed = String(xmlString).trim();
      if (!trimmed) {
        return null;
      }
      try {
        doc = new DOMParser().parseFromString(trimmed, "application/xml");
      } catch (_error) {
        const erMessage =
          _error instanceof Error ? _error.message : String(_error);
        throw new ParseError(
          `${context}: failed to parse XML response, DOMParser threw an error: ${erMessage}`,
        );
      }

      const parserError = doc?.querySelector?.("parsererror");
      if (parserError) {
        const detail = parserError.textContent
          ? parserError.textContent.trim()
          : "Unknown parser error";
        throw new ParseError(
          `${context}: failed to parse XML response (DOMParser error: ${detail})`,
        );
      }

      return doc;
    },

    /**
     * Return a lower-cased local element name with any namespace prefix
     * removed.
     * @param {Node} node The XML node to inspect.
     * @returns {string} The normalized local name, or an empty string.
     * @since 0.0.0
     */
    getNormalizedElementName(node) {
      const name = node?.localName || node?.nodeName || "";
      return name.split(":").pop().toLowerCase();
    },

    /**
     * Return only element children for the given XML node.
     * @param {Node} node The parent XML node.
     * @returns {Element[]} Direct child elements.
     * @since 0.0.0
     */
    getElementChildren(node) {
      return Array.from(node?.childNodes || []).filter(
        (child) => child.nodeType === 1,
      );
    },

    /**
     * Parses a simple CSS-like selector string into an array of selector parts,
     * each with a combinator and a tag name. Supports descendant combinators
     * (space) and child combinators (>), as well as optional namespace prefixes
     * in tag names.
     * @param {string} selector The simple selector string to parse (e.g.
     * "d1:identifier", "parent > child")
     * @returns {Array<{combinator: string, name: string}>|null} An array of
     * selector parts with combinators and tag names, or null if the selector is
     * invalid, e.g. [{ combinator: "descendant", name: "identifier" }] for
     * "d1:identifier", or [{ combinator: "descendant", name: "parent" }, {
     * combinator: "child", name: "child" }] for "parent > child"
     * @since 0.0.0
     */
    parseSimpleElementSelector(selector) {
      if (!isString(selector)) return null;

      const tokens = String(selector)
        .trim()
        .match(/(>|\S+)/g);
      if (!tokens?.length) return null;

      const parts = [];
      let combinator = "descendant";

      for (const token of tokens) {
        if (token === ">") {
          combinator = "child";
          continue;
        }

        const normalizedToken = token.replace(/\\:/g, ":");
        if (!/^([A-Za-z_][\w.-]*:)?[A-Za-z_][\w.-]*$/.test(normalizedToken)) {
          return null;
        }

        parts.push({
          combinator,
          name: normalizedToken.split(":").pop().toLowerCase(),
        });
        combinator = "descendant";
      }

      return parts.length ? parts : null;
    },

    /**
     * Find elements matching a simple selector, ignoring namespace prefixes in
     * element names. Used as a fallback when querySelector cannot handle XML
     * names safely.
     * @param {Document|Element} root Parsed XML document or element to search.
     * @param {string} selector Simple selector such as `d1:identifier` or
     * `parent > child`.
     * @returns {Element[]} Matching elements, or an empty array.
     * @since 0.0.0
     */
    findElementsBySimpleSelector(root, selector) {
      const parts = this.parseSimpleElementSelector(selector);
      if (!parts) return [];

      let currentNodes = root?.documentElement
        ? [root.documentElement]
        : [root];
      let isFirstPart = true;

      for (const part of parts) {
        const nextNodes = [];

        currentNodes.forEach((node) => {
          if (!node) return;

          const candidates = isFirstPart
            ? [
                ...(node.nodeType === 1 ? [node] : []),
                ...Array.from(node.getElementsByTagName?.("*") || []),
              ]
            : part.combinator === "child"
              ? this.getElementChildren(node)
              : Array.from(node.getElementsByTagName?.("*") || []);

          candidates.forEach((candidate) => {
            if (this.getNormalizedElementName(candidate) === part.name) {
              nextNodes.push(candidate);
            }
          });
        });

        currentNodes = nextNodes;
        isFirstPart = false;

        if (!currentNodes.length) return [];
      }

      return currentNodes;
    },

    /**
     * Find the first direct child element with the given local name.
     * Matching is case-insensitive and ignores namespace prefixes.
     * @param {Node} node The parent XML node.
     * @param {string} name Local child element name to match.
     * @returns {Element|null} The first matching child element, or null.
     * @since 0.0.0
     */
    findDirectChildElement(node, name) {
      const normalized = String(name || "").toLowerCase();
      return (
        this.getElementChildren(node).find(
          (child) => this.getNormalizedElementName(child) === normalized,
        ) || null
      );
    },

    /**
     * Find all direct child elements with the given local name.
     * Matching is case-insensitive and ignores namespace prefixes.
     * @param {Node} node The parent XML node.
     * @param {string} name Local child element name to match.
     * @returns {Element[]} Matching child elements.
     * @since 0.0.0
     */
    findDirectChildElements(node, name) {
      const normalized = String(name || "").toLowerCase();
      return this.getElementChildren(node).filter(
        (child) => this.getNormalizedElementName(child) === normalized,
      );
    },

    /**
     * Find the first element with the given local name anywhere under a parsed
     * XML document or node. Matching ignores namespace prefixes.
     * @param {Document|Node} documentOrNode Parsed XML document or node.
     * @param {string} name Local element name to match.
     * @returns {Element|null} The first matching element, or null.
     * @since 0.0.0
     */
    findFirstElement(documentOrNode, name) {
      const normalized = String(name || "").toLowerCase();
      if (
        documentOrNode?.documentElement &&
        this.getNormalizedElementName(documentOrNode.documentElement) ===
          normalized
      ) {
        return documentOrNode.documentElement;
      }
      // if its a plain Element, check it first before searching its children
      if (
        documentOrNode?.nodeType === 1 &&
        this.getNormalizedElementName(documentOrNode) === normalized
      ) {
        return documentOrNode;
      }

      return (
        Array.from(documentOrNode?.getElementsByTagName?.("*") || []).find(
          (element) => this.getNormalizedElementName(element) === normalized,
        ) || null
      );
    },

    /**
     * Return trimmed text content from an XML element.
     * @param {Element} element The XML element.
     * @returns {string|null} The trimmed text content, or null.
     * @since 0.0.0
     */
    getElementText(element) {
      if (!element) return null;
      return element.textContent.trim() || null;
    },

    /**
     * Extract the first non-empty text value from a given element. The element
     * is matched by local name and searched for anywhere under the given
     * document or node. Throws an error if the element is not found or if the
     * text value is empty.
     * @param {Document|Node} documentOrNode Parsed XML document or node.
     * @param {string} elementName Local element name to extract.
     * @param {string} [context="XML response"] Context label for error
     * messages.
     * @returns {string} The extracted non-empty text value.
     * @since 0.0.0
     */
    getRequiredElementText(
      documentOrNode,
      elementName,
      context = "XML response",
    ) {
      if (
        !documentOrNode ||
        typeof documentOrNode.getElementsByTagName !== "function"
      ) {
        throw new Error(`${context}: parsed XML document is required`);
      }

      const element = this.findFirstElement(documentOrNode, elementName);
      const value = this.getElementText(element);

      if (value) {
        return value;
      }

      throw new Error(
        `${context}: missing ${elementName} element in XML response`,
      );
    },

    /**
     * Parse an XML response and extract the first non-empty text value for the
     * requested element.
     * @param {string} xmlString XML response text.
     * @param {string} elementName Local element name to extract.
     * @param {string} [context="XML response"] Context label for error
     * messages.
     * @returns {{value:string, xml:Document}} Parsed XML and extracted value.
     * @since 0.0.0
     */
    parseXmlStringForRequiredElementText(
      xmlString,
      elementName,
      context = "XML response",
    ) {
      const xml = this.parseXmlString(xmlString, context);
      if (!xml) {
        throw new Error(`${context}: response body must be non-empty XML text`);
      }

      return {
        value: this.getRequiredElementText(xml, elementName, context),
        xml,
      };
    },

    /**
     * Replace an element's text content using a DOM text node so XML escaping
     * is handled later by XMLSerializer. Invalid XML 1.0 characters are removed
     * first.
     * @param {Document} doc The owning XML document.
     * @param {Element} element The element to update.
     * @param {*} value The text value to insert.
     * @returns {Element|null} The updated element, or null if value is nullish.
     * @since 0.0.0
     */
    setElementText(doc, element, value) {
      if (!doc || !element || value === undefined || value === null)
        return null;

      while (element.firstChild) {
        element.removeChild(element.firstChild);
      }

      const normalizedValue = this.removeInvalidXmlCharacters(value);
      element.appendChild(doc.createTextNode(normalizedValue));

      return element;
    },

    /**
     * Creates an element with the given text content and appends it to a parent
     * XML node using a DOM text node so XML escaping is deferred to
     * XMLSerializer. Invalid XML 1.0 characters are removed first.
     * @param {Document} doc The owning XML document
     * @param {Element} parent The parent XML element
     * @param {string} name The child element name
     * @param {*} value The text value to insert
     * @returns {Element|null} The appended element, if created
     * @since 0.0.0
     */
    appendTextElement(doc, parent, name, value) {
      if (value === undefined || value === null) return null;
      const element = doc.createElement(name);
      this.setElementText(doc, element, value);
      parent.appendChild(element);
      return element;
    },

    /**
     * Extract the first non-empty text matched by the provided selectors from
     * an XML string.
     * @param {string} xmlString XML text to search.
     * @param {string[]} selectors Selectors to try in order.
     * @returns {string} The extracted text, or an empty string.
     * @since 0.0.0
     */
    extractTextBySelectors(xmlString, selectors) {
      let xmlDoc = null;
      try {
        xmlDoc = this.parseXmlString(xmlString);
      } catch (e) {
        if (e instanceof ParseError) {
          // If parsing fails, we can still attempt to extract text using a
          // simple selector engine that doesn't rely on valid XML structure
          xmlDoc = null;
        } else {
          throw e;
        }
      }

      if (!xmlDoc || !Array.isArray(selectors)) return "";

      // Return the first non-empty text found for any selector
      let foundText = "";
      selectors.some((selector) => {
        let element = null;

        try {
          element = xmlDoc.querySelector(selector);
        } catch (_error) {
          element = null;
        }

        if (!element) {
          [element] = this.findElementsBySimpleSelector(xmlDoc, selector);
        }

        const text = element?.textContent?.trim();
        if (text) {
          foundText = text;
          return true; // exit loop once found
        }
        return false;
      });
      return foundText;
    },
  };

  /**
   * Custom error type for XML parsing errors.
   * @class ParseError
   * @extends Error
   * @memberof XMLUtilities
   * @since 0.0.0
   */
  XMLUtilities.ParseError = ParseError;

  return XMLUtilities;
});

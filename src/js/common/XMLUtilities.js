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
     * those are handled by XMLSerializer during DOM serialization. See
     * https://www.w3.org/TR/xml/#charsets
     * @param {*} textString Value to normalize. Non-null values are coerced to
     * a string before invalid XML characters are removed.
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
     * Convert an identifier to the legacy XML-safe ID form used by rendered
     * metadata annotations.
     * @param {*} id Identifier.
     * @returns {string|null} XML-safe ID, or null for empty input.
     * @since 0.0.0
     */
    getXMLSafeID(id) {
      if (id === undefined || id === null) return null;
      const normalized = String(id).trim();
      if (!normalized) return null;
      return normalized
        .replace(/</g, "-")
        .replace(/:/g, "-")
        .replace(/&[a-zA-Z0-9]+;/g, "");
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
     * Parse an XML string and require a non-empty XML document.
     * @param {string} xmlString XML text to parse.
     * @param {string} [context] Context label for parse errors.
     * @returns {Document} Parsed XML document.
     * @throws {ParseError} Throws when the XML is empty or invalid.
     * @since 0.0.0
     */
    parseRequiredXmlString(xmlString, context = "XML response") {
      const xml = this.parseXmlString(xmlString, context);
      if (!xml) {
        throw new ParseError(
          `${context}: response body must be non-empty XML text`,
        );
      }
      return xml;
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

      const result = tokens.reduce(
        (state, token) => {
          if (!state.valid) return state;

          if (token === ">") {
            return {
              ...state,
              combinator: "child",
            };
          }

          const normalizedToken = token.replace(/\\:/g, ":");
          if (!/^([A-Za-z_][\w.-]*:)?[A-Za-z_][\w.-]*$/.test(normalizedToken)) {
            return {
              ...state,
              valid: false,
            };
          }

          return {
            valid: true,
            combinator: "descendant",
            parts: [
              ...state.parts,
              {
                combinator: state.combinator,
                name: normalizedToken.split(":").pop().toLowerCase(),
              },
            ],
          };
        },
        {
          valid: true,
          combinator: "descendant",
          parts: [],
        },
      );

      return result.valid && result.parts.length ? result.parts : null;
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

      parts.forEach((part, partIndex) => {
        const isFirstPart = partIndex === 0;

        currentNodes = currentNodes.flatMap((node) => {
          if (!node) return [];

          let candidates = [];
          if (isFirstPart) {
            candidates = [
              ...(node.nodeType === 1 ? [node] : []),
              ...Array.from(node.getElementsByTagName?.("*") || []),
            ];
          } else if (part.combinator === "child") {
            candidates = Array.from(node?.children || []);
          } else {
            candidates = Array.from(node.getElementsByTagName?.("*") || []);
          }

          return candidates.filter(
            (candidate) =>
              this.getNormalizedElementName(candidate) === part.name,
          );
        });
      });

      return currentNodes;
    },

    /**
     * Find the first direct child element with the given local name. Matching
     * is case-insensitive and ignores namespace prefixes.
     * @param {Node} node The parent XML node.
     * @param {string} name Local child element name to match.
     * @returns {Element|null} The first matching child element, or null.
     * @since 0.0.0
     */
    findDirectChildElement(node, name) {
      const nodes = this.findDirectChildElements(node, name);
      return nodes.length ? nodes[0] : null;
    },

    /**
     * Find the last direct child element with the given local name. Matching is
     * case-insensitive and ignores namespace prefixes.
     * @param {Node} node The parent XML node.
     * @param {string} name Local child element name to match.
     * @returns {Element|null} The last matching child element, or null.
     * @since 0.0.0
     */
    findLastDirectChildElement(node, name) {
      const nodes = this.findDirectChildElements(node, name);
      return nodes.length ? nodes[nodes.length - 1] : null;
    },

    /**
     * Find all direct child elements with the given local name. Matching is
     * case-insensitive and ignores namespace prefixes.
     * @param {Node} node The parent XML node.
     * @param {string} name Local child element name to match.
     * @returns {Element[]} Matching child elements.
     * @since 0.0.0
     */
    findDirectChildElements(node, name) {
      const normalized = String(name || "").toLowerCase();
      return Array.from(node?.children || []).filter(
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

    getDirectChildText(node, name) {
      const element = this.findDirectChildElement(node, name);
      return element?.textContent?.trim() || null;
    },

    /**
     * Extract trimmed text from all matching direct child elements.
     * @param {Node} node The parent XML node.
     * @param {string} name Local child element name to match.
     * @returns {Array<string|null>} Matching child text values.
     * @since 0.0.0
     */
    getDirectChildTexts(node, name) {
      return this.findDirectChildElements(node, name).map(
        (child) => child?.textContent?.trim() || null,
      );
    },

    /**
     * Require that an element uses one of the expected namespace URIs.
     * @param {Element} element XML element to inspect.
     * @param {string[]} allowedNamespaceUris Allowed namespace URIs.
     * @param {string} [context] Context label for errors.
     * @returns {string} The matched namespace URI.
     * @throws {Error} Throws when the namespace URI is missing or unsupported.
     * @since 0.0.0
     */
    requireNamespaceUri(
      element,
      allowedNamespaceUris,
      context = "XML response",
    ) {
      const namespaceUri = element?.namespaceURI || null;
      const allowed = Array.isArray(allowedNamespaceUris)
        ? allowedNamespaceUris.filter(Boolean)
        : [];
      const elementLabel = element?.tagName || element?.nodeName || "element";

      if (allowed.includes(namespaceUri)) return namespaceUri;

      throw new Error(
        `${context}: <${elementLabel}> must use one of the supported namespace URIs: ${allowed.join(
          ", ",
        )}`,
      );
    },

    /**
     * Require that an element contains only allowed attribute names. Namespace
     * declaration attributes are ignored by default.
     * @param {Element} element XML element to inspect.
     * @param {string[]} allowedNames Allowed attribute names.
     * @param {string} [context] Context label for errors.
     * @param {object} [options] Additional options.
     * @param {boolean} [options.allowNamespaceDeclarations] Whether xmlns
     * attributes are ignored during validation.
     * @returns {string[]} Present non-namespace attribute names.
     * @throws {Error} Throws when an unexpected attribute is present.
     * @since 0.0.0
     */
    requireAllowedAttributeNames(
      element,
      allowedNames,
      context = "XML response",
      { allowNamespaceDeclarations = true } = {},
    ) {
      const allowed = new Set(Array.isArray(allowedNames) ? allowedNames : []);
      const elementLabel = element?.tagName || element?.nodeName || "element";
      const attributeNames = Array.from(element?.attributes || [])
        .filter((attribute) => {
          if (!allowNamespaceDeclarations) return true;
          const attributeName = attribute?.name || "";
          return (
            attributeName !== "xmlns" && !attributeName.startsWith("xmlns:")
          );
        })
        .map((attribute) => attribute.name);

      attributeNames.forEach((attributeName) => {
        if (!allowed.has(attributeName)) {
          throw new Error(
            `${context}: unexpected attribute "${attributeName}" on <${elementLabel}>`,
          );
        }
      });

      return attributeNames;
    },

    /**
     * Require a non-empty attribute value on an element.
     * @param {Element} element XML element to inspect.
     * @param {string} attributeName Attribute name to read.
     * @param {string} [context] Context label for errors.
     * @returns {string} Trimmed attribute value.
     * @throws {Error} Throws when the attribute is missing or empty.
     * @since 0.0.0
     */
    getRequiredAttribute(element, attributeName, context = "XML response") {
      const value = element?.getAttribute?.(attributeName)?.trim() || "";
      const elementLabel = element?.tagName || element?.nodeName || "element";
      if (value) return value;

      throw new Error(
        `${context}: <${elementLabel}> is missing required "${attributeName}" attribute`,
      );
    },

    /**
     * Require that direct child elements match an ordered schema-like sequence,
     * including min/max occurrence constraints.
     * @param {Node} node Parent XML node.
     * @param {Array<{name:string,minOccurs?:number,maxOccurs?:number}>} definitions Ordered direct-child definitions.
     * @param {string} [context] Context label for errors.
     * @returns {Map<string, Element[]>} Matching child elements by local name.
     * @throws {Error} Throws on unexpected, out-of-order, duplicate, or missing
     * child elements.
     * @since 0.0.0
     */
    requireDirectChildSequence(node, definitions, context = "XML response") {
      const childElements = Array.from(node?.children || []);
      const parentLabel = node?.tagName || node?.nodeName || "element";
      const normalizedDefinitions = Array.isArray(definitions)
        ? definitions.map((definition) => ({
            name: String(definition?.name || "").toLowerCase(),
            minOccurs: definition?.minOccurs ?? 0,
            maxOccurs: definition?.maxOccurs ?? 1,
          }))
        : [];
      const definitionMap = new Map();
      normalizedDefinitions.forEach((definition, index) => {
        definitionMap.set(definition.name, { ...definition, index });
      });

      const matches = new Map();
      let previousIndex = -1;

      childElements.forEach((child) => {
        const childName = this.getNormalizedElementName(child);
        const childLabel = child?.tagName || child?.nodeName || childName;
        const definition = definitionMap.get(childName);

        if (!definition) {
          throw new Error(
            `${context}: unexpected <${childLabel}> under <${parentLabel}>`,
          );
        }

        if (definition.index < previousIndex) {
          throw new Error(
            `${context}: <${childLabel}> is out of order under <${parentLabel}>`,
          );
        }

        previousIndex = definition.index;
        const existing = matches.get(childName) || [];
        existing.push(child);
        matches.set(childName, existing);

        if (
          definition.maxOccurs !== Infinity &&
          existing.length > definition.maxOccurs
        ) {
          throw new Error(
            `${context}: <${childLabel}> may occur at most ${definition.maxOccurs} time(s) under <${parentLabel}>`,
          );
        }
      });

      normalizedDefinitions.forEach((definition) => {
        const count = matches.get(definition.name)?.length || 0;
        if (count < definition.minOccurs) {
          throw new Error(
            `${context}: missing required <${definition.name}> under <${parentLabel}>`,
          );
        }
      });

      return matches;
    },

    /**
     * Require that the provided document or element has the expected root name.
     * Matching is case-insensitive and ignores namespace prefixes.
     * @param {Document|Element} documentOrElement Parsed XML document or root
     * element.
     * @param {string} expectedName Expected root local name.
     * @param {string} [context] Context label for error
     * messages.
     * @returns {Element} The validated root element.
     * @throws {Error} Throws when the root is missing or has the wrong name.
     * @since 0.0.0
     */
    requireDocumentElement(
      documentOrElement,
      expectedName,
      context = "XML response",
    ) {
      let root = null;
      if (documentOrElement?.documentElement) {
        root = documentOrElement.documentElement;
      } else if (documentOrElement?.nodeType === 1) {
        root = documentOrElement;
      }

      if (!root) {
        throw new Error(`${context}: parsed XML document is required`);
      }

      const actualName = this.getNormalizedElementName(root);
      const normalizedExpected = String(expectedName || "").toLowerCase();
      if (actualName !== normalizedExpected) {
        const actualLabel =
          root.tagName || root.nodeName || actualName || "unknown";
        throw new Error(
          `${context}: expected root <${expectedName}> but found <${actualLabel}>`,
        );
      }

      return root;
    },

    /**
     * Extract the first non-empty text value from a given element. The element
     * is matched by local name and searched for anywhere under the given
     * document or node. Throws an error if the element is not found or if the
     * text value is empty.
     * @param {Document|Node} documentOrNode Parsed XML document or node.
     * @param {string} elementName Local element name to extract.
     * @param {string} [context] Context label for error
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
      const value = element?.textContent?.trim() || null;

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
     * @param {string} [context] Context label for error
     * messages.
     * @returns {{value:string, xml:Document}} Parsed XML and extracted value.
     * @since 0.0.0
     */
    parseXmlStringForRequiredElementText(
      xmlString,
      elementName,
      context = "XML response",
    ) {
      const xml = this.parseRequiredXmlString(xmlString, context);

      return {
        value: this.getRequiredElementText(xml, elementName, context),
        xml,
      };
    },

    /**
     * Append a child element with XML-safe text content.
     * @param {XMLDocument} doc XML document used to create elements.
     * @param {Element} parent Parent element that receives the child.
     * @param {string} name Child element name.
     * @param {*} value Text value to append.
     * @returns {Element|null} The appended child element, or null for nullish
     * values.
     * @since 0.0.0
     */
    appendTextElement(doc, parent, name, value) {
      if (value === null || value === undefined) return null;

      const element = doc.createElement(name);
      element.textContent = this.removeInvalidXmlCharacters(value);
      parent.appendChild(element);
      return element;
    },

    /**
     * Extract the XML declaration from raw XML text, if present.
     * @param {string|null|undefined} xmlString XML text to inspect.
     * @returns {string|null} XML declaration text.
     * @since 0.0.0
     */
    extractXmlDeclaration(xmlString) {
      if (!isString(xmlString) || !String(xmlString).trim()) return null;
      const match = String(xmlString).match(/^\s*(<\?xml\b[\s\S]*?\?>)/i);
      return match?.[1] || null;
    },

    /**
     * Capture namespace declarations from an XML element in source order.
     * @param {Element|null} element XML element to inspect.
     * @returns {Array<{name:string, value:string}>} Namespace attributes.
     * @since 0.0.0
     */
    getNamespaceAttributes(element) {
      return Array.from(element?.attributes || [])
        .filter((attribute) => {
          const attributeName = attribute?.name || "";
          return (
            attributeName === "xmlns" || attributeName.startsWith("xmlns:")
          );
        })
        .map((attribute) => ({
          name: attribute.name,
          value: attribute.value,
        }));
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
   * @augments Error
   * @memberof XMLUtilities
   * @since 0.0.0
   */
  XMLUtilities.ParseError = ParseError;

  return XMLUtilities;
});

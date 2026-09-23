define(["common/XMLUtilities", "common/ValueUtilities"], (
  XMLUtilities,
  ValueUtilities,
) => {
  // Option names that require their values to be wrapped in CDATA tags.
  const REQUIRES_CDATA = ["mapConfig"];

  // XML tag names used in the PortalOption schema.
  const TAG_NAMES = Object.freeze({
    OPTION: "option",
    NAME: "optionName",
    VALUE: "optionValue",
  });

  /**
   * A portal OptionType with a name and one or more string values. See
   * {@link https://github.com/DataONEorg/collections-portals-schemas/blob/1.1.0/schemas/portals.xsd#L725-L754}
   * @class PortalOption
   * @classcategory Models/Portals
   * @since 0.0.0
   */
  class PortalOption {
    /**
     * Create an option from its schema values.
     * @param {object} data Option values.
     * @param {string} data.optionName Nonempty option name.
     * @param {string[]} data.optionValue Nonempty option values.
     */
    constructor({ optionName, optionValue } = {}) {
      this.optionName = optionName;
      this.optionValue = ValueUtilities.listify(optionValue);
      this.assertValid();
    }

    /**
     * Find a direct child option by its exact name.
     * @param {Element} parent Element containing options.
     * @param {string} optionName Name to find.
     * @returns {Element|undefined} Matching option element, if present.
     */
    static findDirectChild(parent, optionName) {
      return Array.from(parent.children).find(
        (element) =>
          element.localName === TAG_NAMES.OPTION &&
          Array.from(element.children).some(
            (child) =>
              child.localName === TAG_NAMES.NAME &&
              child.textContent === optionName,
          ),
      );
    }

    /**
     * Read an OptionType XML element without changing its values' whitespace.
     * @param {Element} element OptionType XML element.
     * @returns {PortalOption} Parsed option.
     */
    static fromElement(element) {
      if (element?.nodeType !== 1 || element.localName !== TAG_NAMES.OPTION) {
        throw new Error("PortalOption: expected an <option> element");
      }

      const children = Array.from(element.children);
      const nameElement = children.shift();
      if (nameElement?.localName !== TAG_NAMES.NAME) {
        const misplaced = children.some(
          (child) => child.localName === TAG_NAMES.NAME,
        );
        throw new Error(
          misplaced
            ? "PortalOption: <optionName> is out of order"
            : "PortalOption: missing required <optionName>",
        );
      }
      if (!children.length) {
        throw new Error("PortalOption: missing required <optionValue>");
      }
      children.forEach((child) => {
        if (child.localName !== TAG_NAMES.VALUE) {
          throw new Error(
            child.localName === TAG_NAMES.NAME
              ? "PortalOption: <optionName> is out of order"
              : `PortalOption: unexpected <${child.tagName}>`,
          );
        }
      });

      return new PortalOption({
        optionName: nameElement.textContent,
        optionValue: children.map((child) => child.textContent),
      });
    }

    /**
     * Check for non-whitespace content in the option name and values.
     * @returns {object|null} Validation errors keyed by property name or `null`
     * when valid.
     */
    validate() {
      // Valid text according to NonEmptyStringType and XML character rules.
      const isValidText = (value) =>
        typeof value === "string" &&
        /\S/.test(value) &&
        XMLUtilities.removeInvalidXmlCharacters(value) === value;

      const errors = {};

      if (!isValidText(this.optionName)) {
        errors.optionName = "optionName must contain non-whitespace text.";
      }

      if (
        !Array.isArray(this.optionValue) ||
        !this.optionValue.length ||
        this.optionValue.some((value) => !isValidText(value))
      ) {
        errors.optionValue = "optionValue must contain non-whitespace text.";
      }

      return Object.keys(errors).length > 0 ? errors : null;
    }

    /**
     * Require the non-whitespace content specified by NonEmptyStringType.
     * @throws {Error} When the name or a value is empty or only whitespace.
     */
    assertValid() {
      const errors = this.validate();
      if (errors) {
        const msg = ValueUtilities.arrayToString(Object.values(errors));
        throw new Error(msg);
      }
    }

    /**
     * Create an OptionType XML element in the provided XML document.
     * `mapConfig` values use CDATA because they contain serialized JSON.
     * @param {XMLDocument} doc Owning XML document.
     * @returns {Element} OptionType XML element.
     */
    toElement(doc) {
      this.assertValid();
      const element = doc.createElement(TAG_NAMES.OPTION);
      XMLUtilities.appendTextElement(
        doc,
        element,
        TAG_NAMES.NAME,
        this.optionName,
      );
      this.optionValue.forEach((value) => {
        if (REQUIRES_CDATA.includes(this.optionName)) {
          XMLUtilities.appendCdataElement(doc, element, TAG_NAMES.VALUE, value);
        } else {
          XMLUtilities.appendTextElement(doc, element, TAG_NAMES.VALUE, value);
        }
      });
      return element;
    }
  }

  PortalOption.REQUIRES_CDATA = REQUIRES_CDATA;
  PortalOption.TAG_NAMES = TAG_NAMES;

  return PortalOption;
});

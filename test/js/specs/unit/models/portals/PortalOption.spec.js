define(["common/XMLUtilities", "models/portals/PortalOption"], (
  XMLUtilities,
  PortalOption,
) => {
  const expect = chai.expect;
  const { TAG_NAMES } = PortalOption;

  const parseOption = (xml) =>
    XMLUtilities.parseRequiredXmlString(xml).documentElement;

  const createDocument = () =>
    XMLUtilities.parseRequiredXmlString("<portal />");

  describe("PortalOption", () => {
    it("finds an exact direct option name without matching nested or longer names", () => {
      const xml = XMLUtilities.parseRequiredXmlString(
        `<por:portal xmlns:por="https://purl.dataone.org/portals-1.1.0">
          <section><option><optionName>primaryColor</optionName><optionValue>nested</optionValue></option></section>
          <option><optionName>primaryColorExtra</optionName><optionValue>other</optionValue></option>
          <option><optionName>primaryColor</optionName><optionValue>root</optionValue></option>
        </por:portal>`,
      );

      const found = PortalOption.findDirectChild(
        xml.documentElement,
        "primaryColor",
      );

      expect(found.children[1].textContent).to.equal("root");
      expect(
        PortalOption.findDirectChild(xml.documentElement, "PrimaryColor"),
      ).to.equal(undefined);
    });

    it("reads all direct option values without trimming valid whitespace", () => {
      // Because it is a `NonEmptyStringType` the whitespace around the text is preserved
      const option = PortalOption.fromElement(
        parseOption(
          `<${TAG_NAMES.OPTION}>
            <${TAG_NAMES.NAME}> mapConfig </${TAG_NAMES.NAME}>
            <${TAG_NAMES.VALUE}> first </${TAG_NAMES.VALUE}>
            <${TAG_NAMES.VALUE}><![CDATA[ {"label":"A & B"} ]]></${TAG_NAMES.VALUE}>
          </${TAG_NAMES.OPTION}>`,
        ),
      );

      expect(option.optionName).to.equal(" mapConfig ");
      expect(option.optionValue).to.deep.equal([
        " first ",
        ' {"label":"A & B"} ',
      ]);
    });

    it("rejects option XML with missing, blank, or misplaced required children", () => {
      expect(() =>
        PortalOption.fromElement(
          parseOption(
            `<${TAG_NAMES.OPTION}><${TAG_NAMES.VALUE}>value</${TAG_NAMES.VALUE}></${TAG_NAMES.OPTION}>`,
          ),
        ),
      ).to.throw(/optionName/i);
      expect(() =>
        PortalOption.fromElement(
          parseOption(
            `<${TAG_NAMES.OPTION}><${TAG_NAMES.NAME}>  </${TAG_NAMES.NAME}><${TAG_NAMES.VALUE}>value</${TAG_NAMES.VALUE}></${TAG_NAMES.OPTION}>`,
          ),
        ),
      ).to.throw(/optionName/i);
      expect(() =>
        PortalOption.fromElement(
          parseOption(
            `<${TAG_NAMES.OPTION}><${TAG_NAMES.VALUE}>value</${TAG_NAMES.VALUE}><${TAG_NAMES.NAME}>name</${TAG_NAMES.NAME}></${TAG_NAMES.OPTION}>`,
          ),
        ),
      ).to.throw(/out of order/i);
    });

    it("rejects incorrectly cased XML element names", () => {
      [
        "<Option><optionName>name</optionName><optionValue>value</optionValue></Option>",
        "<option><OptionName>name</OptionName><optionValue>value</optionValue></option>",
        "<option><optionName>name</optionName><OptionValue>value</OptionValue></option>",
      ].forEach((xml) => {
        expect(() => PortalOption.fromElement(parseOption(xml))).to.throw();
      });
    });

    it("reads multiple values from an option in a prefixed portal document", () => {
      const xml = XMLUtilities.parseRequiredXmlString(
        '<por:portal xmlns:por="https://purl.dataone.org/portals-1.1.0"><option><optionName>pageOrder</optionName><optionValue>Data</optionValue><optionValue>Map</optionValue></option></por:portal>',
      );

      const option = PortalOption.fromElement(
        xml.documentElement.firstElementChild,
      );

      expect(option.optionName).to.equal("pageOrder");
      expect(option.optionValue).to.deep.equal(["Data", "Map"]);

      const replacement = option.toElement(xml);
      expect(replacement.ownerDocument).to.equal(xml);
      xml.documentElement.replaceChild(
        replacement,
        xml.documentElement.firstElementChild,
      );
      const reparsed = XMLUtilities.parseRequiredXmlString(
        new XMLSerializer().serializeToString(xml),
      );

      expect(
        PortalOption.fromElement(reparsed.documentElement.firstElementChild)
          .optionValue,
      ).to.deep.equal(["Data", "Map"]);
    });

    it("writes ordinary option values as XML text", () => {
      const xml = createDocument();
      const option = new PortalOption({
        optionName: "primaryColor",
        optionValue: [" #00a&b ", "second"],
      });
      const element = option.toElement(xml);
      xml.documentElement.appendChild(element);

      expect(new XMLSerializer().serializeToString(element)).to.equal(
        `<${TAG_NAMES.OPTION}><${TAG_NAMES.NAME}>primaryColor</${TAG_NAMES.NAME}><${TAG_NAMES.VALUE}> #00a&amp;b </${TAG_NAMES.VALUE}><${TAG_NAMES.VALUE}>second</${TAG_NAMES.VALUE}></${TAG_NAMES.OPTION}>`,
      );
    });

    it("writes required values as real CDATA, including a CDATA terminator", () => {
      const cdataOptionName = PortalOption.REQUIRES_CDATA[0];
      const value = '{"label":"A < B & C ]]> D"}';
      const xml = createDocument();
      const element = new PortalOption({
        optionName: cdataOptionName,
        optionValue: [value],
      }).toElement(xml);
      xml.documentElement.appendChild(element);
      const valueElement = element.children[1];
      const serialized = new XMLSerializer().serializeToString(xml);
      const reparsed = XMLUtilities.parseRequiredXmlString(serialized);

      expect(valueElement.childNodes.length).to.be.greaterThan(1);
      expect(
        Array.from(valueElement.childNodes).every(
          (node) => node.nodeType === 4,
        ),
      ).to.equal(true);
      expect(serialized).to.include("<![CDATA[");
      expect(
        reparsed.documentElement.firstElementChild.children[1].textContent,
      ).to.equal(value);
    });

    it("rejects whitespace only values when serializing", () => {
      const option = new PortalOption({
        optionName: "sectionType",
        optionValue: ["visualization"],
      });
      option.optionValue[0] = " \n ";

      expect(() => option.toElement(createDocument())).to.throw();
    });

    it("rejects XML invalid characters instead of writing an empty required value", () => {
      expect(
        () =>
          new PortalOption({
            optionName: "mapConfig",
            optionValue: ["\u0000"],
          }),
      ).to.throw(/optionValue/i);
    });
  });
});

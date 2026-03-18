define(["common/XMLUtilities"], (XMLUtilities) => {
  const expect = chai.expect;
  const SAMPLE_EML = [
    '<eml:eml xmlns:eml="https://eml.ecoinformatics.org/eml-2.2.0"',
    '  packageId="urn:uuid:test-eml.1" system="knb">',
    "  <dataset>",
    "    <title>Fish &amp; Chips Dataset</title>",
    "    <abstract>",
    "      <para>Contains &lt;observations&gt; and &amp; symbols.</para>",
    "    </abstract>",
    "  </dataset>",
    "</eml:eml>",
  ].join("");

  const SAMPLE_EML_2 = [
    '<eml:eml xmlns:eml="https://eml.ecoinformatics.org/eml-2.2.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:stmml="http://www.xml-cml.org/schema/stmml-1.1" xsi:schemaLocation="https://eml.ecoinformatics.org/eml-2.2.0 https://eml.ecoinformatics.org/eml-2.2.0/eml.xsd" packageId="urn:uuid:abc-123" system="knb">',
    ' <dataset id="urn:uuid:abc-123">',
    "   <title>Test Dataset</title>",
    "   <abstract>",
    "     <para>This is a test dataset.</para>",
    "   </abstract>",
    " </dataset>",
    "</eml:eml>",
  ].join("");

  describe("XMLUtilities", () => {
    describe("isValidXmlCodePoint", () => {
      it("returns true for valid XML code points", () => {
        expect(XMLUtilities.isValidXmlCodePoint(0x20)).to.equal(true); // space
        expect(XMLUtilities.isValidXmlCodePoint(0xd7ff)).to.equal(true); // last valid BMP code point before surrogates
        expect(XMLUtilities.isValidXmlCodePoint(0xe000)).to.equal(true); // first valid private-use BMP code point
        expect(XMLUtilities.isValidXmlCodePoint(0xfffd)).to.equal(true); // last valid BMP code point before U+FFFE/U+FFFF
        expect(XMLUtilities.isValidXmlCodePoint(0x10000)).to.equal(true); // first astral code point
        expect(XMLUtilities.isValidXmlCodePoint(0x10ffff)).to.equal(true); // last Unicode code point
      });

      it("returns false for invalid XML code points", () => {
        expect(XMLUtilities.isValidXmlCodePoint(0x00)).to.equal(false); // null character
        expect(XMLUtilities.isValidXmlCodePoint(0x1f)).to.equal(false); // highest disallowed C0 control character
        expect(XMLUtilities.isValidXmlCodePoint(0xd800)).to.equal(false); // first surrogate code point
        expect(XMLUtilities.isValidXmlCodePoint(0xdfff)).to.equal(false); // last surrogate code point
        expect(XMLUtilities.isValidXmlCodePoint(0xfffe)).to.equal(false); // noncharacter
        expect(XMLUtilities.isValidXmlCodePoint(0x110000)).to.equal(false); // above Unicode range
      });
    });

    describe("removeInvalidXmlCharacters", () => {
      it("returns null for nullish values", () => {
        expect(XMLUtilities.removeInvalidXmlCharacters()).to.equal(null);
        expect(XMLUtilities.removeInvalidXmlCharacters(null)).to.equal(null);
        expect(XMLUtilities.removeInvalidXmlCharacters(undefined)).to.equal(
          null,
        );
      });

      it("removes invalid XML code points but preserves valid astral characters", () => {
        expect(
          XMLUtilities.removeInvalidXmlCharacters("  hi😀\u0000there\uD800!  "),
        ).to.equal("  hi😀there!  ");
      });

      it("does not escape XML syntax characters", () => {
        expect(
          XMLUtilities.removeInvalidXmlCharacters("Tom & Jerry <cartoon>"),
        ).to.equal("Tom & Jerry <cartoon>");
      });
    });

    describe("parseXmlString", () => {
      it("parses valid XML strings", () => {
        const xml = XMLUtilities.parseXmlString(
          '<d1:identifier xmlns:d1="urn:test">urn:uuid:test.1</d1:identifier>',
        );

        expect(xml).to.be.instanceof(Document);
        expect(xml.documentElement.localName).to.equal("identifier");
        expect(xml.documentElement.textContent).to.equal("urn:uuid:test.1");
      });

      it("returns null for empty XML, whitespace-only strings, or nullish values", () => {
        expect(XMLUtilities.parseXmlString("   ")).to.equal(null);
        expect(XMLUtilities.parseXmlString("")).to.equal(null);
        expect(XMLUtilities.parseXmlString(null)).to.equal(null);
        expect(XMLUtilities.parseXmlString(undefined)).to.equal(null);
      });

      it("throws a ParseError for non-string inputs", () => {
        expect(() => XMLUtilities.parseXmlString(42)).to.throw(
          XMLUtilities.ParseError,
          "expected a string but got number",
        );
        expect(() => XMLUtilities.parseXmlString({})).to.throw(
          XMLUtilities.ParseError,
          "expected a string but got object",
        );
      });

      it("throw a ParseError for malformed XML", () => {
        expect(() =>
          XMLUtilities.parseXmlString("<root><unclosed></root>"),
        ).to.throw(
          XMLUtilities.ParseError,
        );

        expect(() =>
          XMLUtilities.parseXmlString("<root><unclosed></root>"),
        ).to.throw(XMLUtilities.ParseError);
      });

      it("round-trips namespace-aware EML through parse and serialize", () => {
        const parsed = XMLUtilities.parseXmlString(SAMPLE_EML, "EML");
        const serialized = new XMLSerializer().serializeToString(parsed);
        const reparsed = XMLUtilities.parseXmlString(
          serialized,
          "Serialized EML",
        );

        expect(reparsed.documentElement.localName).to.equal("eml");
        expect(
          XMLUtilities.findFirstElement(reparsed, "title")?.textContent,
        ).to.equal("Fish & Chips Dataset");
        expect(
          XMLUtilities.extractTextBySelectors(serialized, ["abstract > para"]),
        ).to.equal("Contains <observations> and & symbols.");
      });

      it("handles EML with schemaLocation and datasetId attributes", () => {
        const parsed = XMLUtilities.parseXmlString(
          SAMPLE_EML_2,
          "EML with schemaLocation",
        );
        expect(parsed.documentElement.localName).to.equal("eml");
        expect(
          parsed.documentElement.getAttribute("xsi:schemaLocation"),
        ).to.equal(
          "https://eml.ecoinformatics.org/eml-2.2.0 https://eml.ecoinformatics.org/eml-2.2.0/eml.xsd",
        );
        const dataset = XMLUtilities.findFirstElement(parsed, "dataset");
        expect(dataset).to.not.equal(null);
        expect(dataset.getAttribute("id")).to.equal("urn:uuid:abc-123");
        expect(
          XMLUtilities.findFirstElement(dataset, "title")?.textContent,
        ).to.equal("Test Dataset");
      });
    });

    describe("getNormalizedElementName", () => {
      it("normalizes names using localName when available", () => {
        const xml = new DOMParser().parseFromString(
          '<d1:Identifier xmlns:d1="urn:test">value</d1:Identifier>',
          "application/xml",
        );

        expect(XMLUtilities.getNormalizedElementName(xml.documentElement)).to.equal(
          "identifier",
        );
      });

      it("falls back to nodeName and handles missing nodes", () => {
        expect(
          XMLUtilities.getNormalizedElementName({ nodeName: "d1:Description" }),
        ).to.equal("description");
        expect(XMLUtilities.getNormalizedElementName(null)).to.equal("");
      });
    });

    describe("getElementChildren", () => {
      it("returns only element child nodes", () => {
        const xml = new DOMParser().parseFromString(
          "<root>text<first /><!-- comment --><second /></root>",
          "application/xml",
        );

        const children = XMLUtilities.getElementChildren(xml.documentElement);

        expect(children.map((child) => child.localName)).to.deep.equal([
          "first",
          "second",
        ]);
      });
    });

    describe("findDirectChildElement", () => {
      it("finds the first direct child case-insensitively and ignores prefixes", () => {
        const xml = new DOMParser().parseFromString(
          [
            '<root xmlns:d1="urn:test">',
            "  <wrapper><identifier>nested</identifier></wrapper>",
            "  <d1:Identifier>direct</d1:Identifier>",
            "  <identifier>second</identifier>",
            "</root>",
          ].join(""),
          "application/xml",
        );

        const child = XMLUtilities.findDirectChildElement(
          xml.documentElement,
          "IDENTIFIER",
        );

        expect(child).to.not.equal(null);
        expect(child.textContent).to.equal("direct");
      });

      it("returns null when there is no matching direct child", () => {
        const xml = new DOMParser().parseFromString(
          "<root><child /></root>",
          "application/xml",
        );

        expect(
          XMLUtilities.findDirectChildElement(xml.documentElement, "missing"),
        ).to.equal(null);
      });
    });

    describe("findDirectChildElements", () => {
      it("returns all matching direct children", () => {
        const xml = new DOMParser().parseFromString(
          [
            '<root xmlns:d1="urn:test">',
            "  <d1:replica>one</d1:replica>",
            "  <wrapper><replica>nested</replica></wrapper>",
            "  <replica>two</replica>",
            "</root>",
          ].join(""),
          "application/xml",
        );

        const children = XMLUtilities.findDirectChildElements(
          xml.documentElement,
          "replica",
        );

        expect(children.map((child) => child.textContent.trim())).to.deep.equal(
          ["one", "two"],
        );
      });
    });

    describe("findFirstElement", () => {
      it("returns the document element when it matches", () => {
        const xml = new DOMParser().parseFromString(
          "<systemMetadata><identifier>id</identifier></systemMetadata>",
          "application/xml",
        );

        expect(XMLUtilities.findFirstElement(xml, "systemMetadata")).to.equal(
          xml.documentElement,
        );
      });

      it("returns the current element when a plain element node matches", () => {
        const xml = new DOMParser().parseFromString(
          "<identifier>id</identifier>",
          "application/xml",
        );

        expect(
          XMLUtilities.findFirstElement(xml.documentElement, "identifier"),
        ).to.equal(xml.documentElement);
      });

      it("returns the first matching descendant when the root does not match", () => {
        const xml = new DOMParser().parseFromString(
          "<root><wrapper /><identifier>first</identifier><identifier>second</identifier></root>",
          "application/xml",
        );

        const element = XMLUtilities.findFirstElement(xml, "identifier");

        expect(element).to.not.equal(null);
        expect(element.textContent).to.equal("first");
      });

      it("returns null when no matching element exists", () => {
        const xml = new DOMParser().parseFromString(
          "<root><child /></root>",
          "application/xml",
        );

        expect(XMLUtilities.findFirstElement(xml, "identifier")).to.equal(null);
      });
    });

    describe("getElementText", () => {
      it("returns trimmed text content", () => {
        const xml = new DOMParser().parseFromString(
          "<root>  value  </root>",
          "application/xml",
        );

        expect(XMLUtilities.getElementText(xml.documentElement)).to.equal(
          "value",
        );
      });

      it("returns null for missing elements", () => {
        expect(XMLUtilities.getElementText(null)).to.equal(null);
      });

      it("returns null for whitespace-only text", () => {
        const xml = new DOMParser().parseFromString(
          "<root>   </root>",
          "application/xml",
        );

        expect(XMLUtilities.getElementText(xml.documentElement)).to.equal(null);
      });
    });

    describe("getRequiredElementText", () => {
      it("extracts element text case-insensitively and ignores namespaces", () => {
        const xml = new DOMParser().parseFromString(
          [
            '<d1:response xmlns:d1="http://ns.dataone.org/service/types/v2.0">',
            "  <d1:Identifier>urn:uuid:test.2</d1:Identifier>",
            "</d1:response>",
          ].join(""),
          "application/xml",
        );

        XMLUtilities.getRequiredElementText(xml, "identifier").should.equal(
          "urn:uuid:test.2",
        );
      });

      it("extracts text even if the namespace prefix is missing", () => {
        const xml = new DOMParser().parseFromString(
          "<response><identifier>urn:uuid:test.1</identifier></response>",
          "application/xml",
        );

        XMLUtilities.getRequiredElementText(xml, "identifier").should.equal(
          "urn:uuid:test.1",
        );
      });

      it("rejects XML documents without the requested element", () => {
        const xml = new DOMParser().parseFromString(
          "<response><message>ok</message></response>",
          "application/xml",
        );

        expect(() =>
          XMLUtilities.getRequiredElementText(xml, "identifier"),
        ).to.throw(/missing identifier element/i);
      });

      it("rejects invalid parsed documents", () => {
        expect(() =>
          XMLUtilities.getRequiredElementText(null, "identifier"),
        ).to.throw(/parsed XML document is required/);
      });

      it("returns the first matching element if multiple are present", () => {
        const xml = new DOMParser().parseFromString(
          "<response><identifier>urn:uuid:test.1</identifier><identifier>urn:uuid:test.2</identifier></response>",
          "application/xml",
        );

        XMLUtilities.getRequiredElementText(xml, "identifier").should.equal(
          "urn:uuid:test.1",
        );
      });

      it("supports configurable element names", () => {
        const xml = new DOMParser().parseFromString(
          "<response><nodeReference>urn:node:KNB</nodeReference></response>",
          "application/xml",
        );

        XMLUtilities.getRequiredElementText(
          xml,
          "nodeReference",
        ).should.equal("urn:node:KNB");
      });
    });

    describe("parseXmlStringForRequiredElementText", () => {
      it("returns the extracted value and parsed XML document", () => {
        const result = XMLUtilities.parseXmlStringForRequiredElementText(
          '<identifier xmlns="http://ns.dataone.org/service/types/v2.0">urn:uuid:test.3</identifier>',
          "identifier",
          "create",
        );

        result.value.should.equal("urn:uuid:test.3");
        result.xml.should.be.instanceof(Document);
      });

      it("surfaces context in parse failures", () => {
        expect(() =>
          XMLUtilities.parseXmlStringForRequiredElementText(
            "<identifier>",
            "identifier",
            "reserve",
          ),
        ).to.throw(/reserve/i);
      });

      it("supports configurable element names", () => {
        const result = XMLUtilities.parseXmlStringForRequiredElementText(
          "<response><nodeReference>urn:node:ARCTIC</nodeReference></response>",
          "nodeReference",
          "node lookup",
        );

        result.value.should.equal("urn:node:ARCTIC");
        result.xml.should.be.instanceof(Document);
      });
    });

    describe("appendTextElement", () => {
      it("appends an element with stringified text content", () => {
        const doc = new DOMParser().parseFromString(
          "<root />",
          "application/xml",
        );

        const appended = XMLUtilities.appendTextElement(
          doc,
          doc.documentElement,
          "size",
          42,
        );

        expect(appended.localName).to.equal("size");
        expect(appended.textContent).to.equal("42");
        expect(doc.documentElement.lastChild).to.equal(appended);
      });

      it("uses DOM text nodes so XMLSerializer escapes reserved characters", () => {
        const doc = new DOMParser().parseFromString(
          "<root />",
          "application/xml",
        );

        XMLUtilities.appendTextElement(
          doc,
          doc.documentElement,
          "title",
          "Tom & Jerry <cartoon>",
        );

        const serialized = new XMLSerializer().serializeToString(doc);

        expect(serialized).to.contain(
          "<title>Tom &amp; Jerry &lt;cartoon&gt;</title>",
        );
      });

      it("removes invalid XML characters before appending text nodes", () => {
        const doc = new DOMParser().parseFromString(
          "<root />",
          "application/xml",
        );

        const appended = XMLUtilities.appendTextElement(
          doc,
          doc.documentElement,
          "title",
          "ok\u0000bad",
        );

        expect(appended.textContent).to.equal("okbad");
      });

      it("supports EML-style text round-trips with reserved characters", () => {
        const doc = document.implementation.createDocument(
          "https://eml.ecoinformatics.org/eml-2.2.0",
          "eml:eml",
          null,
        );
        const root = doc.documentElement;
        root.setAttribute("packageId", "urn:uuid:test-eml.2");
        root.setAttribute("system", "knb");

        const dataset = doc.createElement("dataset");
        root.appendChild(dataset);

        XMLUtilities.appendTextElement(
          doc,
          dataset,
          "title",
          "A & B < C \u0000 dataset",
        );

        const abstract = doc.createElement("abstract");
        dataset.appendChild(abstract);
        XMLUtilities.appendTextElement(
          doc,
          abstract,
          "para",
          "Use 5 < 6 & 7 > 3 in free text",
        );

        const serialized = new XMLSerializer().serializeToString(doc);
        const reparsed = XMLUtilities.parseXmlString(
          serialized,
          "Generated EML",
        );

        expect(serialized).to.contain(
          "<title>A &amp; B &lt; C  dataset</title>",
        );
        expect(serialized).to.contain(
          "<para>Use 5 &lt; 6 &amp; 7 &gt; 3 in free text</para>",
        );
        expect(
          XMLUtilities.findFirstElement(reparsed, "title")?.textContent,
        ).to.equal("A & B < C  dataset");
        expect(
          XMLUtilities.extractTextBySelectors(serialized, ["abstract > para"]),
        ).to.equal("Use 5 < 6 & 7 > 3 in free text");
      });

      it("returns null for nullish values", () => {
        const doc = new DOMParser().parseFromString(
          "<root />",
          "application/xml",
        );

        expect(
          XMLUtilities.appendTextElement(
            doc,
            doc.documentElement,
            "size",
            null,
          ),
        ).to.equal(null);
        expect(
          XMLUtilities.appendTextElement(
            doc,
            doc.documentElement,
            "size",
            undefined,
          ),
        ).to.equal(null);
      });
    });

    describe("extractTextBySelectors", () => {
      it("returns the first non-empty text matched by the provided selectors", () => {
        const xml = [
          "<response>",
          "  <description>   </description>",
          "  <identifier>Preferred value</identifier>",
          "  <fallback>ignored</fallback>",
          "</response>",
        ].join("");

        expect(
          XMLUtilities.extractTextBySelectors(xml, [
            "description",
            "identifier",
          ]),
        ).to.equal("Preferred value");
      });

      it("supports namespace-prefixed selectors in XML documents", () => {
        const xml = [
          '<response xmlns:d1="urn:test">',
          "  <d1:description>Namespaced value</d1:description>",
          "</response>",
        ].join("");

        expect(
          XMLUtilities.extractTextBySelectors(xml, ["d1\\:description"]),
        ).to.equal("Namespaced value");
      });

      it("returns an empty string for invalid XML, missing matches, or invalid selectors", () => {
        expect(
          XMLUtilities.extractTextBySelectors("<response>", ["description"]),
        ).to.equal("");
        expect(
          XMLUtilities.extractTextBySelectors(
            "<response><id>1</id></response>",
            ["description"],
          ),
        ).to.equal("");
        expect(
          XMLUtilities.extractTextBySelectors(
            "<response><id>1</id></response>",
            null,
          ),
        ).to.equal("");
      });
    });
  });
});

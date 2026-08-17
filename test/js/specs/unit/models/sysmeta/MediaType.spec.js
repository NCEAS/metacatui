define(["models/sysmeta/MediaType", "models/sysmeta/MediaTypeProperty"], (
  MediaType,
  MediaTypeProperty,
) => {
  const expect = chai.expect;

  const parseElement = (xml) =>
    new DOMParser().parseFromString(xml, "application/xml").documentElement;

  const createDoc = () =>
    new DOMParser().parseFromString("<root />", "application/xml");

  const summarizeIssues = (issues) =>
    issues.map(({ field, message }) => ({ field, message }));

  describe("MediaType", () => {
    describe("construction and mutation", () => {
      it("accepts a string shorthand and clones nested properties", () => {
        const sourceProperty = new MediaTypeProperty({
          name: "charset",
          value: "utf-8",
        });

        const mediaType = new MediaType({
          name: "text/csv",
          properties: [sourceProperty],
        });
        const shorthand = new MediaType("text/plain");

        expect(mediaType.name).to.equal("text/csv");
        expect(mediaType.properties[0]).to.be.instanceof(MediaTypeProperty);
        expect(mediaType.properties[0]).to.not.equal(sourceProperty);
        expect(mediaType.properties[0].toJSON()).to.deep.equal(
          sourceProperty.toJSON(),
        );
        expect(shorthand.name).to.equal("text/plain");
      });

      it("supports add, replace, remove, and clear", () => {
        const mediaType = new MediaType({ name: "text/csv" });

        mediaType
          .add({ name: "charset", value: "utf-8" })
          .add({ name: "profile", value: "tabular" })
          .replace(1, { name: "delimiter", value: "comma" })
          .remove(0);

        expect(mediaType.properties).to.have.length(1);
        expect(mediaType.properties[0].toJSON()).to.deep.equal({
          name: "delimiter",
          value: "comma",
        });

        mediaType.clear("properties");
        expect(mediaType.name).to.equal("text/csv");
        expect(mediaType.properties).to.have.length(0);

        mediaType.clear();
        expect(mediaType.isEmpty()).to.equal(true);
      });
    });

    describe("fromElement()", () => {
      it("parses mediaType elements and nested properties", () => {
        const mediaType = MediaType.fromElement(
          parseElement(`
            <mediaType name="text/csv">
              <property name="charset">utf-8</property>
            </mediaType>
          `),
        );

        expect(mediaType.name).to.equal("text/csv");
        expect(mediaType.property).to.equal(mediaType.properties);
        expect(mediaType.properties[0].toJSON()).to.deep.equal({
          name: "charset",
          value: "utf-8",
        });
      });

      it("requires the name attribute and only property children", () => {
        expect(() =>
          MediaType.fromElement(parseElement("<mediaType />")),
        ).to.throw(/required "name" attribute/i);

        expect(() =>
          MediaType.fromElement(
            parseElement(`
              <mediaType name="text/csv">
                <extra />
              </mediaType>
            `),
          ),
        ).to.throw(/unexpected <extra>/i);
      });
    });

    describe("isEmpty()", () => {
      it("detects when neither a name nor any properties are present", () => {
        expect(new MediaType().isEmpty()).to.equal(true);
        expect(
          new MediaType({
            properties: [{ name: "charset", value: "utf-8" }],
          }).isEmpty(),
        ).to.equal(false);
      });
    });

    describe("fromValue()", () => {
      it("coerces plain input and returns an empty media type for empty values", () => {
        const source = new MediaType({
          name: "text/csv",
          properties: [{ name: "charset", value: "utf-8" }],
        });

        const fromString = MediaType.fromValue("text/plain");
        const fromMediaType = MediaType.fromValue(source);

        expect(fromString).to.be.instanceof(MediaType);
        expect(fromString.name).to.equal("text/plain");
        expect(fromMediaType).to.be.instanceof(MediaType);
        expect(fromMediaType).to.not.equal(source);
        expect(fromMediaType.toJSON()).to.deep.equal(source.toJSON());
        expect(MediaType.fromValue({})).to.be.instanceof(MediaType);
        expect(MediaType.fromValue({}).isEmpty()).to.equal(true);
      });
    });

    describe("validate()", () => {
      it("requires a name and includes nested property validation paths", () => {
        const errors = new MediaType({
          name: "",
          properties: [{ name: "", value: "utf-8" }],
        }).validate();

        expect(summarizeIssues(errors)).to.deep.equal([
          {
            field: "mediaType.name",
            message: "mediaType requires a non-empty name attribute.",
          },
          {
            field: "mediaType.property[0].name",
            message: "Media type property names are required.",
          },
        ]);
      });
    });

    describe("toElement()", () => {
      it("returns null when empty", () => {
        expect(new MediaType().toElement(createDoc())).to.equal(null);
      });

      it("serializes the media type and nested properties", () => {
        const element = new MediaType({
          name: "text/csv",
          properties: [{ name: "charset", value: "utf-8" }],
        }).toElement(createDoc());

        const serialized = new XMLSerializer().serializeToString(element);

        expect(serialized).to.equal(
          '<mediaType name="text/csv"><property name="charset">utf-8</property></mediaType>',
        );
      });
    });

    describe("toJSON()", () => {
      it("returns cloned nested property data", () => {
        const mediaType = new MediaType({
          name: "text/csv",
          properties: [{ name: "charset", value: "utf-8" }],
        });

        const json = mediaType.toJSON();
        json.properties[0].name = "profile";

        expect(mediaType.properties[0].name).to.equal("charset");
      });
    });
  });
});

define(["models/sysmeta/MediaTypeProperty"], (MediaTypeProperty) => {
  const expect = chai.expect;

  const parseElement = (xml) =>
    new DOMParser().parseFromString(xml, "application/xml").documentElement;

  const createDoc = () =>
    new DOMParser().parseFromString("<root />", "application/xml");

  describe("MediaTypeProperty", () => {
    describe("construction", () => {
      it("normalizes name and value text", () => {
        const property = new MediaTypeProperty({
          name: " charset ",
          value: " utf-8 ",
        });

        expect(property.name).to.equal("charset");
        expect(property.value).to.equal("utf-8");
      });
    });

    describe("fromElement()", () => {
      it("parses property elements", () => {
        const property = MediaTypeProperty.fromElement(
          parseElement('<property name="charset">utf-8</property>'),
        );

        expect(property.toJSON()).to.deep.equal({
          name: "charset",
          value: "utf-8",
        });
      });

      it("requires the name attribute", () => {
        expect(() =>
          MediaTypeProperty.fromElement(parseElement("<property>utf-8</property>")),
        ).to.throw(/required "name" attribute/i);
      });
    });

    describe("validate()", () => {
      it("requires a non-empty property name", () => {
        expect(new MediaTypeProperty({ name: "" }).validate()).to.deep.equal([
          {
            field: "mediaType.property.name",
            message: "Media type property names are required.",
          },
        ]);
      });
    });

    describe("toElement()", () => {
      it("serializes property attributes and text content", () => {
        const element = new MediaTypeProperty({
          name: "charset",
          value: "utf-8",
        }).toElement(createDoc());

        const serialized = new XMLSerializer().serializeToString(element);

        expect(serialized).to.equal(
          '<property name="charset">utf-8</property>',
        );
      });

      it("omits null values from the serialized element", () => {
        const element = new MediaTypeProperty({ value: "utf-8" }).toElement(
          createDoc(),
        );

        expect(element.hasAttribute("name")).to.equal(false);
        expect(element.textContent).to.equal("utf-8");
      });
    });

    describe("toJSON()", () => {
      it("returns plain property data", () => {
        expect(
          new MediaTypeProperty({ name: "charset", value: "utf-8" }).toJSON(),
        ).to.deep.equal({
          name: "charset",
          value: "utf-8",
        });
      });
    });
  });
});

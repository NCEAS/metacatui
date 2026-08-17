define(["models/sysmeta/Checksum"], (Checksum) => {
  const expect = chai.expect;

  const parseElement = (xml) =>
    new DOMParser().parseFromString(xml, "application/xml").documentElement;

  const createDoc = () =>
    new DOMParser().parseFromString("<root />", "application/xml");

  const summarizeIssues = (issues) =>
    issues.map(({ field, message }) => ({ field, message }));

  describe("Checksum", () => {
    describe("construction and mutation", () => {
      it("normalizes checksum values and supports set and clear", () => {
        const checksum = new Checksum({
          value: " abc ",
          algorithm: " SHA-256 ",
        });

        expect(checksum.toJSON()).to.deep.equal({
          value: "abc",
          algorithm: "SHA-256",
        });

        checksum.set("def", "MD5");
        expect(checksum.toJSON()).to.deep.equal({
          value: "def",
          algorithm: "MD5",
        });

        checksum.clear();
        expect(checksum.isEmpty()).to.equal(true);
      });
    });

    describe("fromElement()", () => {
      it("parses checksum XML", () => {
        const checksum = Checksum.fromElement(
          parseElement(`<checksum algorithm="SHA-256">abcdef</checksum>`),
        );

        expect(checksum.toJSON()).to.deep.equal({
          value: "abcdef",
          algorithm: "SHA-256",
        });
      });

      it("requires the algorithm attribute", () => {
        expect(() => Checksum.fromElement(parseElement("<checksum>abc</checksum>")))
          .to.throw(/required "algorithm" attribute/i);
      });
    });

    describe("fromValue()", () => {
      it("coerces plain input and clones existing checksums", () => {
        const source = new Checksum({
          value: "abc",
          algorithm: "SHA-256",
        });

        const fromObject = Checksum.fromValue({
          value: "def",
          algorithm: "MD5",
        });
        const fromChecksum = Checksum.fromValue(source);

        expect(fromObject).to.be.instanceof(Checksum);
        expect(fromObject.toJSON()).to.deep.equal({
          value: "def",
          algorithm: "MD5",
        });
        expect(fromChecksum).to.be.instanceof(Checksum);
        expect(fromChecksum).to.not.equal(source);
        expect(fromChecksum.toJSON()).to.deep.equal(source.toJSON());
      });
    });

    describe("validate()", () => {
      it("reports missing checksum value and algorithm", () => {
        const issues = new Checksum().validate();

        expect(summarizeIssues(issues)).to.deep.equal([
          {
            field: "checksum.value",
            message:
              "checksum value is required and must be a non-empty string.",
          },
          {
            field: "checksum.algorithm",
            message:
              "checksum algorithm is required and must be a non-empty string.",
          },
        ]);
      });
    });

    describe("toElement()", () => {
      it("returns null when empty", () => {
        expect(new Checksum().toElement(createDoc())).to.equal(null);
      });

      it("serializes checksum XML", () => {
        const element = new Checksum({
          value: "abcdef",
          algorithm: "SHA-256",
        }).toElement(createDoc());

        const serialized = new XMLSerializer().serializeToString(element);
        expect(serialized).to.equal(
          '<checksum algorithm="SHA-256">abcdef</checksum>',
        );
      });
    });

    describe("toJSON()", () => {
      it("returns null when empty and plain data when populated", () => {
        expect(new Checksum().toJSON()).to.equal(null);
        expect(
          new Checksum({
            value: "abcdef",
            algorithm: "SHA-256",
          }).toJSON(),
        ).to.deep.equal({
          value: "abcdef",
          algorithm: "SHA-256",
        });
      });
    });
  });
});

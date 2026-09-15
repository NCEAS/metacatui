define(["models/maps/featureIdHelpers"], ({
  getIdFromProperties,
  propertyMatchesId,
}) => {
  const expect = chai.expect;

  describe("featureIdHelpers", () => {
    describe("getIdFromProperties", () => {
      it("prefers id over lower-priority keys", () => {
        const props = { id: "A", name: "B" };

        expect(getIdFromProperties(props)).to.equal("A");
      });
    });

    describe("propertyMatchesId", () => {
      it("matches only the canonical derived ID when multiple ID-like keys exist", () => {
        const props = { id: "A", name: "B" };

        expect(propertyMatchesId(props, "A")).to.equal(true);
        expect(propertyMatchesId(props, "B")).to.equal(false);
      });

      it("does not match lower-priority key collisions when id is present", () => {
        const collisionCases = [
          { id: "A", identifier: "B" },
          { id: "A", uuid: "B" },
          { id: "A", name: "B" },
          { id: "A", title: "B" },
          { id: "A", label: "B" },
        ];

        collisionCases.forEach((props) => {
          expect(propertyMatchesId(props, "A")).to.equal(true);
          expect(propertyMatchesId(props, "B")).to.equal(false);
        });
      });

      it("still matches name/title/label when they are the canonical ID", () => {
        expect(propertyMatchesId({ name: "B" }, "B")).to.equal(true);
        expect(propertyMatchesId({ title: "C" }, "C")).to.equal(true);
        expect(propertyMatchesId({ label: "D" }, "D")).to.equal(true);
      });

      it("trims both compared values", () => {
        expect(
          propertyMatchesId({ identifier: "  feat-1  " }, "feat-1"),
        ).to.equal(true);
      });
    });
  });
});

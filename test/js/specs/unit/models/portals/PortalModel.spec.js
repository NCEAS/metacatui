define(["models/portals/PortalModel", "models/portals/PortalImage"], (
  PortalModel,
  PortalImage,
) => {
  const expect = chai.expect;

  describe("PortalModel getRandomSectionImage", () => {
    let sandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("skips a 404 image and returns the next available image", () => {
      const portal = new PortalModel({
        defaultSectionImageIds: ["missing.png", "available.png"],
      });
      const imageExists = sandbox
        .stub(PortalImage.prototype, "imageExists")
        .callsFake(function checkImage() {
          return this.get("identifier") === "available.png";
        });

      const image = portal.getRandomSectionImage();

      expect(image).to.be.instanceOf(PortalImage);
      expect(image.get("identifier")).to.equal("available.png");
      expect(imageExists.firstCall.thisValue.get("identifier")).to.equal(
        "missing.png",
      );
      expect(portal.getRandomSectionImage().get("identifier")).to.equal(
        "available.png",
      );
      expect(imageExists.callCount).to.equal(3);
    });

    it("returns an empty string when every image responds with 404", () => {
      const portal = new PortalModel({
        defaultSectionImageIds: ["missing-1.png", "missing-2.png"],
      });
      const imageExists = sandbox
        .stub(PortalImage.prototype, "imageExists")
        .returns(false);

      expect(portal.getRandomSectionImage()).to.equal("");
      expect(imageExists.firstCall.thisValue.get("identifier")).to.equal(
        "missing-1.png",
      );
      expect(imageExists.secondCall.thisValue.get("identifier")).to.equal(
        "missing-2.png",
      );
      expect(portal.getRandomSectionImage()).to.equal("");
      expect(imageExists.callCount).to.equal(2);
    });
  });
});

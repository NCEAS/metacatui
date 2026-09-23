define(["models/portals/PortalModel", "models/portals/PortalImage"], (
  PortalModel,
  PortalImage,
) => {
  const expect = chai.expect;

  const parsePortal = (optionsXML) => {
    const xml = new DOMParser().parseFromString(
      `<por:portal xmlns:por="https://purl.dataone.org/portals-1.1.0">
        <label>Test portal</label>
        <definition><filter><field>formatType</field><value>METADATA</value></filter></definition>
        ${optionsXML}
      </por:portal>`,
      "application/xml",
    );
    const portal = new PortalModel({});
    portal.set(portal.parse(xml));
    delete window.filterXML;
    return portal;
  };

  const getRootOptions = (xml) => {
    const root = new DOMParser().parseFromString(
      xml,
      "application/xml",
    ).documentElement;
    return Array.from(root.children).filter(
      (child) => child.localName === "option",
    );
  };

  describe("PortalModel root options", () => {
    it("projects the first value, booleans, and page order from direct root options", () => {
      const portal = parsePortal(`
        <option><optionName>hideData</optionName><optionValue>true</optionValue><optionValue>trailing</optionValue></option>
        <option><optionName>hideMetrics</optionName><optionValue>false</optionValue></option>
        <option><optionName>pageOrder</optionName><optionValue>Data,Map</optionValue></option>
        <option><optionName>customOption</optionName><optionValue>custom</optionValue></option>
      `);

      expect(portal.get("hideData")).to.equal(true);
      expect(portal.get("hideMetrics")).to.equal(false);
      expect(portal.get("pageOrder")).to.deep.equal(["Data", "Map"]);
      expect(portal.get("customOption")).to.equal("custom");
    });

    it("rejects an invalid trailing root option value during parse", () => {
      expect(() =>
        parsePortal(
          "<option><optionName>hideData</optionName><optionValue>true</optionValue><optionValue> </optionValue></option>",
        ),
      ).to.throw(/optionValue/);
      delete window.filterXML;
    });

    it("updates only the exact known option and preserves unknown and trailing values", () => {
      const portal = parsePortal(`
        <option><optionName>primaryColorExtra</optionName><optionValue>leave me</optionValue></option>
        <option><optionName>primaryColor</optionName><optionValue>#123456</optionValue><optionValue>second</optionValue></option>
        <option><optionName>customOption</optionName><optionValue>custom</optionValue></option>
      `);
      portal.set("primaryColor", "#abcdef");

      const serialized = portal.serialize();
      const options = getRootOptions(serialized);
      const valuesFor = (name) =>
        options
          .filter((option) => option.firstElementChild.textContent === name)
          .map((option) =>
            Array.from(option.children)
              .slice(1)
              .map((value) => value.textContent),
          );

      expect(valuesFor("primaryColorExtra")).to.deep.equal([["leave me"]]);
      expect(valuesFor("primaryColor")).to.deep.equal([["#abcdef", "second"]]);
      expect(valuesFor("customOption")).to.deep.equal([["custom"]]);
    });

    it("removes a default-valued known option and writes a new known option", () => {
      const portal = parsePortal(
        "<option><optionName>primaryColor</optionName><optionValue>#123456</optionValue></option>",
      );
      portal.set("primaryColor", portal.defaults().primaryColor);
      portal.set("theme", "dark");

      const options = getRootOptions(portal.serialize());
      const names = options.map(
        (option) => option.firstElementChild.textContent,
      );

      expect(names).not.to.include("primaryColor");
      expect(names).to.include("theme");
      expect(
        options.find(
          (option) => option.firstElementChild.textContent === "theme",
        ).children[1].textContent,
      ).to.equal("dark");
    });

    it("reports invalid known option values through the outer serialization error", () => {
      const portal = parsePortal("");
      portal.set("theme", "  ");
      let saveError;
      portal.on("errorSaving", (message) => {
        saveError = message;
      });

      expect(portal.serialize()).to.equal(undefined);
      expect(saveError).to.equal(
        MetacatUI.appModel.get("portalEditSaveErrorMsg"),
      );
      expect(portal.get("errorMessage")).to.match(/optionValue/);
    });
  });

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

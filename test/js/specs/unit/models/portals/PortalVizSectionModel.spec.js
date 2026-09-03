define([
  "models/portals/PortalModel",
  "models/portals/PortalSectionModel",
  "models/portals/PortalVizSectionModel",
  "models/maps/Map",
], (PortalModel, PortalSectionModel, PortalVizSectionModel, Map) => {
  const expect = chai.expect;

  const mixedMapConfig = {
    homePosition: {
      longitude: -110,
      latitude: 65,
      height: 3000000,
    },
    showToolbar: false,
  };

  const getOptionValue = (section, optionName) => {
    const options = Array.from(section.getElementsByTagName("option"));
    const option = options.find(
      (candidate) =>
        candidate.getElementsByTagName("optionName")[0]?.textContent ===
        optionName,
    );

    return option?.getElementsByTagName("optionValue")[0]?.textContent;
  };

  const parsePortal = (xml) => {
    const xmlDocument =
      typeof xml === "string"
        ? new DOMParser().parseFromString(xml, "application/xml")
        : xml;
    const portal = new PortalModel({});
    portal.set(portal.parse(xmlDocument));
    // FilterGroup.parse currently leaks its temporary XML clone globally.
    delete window.filterXML;
    return portal;
  };

  const createMixedPortal = () =>
    parsePortal(
      new DOMParser().parseFromString(
        `<por:portal xmlns:por="https://purl.dataone.org/portals-1.1.0">
          <label>Test portal</label>
          <definition>
            <filter>
              <field>formatType</field>
              <value>METADATA</value>
            </filter>
          </definition>
          <section>
            <label>About</label>
            <title>About this portal</title>
            <content><markdown>Regular body</markdown></content>
          </section>
          <section>
            <label>Map</label>
            <content><markdown>Existing visualization</markdown></content>
            <option>
              <optionName>sectionType</optionName>
              <optionValue>visualization</optionValue>
            </option>
            <option>
              <optionName>visualizationType</optionName>
              <optionValue>cesium</optionValue>
            </option>
            <option>
              <optionName>mapConfig</optionName>
              <optionValue>${JSON.stringify(mixedMapConfig)}</optionValue>
            </option>
          </section>
        </por:portal>`,
        "application/xml",
      ),
    );

  describe("PortalVizSectionModel Test Suite", () => {
    it("preserves Cesium options when an existing section is renamed", () => {
      const mapConfig = {
        homePosition: {
          longitude: -120,
          latitude: 70,
          height: 2500000,
        },
        showToolbar: false,
      };
      const xml = new DOMParser().parseFromString(
        `<por:portal xmlns:por="https://purl.dataone.org/portals-1.1.0">
          <label>Test portal</label>
          <section>
            <label>Existing map</label>
            <content>Existing visualization</content>
            <option>
              <optionName>sectionType</optionName>
              <optionValue>visualization</optionValue>
            </option>
            <option>
              <optionName>visualizationType</optionName>
              <optionValue>cesium</optionValue>
            </option>
            <option>
              <optionName>mapConfig</optionName>
              <optionValue>${JSON.stringify(mapConfig)}</optionValue>
            </option>
          </section>
        </por:portal>`,
        "application/xml",
      );
      const portal = new PortalModel({});
      portal.set(portal.parse(xml));

      const section = portal.get("sections")[0];
      const map = section.get("mapModel");

      expect(section).to.be.instanceof(PortalVizSectionModel);
      expect(section.get("sectionType")).to.equal("visualization");
      expect(section.get("visualizationType")).to.equal("cesium");
      expect(map).to.be.instanceof(Map);
      expect(map.get("homePosition")).to.deep.equal(mapConfig.homePosition);
      expect(map.get("showToolbar")).to.equal(false);

      const sourceDOM = section.get("objectDOM");
      section.set("label", "Updated map");
      const updatedDOM = section.updateDOM();

      expect(updatedDOM).not.to.equal(sourceDOM);
      expect(sourceDOM.getElementsByTagName("label")[0].textContent).to.equal(
        "Existing map",
      );
      expect(updatedDOM.getElementsByTagName("label")[0].textContent).to.equal(
        "Updated map",
      );
      expect(getOptionValue(updatedDOM, "sectionType")).to.equal(
        "visualization",
      );
      expect(getOptionValue(updatedDOM, "visualizationType")).to.equal(
        "cesium",
      );
      const updatedMapConfig = JSON.parse(
        getOptionValue(updatedDOM, "mapConfig"),
      );
      expect(updatedMapConfig.homePosition).to.deep.equal(
        mapConfig.homePosition,
      );
      expect(updatedMapConfig.showToolbar).to.equal(false);
    });

    it("adds and removes a visualization section instance", () => {
      const portal = new PortalModel({});
      const sectionToRemove = new PortalVizSectionModel();
      const sectionToKeep = new PortalVizSectionModel();

      portal.addSection(sectionToRemove);
      portal.addSection(sectionToKeep);
      portal.removeSection(sectionToRemove);

      expect(portal.get("sections")).to.have.length(1);
      expect(portal.get("sections")[0]).to.equal(sectionToKeep);
    });

    it("creates a Cesium section by type", () => {
      const portal = new PortalModel({});
      const section = portal.addSection("cesium");

      expect(section).to.be.instanceof(PortalVizSectionModel);
      expect(section.get("visualizationType")).to.equal("cesium");
      expect(section.get("mapModel")).to.be.instanceof(Map);
      expect(portal.sectionIsDefault(section)).to.equal(false);

      section.set("label", "Map");
      const sectionDOM = section.updateDOM();
      expect(sectionDOM.getElementsByTagName("label")[0].textContent).to.equal(
        "Map",
      );
      expect(sectionDOM.firstElementChild.tagName).to.equal("label");
      expect(getOptionValue(sectionDOM, "visualizationType")).to.equal(
        "cesium",
      );
    });

    it("round-trips freeform and Cesium sections through serialization", () => {
      const portal = createMixedPortal();
      const serializedPortal = portal.serialize();

      expect(serializedPortal).to.be.a("string").and.not.empty;

      const reloadedPortal = parsePortal(serializedPortal);
      const [freeformSection, mapSection] = reloadedPortal.get("sections");

      expect(reloadedPortal.get("sections")).to.have.length(2);
      expect(
        reloadedPortal.get("sections").map((section) => section.get("label")),
      ).to.deep.equal(["About", "Map"]);
      expect(freeformSection).to.be.instanceof(PortalSectionModel);
      expect(freeformSection).not.to.be.instanceof(PortalVizSectionModel);
      expect(freeformSection.get("title")).to.equal("About this portal");
      expect(freeformSection.get("content").get("markdown")).to.equal(
        "Regular body",
      );
      expect(mapSection).to.be.instanceof(PortalVizSectionModel);
      expect(mapSection.get("visualizationType")).to.equal("cesium");
      expect(mapSection.get("mapModel")).to.be.instanceof(Map);
      expect(mapSection.get("mapModel").get("homePosition")).to.deep.equal(
        mixedMapConfig.homePosition,
      );
      expect(mapSection.get("mapModel").get("showToolbar")).to.equal(false);
    });

    it("persists Cesium section removal without dropping freeform content", () => {
      const portal = createMixedPortal();
      const mapSection = portal
        .get("sections")
        .find((section) => section instanceof PortalVizSectionModel);

      portal.removeSection(mapSection);

      const serializedPortal = portal.serialize();

      expect(serializedPortal).to.be.a("string").and.not.empty;

      const reloadedPortal = parsePortal(serializedPortal);
      const remainingSection = reloadedPortal.get("sections")[0];

      expect(reloadedPortal.get("sections")).to.have.length(1);
      expect(remainingSection).to.be.instanceof(PortalSectionModel);
      expect(remainingSection).not.to.be.instanceof(PortalVizSectionModel);
      expect(remainingSection.get("label")).to.equal("About");
      expect(remainingSection.get("title")).to.equal("About this portal");
      expect(remainingSection.get("content").get("markdown")).to.equal(
        "Regular body",
      );
    });
  });
});

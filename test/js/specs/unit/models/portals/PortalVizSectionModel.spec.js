define([
  "models/portals/PortalModel",
  "models/portals/PortalSectionModel",
  "models/portals/PortalVizSectionModel",
  "models/portals/PortalOption",
  "models/maps/Map",
], (
  PortalModel,
  PortalSectionModel,
  PortalVizSectionModel,
  PortalOption,
  Map,
) => {
  const expect = chai.expect;

  const mixedMapConfig = {
    homePosition: {
      longitude: -110,
      latitude: 65,
      height: 3000000,
    },
    showToolbar: false,
    viewfinderCards: [
      { title: "Original place", latitude: 65, longitude: -110 },
    ],
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
              <optionValue>keep map extra</optionValue>
            </option>
            <option><optionName>mapConfigExtra</optionName><optionValue>keep nearby</optionValue></option>
            <option><optionName>customSection</optionName><optionValue>keep section</optionValue></option>
          </section>
          <option><optionName>hideData</optionName><optionValue>true</optionValue></option>
          <option><optionName>customRoot</optionName><optionValue>keep root</optionValue></option>
        </por:portal>`,
        "application/xml",
      ),
    );

  describe("PortalVizSectionModel Test Suite", () => {
    it("selects a visualization section by the exact sectionType option", () => {
      const portal = parsePortal(
        `<por:portal xmlns:por="https://purl.dataone.org/portals-1.1.0">
          <label>Test portal</label>
          <definition><filter><field>formatType</field><value>METADATA</value></filter></definition>
          <section>
            <label>Map</label>
            <content><markdown>Visualization</markdown></content>
            <option><optionName>othersectionType</optionName><optionValue>freeform</optionValue></option>
            <option><optionName>sectionType</optionName><optionValue>visualization</optionValue></option>
            <option><optionName>visualizationType</optionName><optionValue>cesium</optionValue></option>
            <option><optionName>mapConfig</optionName><optionValue>{"showToolbar":false}</optionValue></option>
          </section>
        </por:portal>`,
      );

      expect(portal.get("sections")[0]).to.be.instanceof(PortalVizSectionModel);
    });

    it("preserves Cesium options when an existing section is renamed", () => {
      const mapConfig = {
        homePosition: {
          longitude: -120,
          latitude: 70,
          height: 2500000,
        },
        showToolbar: false,
        viewfinderCards: [{ title: "Home", latitude: 70, longitude: -120 }],
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
              <optionName>visualizationTypeExtra</optionName>
              <optionValue>fever</optionValue>
            </option>
            <option>
              <optionName>visualizationType</optionName>
              <optionValue>cesium</optionValue>
              <optionValue>keep visualization extra</optionValue>
            </option>
            <option>
              <optionName>mapConfigExtra</optionName>
              <optionValue>leave me</optionValue>
            </option>
            <option>
              <optionName>mapConfig</optionName>
              <optionValue>${JSON.stringify(mapConfig)}</optionValue>
              <optionValue>keep map extra</optionValue>
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
      map.set("showToolbar", true);
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
      expect(
        PortalOption.fromElement(
          PortalOption.findDirectChild(updatedDOM, "visualizationType"),
        ).optionValue,
      ).to.deep.equal(["cesium", "keep visualization extra"]);
      const updatedMapConfig = JSON.parse(
        getOptionValue(updatedDOM, "mapConfig"),
      );
      expect(updatedMapConfig.homePosition).to.deep.equal(
        mapConfig.homePosition,
      );
      expect(updatedMapConfig.showToolbar).to.equal(true);
      expect(updatedMapConfig.viewfinderCardCategories[0].label).to.equal(
        "Zoom to...",
      );
      expect(
        updatedMapConfig.viewfinderCardCategories[0].viewfinderCards[0].buttons,
      ).to.have.length(1);
      expect(updatedMapConfig).not.to.have.property("viewfinderCards");
      const mapOptions = Array.from(updatedDOM.children).filter(
        (child) =>
          child.localName === "option" &&
          child.firstElementChild?.textContent === "mapConfig",
      );
      expect(mapOptions).to.have.length(1);
      expect(mapOptions[0].children[1].firstChild.nodeType).to.equal(4);
      expect(PortalOption.fromElement(mapOptions[0]).optionValue[1]).to.equal(
        "keep map extra",
      );
      expect(getOptionValue(updatedDOM, "mapConfigExtra")).to.equal("leave me");
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
      const mapConfig = PortalOption.findDirectChild(sectionDOM, "mapConfig");
      expect(mapConfig).to.exist;
      expect(mapConfig.children[1].firstChild.nodeType).to.equal(4);
      const savedConfig = JSON.parse(mapConfig.children[1].textContent);
      expect(savedConfig.showToolbar).to.equal(true);
      expect(savedConfig.layers[0].type).to.equal(
        "OpenStreetMapImageryProvider",
      );
      expect(savedConfig.terrains).to.deep.equal([]);
    });

    it("round-trips freeform and Cesium sections through serialization", () => {
      const portal = createMixedPortal();
      const sourceSection = portal.get("sections")[1];
      const map = sourceSection.get("mapModel");
      const sourceDOM = sourceSection.get("objectDOM");
      const sourceXML = new XMLSerializer().serializeToString(sourceDOM);
      map.set("showToolbar", true);
      const cards = map
        .get("viewfinderCardsCollection")
        .at(0)
        .get("viewfinderCards");
      cards.at(0).set("title", "Edited place");
      portal.set("hideData", false);
      portal.set("theme", "ocean");
      const serializedPortal = portal.serialize();

      expect(serializedPortal).to.be.a("string").and.not.empty;
      const serializedXML = new DOMParser().parseFromString(
        serializedPortal,
        "application/xml",
      );
      const root = serializedXML.documentElement;
      const mapSectionElement = Array.from(root.children).find(
        (child) =>
          child.localName === "section" &&
          child.firstElementChild?.textContent === "Map",
      );
      const mapOption = PortalOption.findDirectChild(
        mapSectionElement,
        "mapConfig",
      );
      const directMapOptions = Array.from(mapSectionElement.children).filter(
        (child) =>
          child.localName === "option" &&
          child.firstElementChild?.textContent === "mapConfig",
      );

      expect(root.namespaceURI).to.equal(
        "https://purl.dataone.org/portals-1.1.0",
      );
      expect(mapOption.children[1].firstChild.nodeType).to.equal(4);
      expect(directMapOptions).to.have.length(1);
      const savedConfig = JSON.parse(mapOption.children[1].textContent);
      expect(savedConfig.showToolbar).to.equal(true);
      expect(
        savedConfig.viewfinderCardCategories[0].viewfinderCards[0].title,
      ).to.equal("Edited place");
      expect(savedConfig).not.to.have.property("viewfinderCards");
      const mapOptionValues = PortalOption.fromElement(mapOption).optionValue;
      expect(mapOptionValues).to.have.length(2);
      expect(mapOptionValues[1]).to.equal("keep map extra");
      expect(
        PortalOption.findDirectChild(mapSectionElement, "mapConfigExtra")
          .children[1].textContent,
      ).to.equal("keep nearby");
      expect(
        PortalOption.findDirectChild(mapSectionElement, "customSection")
          .children[1].textContent,
      ).to.equal("keep section");
      expect(
        PortalOption.findDirectChild(root, "customRoot").children[1]
          .textContent,
      ).to.equal("keep root");
      expect(sourceSection.get("objectDOM")).to.equal(sourceDOM);
      expect(new XMLSerializer().serializeToString(sourceDOM)).to.equal(
        sourceXML,
      );

      const reloadedPortal = parsePortal(serializedPortal);
      const [freeformSection, mapSection] = reloadedPortal.get("sections");

      expect(reloadedPortal.get("hideData")).to.equal(false);
      expect(reloadedPortal.get("theme")).to.equal("ocean");
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
      expect(mapSection.get("mapModel").get("showToolbar")).to.equal(true);
      const reloadedCards = mapSection
        .get("mapModel")
        .get("viewfinderCardsCollection")
        .at(0)
        .get("viewfinderCards");
      expect(reloadedCards.at(0).get("title")).to.equal("Edited place");
    });

    it("serializes and reparses a new portal with root and Cesium options", () => {
      const portal = new PortalModel({});
      portal.set("label", "New portal");
      portal.set("hideMetrics", true);
      portal.get("definitionFilters").add({
        fields: ["formatType"],
        values: ["METADATA"],
      });
      const section = portal.addSection("cesium");
      section.set("label", "Map");
      const map = section.get("mapModel");
      map.set("showToolbar", false);
      map.get("layers").at(0).set("label", "Edited base layer");

      const serialized = portal.serialize();
      expect(serialized).to.be.a("string").and.not.empty;
      const xml = new DOMParser().parseFromString(
        serialized,
        "application/xml",
      );
      const root = xml.documentElement;
      const sectionElement = Array.from(root.children).find(
        (child) => child.localName === "section",
      );
      const mapOption = PortalOption.findDirectChild(
        sectionElement,
        "mapConfig",
      );
      const directMapOptions = Array.from(sectionElement.children).filter(
        (child) =>
          child.localName === "option" &&
          child.firstElementChild?.textContent === "mapConfig",
      );

      expect(root.namespaceURI).to.equal(
        "https://purl.dataone.org/portals-1.1.0",
      );
      expect(PortalOption.findDirectChild(root, "hideMetrics")).to.exist;
      expect(directMapOptions).to.have.length(1);
      expect(mapOption.children).to.have.length(2);
      expect(mapOption.children[1].firstChild.nodeType).to.equal(4);
      const savedConfig = JSON.parse(mapOption.children[1].textContent);
      expect(savedConfig.showToolbar).to.equal(false);
      expect(savedConfig.layers[0].label).to.equal("Edited base layer");

      const reloaded = parsePortal(xml);
      expect(reloaded.get("hideMetrics")).to.equal(true);
      expect(reloaded.get("sections")[0]).to.be.instanceof(
        PortalVizSectionModel,
      );
      expect(reloaded.get("sections")[0].get("mapModel")).to.be.instanceof(Map);
      const reloadedMap = reloaded.get("sections")[0].get("mapModel");
      expect(reloadedMap.get("showToolbar")).to.equal(false);
      expect(reloadedMap.get("layers").at(0).get("label")).to.equal(
        "Edited base layer",
      );
    });

    it("round-trips a map config value containing a CDATA terminator", () => {
      const portal = new PortalModel({});
      portal.set("label", "New portal");
      portal.get("definitionFilters").add({
        fields: ["formatType"],
        values: ["METADATA"],
      });
      const section = portal.addSection("cesium");
      section.set("label", "Map");
      section.get("mapModel").set("feedbackText", "Before ]]> after");

      const serialized = portal.serialize();
      expect(serialized).to.be.a("string").and.not.empty;
      const xml = new DOMParser().parseFromString(
        serialized,
        "application/xml",
      );
      expect(xml.getElementsByTagName("parsererror").length).to.equal(0);

      const sectionElement = Array.from(xml.documentElement.children).find(
        (child) => child.localName === "section",
      );
      const mapOption = PortalOption.findDirectChild(
        sectionElement,
        "mapConfig",
      );
      expect(mapOption.children[1].firstChild.nodeType).to.equal(4);
      expect(
        JSON.parse(mapOption.children[1].textContent).feedbackText,
      ).to.equal("Before ]]> after");

      const reloaded = parsePortal(xml);
      expect(
        reloaded.get("sections")[0].get("mapModel").get("feedbackText"),
      ).to.equal("Before ]]> after");
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
      expect(reloadedPortal.get("hideData")).to.equal(true);
    });
  });
});

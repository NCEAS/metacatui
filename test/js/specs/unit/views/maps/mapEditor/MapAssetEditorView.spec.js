define([
  "models/maps/assets/CesiumImagery",
  "views/maps/mapEditor/MapAssetEditorView",
  "/test/js/specs/shared/clean-state.js",
], (CesiumImagery, MapAssetEditorView, cleanState) => {
  const expect = chai.expect;
  const WMTS = "WebMapTileServiceImageryProvider";
  const ION = "IonImageryProvider";
  const OSM = "OpenStreetMapImageryProvider";

  describe("MapAssetEditorView", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      sandbox.stub(CesiumImagery.prototype, "createCesiumModelWhenVisible");
      sandbox.stub(CesiumImagery.prototype, "getThumbnail");
      const createImagery = sandbox.stub(
        CesiumImagery.prototype,
        "createCesiumModel",
      );
      const model = new CesiumImagery({
        id: "asset-1",
        label: "CO<sub>2</sub>",
        description: "</textarea><b>Literal description</b>",
        type: WMTS,
        opacity: 0.5,
        saturation: 0.8,
        attribution: "Original attribution",
        moreInfoLink: "https://example.org/metadata",
        cesiumOptions: {
          url: "/tiles/{TileMatrix}/{TileCol}/{TileRow}.png",
          tilingScheme: "GeographicTilingScheme",
          rectangle: [-143.9, 69.65, -143.7, 69.75],
          layer: "existing-layer",
          dimensions: { time: "2020" },
        },
      });
      const view = new MapAssetEditorView({ model });
      const container = document.createElement("form");
      container.append(view.el);
      document.body.append(container);
      view.render();
      return { sandbox, createImagery, model, view, container };
    }, beforeEach);

    const field = (name, root = state.view.el) =>
      root.querySelector(`[name="${name}"]`);
    const source = (type) =>
      state.view.el.querySelector(`[data-provider="${type}"]`);
    const error = (name) =>
      state.view.el.querySelector(`[data-error="${name}"]`);
    const apply = () => state.view.el.querySelector("button").click();

    afterEach(() => {
      state.view.remove();
      state.container.remove();
      state.model.stopListening();
      state.sandbox.restore();
    });

    it("uses the supplied model and puts labeled metadata controls first", () => {
      expect(state.view.model).to.equal(state.model);
      const controls = [
        ...state.view.el.querySelectorAll("input, textarea, select"),
      ];
      expect(controls.slice(0, 3).map((control) => control.name)).to.deep.equal(
        ["label", "description", "type"],
      );
      expect(state.view.el.querySelector("h1, h2, h3, form")).to.equal(null);
      expect(controls.every((control) => control.closest("label"))).to.equal(
        true,
      );
      expect(
        [...field("type").options].map((option) => option.value),
      ).to.deep.equal([WMTS, ION, OSM]);
      expect(state.view.el.querySelector("button").type).to.equal("button");
    });

    it("keeps metadata HTML literal and a configured extent collapsed", () => {
      expect(field("label").value).to.equal("CO<sub>2</sub>");
      expect(field("description").value).to.equal(
        "</textarea><b>Literal description</b>",
      );
      expect(state.view.el.querySelector("sub, b")).to.equal(null);
      expect(state.view.el.querySelector("summary").textContent).to.equal(
        "Geographic extent (optional)",
      );
      expect(state.view.el.querySelector("details").open).to.equal(false);
      expect(
        ["west", "south", "east", "north"].map((name) =>
          Number(field(name).value),
        ),
      ).to.deep.equal([-143.9, 69.65, -143.7, 69.75]);
      apply();
      expect(state.model.get("label")).to.equal("CO<sub>2</sub>");
      expect(state.model.get("description")).to.equal(
        "</textarea><b>Literal description</b>",
      );
    });

    it("shows the default or custom OpenStreetMap URL as the actual value", () => {
      state.model.set({ type: OSM });
      state.model.unset("cesiumOptions");
      state.view.render();
      expect(field("url", source(OSM)).value).to.equal(
        CesiumImagery.OSM_DEFAULT_URL,
      );
      apply();
      expect(state.model.get("cesiumOptions").url).to.equal(
        CesiumImagery.OSM_DEFAULT_URL,
      );
      state.model.set("cesiumOptions", {
        url: "https://a.tile.opentopomap.org/",
      });
      state.view.render();
      expect(field("url", source(OSM)).value).to.equal(
        "https://a.tile.opentopomap.org/",
      );
      state.model.set("cesiumOptions", { url: "" });
      state.view.render();
      expect(field("url", source(OSM)).value).to.equal(
        CesiumImagery.OSM_DEFAULT_URL,
      );
    });

    it("renders an existing numeric-string Ion ID", () => {
      state.model.set({ type: ION, cesiumOptions: { ionAssetId: "2" } });
      state.view.render();
      expect(field("ionAssetId").value).to.equal("2");
      expect(source(ION).hidden).to.equal(false);
    });

    it("preserves an Ion rectangle that this editor does not expose", () => {
      const rectangle = [-143.9, 69.65, -143.7, 69.75];
      state.model.set({
        type: ION,
        cesiumOptions: { ionAssetId: "2", rectangle },
      });
      state.view.render();
      apply();
      expect(state.model.get("cesiumOptions").rectangle).to.equal(rectangle);
    });

    it("switches source controls without discarding metadata or changing the model", () => {
      field("label").value = "Draft label";
      field("description").value = "Draft description";
      field("type").value = ION;
      field("type").dispatchEvent(new Event("change", { bubbles: true }));
      expect(source(ION).hidden).to.equal(false);
      expect(source(WMTS).hidden).to.equal(true);
      expect(field("ionAssetId").value).to.equal("");
      field("type").value = OSM;
      field("type").dispatchEvent(new Event("change", { bubbles: true }));
      expect(field("url", source(OSM)).value).to.equal(
        CesiumImagery.OSM_DEFAULT_URL,
      );
      field("type").value = WMTS;
      field("type").dispatchEvent(new Event("change", { bubbles: true }));
      expect(field("url", source(WMTS)).value).to.equal("");
      expect(field("tilingScheme").value).to.equal("");
      expect(field("west").value).to.equal("");
      expect(field("label").value).to.equal("Draft label");
      expect(field("description").value).to.equal("Draft description");
      expect(state.model.get("type")).to.equal(WMTS);
      expect(state.model.get("label")).to.equal("CO<sub>2</sub>");
    });

    it("keeps an invalid draft isolated and clears feedback after correction", () => {
      const before = { ...state.model.attributes };
      field("label").value = "Draft label";
      field("url", source(WMTS)).value = "/invalid";
      expect(state.model.attributes).to.deep.equal(before);
      apply();
      expect(state.model.attributes).to.deep.equal(before);
      expect(state.model.get("cesiumOptions")).to.equal(before.cesiumOptions);
      expect(field("url", source(WMTS)).value).to.equal("/invalid");
      expect(error("cesiumOptions.url").textContent).not.to.equal("");
      field("url", source(WMTS)).value =
        "/fixed/{TileMatrix}/{TileCol}/{TileRow}";
      apply();
      expect(state.model.get("label")).to.equal("Draft label");
      expect(error("cesiumOptions.url").textContent).to.equal("");
    });

    it("rejects partial extent input and accepts an antimeridian extent", () => {
      const options = state.model.get("cesiumOptions");
      field("south").value = "";
      apply();
      expect(state.model.get("cesiumOptions")).to.equal(options);
      expect(error("cesiumOptions.rectangle").textContent).not.to.equal("");
      [170, -20, -170, 20].forEach((value, index) => {
        field(["west", "south", "east", "north"][index]).value = value;
      });
      field("tilingScheme").value = "WebMercatorTilingScheme";
      apply();
      expect(state.model.get("cesiumOptions").rectangle).to.deep.equal([
        170, -20, -170, 20,
      ]);
      expect(state.model.get("cesiumOptions").tilingScheme).to.equal(
        "WebMercatorTilingScheme",
      );
      expect(error("cesiumOptions.rectangle").textContent).to.equal("");
    });

    it("preserves unrelated attributes and unedited options in one validated set", () => {
      state.model.set("cesiumModel", { alpha: 0.5, show: true });
      const before = { ...state.model.attributes };
      const oldOptions = before.cesiumOptions;
      const set = state.sandbox.spy(state.model, "set");
      const change = state.sandbox.spy();
      const submit = state.sandbox.spy();
      state.model.on("change", change);
      state.container.addEventListener("submit", submit);
      field("label").value = "Accepted label";
      field("url", source(WMTS)).value =
        "/new/{TileMatrix}/{TileCol}/{TileRow}";
      apply();
      expect(set.callCount).to.equal(1);
      expect(Object.keys(set.firstCall.args[0]).sort()).to.deep.equal(
        ["label", "description", "type", "cesiumOptions"].sort(),
      );
      expect(set.firstCall.args[1]).to.deep.equal({ validate: true });
      expect(change.callCount).to.equal(1);
      expect(submit.called).to.equal(false);
      Object.entries(before).forEach(([key, value]) => {
        if (!["label", "description", "type", "cesiumOptions"].includes(key)) {
          expect(state.model.get(key)).to.equal(value);
        }
      });
      expect(state.model.get("cesiumOptions")).not.to.equal(oldOptions);
      expect(state.model.get("cesiumOptions").layer).to.equal("existing-layer");
      expect(state.model.get("cesiumOptions").dimensions).to.equal(
        oldOptions.dimensions,
      );
      expect(oldOptions.url).to.equal(
        "/tiles/{TileMatrix}/{TileCol}/{TileRow}.png",
      );
      expect(state.createImagery.called).to.equal(false);
    });

    it("omits cleared optional fields without dropping unedited options", () => {
      ["west", "south", "east", "north", "tilingScheme"].forEach((name) => {
        field(name).value = "";
      });
      apply();
      expect(state.model.get("cesiumOptions")).not.to.have.property(
        "rectangle",
      );
      expect(state.model.get("cesiumOptions")).not.to.have.property(
        "tilingScheme",
      );
      expect(state.model.get("cesiumOptions").layer).to.equal("existing-layer");
      state.model.set({
        type: OSM,
        cesiumOptions: {
          url: "https://a.tile.opentopomap.org/",
          maximumLevel: 10,
        },
      });
      state.view.render();
      field("url", source(OSM)).value = "";
      apply();
      expect(state.model.get("cesiumOptions")).to.deep.equal({
        maximumLevel: 10,
      });
    });

    it("uses model Ion validation and drops old options on provider change", () => {
      field("type").value = ION;
      field("type").dispatchEvent(new Event("change", { bubbles: true }));
      field("ionAssetId").value = "0";
      apply();
      expect(state.model.get("type")).to.equal(WMTS);
      expect(error("cesiumOptions.ionAssetId").textContent).not.to.equal("");
      field("ionAssetId").value = "2";
      apply();
      expect(state.model.get("type")).to.equal(ION);
      expect(state.model.get("cesiumOptions")).to.deep.equal({
        ionAssetId: "2",
      });
      expect(error("cesiumOptions.ionAssetId").textContent).to.equal("");
    });

    it("retains a draft across status changes and allows Apply while loading", () => {
      const render = state.sandbox.spy(state.view, "render");
      field("label").value = "Still editing";
      state.model.set({
        status: "loading",
        cesiumModel: { alpha: 0.5, show: true },
      });
      expect(render.called).to.equal(false);
      expect(field("label").value).to.equal("Still editing");
      expect(state.view.el.querySelector("button").disabled).to.equal(false);
      apply();
      expect(state.model.get("label")).to.equal("Still editing");
      state.model.set("status", "error");
      expect(render.called).to.equal(false);
      expect(state.createImagery.called).to.equal(false);
    });
  });
});

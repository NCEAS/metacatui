"use strict";

define(["jquery", "backbone", "views/DownloadButtonView"], (
  $,
  Backbone,
  DownloadButtonView,
) => {
  const { expect } = chai;

  // inactivate() uses Bootstrap's tooltip plugin, which the test page does
  // not load on its own; give jQuery a no-op stand-in when it is absent.
  if (!$.fn.tooltip) {
    $.fn.tooltip = function tooltipStub() {
      return this;
    };
  }

  const OBJECT_SERVICE_URL = "https://mn.test.dataone.org/mn/v2/object/";

  describe("DownloadButtonView Test Suite", () => {
    let originalMetacatUI;
    let view;

    function makeView(attributes = {}) {
      const model = new Backbone.Model(attributes);
      model.downloadWithCredentials = sinon.stub();
      view = new DownloadButtonView({ model });
      view.render();
    }

    function setUser({ tokenChecked = true, loggedIn = false } = {}) {
      globalThis.MetacatUI.appUserModel = new Backbone.Model({
        tokenChecked,
        loggedIn,
      });
    }

    beforeEach(() => {
      originalMetacatUI = globalThis.MetacatUI;
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        appModel: new Backbone.Model({
          objectServiceUrl: OBJECT_SERVICE_URL,
        }),
      };
      setUser();
    });

    afterEach(() => {
      view?.remove();
      view = null;
      globalThis.MetacatUI = originalMetacatUI;
    });

    describe("render", () => {
      it("links to the object service with an encoded PID and download name", () => {
        makeView({ id: "doi:10.5063/F1/2", fileName: "data.csv" });

        expect(view.$el.attr("href")).to.equal(
          `${OBJECT_SERVICE_URL}doi%3A10.5063%2FF1%2F2`,
        );
        expect(view.$el.attr("download")).to.equal("data.csv");
        expect(view.$el.attr("data-id")).to.equal("doi:10.5063/F1/2");
      });

      it("prefers an explicit model url and opens cross-origin links in a new tab", () => {
        makeView({ id: "data.1", url: "https://other.example.org/data.1" });

        expect(view.$el.attr("href")).to.equal(
          "https://other.example.org/data.1",
        );
        expect(view.$el.attr("target")).to.equal("_blank");
      });
    });

    describe("inactivate", () => {
      it("removes the link and disables the button", () => {
        makeView({ id: "data.1" });

        view.inactivate("not available");

        expect(view.$el.attr("href")).to.equal(undefined);
        expect(view.$el.attr("disabled")).to.equal("disabled");
      });
    });

    describe("download", () => {
      function click() {
        const event = { preventDefault: sinon.spy() };
        view.download(event);
        return event;
      }

      it("lets the browser handle downloads for logged-out users", () => {
        setUser({ tokenChecked: true, loggedIn: false });
        makeView({ id: "private.1" });

        const event = click();

        sinon.assert.notCalled(event.preventDefault);
        sinon.assert.notCalled(view.model.downloadWithCredentials);
      });

      it("lets the browser handle public objects for logged-in users", () => {
        setUser({ tokenChecked: true, loggedIn: true });
        makeView({ id: "public.1", isPublic: true });

        const event = click();

        sinon.assert.notCalled(event.preventDefault);
        sinon.assert.notCalled(view.model.downloadWithCredentials);
      });

      it("downloads private objects with credentials for logged-in users", () => {
        setUser({ tokenChecked: true, loggedIn: true });
        makeView({ id: "private.1" });

        const event = click();

        sinon.assert.calledOnce(event.preventDefault);
        sinon.assert.calledOnce(view.model.downloadWithCredentials);
        expect(view.$el.hasClass("in-progress")).to.equal(true);
      });

      it("waits for the token check before deciding how to download", () => {
        setUser({ tokenChecked: false, loggedIn: false });
        makeView({ id: "private.1" });

        const event = click();
        sinon.assert.calledOnce(event.preventDefault);
        sinon.assert.notCalled(view.model.downloadWithCredentials);

        // Once the token check completes as logged-in, the click is replayed.
        globalThis.MetacatUI.appUserModel.set({
          loggedIn: true,
          tokenChecked: true,
        });

        sinon.assert.calledOnce(event.preventDefault);
        sinon.assert.calledOnce(view.model.downloadWithCredentials);
      });

      it("replays a browser download after confirming the user is logged out", () => {
        setUser({ tokenChecked: false, loggedIn: false });
        makeView({ id: "public.1" });
        const preventedStates = [];
        view.el.addEventListener("click", (event) => {
          preventedStates.push(event.defaultPrevented);
          event.preventDefault();
        });

        view.el.click();
        globalThis.MetacatUI.appUserModel.set("tokenChecked", true);

        expect(preventedStates).to.deep.equal([true, false]);
        sinon.assert.notCalled(view.model.downloadWithCredentials);
      });

      it("ignores clicks while the button is disabled", () => {
        makeView({ id: "data.1" });
        view.inactivate();

        const event = click();

        sinon.assert.calledOnce(event.preventDefault);
        sinon.assert.notCalled(view.model.downloadWithCredentials);
      });
    });
  });
});

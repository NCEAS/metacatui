define(["backbone", "views/portals/PortalsSearchView"], (
  Backbone,
  PortalsSearchView,
) => {
  const expect = chai.expect;

  describe("PortalsSearchView Test Suite", () => {
    let sandbox;
    let view;
    let requests;
    let appAttributes;
    let userAttributes;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      requests = [];
      appAttributes = { ...MetacatUI.appModel.attributes };
      userAttributes = { ...MetacatUI.appUserModel.attributes };
      MetacatUI.appModel.set(
        {
          showMyPortals: true,
          portalTermPlural: "portals",
          portalTermSingular: "portal",
          defaultAlternateRepositoryId: null,
          disableQueryPOSTs: false,
        },
        { silent: true },
      );
      MetacatUI.appUserModel.set(
        {
          checked: true,
          loggedIn: false,
          allIdentitiesAndGroups: ["testuser"],
          isAuthorizedCreatePortal: true,
          token: null,
        },
        { silent: true },
      );
      sandbox.stub(Backbone, "ajax").callsFake((options) => {
        const request = {
          options,
          query: options.data.get("q"),
          start: options.data.get("start"),
          aborted: false,
        };
        requests.push(request);
        return {
          abort() {
            request.aborted = true;
            options.error(this, "abort", "abort");
          },
        };
      });
      view = new PortalsSearchView();
      document.body.append(view.el);
    });

    afterEach(() => {
      view.remove();
      sandbox.restore();
      MetacatUI.appModel.set(appAttributes, { silent: true });
      MetacatUI.appUserModel.set(userAttributes, { silent: true });
    });

    function submit(term) {
      const input = view.el.querySelector('input[type="search"]');
      expect(input, "portal search input").not.to.equal(null);
      input.value = term;
      input.form.requestSubmit();
    }

    function respond(request, docs) {
      if (request.aborted) return;
      request.options.success({
        responseHeader: {
          status: 0,
          QTime: 0,
          params: { q: request.query, rows: "99999" },
        },
        response: { numFound: docs.length, start: 0, docs },
      });
    }

    function portals(count, prefix) {
      return Array.from({ length: count }, (_, index) => ({
        id: `${prefix}-${index}`,
        seriesId: `${prefix}-${index}`,
        title: `${prefix} ${index}`,
        label: `${prefix}-${index}`,
        formatId: "https://purl.dataone.org/portals-1.1.0",
        rightsHolder: "testuser",
      }));
    }

    it("constructs the core search query and resets the pager", () => {
      view.render();
      submit("permafrost");

      expect(requests[1].query).to.equal(
        "(formatId:*dataone.org\\/portals* AND -obsoletedBy:*) AND " +
          "(title:permafrost OR abstract:permafrost OR label:permafrost OR " +
          "investigator:permafrost OR funderName:permafrost OR " +
          "funderIdentifier:permafrost OR awardNumber:permafrost OR " +
          "collectionQuery:permafrost)",
      );
      expect(requests[1].start).to.equal("0");
    });

    it("escapes phrases and clears to the base query", () => {
      view.render();
      submit('  Toolik "Station"  ');

      expect(requests[1].query).to.contain('title:"Toolik \\"Station\\""');
      expect(requests[1].query).to.contain(
        'investigator:"Toolik \\"Station\\""',
      );

      submit("   ");
      expect(requests[2].query).to.equal(
        "(formatId:*dataone.org\\/portals* AND -obsoletedBy:*)",
      );
    });

    it("keeps permission-scoped queries in sync for both portal lists", () => {
      MetacatUI.appUserModel.set("loggedIn", true, { silent: true });
      view.render();
      respond(requests[0], []);
      submit("permafrost");

      expect(requests[2].query).to.contain(
        "(rightsHolder:testuser OR writePermission:testuser OR changePermission:testuser) AND",
      );
      expect(requests[3].query).to.contain(
        "-(rightsHolder:testuser OR writePermission:testuser OR changePermission:testuser) AND",
      );
      expect(requests[2].query).to.contain("title:permafrost");
      expect(requests[3].query).to.contain("title:permafrost");
    });

    it("ignores stale results from older searches", () => {
      view.render();
      submit("first");
      submit("latest");
      respond(requests[1], portals(1, "first"));
      respond(requests[0], portals(1, "initial"));
      expect(view.$(".loading")).not.to.have.lengthOf(0);
      respond(requests[2], portals(1, "latest"));

      expect(view.$(".portals-list-entry")).to.have.lengthOf(1);
      expect(view.$(".portal-title").text()).to.equal("latest 0");
    });
  });
});

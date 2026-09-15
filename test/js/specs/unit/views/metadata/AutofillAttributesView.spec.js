define(["backbone", "views/metadata/AutofillAttributesView"], (
  Backbone,
  AutofillAttributesView,
) => {
  const expect = chai.expect;

  describe("AutofillAttributesView", () => {
    let originalMetacatUI;

    function createAttributeList({
      isValid = true,
      hasAttributes = true,
    } = {}) {
      const emlAttributes = {
        isValid: sinon.stub().returns(isValid),
      };
      const attrList = new Backbone.Model({ emlAttributes });
      attrList.isValid = sinon.stub().returns(isValid);
      attrList.hasNonEmptyAttributes = sinon.stub().returns(hasAttributes);
      return attrList;
    }

    function createEntity({ name, id, isValid, hasAttributes }) {
      const entity = new Backbone.Model({
        attributeList: createAttributeList({ isValid, hasAttributes }),
        entityName: name,
        xmlID: id,
      });
      entity.getFileName = function () {
        return this.get("entityName");
      };
      entity.getId = function () {
        return this.get("xmlID");
      };
      return entity;
    }

    function createView() {
      const collection = new Backbone.Collection();
      const currentEntity = createEntity({ name: "current.csv", id: "e1" });
      const otherEntity = createEntity({ name: "other.csv", id: "e2" });
      collection.add([currentEntity, otherEntity]);

      const activePanel = document.createElement("div");
      activePanel.id = "test-copyFrom";
      activePanel.classList.add("active");
      const actionPanelsContainer = document.createElement("div");
      actionPanelsContainer.append(activePanel);

      const view = new AutofillAttributesView({
        model: currentEntity.get("attributeList"),
        parentModel: currentEntity,
      });
      view.els = { actionPanelsContainer };
      view.actions = {
        fillFromFile: {
          id: "test-fillFromFile",
          renderMethod: "renderFillFromFile",
        },
        copyFrom: {
          id: "test-copyFrom",
          renderMethod: "renderCopyFrom",
        },
        copyTo: {
          id: "test-copyTo",
          renderMethod: "renderCopyTo",
        },
      };
      view.renderFillFromFile = sinon.spy();
      view.renderCopyFrom = sinon.spy();
      view.renderCopyTo = sinon.spy();
      view.entityPanelSignature = view.getEntityPanelSignature();

      return { collection, otherEntity, view };
    }

    beforeEach(() => {
      originalMetacatUI = globalThis.MetacatUI;
    });

    afterEach(() => {
      globalThis.MetacatUI = originalMetacatUI;
    });

    it("falls back to a legacy dataONEObject when PID lookup misses", () => {
      const legacyObject = new Backbone.Model({
        id: "data.1",
        formatId: "text/csv",
      });
      const entity = new Backbone.Model({
        downloadID: "data.1",
        dataONEObject: legacyObject,
      });
      const getMember = sinon.stub().withArgs("data.1").returns(null);
      entity.getDataPid = function () {
        return this.get("downloadID") || null;
      };
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage: { getMember },
      };

      const view = new AutofillAttributesView({ parentModel: entity });

      expect(view.getDataObject()).to.equal(legacyObject);
      sinon.assert.calledOnceWithExactly(getMember, "data.1");
    });

    it("uses a property-based package member resolved by PID", () => {
      const member = {
        pid: "data.1",
        getFormatId: sinon.stub().returns("text/csv"),
      };
      const entity = new Backbone.Model({ downloadID: "data.1" });
      entity.getDataPid = function () {
        return this.get("downloadID");
      };
      const getMember = sinon.stub().withArgs("data.1").returns(member);
      globalThis.MetacatUI = {
        ...(originalMetacatUI || {}),
        rootDataPackage: { getMember },
      };

      const view = new AutofillAttributesView({ parentModel: entity });

      expect(view.getDataObject()).to.equal(member);
      expect(view.isFillable()).to.equal(true);
      expect(view.readDataObjectField(member, "id")).to.equal("data.1");
      sinon.assert.calledOnce(member.getFormatId);
      sinon.assert.calledTwice(getMember);
    });

    it("does not re-render entity panels when the entity list is unchanged", () => {
      const { view } = createView();

      view.handleEntityUpdate();

      sinon.assert.notCalled(view.renderFillFromFile);
      sinon.assert.notCalled(view.renderCopyFrom);
      sinon.assert.notCalled(view.renderCopyTo);
      view.onClose();
    });

    it("re-renders entity panels once when the entity list changes", () => {
      const { collection, view } = createView();

      collection.add(createEntity({ name: "new.csv", id: "e3" }));

      view.handleEntityUpdate();
      view.handleEntityUpdate();
      view.handleEntityUpdate();

      sinon.assert.calledOnce(view.renderFillFromFile);
      sinon.assert.notCalled(view.renderCopyFrom);
      sinon.assert.calledOnce(view.renderCopyTo);
      view.onClose();
    });

    it("re-renders when rendered entity content state changes", () => {
      const { otherEntity, view } = createView();
      const attrList = otherEntity.get("attributeList");

      attrList.isValid.returns(false);

      view.handleEntityUpdate();

      sinon.assert.calledOnce(view.renderFillFromFile);
      sinon.assert.notCalled(view.renderCopyFrom);
      sinon.assert.calledOnce(view.renderCopyTo);
      view.onClose();
    });
  });
});

'use strict';

define(
  [
    'underscore',
    'backbone',
    'views/maps/viewfinder/ExpansionPanelView',
    'models/maps/viewfinder/ExpansionPanelsModel',
    // The file extension is required for files loaded from the /test directory.
    '/test/js/specs/shared/clean-state.js',
    '/test/js/specs/unit/views/maps/viewfinder/ExpansionPanelViewHarness.js',
  ],
  (
    _,
    Backbone,
    ExpansionPanelView,
    ExpansionPanelsModel,
    cleanState,
    ExpansionPanelViewHarness,
  ) => {
    const should = chai.should();
    const expect = chai.expect;

    describe('ExpansionPanelView Test Suite', () => {
      describe('standalone panel', () => {
        const state = cleanState(() => {
          const view = new ExpansionPanelView({
            title: 'Some title',
            icon: 'leaf',
            contentViewInstance: new TestView(),
          });
          view.render();
          const harness = new ExpansionPanelViewHarness(view);

          return { harness, view };
        }, beforeEach);

        it('creates a ExpansionPanelView instance', () => {
          state.view.should.be.instanceof(ExpansionPanelView);
        });

        it('hides the content initially', () => {
          expect(state.harness.isContentVisible()).to.be.false;
        });

        it('shows the content initially when startOpen is true', () => {
          const view = new ExpansionPanelView({
            title: 'Some title',
            icon: 'leaf',
            contentViewInstance: new TestView(),
            startOpen: true,
          });
          view.render();

          const harness = new ExpansionPanelViewHarness(view);

          expect(harness.isContentVisible()).to.be.true;
        });

        it('shows content when toggled', () => {
          state.harness.clickToggle();

          expect(state.harness.isContentVisible()).to.be.true;
        });

        it('hides content when toggled twice', () => {
          state.harness.clickToggle();
          state.harness.clickToggle();

          expect(state.harness.isContentVisible()).to.be.false;
        });

        it('hides content when collapsed', () => {
          state.harness.clickToggle();
          state.view.collapse();

          expect(state.harness.isContentVisible()).to.be.false;
        });

        it('renders a title', () => {
          expect(state.harness.getTitle().text()).to.be.match(/Some title/);
        });

        it('renders an icon from Font Awesome', () => {
          expect(state.harness.getIconClassString()).to.be.match(/leaf/);
        });
      });

      describe('coordinates with other panels via an ExpansionPanelsModel', () => {
        const state = cleanState(() => {
          return { sandbox: sinon.createSandbox() };
        }, beforeEach);

        afterEach(() => {
          state.sandbox.restore();
        });

        it('registers itself to a panel model if present', () => {
          const panelsModel = new ExpansionPanelsModel();
          state.sandbox.stub(panelsModel, 'register');
          const view = new ExpansionPanelView({
            title: 'Some title',
            icon: 'leaf',
            contentViewInstance: new TestView(),
            panelsModel,
          });
          view.render();

          expect(panelsModel.register.callCount).to.equal(1);
        });

        it('collapses all other on panels model if present', () => {
          const panelsModel = new ExpansionPanelsModel();
          const view = new ExpansionPanelView({
            title: 'Some title',
            icon: 'leaf',
            contentViewInstance: new TestView(),
            panelsModel,
          });
          view.render();
          const view2 = new ExpansionPanelView({
            title: 'Some title 2',
            icon: 'leaf',
            contentViewInstance: new TestView(),
            panelsModel: panelsModel,
          });
          view2.render();
          const harness = new ExpansionPanelViewHarness(view);
          const harness2 = new ExpansionPanelViewHarness(view2);

          harness.clickToggle();
          harness2.clickToggle();

          expect(harness.isContentVisible()).to.be.false;
        });

        it('does not collapse other on panels model in multi mode', () => {
          const panelsModel = new ExpansionPanelsModel({ isMulti: true });
          const view = new ExpansionPanelView({
            title: 'Some title',
            icon: 'leaf',
            contentViewInstance: new TestView(),
            panelsModel,
          });
          view.render();
          const view2 = new ExpansionPanelView({
            title: 'Some title 2',
            icon: 'leaf',
            contentViewInstance: new TestView(),
            panelsModel: panelsModel,
          });
          view2.render();
          const harness = new ExpansionPanelViewHarness(view);
          const harness2 = new ExpansionPanelViewHarness(view2);

          harness.clickToggle();
          harness2.clickToggle();

          expect(harness.isContentVisible()).to.be.true;
        });

      });
    });

    const TestView = Backbone.View.extend({});
  });
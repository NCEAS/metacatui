'use strict';

define(
  [
    'underscore',
    'backbone',
    'views/maps/viewfinder/ExpansionPanelView',
    'models/maps/viewfinder/ExpansionPanelsModel',
    // The file extension is required for files loaded from the /test directory.
    '/test/js/specs/shared/clean-state.js',
  ],
  (
    _,
    Backbone,
    ExpansionPanelView,
    ExpansionPanelsModel,
    cleanState,
  ) => {
    const should = chai.should();
    const expect = chai.expect;

    describe('ExpansionPanelsModel Test Suite', () => {
      const state = cleanState(() => {
        const model = new ExpansionPanelsModel();
        const view = new ExpansionPanelView({ panelsModel: model });
        const view2 = new ExpansionPanelView({ panelsModel: model });

        return { model, view, view2 };
      }, beforeEach);

      it('creates a ExpansionPanelsModel instance', () => {
        state.model.should.be.instanceof(ExpansionPanelsModel);
      });
    });
  });
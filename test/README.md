MetacatUI Unit Testing
======================

Overview
--------
We currently use the [`Mocha`](http://mochajs.org) framework for running unit tests, along with the [`Chai`](http://chaijs.com)
assertion library.
We've chosen to use behavior driven development (BDD) style of unit tests, and so write specs
with the `should()` and `expect()` methods rather than `assert()`.

Writing tests
-------------
When developing Backbone models and collections, we're using the
convention that each object gets its own test spec file.  So, for example,
the `EMLEntityModel` located in:

```
metacatui/src/js/models/metadata/eml211/EMLEntity.js
```

has a corresponding spec file in:

```
metacatui/test/js/specs/models/metadata/eml211/EMLEntity.spec.js
```

You can use `EMLEntity.spec.js` as a template for writing other spec files,
but in general, use the RequireJS `define()` method to define a module and
inject dependencies, such as:

```
    define(["../../../../../../src/js/models/metadata/eml211/EMLEntity"],
        function(EMLEntity) {
        // spec code goes here
    });
```

The test suite to be run is defined in `tests.json`, in the `tests` array. Paths to new spec test files are added to the `tests` array. Tests are run in order, so add the new test in the position that makes most sense.

Running tests
-------------
 To run the test suite, serve the `index.html` file via a Node Express server:

```
npm run test
```

and view the tests in a web browser by going to the localhost address printed out plus the `test` directory (e.g. `http://localhost:3001/test`).

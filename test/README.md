MetacatUI Testing
======================
Overview
--------
Following Test-Driven Development (TDD) best practices (and BDD best practices as well), unit tests should be written
and executed during MetacatUI code development - not after features are already developed.

We currently use the [`Mocha`](http://mochajs.org) framework for running unit and integration tests, along with the [`Chai`](http://chaijs.com)
assertion library.

Test file organization
----------------------
- Unit and Integration tests are separated into different directories and files.
    - Unit tests are in: `metacatui/test/js/specs/unit`
    - Integration tests are in: `metacatui/test/js/specs/integration`
- Directories inside `unit` and `integration` should match the MetacatUI source code directory structure for easy readability.
    - So, for example, the `EMLEntityModel` located in `metacatui/src/js/models/metadata/eml211/EMLEntity.js`
      has a corresponding spec file in `metacatui/test/js/specs/unit/models/metadata/eml211/EMLEntity.spec.js`

Writing tests
-------------
We've chosen to use behavior driven development (BDD) style of tests, and so write specs
with the `should()` and `expect()` methods rather than `assert()`. 

You can use `EMLEntity.spec.js` as a template for writing other spec files,
but in general, use the RequireJS `define()` method to define a module and
inject dependencies, such as:

```
    define(["../../../../../../src/js/models/metadata/eml211/EMLEntity"],
        function(EMLEntity) {
        // spec code goes here
    });
```
Adding new tests
----------------
The test suite to be run is defined in `test/config/tests.json`. Paths to new spec test files are added to the `unit` or `integration` array. Tests are run in order, so add the new test in the position that makes most sense.

Running tests
-------------

## Unit tests
All unit tests are run by default. To run the unit test suite, serve the `index.html` file via a Node Express server:

```
npm run test
```

and view the tests in a web browser by going to the localhost address printed out (e.g. `http://localhost:3001`).

## Integration tests
Integration tests are not run by default, since they are most resource and time intensive. To run the integration test suite
follow the above steps for unit tests, but pass the `integration` test `type` as a search parameter: 

```
http://localhost:3001/test/?type=integration
```

Note: For convienence, there is a node script called `integration-test` that will redirect requests to the root `http://localhost:3001` to `http://localhost:3001/test/?type=integration`, but that node script is not necessary to run the integration tests.

Configuring tests
----------------------------
Tests are executed using the app configuration in `/test/config/appconfig.json`. Change that `appconfig.json` file to 
run integration tests against a specific Metacat instance or to test certain [`AppConfig`](https://nceas.github.io/metacatui/docs/AppConfig.html) options. The `appconfig.json` JSON is the same namespace as the MetacatUI [`AppConfig`](https://nceas.github.io/metacatui/docs/AppConfig.html).
MetacatUI Unit Testing
======================

Overview
--------
We currently use the `Mocha`_ framework for running unit tests, along with the `Chai`_
assertion library and the third-party assertion libraries compatible with Chai.
We've chosen to use behavior driven development style of unit tests, and so write specs
with the `should()` and `expect()` methods rather than `assert()`.

.. _`Mocha`: http://mochajs.org
.. _`Chai`: http://chaijs.com

Writing tests
-------------
When developing Backbone models, collections, views, and routers, we're using the
convention that each object gets its own test spec file.  So, for example,
the `EMLEntityModel` located in:

.. code:
    metacatui/metacatui/src/main/webapp/js/models/metadata/eml211/EMLEntity.js

has a corresponding spec file in:

.. code:
    metacatui/metacatui/test/js/specs/models/metadata/eml211/EMLEntity.spec.js

You can use `EMLEntity.spec.js` as a template for writing other spec files,
but in general, use the RequireJS `define()` method to define a module and
inject dependencies, such as:

.. code:
    define(["chai", "chai-jquery", "chai-backbone",
        "../../../../../../src/main/webapp/js/models/metadata/eml211/EMLEntity"],
        function(chai, chaiJquery, chaiBackbone, EMLEntity) {

        // spec code goes here
    });

If other libraries are needed, add the paths and shims to the `require.config()`
call in:

.. code:
    metacatui/metacatui/test/js/specs/runner.spec.js

We currently have library definitions for JQuery, Underscore, Backbone, Mocha,
Chai, Chai-JQuery, and Chai-Backbone.

Running tests
-------------
The test suite to be run is defined in `runner.spec.js`, so add the path to
you spec file into the `tests` array.  To run the `runner.spec.js` file,
open the `metacatui/metacatui/test/index.html` file in the browser(s) you want
to test in.  Each time `index.html` is reloaded, the runner calls `mocha.run()`, which
will execute all of the tests in the suite.

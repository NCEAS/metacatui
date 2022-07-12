/* Simple MetacatUI app module.

You'll need node.js and express.js to run this.

- Install dependencies with `npm install`.
- load with `const main = require("./app");`

*/

const express = require("express");
const path = require("path");
const port = process.env.PORT || 3000;
const app = express();
const fs = require("fs");

// Subdirectory where index.html and the rest are
const src_dir = "src";

/**
 * Get the directories for the given path
 * @param path
 * @returns {*}
 */
function getDirectories(path) {
    return fs.readdirSync(path).filter(function (file) {
        return fs.statSync(path + '/' + file).isDirectory();
    });
}

/**
 * Initialize the MetacatUI App with the base dir to the main
 * source directory
 *
 * @param metacatuiBaseDir [Optional] base metacatui repo directory
 * @param configJs [Optional] override  /config/config.js
 */
function initializeApp(metacatuiBaseDir = null, configJs = null, ) {

    // Determine where metacatui source directory is
    if (metacatuiBaseDir === null || metacatuiBaseDir === undefined) {
        metacatuiBaseDir = __dirname;
    }

    app.use('/loader.js', express.static(path.resolve(metacatuiBaseDir, src_dir, "loader.js")));

    // Is /config/config/js to be overridden?
    var overrideConfigJs = configJs !== null;

    // Map metacatui source directories
    let metacatDirs = getDirectories(metacatuiBaseDir + "/" + src_dir)
    for (let i in metacatDirs) {

        var metacatCurrentDir = path.resolve(metacatuiBaseDir, src_dir, metacatDirs[i])
        // Determine if we override the configuration file (/config/config.js)
        if (metacatDirs[i] !== 'config' || !overrideConfigJs) {
            console.log('Setting /' + metacatDirs[i]+ " to " + metacatCurrentDir)
            app.use('/' + metacatDirs[i], express.static(metacatCurrentDir))
        } else if (metacatDirs[i] === 'config' || overrideConfigJs) {
            console.log("Setting " + '/' + metacatDirs[i] + "/config.js to " + configJs)
            app.use('/' + metacatDirs[i] + "/config.js", express.static(configJs));
        }
    }

    app.get("*", function (request, response) {
        response.sendFile(path.resolve(metacatuiBaseDir, src_dir, "index.html"));
    });


    return app;
}

/**
 * Expose the `initializeApp`  function.
 */
exports.initializeApp = initializeApp

/**
 * Expose the prototypes.
 */

exports.express = express;
exports.app = app;
exports.srcDir = src_dir;
exports.port = port;
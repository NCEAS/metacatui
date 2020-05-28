# Installing MetacatUI locally for development with a Metacat repository

## Step 1. Clone MetacatUI

- Clone the MetacatUI git repository:

  ```
  git clone https://github.com/NCEAS/metacatui.git
  ```

## Step 2. Set up a local web server

While developing on MetacatUI, it's necessary to run a web server of some sort in order for the application to work completely.
It will not work properly by simply opening up the HTML webpage(s) in your browser.
This is due to browser security issues that prevent certain Javascript functions from executing
on local files, but also because MetacatUI needs certain web server configurations for navigation
to work properly (more on that later).

Following are instructions for two local web server options - Node & Express JS (recommended) or Apache.

### Server Option 1. NodeJS & ExpressJS (recommended)

*Requirements:* [NodeJS](https://nodejs.org/en/download/) and ExpressJS. Install Express via `npm install express`

MetacatUI also comes with a simple script that runs a [node.js](https://nodejs.org) application called [Express.js](https://expressjs.com), which responds to HTTP requests.

- To start the Express server, run [`server.js`](https://github.com/NCEAS/metacatui/blob/master/server.js):

  ```bash
  node server.js
  ```

### Server Option 2. Apache

See the [Apache configuration instructions](https://github.com/NCEAS/metacatui/blob/master/docs/install/apache.md).
The Apache instructions are *not* updated regularly, since we recommend you use the NodeJS Express server instead.

## Step 3. Configure MetacatUI

- Open `src/index.html` in a text editor and change the following values:
    - Set `data-metacat-context` to match the Metacat directory name of the Metacat you will be using.
    For example, if your Metacat is installed at https://your-site.com/metacat, your `data-metacat-context` would be set to `metacat`. (Most Metacat installations are in a `metacat` directory sice that is the default Metacat directory name).
    - Make sure the path to the `loader.js` file is correct. By default, it is set to `/metacatui/loader.js`, but if you  have your MetacatUI installed at root, (e.g. http://localhost:3000/), the path would be `/loader.js`.
    - *Optional:* Set the `data-theme` to your chosen theme name, e.g. `default`, `knb`, `arctic`.
    - *Optional:* Replace `YOUR-GOOGLE-MAPS-API-KEY` with your [Google Maps API key](https://developers.google.com/maps/documentation/javascript/get-api-key) to enable the Google Map features of MetacatUI. If no API key is given, MetacatUI will still work, it just will not include the map features.

- Open `src/loader.js` in a text editor and change the following values:
  - Make sure the `MetacatUI.root` path is the correct path to your MetacatUI installation. By default, it is set to `/metacatui`, but if you  have your MetacatUI installed at root, (e.g. http://localhost:3000/), the path would be `/`.

- Open `src/js/models/AppModel.js` (or if using a theme other than the default theme, `src/js/themes/{theme name}/models/AppModel.js`) and change the following values:
    - Set `baseUrl` to the URL where Metacat is deployed (e.g. `https://your-site.com`). This is concatinated with `data-metacat-context` earlier to create the full Metacat URL.
    - Set `d1CNBaseUrl` to the base URL of the DataONE Coordinating Node environment that the Metacat repository is a part of. (e.g. the DataONE test member Metacat repository, `urn:node:mnTestKNB`, is in the `urn:node:cnStage2` Coordinating Node, so this attribute would be set to `https://cn-stage-2.test.dataone.org/`)
    - *Optional:* The `AppModel` contains MetacatUI settings that control many MetacatUI features. You may want to configure some of these differently, according to your needs. See the [`AppModel` documentation](https://nceas.github.io/metacatui/docs/AppModel.html#defaults) for details.

## Step 4. DONE!

Go to the installed web location in your web browser (e.g. if you used the Express server above, your install location is http://localhost:3000) and you're ready to use MetacatUI!

## Troubleshooting

See the installation [troubleshooting page](https://nceas.github.io/metacatui/install/troubleshooting.md).

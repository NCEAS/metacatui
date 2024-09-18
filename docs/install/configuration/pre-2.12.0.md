# Configuring MetacatUI for versions 2.11.5 and earlier

## Step 1. Configure `index.html`

- Open `src/index.html` in a text editor and change the following values:
  - Set `data-metacat-context` to match the Metacat directory name of the Metacat you will be using.
    For example, if your Metacat is installed at https://your-site.com/metacat, your `data-metacat-context` would be set to `metacat`. (Most Metacat installations are in a `metacat` directory sice that is the default Metacat directory name).
  - Make sure the path to the `loader.js` file is correct. By default, it is set to `/metacatui/loader.js`, but if you have your MetacatUI installed at root, (e.g. http://localhost:3000/), the path would be `/loader.js`.
  - _Optional:_ Set the `data-theme` to your chosen theme name, e.g. `default`, `knb`, `arctic`.
  - _Optional:_ Replace `YOUR-GOOGLE-MAPS-API-KEY` with your [Google Maps API key](https://developers.google.com/maps/documentation/javascript/get-api-key) to enable the Google Map features of MetacatUI. If no API key is given, MetacatUI will still work, it just will not include the map features.

## Step 2. Configure `loader.js`

- Open `src/loader.js` in a text editor and change the following values:
  - Make sure the `MetacatUI.root` path is the correct path to your MetacatUI installation. By default, it is set to `/metacatui`, but if you have your MetacatUI installed at root, (e.g. http://localhost:3000/), the path would be `/`.

## Step 3. Configure the `AppModel`

- Open `src/js/models/AppModel.js` (or if using a theme other than the default theme, `src/js/themes/{theme name}/models/AppModel.js`) and change the following values:
  - Set `baseUrl` to the URL where Metacat is deployed (e.g. `https://your-site.com`). This is concatinated with `data-metacat-context` earlier to create the full Metacat URL.
  - Set `d1CNBaseUrl` to the base URL of the DataONE Coordinating Node environment that the Metacat repository is a part of. (e.g. the DataONE test member Metacat repository, `urn:node:mnTestKNB`, is in the `urn:node:cnStage2` Coordinating Node, so this attribute would be set to `https://cn-stage-2.test.dataone.org/`)
  - _Optional:_ The `AppModel` contains MetacatUI settings that control many MetacatUI features. You may want to configure some of these differently, according to your needs. See the [`AppModel` documentation](https://nceas.github.io/metacatui/docs/AppModel.html#defaults) for details.

# Installing MetacatUI for your Metacat repository

## Step 1. Download MetacatUI

[Download the latest version of MetacatUI](https://github.com/NCEAS/metacatui/releases) and unzip it.

Note: If you have a `metacatui.war` file from Metacat, then you can unpack that war file instead, since it is the
same as downloading MetacatUI from Github.

## Step 2. Configure Apache for MetacatUI

Follow the steps in the [Apache configuration instructions](apache).

Then, move the MetacatUI files in the `src` directly to your Apache metacatui directory. Example:

  ```bash
   cd metacatui-2.11.2
   mv -rf src/* /var/www/
  ```

## Step 3. Configure MetacatUI

- Open `src/index.html` in a text editor and change the following values:
    - Set `data-metacat-context` to match the Metacat directory name of the Metacat you will be using.
    For example, if your Metacat is installed at https://your-site.com/metacat, your `data-metacat-context` would be set to `metacat`. (Most Metacat installations are in a `metacat` directory sice that is the default Metacat directory name).
    - Make sure the path to the `loader.js` file is correct. By default, it is set to `/metacatui/loader.js`, but if you  have your MetacatUI installed at root, (e.g. https://your-site.com), the path would be `/loader.js`.
    - *Optional:* Set the `data-theme` to your chosen theme name, e.g. `default`, `knb`, `arctic`.
    - *Optional:* Replace `YOUR-GOOGLE-MAPS-API-KEY` with your [Google Maps API key](https://developers.google.com/maps/documentation/javascript/get-api-key) to enable the Google Map features of MetacatUI. If no API key is given, MetacatUI will still work, it just will not include the map features.

- Open `src/loader.js` in a text editor and change the following values:
  - Make sure the `MetacatUI.root` path is the correct path to your MetacatUI installation. By default, it is set to `/metacatui`, but if you  have your MetacatUI installed at root, (e.g. https://your-site.com), the path would be `/`.

- Open `src/js/models/AppModel.js` (or if using a theme other than the default theme, `src/js/themes/{theme name}/models/AppModel.js`) and change the following values:
    - Set `baseUrl` to the URL where Metacat is deployed (e.g. `https://your-site.com`). This is concatinated with `data-metacat-context` earlier to create the full Metacat URL.
    - Set `d1CNBaseUrl` to the base URL of the DataONE Coordinating Node environment that the Metacat repository is a part of. (e.g. the DataONE test member Metacat repository, `urn:node:mnTestKNB`, is in the `urn:node:cnStage2` Coordinating Node, so this attribute would be set to `https://cn-stage-2.test.dataone.org/`)
    - *Optional:* The `AppModel` contains MetacatUI settings that control many MetacatUI features. You may want to configure some of these differently, according to your needs. See the [`AppModel` documentation](https://nceas.github.io/metacatui/docs/AppModel.html#defaults) for details.

## Step 4. DONE!

Go to the URL of your MetacatUI directory in your web browser, and you're done!

## Troubleshooting

See the installation [troubleshooting page](https://nceas.github.io/metacatui/install/troubleshooting.md).

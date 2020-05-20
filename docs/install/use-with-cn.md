### Installing MetacatUI locally to use with a remote DataONE Coordinating Node

#### Step 1. Clone MetacatUI
- Clone the MetacatUI git repository:

```
git clone https://github.com/NCEAS/metacatui.git
```

#### Step 2. Configure MetacatUI

- Open `src/index.html` in a text editor and change the following values:
    - Set the `data-theme` to `dataone`.
    - Remove the value of `data-metacat-context` since DataONE CN URLs do not have a metacat directory
    - Make sure the path to the `loader.js` file is correct. By default, it is set to `/metacatui/loader.js`, but if you  have your MetacatUI installed at root, (e.g. http://localhost:3000), the path would be `/loader.js`.
    - *Optional:* Replace `YOUR-GOOGLE-MAPS-API-KEY` with your [Google Maps API key](https://developers.google.com/maps/documentation/javascript/get-api-key) to enable the Google Map features of MetacatUI. If no API key is given, MetacatUI will still work, it just will not include the map features.

- Open `src/js/themes/dataone/models/AppModel.js` and change the following values:
    - Set `baseUrl` and `d1CNBaseUrl` to the URL where the remote DataONE CN is (e.g. `https://cn-stage.test.dataone.org`)

- Open `src/loader.js` in a text editor and change the following values:
  - Make sure the `MetacatUI.root` path is the correct path to your MetacatUI installation. By default, it is set to `/metacatui`, but if you  have your MetacatUI installed at root, (e.g. http://localhost:3000), the path would be `/`.

#### Step 3. Set up a local web server
- Follow Step 3 from the [MetacatUI README](index) to configure a web server on your local machine.

#### Step 4. DONE!

Go to the installed web location in your web browser (e.g. if you used the Express server above, your install location is http://localhost:3000) and you're ready to use MetacatUI!

### Troubleshooting

See the installation [troubleshooting page](troubleshooting.md).

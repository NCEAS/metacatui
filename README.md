## MetacatUI: A client-side web interface for DataONE data repositories

- **Author**: Matthew B. Jones, Chris Jones, Ben Leinfelder, Lauren Walker, Bryce Mecum, Peter Slaughter, Rushiraj Nenuji, Robyn Thiessen-Bock ([NCEAS](http://www.nceas.ucsb.edu))
- **License**: [Apache 2](http://opensource.org/licenses/Apache-2.0)
- [Package source code on Github](https://github.com/NCEAS/metacatui)
- [**Submit Bugs and feature requests**](https://github.com/NCEAS/metacatui/issues)
- [Task Board](https://waffle.io/NCEAS/metacatui)
- Discussion list: metacat-dev@ecoinformatics.org

MetacatUI is a client-side web interface for querying Metacat servers and other servers that implement the DataONE REST API.  Currently, it is used as the basis for the [KNB Data Repository](http://knb.ecoinformatics.org), the [NSF Arctic Data Center](https://arcticdata.io/catalog/), the [DataONE federation](https://search.dataone.org), and other repositories.

MetacatUI is an open source, community project.  We welcome contributions in many forms, including code, graphics, documentation, bug reports, testing, etc.  Use the [discussion list](https://github.com/NCEAS/metacatui/issues) to discuss these contributions with project contributors.

## Screenshots

The main search screen, as configured for the KNB Repository:
![KNB Search](https://raw.githubusercontent.com/NCEAS/metacatui/master/docs/screenshots/metacatui-knb-1200w.png)

A metadata view, as configured for the Arctic Data Center:
![Arctic Data Center Metadata View](https://raw.githubusercontent.com/NCEAS/metacatui/master/docs/screenshots/metacatui-arctic-1200w.png)

## Installation

### Using MetacatUI with your own Metacat repository
 See the [Metacat documentation](https://github.com/NCEAS/metacat) for full installation instructions. In particular, the [`themes` section](https://github.com/NCEAS/metacat/blob/master/docs/user/metacat/source/themes.rst) of the Metacat documentation gives installation instructions for using MetacatUI with your Metacat repository.

### Using MetacatUI locally with a remote Metacat repository
To run MetacatUI, you will need to first install a web server such as [Apache](https://httpd.apache.org/). The following instructions are for Mac OS X. Apache comes pre-installed on Mac OS X.

#### Step 1. Set up Apache
- Choose a location from which to serve *all* your Apache website files. A good location is `/Users/{username}/Sites`
- Make a subdirectory in `~/Sites` specifically for MetacatUI. The default directory name for MetacatUI is `metacatui`.

  ```
  mkdir ~/Sites/metacatui
  ```

- Configure Apache to serve files from your `Sites` directory by opening `/etc/apache2/httpd.conf` and changing the `DocumentRoot` pathname. Example:

    ```
    DocumentRoot "/Users/walker/Sites"
    <Directory "/Users/walker/Sites/metacatui">
    ```

#### Step 2. Configure a VirtualHost in Apache for MetacatUI
- First, create a backup of the default httpd-vhosts.conf file:

  ```
  sudo cp /etc/apache2/extra/httpd-vhosts.conf /etc/apache2/extra/httpd-vhosts.conf.bak
  ```

- Clear out the example VirtualHost configuration if it is there, and add a VirtualHost for the `~/Sites/metacatui` directory (make sure `walker` is replaced with your username):

  ```
    <VirtualHost *:80>
      DocumentRoot "/Users/walker/Sites"
      ServerName metacatui.localhost
      ErrorLog "/private/var/log/apache2/metacatui-error_log"
      CustomLog "/private/var/log/apache2/metacatui-access_log" common

      # Allow encoded slashes in URLs so encoded identifiers can be sent in MetacatUI URLs
      AllowEncodedSlashes On

     <Directory "/Users/walker/Sites/metacatui">
      FallbackResource /metacatui/index.html
    </Directory>
  </VirtualHost>
  ```

The FallbackResource configuration is how MetacatUI is able to use real pathnames like `/data/page/2` for a single-page application.

The FallbackResource directive requires your Apache version to be `2.2.16` and above. If you're using the earlier versions of Apache, you'll require `mod_rewrite` in your configuration. Example:

  ```
    <Directory "/Users/walker/Sites/metacatui">
    ...
    ...

    <IfModule mod_rewrite.c>
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </IfModule>
    </Directory>
  ```

- Create a host name for `metacatui.locahost`. First, open `/etc/hosts`:

  ```
  sudo vi /etc/hosts
  ```

- Add `metacatui.localhost` to the bottom of the file. **Be careful not to change any other part of this file!**:

  ```
  # metacatui local site
  127.0.0.1 metacatui.localhost
  ```

- Save your `/etc/hosts` changes and start (or restart) Apache:

  ```
  sudo apachectl start
  ```

#### Step 3. Configure MetacatUI
- Download the [latest MetacatUI release .zip file](https://github.com/NCEAS/metacatui/releases) and unzip it
- Open `src/index.html` in a text editor and change the following values:
    - Set the `data-theme` to your chosen theme name, e.g. `default`, `knb`, `arctic`.
    - Set `data-metacat-context` to match the Metacat directory name of the remote Metacat you will be using. For example, Metacat is installed at https://dev.nceas.ucsb.edu/knb so the `data-metacat-context` would be set to `knb`. Most Metacat installations are at `metacat` since that is the default.
    - Optional: Replace `YOUR-GOOGLE-MAPS-API-KEY` with your [Google Maps API key](https://developers.google.com/maps/documentation/javascript/get-api-key) to enable the Google Map features of MetacatUI. If no API key is given, MetacatUI will still work, it just will not include the map features.
- Open `src/js/models/AppModel.js`, or if using a theme other than the default theme, `src/js/themes/{theme name}/models/AppModel.js` and change the following values:
    - Set `baseUrl` to the URL where the remote Metacat is (e.g. `https://dev.nceas.ucsb.edu`)
    - Set `d1CNBaseUrl` to the URL of the DataONE Coordinating Node that the Metacat Member Node is a part of. (e.g. the Member Node `urn:node:mnTestKNB` is in the `urn:node:cnStage` Coordinating Node, so this attribute would be set to `https://cn-stage.test.dataone.org/`)

- *Note: If you installed MetacatUI somewhere other than the location in step 2 above:* you will need to change the `loader.js` pathname in `index.html` and the `MetacatUI.root` pathname in `loader.js` to the custom location where MetacatUI is located. For example, if you installed MetacatUI at root instead of in a `metacatui` subdirectory, your `loader.js` pathname in `index.html` would be `/loader.js` and `MetacatUI.root` would be `/`.

#### Step 4. Move MetacatUI files to Apache
- Move the MetacatUI application code to the directory we chose in Step 2.

    ```
    cp -rf metacatui-2.0.0/src/* ~/Sites/metacatui/
    ```

- Open a web browser and navigate to `metacatui.localhost/metacatui` and your MetacatUI application should be ready to go!

### Using MetacatUI locally with a remote DataONE Coordinating Node

#### Step 1.
- Follow Step 1-2 above to configure the Apache web server on your local machine.

#### Step 2. Configure MetacatUI
- Download the [latest MetacatUI release .zip file](https://github.com/NCEAS/metacatui/releases) and unzip it
- Open `src/index.html` in a text editor and change the following values:
    - Set the `data-theme` to `dataone`.
    - Remove the value of `data-metacat-context` since DataONE CN URLs do not have a metacat directory
    - Optional: Replace `YOUR-GOOGLE-MAPS-API-KEY` with your [Google Maps API key](https://developers.google.com/maps/documentation/javascript/get-api-key) to enable the Google Map features of MetacatUI. If no API key is given, MetacatUI will still work, it just will not include the map features.
- Open `src/js/themes/dataone/models/AppModel.js` and change the following values:
    - Set `baseUrl` and `d1CNBaseUrl` to the URL where the remote DataONE CN is (e.g. `https://cn-stage.test.dataone.org`)
- Open `src/loader.js` and set the value for the following property:
    - Set `MetacatUI.root` based on the location off of its top directory. Example:
        - If the source code is located at `~/Sites/metacatui` (as detailed in Step 1), set the `MetacatUI.root = "/metacatui"`.

#### Step 3. Move MetacatUI files to Apache
- Move the MetacatUI application code to the directory we chose in Step 1.

    ```
    cp -rf metacatui-2.0.0/src/* ~/Sites/metacatui/
    ```

- Open a web browser and navigate to `metacatui.localhost/metacatui` and your MetacatUI application should be ready to go!

## Development

### Running

While developing on MetacatUI, it's necessary to run a web server of some sort in order for the application to work completely.
You can set up a web server such as Apache as described above in the Installation section but MetacatUI also comes with a simple [Express.js](https://expressjs.com) application that uses [node.js](https://nodejs.org).

Pre-requisites:

1. [node.js](https://nodejs.org) and `npm`
2. [Express.js](https://expressjs.com): Install with `npm install express`

Steps:

1. Set up `index.html` and `loader.js` as described above in the Installation section.
2. Run the folowing commands in a terminal:

```sh
# from this repository's top level directory
npm install express
node server.js
```

Now MetacatUI should be serving at http://localhost:3000 and you should be able to visit it in your web browser.

## License
```
Copyright [2013] [Regents of the University of California]

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

## Acknowledgements
Work on this package was supported by:

- NSF-ABI grant #1262458 to C. Gries, M. B. Jones, and S. Collins.
- NSF-DATANET grant #1430508 to W. Michener, M. B. Jones, D. Vieglais, S. Allard and P. Cruse
- NSF DIBBS grant #1443062 to T. Habermann and M. B. Jones
- NSF-PLR grant #1546024 to M. B. Jones, S. Baker-Yeboah, J. Dozier, M. Schildhauer, and A. Budden

Additional support was provided for working group collaboration by the National Center for Ecological Analysis and Synthesis, a Center funded by the University of California, Santa Barbara, and the State of California.

[![nceas_footer](https://www.nceas.ucsb.edu/files/newLogo_0.png)](http://www.nceas.ucsb.edu)

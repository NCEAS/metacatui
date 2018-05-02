## MetacatUI: A client-side web interface for DataONE data repositories

- **Author**: Matthew B. Jones, Chris Jones, Ben Leinfelder, Lauren Walker, Bryce Mecum, Peter Slaughter ([NCEAS](http://www.nceas.ucsb.edu))
- **License**: [Apache 2](http://opensource.org/licenses/Apache-2.0)
- [Package source code on Github](https://github.com/NCEAS/metacatUI)
- [**Submit Bugs and feature requests**](https://projects.ecoinformatics.org/ecoinfo/projects/metacatui/)
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
 See the [Metacat documentation](https://github.com/NCEAS/metacat) for full installation instructions. In particular, the []`themes` section](https://github.com/NCEAS/metacat/blob/master/docs/user/metacat/source/themes.rst) of the Metacat documentation gives installation instructions for using MetacatUI with your Metacat repository.

### Using MetacatUI locally with a remote Metacat repository
To run MetacatUI, you will need to first install a web server such as [Apache](https://httpd.apache.org/). The following instructions are for Mac OS X.

#### Step 1. Configure Apache
- Choose a location from which to serve your Apache website files. A good location is `/Users/{username}/Sites`
- Configure Apache to serve files from this location by opening `/etc/apache2/httpd.conf` and changing the `DocumentRoot` to your chosen directory path. Example:

    ```
    DocumentRoot "/Users/walker/Sites"
    <Directory "/Users/walker/Sites">
    ```

#### Step 2. Configure MetacatUI
- Download the [latest MetacatUI release .zip file](https://github.com/NCEAS/metacatui/releases) and unzip it
- Open `src/index.html` in a text editor and change the following values:
    - Set the `data-theme` to your chosen theme name, e.g. `default`, `knb`, `arctic`.
    - Set `data-metacat-context` to match the Metacat directory name of the remote Metacat you will be using. For example, Metacat is installed at https://dev.nceas.ucsb.edu/knb so the `data-metacat-context` would be set to `knb`. Most Metacat installations are at `metacat` since that is the default.
    - Optional: Replace `YOUR-GOOGLE-MAPS-API-KEY` with your [Google Maps API key](https://developers.google.com/maps/documentation/javascript/get-api-key) to enable the Google Map features of MetacatUI. If no API key is given, MetacatUI will still work, it just will not include the map features.
- Open `src/js/models/AppModel.js`, or if using a theme other than the default theme, `src/js/themes/{theme name}/models/AppModel.js` and change the following values:
    - Set `baseUrl` to the URL where the remote Metacat is (e.g. `https://dev.nceas.ucsb.edu`)
    - Set `d1CNBaseUrl` to the URL of the DataONE Coordinating Node that the Metacat Member Node is a part of. (e.g. the Member Node `urn:node:mnTestKNB` is in the `urn:node:cnStage` Coordinating Node, so this attribute would be set to `https://cn-stage.test.dataone.org/`)

#### Step 3. Install MetacatUI in Apache
- Copy the contents of the MetacatUI `src` directory to your Sites directory.

    ```
    mkdir ~/Sites/metacatui
    cp -rf metacatui-2.0.0/src/* ~/Sites/metacatui/
    ```

- Run `sudo apachectl start` to start Apache
- Open a web browser and navigate to `localhost/metacatui`

### Using MetacatUI locally with a remote DataONE Coordinating Node

#### Step 1.
- Follow Step 1 above to configure the Apache web server on your local machine.

#### Step 2. Configure MetacatUI
- Download the [latest MetacatUI release .zip file](https://github.com/NCEAS/metacatui/releases) and unzip it
- Open `src/index.html` in a text editor and change the following values:
    - Set the `data-theme` to `dataone`.
    - Remove the value of `data-metacat-context` since DataONE CN URLs do not have a metacat directory
    - Optional: Replace `YOUR-GOOGLE-MAPS-API-KEY` with your [Google Maps API key](https://developers.google.com/maps/documentation/javascript/get-api-key) to enable the Google Map features of MetacatUI. If no API key is given, MetacatUI will still work, it just will not include the map features.
- Open `src/js/themes/dataone/models/AppModel.js` and change the following values:
    - Set `baseUrl` and `d1CNBaseUrl` to the URL where the remote DataONE CN is (e.g. `https://cn-stage.test.dataone.org`)

#### Step 3.
- Follow Step 3 above to install MetacatUI in Apache.

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

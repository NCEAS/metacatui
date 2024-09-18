# Configuring Apache for MetacatUI

There are two Apache configurations needed for MetacatUI to work properly.

1. Configure Apache to serve `index.html` instead of a 404 for the MetacatUI directory
2. Allow encoded slashes in MetacatUI paths

### Configure Apache to serve `index.html` instead of a 404 for the MetacatUI directory

**Why do I need this?**

MetacatUI is a single-page Javascript application which uses a single `index.html` file to
initialize the MetacatUI app. The app checks the path that the user has navigated to (e.g. `/data/page/2`), and
renders the corresponding view. Then MetacatUI listens to each link click in the app and renders the next view for that link.

This means there is no server-side application or files that are serving up HTML responses for each
MetacatUI path.

For this all to work, you need to tell your web server to serve the `index.html`
MetacatUI page for every MetacatUI path. Otherwise, your server will return a 404 error.

#### Apache v2.2.16 and later

Add the `FallbackResource` Apache directive:

```apache
  ...
  # Serve index.html instead of a 404 error in the MetacatUI directory
  <Directory "/var/www/metacatui">
    FallbackResource /metacatui/index.html
  </Directory>
  ...
```

#### Apache v2.2.15 and earlier

Add a `mod_rewrite` Apache directive for the MetacatUI index.html file:

```apache
  <Directory "/var/www/metacatui">
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

### Allow encoded slashes in MetacatUI paths

Add the following to your Apache configuration file:

```apache
...
# Allow encoded slashes in URLs so encoded identifiers can be sent in MetacatUI URLs
AllowEncodedSlashes On
...
```

**Why do I need this?**
`/` characters are commonly used in identifiers for data and metadata objects in Metacat
repositories. These identifiers are used in MetacatUI paths and are usually URL-encoded.

## Configuring Apache locally on Mac OS X, for MetacatUI development

Note: The following instructions are general guidelines on how to set up a local Apache server so
you can develop MetacatUI features/bugs on your local machine. These instructions are _not_
updated regularly, since we recommend you use the [NodeJS Express server instead](https://github.com/NCEAS/metacatui/blob/master/server.js).

#### Step 1. Create a directory for your MetacatUI

- Choose a location from which to serve _all_ your Apache website files. A good location is `/Users/{username}/Sites`
- Make a subdirectory in `~/Sites` specifically for MetacatUI. The default directory name for MetacatUI is `metacatui`.

  ```bash
  mkdir ~/Sites/metacatui
  ```

#### Step 2. Tell Apache to use the directory from Step 1

- Configure Apache to serve files from your `Sites` directory by opening `/etc/apache2/httpd.conf` and changing the `DocumentRoot` pathname. Example:

  ```apache
  DocumentRoot "/Users/walker/Sites"
  <Directory "/Users/walker/Sites/metacatui">
  ```

#### Step 3. Configure a VirtualHost in Apache for MetacatUI

- First, create a backup of the default httpd-vhosts.conf file:

  ```bash
  sudo cp /etc/apache2/extra/httpd-vhosts.conf /etc/apache2/extra/httpd-vhosts.conf.bak
  ```

- Clear out the example VirtualHost configuration if it is there, and add a VirtualHost for the `~/Sites/metacatui` directory (make sure `walker` is replaced with your username):

  ```apache
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

- Create a host name for `metacatui.locahost`. First, open `/etc/hosts`:

  ```bash
  sudo vi /etc/hosts
  ```

- Add `metacatui.localhost` to the bottom of the file. **Be careful not to change any other part of this file!**:

  ```
  # metacatui local site
  127.0.0.1 metacatui.localhost
  ```

- Save your `/etc/hosts` changes

#### Step 4. Move MetacatUI files to Apache

- Move the MetacatUI application code to the directory we chose in Step 2.

  ```bash
  cp -rf metacatui-2.0.0/src/* /Users/walker/Sites/metacatui/
  ```

#### Step 5. Start Apache

- Start (or restart) Apache:

  ```bash
  sudo apachectl start
  ```

- Open a web browser and navigate to `metacatui.localhost/metacatui` and your MetacatUI application should be ready to go!

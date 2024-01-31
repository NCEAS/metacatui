# Setting Up a Proxy for NSF Award API in MetacatUI

MetacatUI integrates with the NSF (National Science Foundation) Award API to fetch award information. Since the NSF Award API does not support CORS (Cross-Origin Resource Sharing) or JSONP (JSON with Padding), it's necessary to set up a server-side proxy. This documentation guides you through setting up an Apache proxy to enable this functionality in MetacatUI.

![NSF Award API Proxy](guides/images/funding.png)

## Prerequisites

- Apache Web Server
- Access to Apache configuration files
- MetacatUI already installed and served via Apache

## Steps to Configure Apache as a Proxy

### 1. Enable Required Apache Modules

Ensure that the following Apache modules are enabled:

- `mod_proxy`
- `mod_proxy_http`

You can enable them by running the following commands:

```bash
sudo a2enmod proxy
sudo a2enmod proxy_http
```

Then, restart Apache to apply the changes:

```bash
sudo systemctl restart apache2
```

### 2. Configure Apache Virtual Host

Edit your Apache virtual host configuration file where MetacatUI is served. This file is typically located in `/etc/apache2/sites-available/`. 

Add the following configuration inside the `<VirtualHost>` block:

```apache
# NSF Award API Proxy Configuration
ProxyPass "/research.gov/awardapi-service/v1/awards.json" "https://www.research.gov/awardapi-service/v1/awards.json"
ProxyPassReverse "/research.gov/awardapi-service/v1/awards.json" "https://www.research.gov/awardapi-service/v1/awards.json"
```

Replace `"https://www.research.gov/awardapi-service/v1/awards.json"` with the actual URL of the NSF Award API if it's different. You may also use a different proxy path if you prefer (other than `/research.gov/awardapi-service/v1/awards.json`), but make sure to update the proxy path in the `grantsUrl` property of the MetacatUI configuration as well.

### 3. Restart Apache

After editing the configuration file, restart Apache to apply the new settings:

```bash
sudo systemctl restart apache2
```

## Update MetacatUI Configuration

The last step is to update the MetacatUI configuration to use the proxy path, if you used a different proxy path than the default one. The default path is `/research.gov/awardapi-service/v1/awards.json`, relative to the domain on which your MetacatUI is served. If you used a different proxy path, you will need to update the `grantsUrl` property in the MetacatUI configuration:

```javascript
grantsUrl: "/research.gov/awardapi-service/v1/awards.json";
```

Ensure that you also have the funding lookup feature enabled in the MetacatUI configuration by setting the `fundingLookup` property to `true`. It defaults to `false`.

```javascript
useNSFAwardAPI: true;
```

## Testing

Ensure that the proxy is correctly set up by accessing the following URL in your browser:

```
[your MetacatUI domain]/research.gov/awardapi-service/v1/awards.json
```

You should see the JSON response from the NSF Award API.

## Conclusion

By following these steps, you set up an Apache proxy to enable the NSF award lookup feature in MetacatUI. Ensure you test the configuration to confirm everything is working as expected.

## Additional Notes

- Each MetacatUI installation that wants to use the NSF award lookup feature will need to set up its own proxy.
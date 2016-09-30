# Mayktso
Encounters at an endpoint.

## Status
Preliminary HTTP server. Originally intended to be a compliant
[LDN receiver](https://www.w3.org/TR/ldn#receiving) but will extend further to
do more LDP (e.g., ldp:constrainedBy), do authentication/authorisation.. and
other fancy standards stuff.

Next plans: see [issues](https://github.com/csarven/mayktso/issues).

## Receiver
Runs on http://localhost:3000/ by default:

```
$ node app.js
```

### Config
Optional config use: `cp config.json.default cp config.json`
```json
{
  "port": "3000",
  "sslKey": "/path/to/privkey.pem",
  "sslCert": "/path/to/cert.pem",
  "basePath": "",
  "inboxPath": "inbox/",
  "queuePath": "queue/",
  "maxPayloadSize": 1000,
  "maxResourceCount": 10
}
```

* Defaults will be used for omitted key/values (except sslKey/Cert are unused)
* base path is useful when running as a reverse proxy in a dedicated directory:
```
ProxyPass /foo/ https://localhost:3000/
ProxyPassReverse /foo/ https://localhost:3000/
```
so that http://example.org/foo/bar resolves, otherwise, server only sees /bar
* inbox and queue paths are relative to root e.g., http://localhost:3000/inbox/
* queue/ is used for HTTP 202 responses (default for payload above 1000 bytes)
* maxPayloadSize is for POSTs (as the name suggests)
* maxResourceCount is for number of notifications to keep in inbox/ or queue

### Command line
```bash
# Get target URL
$ curl -i -H'Accept: application/ld+json' http://localhost:3000/
$ curl -I -H'Accept: application/ld+json' http://localhost:3000/
$ curl -i -X OPTIONS -H'Accept: application/ld+json' http://localhost:3000/

# Send to Inbox
$ curl -i -X POST -H'Content-Type: application/ld+json' \
-d '[{"@id":"","http://schema.org/name":"Foo"}]' http://localhost:3000/inbox/
$ curl -i -X POST -H'Content-Type: text/turtle' \
-d '<> <http://schema.org/name> "Bar" .' http://localhost:3000/inbox/

# Get Inbox URL
$ curl -i -H'Accept: application/ld+json' http://localhost:3000/inbox/
$ curl -i -H'Accept: application/ld+json, text/turtle' http://localhost:3000/inbox/
$ curl -i -H'Accept: text/turtle, application/ld+json' http://localhost:3000/inbox/
$ curl -I -H'Accept: application/ld+json' http://localhost:3000/inbox/
$ curl -I -H'Accept: text/turtle' http://localhost:3000/inbox/

# Location header in POST response
$ curl -i http://localhost:3000/inbox/abc
$ curl -i -H'Accept: application/ld+json' http://localhost:3000/inbox/abc
$ curl -i -H'Accept: text/turtle' http://localhost:3000/inbox/abc
$ curl -i -H'Accept: application/ld+json, text/turtle' http://localhost:3000/inbox/abc
$ curl -i -H'Accept: text/turtle, application/ld+json' http://localhost:3000/inbox/abc
$ curl -I http://localhost:3000/inbox/abc
$ curl -I -H'Accept: application/ld+json' http://localhost:3000/inbox/abc
$ curl -i -X OPTIONS -H'Accept: application/ld+json' http://localhost:3000/inbox/abc
```

## Dependencies
* [SimpleRDF](https://github.com/simplerdf/simplerdf) (MIT License) used for RDF
* [Express](https://github.com/expressjs/express)
* and other node libraries for general plumbing

## License
[Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0)

## See also
* https://www.w3.org/TR/ldp/
* https://www.w3.org/TR/ldn/
* https://github.com/solid/node-solid-server
* https://github.com/linkeddata/dokieli

# mayktso
Encounters at an endpoint.

## About
* Preliminary HTTP server and command-line RDF tool to get/send, serialise data.
* Server can receive HTTP `HEAD`, `OPTIONS`, `GET`, `POST`, `PUT` requests.
Content negotiation with `text/turtle`, `application/ld+json`, `text/html`,
`application/xhtml+xml`
* Conforming
[Linked Data Notifications](https://www.w3.org/TR/ldn/) sender, receiver, sender.
TODO: Serialisation to HTML+RDFa
* The server speaks a little bit of LDP. It doesn't do
authenication/authorisation yet.

Dive into [issues](https://github.com/csarven/mayktso/issues) because it is fun.

## Receiver
Server runs on http://localhost:3000/ by default:

```shell
$ node index.js
```

### Config
Optional config use: `cp config.json.default config.json`
```json
{
  "port": "3000",
  "sslKey": "/path/to/privkey.pem",
  "sslCert": "/path/to/cert.pem",
  "proxyURL": "http://example.org/proxy?uri=",
  "rootPath": ".",
  "basePath": "",
  "inboxPath": "inbox/",
  "queuePath": "queue/",
  "maxPayloadSize": 100000,
  "maxResourceCount": 10
}
```

* Defaults will be used for omitted key/values (except `sslKey`/`sslCert` are
unused)
* `basePath` is useful when running as a reverse proxy in a dedicated directory
(e.g., Apache)
```apache
ProxyPass /foo/ https://localhost:3000/
ProxyPassReverse /foo/ https://localhost:3000/
```

so that http://example.org/foo/bar resolves, otherwise, server only sees /bar
e.g., `basePath: "/foo/bar/"`

* `inboxPath` and `queuePath` are relative to root e.g.,
http://localhost:3000/{inbox,queue}/
* queue is used for HTTP 202 responses (default for payload above maxPayloadSize in bytes).
Status: Testing
* `rootPath` defaults to the current directory (`.`) or a full path can be
specified. Requests are relative to this location.
* `maxPayloadSize` is for POSTs (as the name suggests)
* `maxResourceCount` is for number of notifications to keep in inbox/ or queue


## Sender and Consumer

### Command line
```shell
$ node index.js --help
mayktso: https://github.com/csarven/mayktso
  * Running without parameter/option starts server, otherwise:
  * Usage: node index.js [parameter] [options]
    [parameter]
    --help
    --discoverInbox <URI>        Discover a target's Inbox
    --getNotifications <URI>     Get the notifications contained in an Inbox
    --head <URI>                 Headers of a URI
    --options <URI>              Check the options of a URI
    --get <URI> [options]        Dereference a resource to RDF
    --post <URI> [options]       Send notification to Inbox
    --put <URI> [options]        Store data under a URI
    [options]
    --accept (m, default: application/ld+json)
    --contentType (m, default: application/ld+json)
    --slug string
    -d, --data <data>
    -o, --outputType (m, default: application/ld+json)
    m: mimetype or format; jsonld, turtle
```

```shell
$ node index.js --discoveryInbox http://localhost:3000/ --accept \
application/ld+json
$ node index.js --getNotifications http://localhost:3000/inbox/abc --accept \
application/ld+json
$ node index.js --head http://localhost:3000/
$ node index.js --get http://localhost:3000/ --accept application/ld+json
$ node index.js --post http://localhost:3000/inbox/ --slug foo \
--contentType application/ld+json -d \
'[{"@id":"http://example.org/foo","http://schema.org/name":"Foo"}]'
$ node index.js --put http://localhost:3000/inbox/ --contentType \
application/ld+json -d \
'[{"@id":"http://example.org/foo","http://schema.org/name":"Foo"}]'
```

Or just curl:
```shell
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
$ curl -i -H'Accept: application/ld+json, text/turtle' \
http://localhost:3000/inbox/
$ curl -i -H'Accept: text/turtle, application/ld+json' \
http://localhost:3000/inbox/
$ curl -I -H'Accept: application/ld+json' http://localhost:3000/inbox/
$ curl -I -H'Accept: text/turtle' http://localhost:3000/inbox/

# Location header in POST response
$ curl -i http://localhost:3000/inbox/abc
$ curl -i -H'Accept: application/ld+json' http://localhost:3000/inbox/abc
$ curl -i -H'Accept: text/turtle' http://localhost:3000/inbox/abc
$ curl -i -H'Accept: application/ld+json, text/turtle' \
http://localhost:3000/inbox/abc
$ curl -i -H'Accept: text/turtle, application/ld+json' \
http://localhost:3000/inbox/abc
$ curl -I http://localhost:3000/inbox/abc
$ curl -I -H'Accept: application/ld+json' http://localhost:3000/inbox/abc
$ curl -i -X OPTIONS -H'Accept: application/ld+json' \
http://localhost:3000/inbox/abc
```

## Dependencies
* [SimpleRDF](https://github.com/simplerdf/simplerdf) (MIT License) used for RDF
* [Express](https://github.com/expressjs/express)
* and other node libraries for general plumbing

## License
[Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0)

## See also
* mayktso is based on [Linked Data Platform](https://www.w3.org/TR/ldp/)
mechanisms
* [Linked Data Notifications](https://www.w3.org/TR/ldn/) conformant (use
mayktso as a receiver for your Inbox)
* Motived by [node-solid-server](https://github.com/solid/node-solid-server)
* Compliments [dokieli](https://github.com/linkeddata/dokieli)

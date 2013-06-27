# Refract

Converts NLM XML-format to a JSON representation that can be consumed by [Lens](http://lens.elifesciences.org/#about/figures/all/video_video1) and other web-clients.

# Experimental warnings

Refract will convert NLM formatted XML files into their JSON notation. Some of the meta related information (e.g. keywords, subject matter, organism), along with author contributions and conflict of interest might not render correctly because different publishers might have them in different portions of the XML and defined with different attribute tags. The other main issue during the conversion process that has come up is with annotating xref instance. If the ref-type is not supported in the convert variable within the converter, those links will not be established. The text will still render though. 

Finally, each publisher will have to provide their own "magic potion" to get the figure and video URLs. 

Please post to the issues if you have any questions and feel free to open up developmental branches where we can help make the necessary tweaks to get things running for you!


## Prerequisites

- Node.js 0.8.x

## Install

    $ npm install

## Start

    $ SECRET_TOKEN="abcd" node server.js

## API


**List all available documents**

```
GET /documents
```

**Get a specific document by ID where id is the eLife article number, e.g. 00278**

```
GET /documents/:document
```

**Update (convert or reconvert) a document**

```
PUT /documents/:document
```

**Delete a document from the index**

```
DELETE /documents/:document
```

**Reseed** 

Reconvert all documents (this may take a while)

```
PUT /reseed
```

**List conversion errors.**

This Useful for debugging, since the converter might fail for some documents. We're collecting the errors and are exposing them through a webservice.

```
GET /errors
```

**Status** (not yet implemented)

```
GET /status
```

This will output the current status of the converter. That way our worklflow can make sure that converting the docs has been completed successfully.

Output will look like this:

```js
{
  "status": "ready", // could also be "seeding" or "unhealthy"
  "docs_available": 138,
  "conversion_errors": 2
}
```



## API Usage examples

Update document `00012` with the contents of an XML hosted on S3.

```bash
curl -X PUT -H 'Content-Type: application/json' -d '{"url": "https://s3.amazonaws.com/elife-articles/00012/elife_2013_00012.xml.zip", "token": "abcd"}' http://localhost:1441/documents/00012
```

Delete document `00012`

```bash
curl -X DELETE -H 'Content-Type: application/json' -d '{"token": "abcd"}' http://localhost:1441/documents/00012
```

Reseed the cache, so all documents are reconverted

```bash
curl -X PUT -H 'Content-Type: application/json' -d '{"token": "abcd"}' http://localhost:1441/reseed
```


## Current Workflow

**1. Expose sources (XMLs that are provided by the typesetters)**

Our converter relies on a filestructure on S3, which involves an index file containing a list of xml files that are used as source for conversion.

`http://s3.amazonaws.com/elife-lens/xml_files.txt`

```
https://s3.amazonaws.com/elife-cdn/article_xml/elife00003.xml
https://s3.amazonaws.com/elife-cdn/article_xml/elife00005.xml
https://s3.amazonaws.com/elife-cdn/article_xml/elife00007.xml
https://s3.amazonaws.com/elife-cdn/article_xml/elife00011.xml
https://s3.amazonaws.com/elife-cdn/article_xml/elife00012.xml
```

**2. Seed the converter**

Seeding the converter is triggered by the workflow  (e.g. when a new article has arrived).

Seeding is triggered by the workflow via API call to `PUT /reseed`. This happens when a new article has been published. It might take a while until seeding is completed, the workflow can verify the conversion state by polling `GET /status`. Conversion errors are logged and also exposed via `GET /errors`.

**3. Mirror the output to S3, so we can serve the index + documents statically**

Once the converter has been run for all XML files, our workflow pulls them from the service (`GET /documents` for the index and `GET /documents/:docid` for a particular document and makes them available in an Amazon S3 bucket.


Currently the outputs are stored in a file structure like this


The document index:

```
https://s3.amazonaws.com/elife-cdn/documents/elife/documents.js
https://s3.amazonaws.com/elife-cdn/documents/elife/documents.json
```

A particular file

```
https://s3.amazonaws.com/elife-cdn/documents/elife/00482.js
https://s3.amazonaws.com/elife-cdn/documents/elife/00482.json
```

The `.js` file is consumed by the viewer to overcome CORS issues. The plain JSON sits just next to it.


## Desired Workflow

Some potential improvements to be discussed.

**1. Seeding the converter**

Ideally, we could expose the sources index as a JSON file, so it's easier for us to process it. We would no longer need to extract the id from the URL which makes things less error prone, also we could host the files somewhere else without the need for changing the converter.


`https://s3.amazonaws.com/elife-cdn/documents/elife/sources.json`

```json
{
  "documents": [
    {
      "id": "00003",
      "xml_url": "https://s3.amazonaws.com/elife-cdn/documents/elife/00003/article.xml"
    },
    {
      "id": "00005",
      "xml_url": "https://s3.amazonaws.com/elife-cdn/documents/elife/00005/article.xml"
    },
    ...
  ]
}
```

**2. Seed the converter**

No suggestions here at the moment.

**3. Mirror the output to S3, so we can serve the index + documents statically**

To be consistent with all of our URL's the proposed format would look like so:

The index:

```
https://s3.amazonaws.com/elife-cdn/documents/elife/documents.js
https://s3.amazonaws.com/elife-cdn/documents/elife/documents.json
```

And for particular files:

```
https://s3.amazonaws.com/elife-cdn/documents/elife/00482/article.js
https://s3.amazonaws.com/elife-cdn/documents/elife/00482/article.json
```

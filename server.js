// Copyright (c) 2013, Ivan Grubisic, Michael Aufreiter & eLife Sciences Publications, Ltd
// All rights reserved.

// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:

// Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
// Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
// WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
// ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
// (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
// LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
// ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
// SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

// The views and conclusions contained in the software and documentation are those
// of the authors and should not be interpreted as representing official policies, 
// either expressed or implied, of the FreeBSD Project.

var express = require('express');
var fs = require('fs');
var app = express();
var http  = require('http');
var _ = require('underscore');
var api = require('./lib/api');


var SECRET_TOKEN = process.env.SECRET_TOKEN || "abcd";
var PORT = process.env.PORT || 1441;


var ensureAuthorized = function(req, res, next) {
  req.body.token === SECRET_TOKEN ? next() : next('not_authorized');
};


app.configure(function () {
  app.use(express.bodyParser());
  app.use(express.methodOverride());
});



// Convenience for allowing CORS on routes - GET only
app.all('*', function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*'); 
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS'); 
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// List available documents
// -------------

app.get('/documents', function(req, res) {
  api.listDocuments(function(err, documents) {
    if (err) return res.jsonp(500, { error: err });
    res.jsonp(documents);
  });
});


// Get Document
// -------------

app.get('/documents/:document', function(req, res) {
  api.getDocument(req.params.document, function(err, doc) {
    if (err) return res.jsonp(500, { error: err });
    res.jsonp(doc);
  });
});

// Update document
// -------------

app.put('/documents/:document', 
  ensureAuthorized,
  function(req, res) {
    console.log('PUT /documents/'+req.params.document+' called');
    var options = {
      id: req.params.document,
      url: req.body.url.replace('https:', 'http:')
    };
    if (!options.url) res.jsonp(500, { error: "no url provided" });
    api.updateDocument(options, function(err, doc) {
      if (err) return res.jsonp(500, {error: err.message, stack: err.stack});
      res.jsonp(doc);
    });
  });


// Reseed
// -------------

app.put('/reseed',
  ensureAuthorized,
  function(req, res) {
    console.log('PUT /reseed called');
    api.reseed(function(err) {
      if (err) return res.jsonp(500, { error: JSON.stringify(err) });
      res.jsonp({"status": "now reseeding ... "});
    });
  });


// Delete document
// -------------

app.delete('/documents/:document',
  ensureAuthorized,
  function(req, res) {
    console.log('DELETE /documents/'+req.params.document+' called');
    api.deleteDocument(req.params.document, function(err, doc) {
      if (err) return res.jsonp(500, { error: err });
      res.jsonp({"status": "deleted"});
    });
  });


// Temporary solution to expose a valid library interface + documents
// -------------


// The generated library
app.get('/index.json', function(req, res) {
  // var json = JSON.parse(fs.readFileSync(__dirname+ '/data/lens_library.json', 'utf-8'));
  var json = {
    "id": "lens_library",
    "schema": ["substance-library", "0.1.0"],
    "nodes": {

      "library": {
        "type": "library",
        "name": "Lens development resources",
        "collections": ["elife"]
      },

      "elife": {
        "id": "elife",
        "name": "eLife",
        "type": "collection",
        "records": ["00003", "00005", "00311"]
      },

      "00003": {
        "id": "00003",
        "title": "A novel role for lipid droplets in the organismal antibacterial response",
        "authors": ["Preetha Anand", "Silvia Cermelli", "Zhihuan LiAdam Kassan"],
        "type": "record",
        "url": "http://localhost:1441/00003.json"
      },

      "00005": {
        "id": "00005",
        "title": "Molecular architecture of human polycomb repressive complex 2",
        "authors": ["Claudio Ciferri", "Gabriel C Lander", "Alessio Maiolica"],
        "type": "record",
        "url": "http://localhost:1441/00005.json"
      },

      "00311": {
        "id": "00311",
        "title": "Modelling dynamics in protein crystal structures by ensemble refinement",
        "authors": ["B Tom Burnley", "Pavel V Afonine", "Paul D Adams", "Piet Gros"],
        "type": "record",
        "url": "http://localhost:1441/00311.json"
      }
    }
  };

  res.json(json);
});


// For each document
app.get('/:document.json', function(req, res) {
  var docId = req.params.document;
  // var json = fs.readFileSync()
  var json = JSON.parse(fs.readFileSync(__dirname+ '/data/'+docId+'.json', 'utf-8'));
  res.json(json);
});


// Errors
// -------------

app.get('/errors',
  function(req, res) {
    res.jsonp(api.getErrors());
  });

app.listen(PORT);

console.log('Server listening on port', PORT,'with secret:', SECRET_TOKEN);

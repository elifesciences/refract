var DocumentCache = require('./document_cache');
var CacheWarmer = require('./cache_warmer');
var Converter = require('./converter');
var _ = require('underscore');

// Create a new cache
var cache = new DocumentCache();


// Warm cache on launch (delay a bit to avoid cyclic dependency madness)
_.delay(function() {
  new CacheWarmer(cache).start();  
}, 20);


var EMPTY_COLLECTION = {
  "type": {
    "_id": "/type/article",
    "name": "Projects",
    "properties": {
      "name": {
        "name": "Article Name",
        "type": "string",
        "unique": true
      },
      "journal": {
        "name": "Journal",
        "type": "string",
        "unique": true
      },
      "authors": {
        "name": "Author",
        "type": "string",
        "unique": false,
        "meta": {
          // "facet": true,
          "details": true
        }
      },
      "published_at": {
        "name": "Published Date",
        "type": "date",
        "unique": true
      },
      "image": {
        "name": "Image",
        "type": "string",
        "unique": true
      },
      "abstract": {
        "name": "Abstract",
        "type": "string",
        "unique": true
      },
      "article-type": {
        "name": "Article Type",
        "type": "string",
        "unique": true,
        "meta": {
          "facet": true,
          "details": true
        }
      },
      "organisms": {
        "name": "Organisms",
        "type": "string",
        "unique": false,
        "meta": {
          "facet": true,
          "details": true
        }
      },
      "subjects": {
        "name": "Subjects",
        "type": "string",
        "unique": false,
        "meta": {
          "facet": true,
          "details": true
        }
      },
      "keywords": {
        "name": "Keywords",
        "type": "string",
        "unique": false,
        "meta": {
          "facet": false,
          "details": true
        }
      }
    }
  },
  "objects": []
};


var errors = [];

// Collect a new conversion error
// -----------------

function collectError(docId, err) {
  errors.push({
    document: docId,
    err: err.stack,
    message: err.message
  });
}

var API = {

  // List all available documents
  // -----------------

  listDocuments: function(cb) {
    var docs = [];
    _.each(cache.list(), function(doc) {
      var authors = _.map(doc.nodes["cover:document"].authors, function(a) {
        return doc.nodes[a]["last-name"];
      });
      var props = doc.properties;

      docs.push({
        _id: doc.id,
        published_at: props["published_on"] || props["accepted_on"] || props["received_on"],
        name: props.title,
        authors: authors,
        "journal": props["journal"],
        "article-type": props["article_type"],
        keywords: props["keywords"],
        organisms: _.map(props["research_organisms"], function(o) {
          if (o === "rat") return "Rat";
          if (!o) return "None";
          return o;
        }),
        subjects: props["subjects"],
        url: '/documents/'+doc.id        
      });
    });

    cb(null, _.extend(EMPTY_COLLECTION, {
      "objects": docs
    }));
  },


  // Update document
  // -----------------

  updateDocument: function(options, cb) {
    var converter = new Converter();
    converter.convert(options, function(err, doc) {
      if (err) {
        collectError(options.id, err);
        return cb(err);
      }
      cache.set(options.id, doc);
      cb(null, doc);
    });
  },

  // Reseed the cache
  // -----------------

  reseed: function(cb) {
    // Create a new cache
    cache = new DocumentCache();

    // Warm it
    new CacheWarmer(cache).start();
    cb(null);
  },

  // Delete document
  // -----------------

  deleteDocument: function(id, cb) {
    cache.remove(id);
    cb(null);
  },

  // Get Document by id
  // -----------------

  getDocument: function(id, cb) {
    var doc = cache.get(id);
    if (doc) cb(null, doc);
    else cb('not_found');
  },

  getErrors: function() {
    return errors;
  }
};

module.exports = API;
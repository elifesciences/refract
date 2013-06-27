// Holds documents in Memory (can be persisted a later point)
// =============

var _ = require('underscore');

var DocumentCache = function() {
  // Converted docs are stored here
  var documents = {};

  // Store doc in the cache
  this.set = function(id, doc) {
    documents[id] = doc;
    console.log('updated cache: doc ', id);
  };

  // Get document
  this.get = function(id) {
    return documents[id];
  };

  // Delete document
  this.remove = function(id) {
    delete documents[id];
    console.log('removed from cache', id);
  };

  // List documents in the cache
  this.list = function() {
    var res = [];
    _.each(documents, function(d) {
      res.push(d);
    });
    return res;
  };

  // Clear the cache
  this.clear = function() {
    documents = {};
  };
};

module.exports = DocumentCache;
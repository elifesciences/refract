// Warm the cache by pulling doc id's from github and start the conversion
// =============

var Converter = require('./converter');
var _ = require('underscore');
var util = require('./util');

var CACHE_WARM_FILE = process.env.CACHE_WARM_FILE || 'http://s3.amazonaws.com/elife-lens/xml_files.txt';

var CacheWarmer = function(cache) {
  // Error log for conversion

  // If you want to load local files, use fs.readFileSync in listDocuments(cb). 
  // Need to update line 11 in api.js to say _.delay(function() { new CacheWarmer(cache).start();  }, 20);
  function listDocuments(cb) {
    var url = CACHE_WARM_FILE;
    util.getURL(url, function(err, data) {
      var files = data.split('\n');
      cb(null, files);
    });
  }

  function buildDocs(cb) {
    listDocuments(function(err, docs) {
      var index = 0;
      var api = require('./api');

      function next() {
        // TODO: Remove that hack of turning https into http
        var url = docs[index].replace('https:', 'http:');

        // This needs to be tweaked for every type of source
        var id = index;
        
        api.updateDocument({id: index, url: url}, function(err) {
          index += 1;
          if (docs[index]) {
            next();
          } else {
            cb(null);
          }
        });
      }
      next();
    });
  }

  // Start off
  this.start = function() {
    buildDocs(function() {
      console.log('Cache warmed.');
    });
  };
}

module.exports = CacheWarmer;
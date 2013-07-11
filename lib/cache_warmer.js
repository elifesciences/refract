// Warm the cache by pulling doc id's from github and start the conversion
// =============

var Converter = require('./converter');
var _ = require('underscore');
var util = require('./util');
var fs = require('fs');

var CacheWarmer = function(cache) {
  // Error log for conversion

  function listDocuments(cb) {
    var data = fs.readFileSync('./data/plos_xml_list.txt','utf8');
    var files = data.split('\n')
    cb(null, files);
  }

  function buildDocs(cb) {
    listDocuments(function(err, docs) {
      var index = 0;
      var api = require('./api');
      
      function next() {
        // TODO: Remove that hack of turning https into http
        var url = docs[index].replace('https:', 'http:');
        try {
          var id = /journal.(.*).(\d+)/.exec(url)[0].replace(/\./g,'_');
          
          api.updateDocument({id: id, url: url}, function(err) {
            index += 1;
            if (docs[index]) {
              next();
            } else {
              cb(null);
            }
          });
        }
        catch (TypeError){
          console.log(url)
        }
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
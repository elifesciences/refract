var util = {};
var http = require('http');
var fs = require('fs');


// Load eLife doc as plaintext
// -------
// TODO: get rid of the hacks introduced such as inserting the 1 or 2 and 'e' prefix

util.loadText = function(pth, cb) {
  pth = pth.replace('//', '/1/e');
  var options = {
    hostname: 'elife.elifesciences.org',
    port: 80,
    path: pth,
    method: 'GET',
    headers: {"Accept": "text/plain"},
    async : 'false'
  };

  var request = http.get(options, function(res) {
    res.setEncoding('utf8');
    var article = "";
    res.on("data", function(chunk){
      article += chunk.replace(/\*/g,'');
    });
    res.on("end",function() {
      if (pth.indexOf('/1/')>=0 && res.statusCode != 200) {
        return util.loadText(pth.replace('/1/', '/2/'), cb);
      } else {
        cb(null, article,pth);  
      }
    });
  }).on("error", function(e) {
    if (pth.indexOf('/1/')>=0) {
      // retry with /content/2
      return util.loadText(pth.replace('/1/', '/2/'), cb);
    }
    cb(e.message);
  });
};

// GET Request to given URL
// -------

util.getURL = function(url, cb) {
  var parts = require("url").parse(url),
      protocol;

  if (parts.protocol === 'http:') {
    protocol = require('http');
  } else if(parts.protocol === 'https:') {
    protocol = require('https');
  }

  
  protocol.get(url, function(res) {
    res.setEncoding('utf8');
    var result = "";
    res.on("data", function ( d ) {
      result += d.toString();
    });
    res.on('end', function() {
      cb(null, result);
    });
  }).on('error', function( e ) {
    cb(err);
  });
};


// Load an eLife XML file, unzip if zip-archive provided
// -------

util.loadXML = function(url, cb) {
  // delegate
  return util.getURL(url, cb);
};

module.exports = util;
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

var http  = require('http');
var _ = require('underscore');
var util = require('./util');
var fs = require('fs');

// The eLife Document Converter
// =============

var Converter = function(options) {

  // Convert XML to JSON
  // =============

  function convert(xml, cb) {
    var parser = require("sax").parser(true);

    // Initialize some variables for counting and ID purposes
    // ============

    var nodeCount = 1;
    var paperid = '';
    var affmap = [];
    var figcount = 1;
    
    
    // Create the document object for the JSON
    // ============

    var document = {
      "id" : "",
      "nodes": {
        "content": {
          "type" : "view",
          "id" : "content",
          "nodes" : []
        },
        "figures" : {
          "type" : "view",
          "id" : "figures",
          "nodes" : []
        },
        "citations" : {
          "type" : "view",
          "id" : "citations",
          "nodes" : []
        },
        "document" : {
          "type" : "document",
          "id" : "document",
          "views" : [
            "content",
            "figures",
            "citations"
          ],
          "guid" : "",
          "title" : '',
          "authors" : [],
          "received_on" : "",
          'accepted_on' : "",
          "published_on" : "",
          "journal" : "",
          "article_type" : "",
          "keywords" : [],
          "research_organisms" : [],
          "subjects" : [],
          "pdf_link" : "",
          "xml_link" : "",
          "json_link" : "",
          "doi" : ""
        },
      }
    };

    // Supported reference and font style tags
    // =============

    var convert = {
      'xref' : {
        'bibr' : ['citation_reference','article_citation'],
        'boxed-text' : ["figure_reference","box"],
        'fig' : ['figure_reference','image'],
        'sec' : ["cross_reference","heading"],
        'table' : ['figure_reference','table'],
        'other' : ['figure_reference','video'],
        'movie' : ['figure_reference','video'],
        'video' : ['figure_reference','video'],
        'disp-formula' : ['cross_reference','formula'],
        'inline-formula' : ['cross_reference','inline-formula'],
        'aff' : ['affiliation_reference', 'affiliation'],
        'supplementary-material' : ['figure_reference','supplement'],
        'supplement-material' : ['figure_reference','supplement'],
        'supplementary-meterial' : ['figure_reference','supplement'],
        'table-fn' : ["figure_reference","table"]
      },
      'bold' : 'strong',
      'italic' : 'emphasis',
      'underline' : 'underline',
      'sc' : 'sc',
      'sup' : 'superscript',
      'sub' : 'subscript',
      'ext-link' : 'link',
      'research-organism' : 'Research Organism',
      'author-keywords' : 'Keywords',
    }

    // Dictionary of keys that are affiliated with each annotation type
    // =============

    var nodetype = {
      'image' : ['type','id','label','url','object_id','title','content_type','large_url','content','group','doi','caption'],
      'box' : ['type','id','label','url','title','caption','content','doi'],
      'table' : ['type','id','label','content','title','footers','doi','caption','format'],
      'supplement' : ['type','id','label','source','title','caption','content','doi','files'],
      'list' : ['type','id','items'],
      'paragraph' : ['type','id','content'],
      'file' : ['type','id','description','name','url'],
      'quote' : ['type','id','content'],
      'citation' : ['type','id','authors','title','year','volume','source','issue','fpage','lpage','edition','comment','publisher-name','publisher-loc','doi','citation_url','format','label','editors'],
      'article_citation' : ['type','id','authors','title','year','volume','source','issue','fpage','lpage','collab','edition','publisher-name','publisher-loc','doi','citation_url','format','label','editors'],
      'caption' : ['type','id','content'],
      'video' : ['type','id','label','title','caption','content_type','url_ogv','url_jpg','url_mp4','doi'],
      'person' : ['type','id','given-names','last-name','role','affiliations','image','contribution','email','funding'],
      'figure_reference' : ['type','id','path','target','range'],
      'citation_reference' : ['type','id','path','target','range'],
      'cross_reference' : ['type','id','path','target','range'],
      'annotation' : ['type','id','path','target','range'],
      'institution' : ['type','id','name','city','country','email','image'],
      'funding' : ['type','id','institution','accession','person','given-names','last-name'],
      'footer' : ['type','id','content','label'],
      'formula' : ['type','id','label','content','format'],
      'heading' : ['type','id','level','content','nodes'],
      'dataset' : ['type','id','content'],
      'email' : ['type','id','node','email'],
      'publication_info' : ['type','id','accepted_on','journal','article_type','received_on','published_on','keywords','research_organisms','subjects','pdf_link','xml_link','json_link','doi','nodes']
    }

    // Keys that require lists when initializing
    // =============

     var keylist = ['authors','affiliations','keywords','files','dataset','editor','items','editors','funding','subjects','nodes','footers','subject','citation_url'];

    // Find the parent tag
    // =============

    function GetParentTag(node,steps){
      // Return the tag that is n steps from the current open tag
      return node["tags"][node["tags"].length-steps];
    };
    
    // Compile the Info information in an ordered way
    // =================

    function CompileInfo(){
      var list = ["publication_info",'infoblock:author_info',"person",'infoblock:article_info',"info:impact","info:download","info:review","info:author_contributions","info:corresponding","info:funding","info:competing_interest","info:dataset","info:ack","info:copyright"];
      document["nodes"]["infoblock:author_info"] = {
        "type" : "heading",
        "id" : "infoblock:author_info",
        'content' : 'Author Information',
        "level" : 1,
        "nodes" : []
      };
      document["nodes"]["infoblock:article_info"] = {
        "type" : "heading",
        "id" : "infoblock:article_info",
        "content" : 'Article Information',
        'level' : 1,
        "nodes" : []
      };


      var nodes = document["nodes"];
      var authors = document["nodes"]["document"]["authors"];
      for (var i=0;i<list.length;i++){
        if (list[i].indexOf("person") >= 0){
          for (var j=0;j<authors.length;j++){
            document["views"]["info"].push(authors[j]);
          }
          continue
        }
        try {
          var nd = document["nodes"][list[i]]["nodes"];
          delete document["nodes"][list[i]].nodes;
          document["views"]["info"].push(list[i]);
        }
        catch (TypeError){
          continue
        }
        for (var j=0;j<nd.length;j++){
          document["views"]["info"].push(nd[j]);
        } 
      }
    };

    function ClearEmpty() {
      var nodes = document["nodes"];
      for (var key in nodes){
        var prop = document["nodes"][key];
        if (prop["type"] === 'text' && prop["content"] === " "){
          delete document["nodes"][key];
          document["views"]["content"] = _.without(document["views"]["content"],key);
          continue
        }
        for (var subkey in prop){
          if (prop[subkey] === '' || prop[subkey] === []){
            delete document["nodes"][key][subkey];
          }
        }
      }
    };

    function SaveJSON() {
      if (true){
        fs.writeFileSync('./data/'+document["id"]+'.json',JSON.stringify(document,null,2));
        console.log('converted and printed '+document["id"]);
      }
    }

    function BuildStats() {

      function ShowAbstract() {
        var content = document["nodes"]["content"]["nodes"];
        var init = 0;
        for (var i=0;i<content.length;i++){
          if (content[i].indexOf('heading_s') >=0){
            stats["nodes"][doi]["display"] = stats["nodes"][doi]["abstract"]
            return
          }
          else if (content[i].indexOf('abstract') >= 0 || init === 1){
            init = 1;
            stats["nodes"][doi]["abstract"].push(content[i]);
          } 
        }
      }

      var contents = fs.readFileSync('./data/lens_stats.json','utf8');
      var stats = JSON.parse(contents);
      var doi = document["nodes"]["document"]["doi"];
      if (doi in stats["nodes"]){
        fs.writeFileSync('./data/lens_stats.json',JSON.stringify(stats,null,2))
        return
      }
      else {
        stats["nodes"][doi] = {
          "id" : doi,
          "article_id" : document["id"],
          "type" : "stats",
          "display" : [],
          "abstract" : [],
          "figures" : [],
          "citations" : []
        }
        ShowAbstract();
        fs.writeFileSync('./data/lens_stats.json',JSON.stringify(stats,null,2))
      }
    }
    function AddToLibrary() {
      function AddRecord(){
        function AddAuthors() {
          var authors = document["nodes"]["document"]["authors"];
          for (var i=0;i<authors.length;i++){
            var name = document["nodes"][authors[i]]["given-names"] +" "+ document["nodes"][authors[i]]["last-name"];
            library["nodes"][id]["authors"].push(name);
          }
          fs.writeFileSync('./data/lens_library.json',JSON.stringify(library,null,2))
          return
        }
        if (library["nodes"][type]["records"].indexOf(id) < 0) {
          library["nodes"][type]["records"].push(id);
        }
        
        library["nodes"][id] = {
          "id" : id,
          "title" : document["nodes"]["document"]["title"],
          "type" : "record",
          "authors" : [],
          "url" : document['id']+'.json'
        }
        AddAuthors();
      }
      function AddCollection() {
        library["nodes"]["library"]["collections"].push(type);
        library["nodes"][type] = {
          "id" : type,
          "name" : document["nodes"]["document"]["journal"],
          "type" : "collection",
          "records" : []
        }
        AddRecord();
      }
      var contents = fs.readFileSync('./data/lens_library.json','utf8');
      var library = JSON.parse(contents);

      var id = document["id"];
      var type = document["nodes"]["document"]["journal"].toLowerCase();
      var collections = library["nodes"]["library"]["collections"]
      if (collections.indexOf(type) >= 0){
        AddRecord();
      }
      else {
        AddCollection();
      }
    }

    function BuildProperties() {
      document["properties"]["title"] = document["nodes"]["document"]["title"];
      document["properties"]["authors"] = document["nodes"]["document"]["authors"];
      var keys = document["nodes"]["document"];
      for (var subkey in keys) {
        if (subkey === 'type' || subkey === 'id'){
          continue
        }
        document["properties"][subkey] = document["nodes"]["document"][subkey];
      }
    }

    function TabletoImage() {
      var figs = document["nodes"]["figures"];
      for (var i=0;i<figs.length;i++) {
        if (figs[i].indexOf('table') >=0 && typeof document["nodes"][figs[i]]["graphic_id"] !== 'undefined') {
          var id = figs[i].replace('table_','image:');
          document["nodes"][id] = document["nodes"][figs[i]];
          delete document["nodes"][figs[i]];
          
          document["nodes"][id]["id"] = id;
          document["nodes"][id]["type"] = "image";
          for (j in document["nodes"]){
            if (document["nodes"][j]["type"] === 'figure_reference') {
              if (document["nodes"][j]["target"] ===  figs[i]){
                document["nodes"][j]["target"] = id;
              }
              else if (document["nodes"][j]["source"] === figs[i]){
                document["nodes"][j]["source"] = id;
              }
            }
          }
          document["views"]["figures"][i] = id;
        }
      }
    }

    function urlMagic() {
      var journal = document["nodes"]["document"]["journal"].toLowerCase();
      if (journal.indexOf('plos') >= 0){
        var doi = '10.1371/'
        var id = document["id"].replace(/\_/g,'.');
        document["nodes"]["document"]["doi"] = 'http://www.plosone.org/article/info:doi/'+doi+id;
        document["nodes"]["document"]["json_link"] = 'http://localhost:1441/documents/' + document["id"];
        document["nodes"]["document"]["pdf_link"] = 'http://www.plosone.org/article/fetchObjectAttachment.action?uri=info%3Adoi%2F10.1371%2F'+id+'&representation=PDF';
        document["nodes"]["document"]["xml_link"] = 'http://www.plosone.org/article/fetchObjectAttachment.action?uri=info%3Adoi%2F10.1371%2F'+id+'&representation=XML';
      }
      else if (journal.indexOf('peerj') >= 0) {

      }
      else if (journal.indexOf('elife') >= 0) {
        var id = document["id"];
        document["nodes"]["document"]["doi"] = "http://dx.doi.org/10.7554/eLife."+id;
        document["nodes"]["document"]["xml_link"] = "https://s3.amazonaws.com/elife-cdn/elife-articles/"+id+"/elife"+id+".xml";
        document["nodes"]["document"]["json_link"] = "https://s3.amazonaws.com/elife-cdn/elife-articles/"+id+"/"+id+".json";
      }
      for (var node in document["nodes"]){
        if (typeof document["nodes"][node]["graphic_id"] !== 'undefined'){
          if (journal.indexOf('plos') >= 0){
            if (document["nodes"][node]["type"] === 'image' || document["nodes"][node]["type"] === 'table') {
              document["nodes"][node]["url"] = 'http://www.plosone.org/article/fetchObject.action?uri=' + document["nodes"][node]["graphic_id"]+'&representation=PNG_M';
              document["nodes"][node]["large_url"] = 'http://www.plosone.org/article/fetchObject.action?uri='+ document["nodes"][node]["graphic_id"]+'&representation=PNG_M';
            }
            else if (document["nodes"][node]["type"] === 'formula'){
              document["nodes"][node]["url"] = 'http://www.plosone.org/article/fetchObject.action?uri=' + document["nodes"][node]["graphic_id"]+'&representation=PNG';
            }
            else if (document['nodes'][node]["type"] === 'supplement'){
              document["nodes"][node]["source"] = "http://www.plosone.org/article/fetchSingleRepresentation.action?uri=info:doi/10.1371/" + document["nodes"][node]["graphic_id"]
            }
          }
          else if (journal.indexOf('peerj') >=0){
            document["nodes"][node]["url"] = document["nodes"][node]["graphic_id"];
            document["nodes"][node]["large_url"] = document["nodes"][node]["graphic_id"];
          }
          if (journal.indexOf('elife') >= 0){
            if (document["nodes"][node]["type"] === 'image') {
              document["nodes"][node]["url"] = "https://s3.amazonaws.com/elife-cdn/elife-articles/"+id+'/svg/'+document["nodes"][node]["graphic_id"]+'.svg';
            }
            else if (document['nodes'][node]["type"] === 'file'){
              document["nodes"][node]["url"] = "https://s3.amazonaws.com/elife-cdn/elife-articles/"+id+'/suppl/'+document["nodes"][node]["graphic_id"];
            }
          }
        }
      }
    };

    // Initialize the node object
    // =================

    function BeginInitObj(node,type){
      var id = IfIdPres(node,type);
      InitObj("nodes",type,id);
      return id
    }

    function InitObj(node,type,id) {
      if (id in document['nodes']){
        return
      }
      if (id.indexOf("annotation") >= 0){
        var keys = nodetype["annotation"];
      }
      else {
        var keys = nodetype[type];
      }

      document[node][id] = {};
      for (var i=0;i<keys.length;i++) {
        if (keylist.indexOf(keys[i]) >= 0){
          document[node][id][keys[i]] = [];
        }
        else {
          document[node][id][keys[i]] = ""; 
        }
      }

      document[node][id]["type"] = type;
      document[node][id]["id"] = id;
    }

    // Create a node id in case there is no id in the XML tag
    // =================

    function GetNodeId(type){
      var id = type + '_' + nodeCount;
      nodeCount += 1;
      return id
    };

    // Check to see if an id already exists. If not, make a 
    // new one
    // =================

    function IfIdPres(node,type) {
      try {
        var parent = GetParentTag(node,2);
        if (type === 'heading' && typeof parent["attributes"]["id"] !== 'undefined'){
          return type+'_'+parent["attributes"]["id"].replace(/[\.\-]/g,'_')
        }
        var id = node["tag"]["attributes"]["id"];
        if (typeof id !== 'undefined'){
          return type+'_'+id.replace(/[\.\-]/g,'_');
        }
        else {
          var id = CreateNewId(node,type);
        }
      }
      catch (TypeError) {
        var id = CreateNewId(node,type);
      }
      return id
    }
    
    // Create a new tag id if it was not enclose in the xml
    // ================

    function CreateNewId(node,type) {
      var name = node["tagName"];
      if (name === 'xref') {
        var id = GetNodeId(type);
      }
      else if (CheckTags(name) || type.indexOf('link') >= 0) {
        var id = GetNodeId("annotation");
      }
      else{
        var id = GetNodeId(type);
      }
      return id
    }
    
    function ReturnToSec(node) {
      var nodeparents = node["tags"];
      var tags = [];
      for (var i=0;i<nodeparents.length;i++) {
        tags.push(nodeparents[i]["name"]);
      }
      if (tags.indexOf('caption') >= 0){
        GetCaptions(node);
      }
      else if (tags.indexOf('list') >= 0){
        GetList(node);
      }
      else if (tags.indexOf('sub-article') >= 0) {
        GetCommentary(node);
      }
      else if (tags.indexOf('body') >= 0){
        ReadBody(node);
      }
      else if (tags.indexOf('abstract') >= 0){
        GetAbstract(node);
      }
      else if (tags.indexOf('front') >= 0){
        ReadFront(node);
      }
      else if (tags.indexOf('ref') >= 0){
        GetCitations(node);
      }
      else if (tags.indexOf('back') >= 0){
        ReadBack(node);
      }
    }
    // All of the code used to process the text and build 
    // the required annotations 
    // =================
    
    function ProcessText(node,text,index,key,tag) {
      if (CheckTags(tag)){
        GetAnnotations(node,text,index,tag,key);
      }
      else if (tag !== 'object-id' && tag !== 'article-id'){
        AddText(text.replace(/\n/g,''),index,key);
      }
    };

    function AddText(text,index,key) {

      if (typeof text["tags"] !== 'undefined') {
        var name = text["tagName"]
        text.ontext = function (txt) {
          if (key === 'doi'){
            document["nodes"][index][key] = 'http://dx.doi.org/'+txt;
          }
          else if (document["nodes"][index][key] === "[object Object]"){
            document["nodes"][index][key] = txt;
          }
        }
        text.onclosetag = function(tag){
          if (tag === name){
            ReturnToSec(text);
          }
        }
      }

      // Add text to the text/caption nodes
      try {
        document["nodes"][index][key] += text;
      }
      catch (TypeError){
        document["nodes"][index][key] = text;
      }
    }
    
    function CheckTags(tag){
      // Check to see if a text embedded tag is supported
      if (tag in convert){
        return true
      }
      else{
        return false
      }
    }

    function AnnotationSequence(node,stag,node_id,initpos,path) {
      function DefineType(node,stag) {
        function CheckDouble(node){
          if (node["tag"]["attributes"]["rid"].indexOf(' ') >= 0){
            var id = node["tag"]["attributes"]["rid"].split(' ');
            return id[0]
          }
          else {
            return node["tag"]["attributes"]["rid"]
          }
        }

        if (stag === 'xref') {
          try {
            var type = convert[stag][node["tag"]["attributes"]["ref-type"]][0];
            var rid = CheckDouble(node);
            var id = convert[stag][node["tag"]["attributes"]["ref-type"]][1] +'_'+rid.replace(/[\.\-]/g,'_');
          }
          catch (TypeError) {
            AddText(text,node_id,path);
          }
        }
        else{
          var type = convert[stag];
          var id = null;
        }
        return [type,id]
      }

      function Checklink(tag) {
        if (tag === 'ext-link') {
          return node["tag"]["attributes"]["xlink:href"];
        }
      }

      function CreateAnnot(node,st,rid,urlattr) {
        if (typeof rid[0] === 'undefined') {
          return
        }
        var annot = BeginInitObj(node,rid[0]);
        var finalpos = document["nodes"][node_id][path].length
        document["nodes"][annot]["type"] = rid[0];
        document["nodes"][annot]["path"] = [node_id,path];
        document["nodes"][annot]["target"] = rid[1];
        document["nodes"][annot]["range"] = [st,finalpos];
        if (rid[0] === 'link' && typeof urlattr !== "undefined" ) {
          document["nodes"][annot]["url"] = urlattr;
        }
      }

      function CheckSerial(node,name) {
        if (CheckTags(name)) {
          var pos = document["nodes"][node_id][path].length;
          tags.push(name);
          starts.push(pos);
          RunInternal(node,name,pos);
        }
      }

      function RunInternal(node,newtag,init) {
        var urlattr = Checklink(newtag)
        var refid = DefineType(node,newtag);
        node.onopentag = function(tag){
          var name = tag["name"];
          CheckSerial(node,name);
        }
        node.ontext = function(text){
          AddText(text,node_id,path);
        }
        node.onclosetag = function(name){
          if (name == newtag){
            CreateAnnot(node,init,refid,urlattr);
            tags.splice(tags.length-1,1);
            starts.slice(starts.length-1,1);
            if (tags.length > 0) {
              newtag = tags[tags.length-1];
              init = starts[starts.length-1];
              RunInternal(node,newtag,init);
            }
            else{
              AnnotationSequence(node,stag,node_id,initpos,path);
            }
          }
        }
      }

      tags = [];
      starts = [];
      var urlattr = Checklink(stag)
      var refid = DefineType(node,stag);
      node.onopentag = function(tag) {
        var name = tag["name"]
        if (stag === ''){
          var stpos = document["nodes"][node_id][path].length;
          AnnotationSequence(node,name,node_id,stpos,path);
        }
        else {
          CheckSerial(node,name);
        }
        CheckOtherTags(node,tag);
      }
      node.ontext = function(text) {
        var name = node["tagName"]
        if (name !== 'object-id' && name !== 'article-id'){
          AddText(text,node_id,path); 
        }
      }
      node.onclosetag = function(name) {
        if (name === stag) {
          CreateAnnot(node,initpos,refid,urlattr);
          stag = '';
        }
        else if (name === 'p' || !CheckTags(name) || name === 'body') {
          ReturnToSec(node);
        }
      }
    }

    // Add the node to the index list
    // ==============

    function AddToIndex(id,type) {
      if (id in document["nodes"][type]["nodes"]){
        return
      }
      document["nodes"][type]["nodes"].push(id);
    }

    function AddToInfoIndex(infoid,nodeid){
      document["nodes"][infoid]["nodes"].push(nodeid);
    };

    // Code for building the header nodes
    // ==============

    function GetHeading(node,tag) {
      // Create and populate the heading node
      var level = GetHeadingLevel(node);
      var id = BeginInitObj(node,"heading");
      AddToIndex(id,"content");
      document["nodes"][id]["level"] = level;
      
      GetText(node,id,tag,'content');
    };

    function GetHeadingLevel(node) {
      // Figure out if it is a sub header or a section header
      var parents = node["tags"]
      var level = 1
      for (var i=0;i<parents.length;i++){
        if (parents[i]["name"] === 'sec'){
          level += 1;
        }
      }
      return level-1;
    };

    // Code for adding paragraph text into text nodes
    // ================

    function GetText(node,node_id,stag,key) {
      node.onopentag = function(tag) {
        var name = tag["name"];
        if (name === 'boxed-text'){
          var id = BeginInitObj(node,"box");
          AddToIndex(id,"figures");
          GetBox(node,id,name);
        } 
        else if (CheckTags(name)){
          var stpos = document["nodes"][node_id][key].length;
          AnnotationSequence(node,name,node_id,stpos,key);
        }
        else {
          CheckOtherTags(node,tag);
        } 
      }
      node.ontext = function(text){
        AddText(text,node_id,key);
      };
      node.onclosetag = function(tag){
        if (tag === stag){
          ReturnToSec(node);
        }
      };
    };

    function GetCitations(node){
        function InitAuthors() {
          return {
            "given-names" : '',
            "last-name" : '',
          };
        }
        function RunThroughCitName(node,author_type){

          function AddName(node,stag,key){
            node.ontext = function(text) {
              author[key] = text;
            }
            node.onclosetag = function(name){
              if (name === stag){
                RunThroughCitName(node,author_type);
              }
            }
          }         

          node.onopentag = function(tag){
            var name = node["tagName"];
            if (name === 'given-names'){
              AddName(node,name,name);
            }
            else if (name === 'surname'){
              AddName(node,name,'last-name');
            }
          }
          
          node.onclosetag = function(name) {
            if (name === "name"){
              document['nodes'][id][author_type].push(author["given-names"]+' '+author["last-name"]);
              author = InitAuthors();
            }
            else if (name === 'person-group'){
              GetCitations(node);
            }
          }
        };

        function SwitchBook(id){
          if (document["nodes"][id]["title"] === ''){
            document["nodes"][id]["title"] = document["nodes"][id]["source"];
            document["nodes"][id]["source"] = '';
          }
        }
        
        function AddLabelFormat(id,label,format) {
          if (label !== '') {
            document['nodes'][id]["label"] = label;
          }
          if (typeof format !== 'undefined') {
            document['nodes'][id]["format"] = format;
          }
        }
        function CheckLensFormat(index) {
          var contents = fs.readFileSync('./data/lens_stats.json','utf8');
          var stats = JSON.parse(contents);
          var doi = document['nodes'][index]["doi"];
          if (doi in stats["nodes"]) {
            document["nodes"][id]["display"] = {
              "article_id" : stats["nodes"][doi]["article_id"],
              "render" : stats["nodes"][doi]["display"]
            }
          } 
        }
        function UpdateInArticle(id) {
          console.log("inside")
          for (node in document["nodes"]){
            console.log(node)
            if (document["nodes"][node]["target"] === 'article_citation_'+id) {
              document["nodes"][node]["target"] = "citation_" + id;
            }
          }
        }
        function SetID(rid) {
          id = 'article_citation'+'_'+rid.replace(/[\.\-]/g,'_');
          InitObj("nodes",'article_citation',id);
          AddToIndex(id,"citations");
          if (typeof format !== 'undefined') {
            document['nodes'][id]["format"] = format;
          }
          if (lbl !== '') {
            document['nodes'][id]["label"] = lbl;
          }
        }
        var tags = false;
        var lbl = '';
        var rid = node["tag"]["attributes"]["id"];
        var format = ''
        if (node["tagName"] !== 'ref'){
          var id = document["nodes"]["citations"]["nodes"][document["nodes"]["citations"]["nodes"].length-1];
          CheckLensFormat(id);
          tags = true;
        }
       
        node.onopentag = function(tag){
          var name = tag["name"];
          if (name.indexOf('citation') >= 0) {
            format = tag["attributes"]['publication-type'];
          }
          else if (name === 'person-group' && tag["attributes"]["person-group-type"] === 'author'){
            tags = true;
            author = InitAuthors();
            if (typeof id === 'undefined') {
              SetID(rid);
            }
            RunThroughCitName(node,'authors');
          }
          else if (name === 'person-group' && tag["attributes"]["person-group-type"] === 'editor') {
            tags = true;
            author = InitAuthors();
            if (typeof id === 'undefined') {
              SetID(rid)
            }
            RunThroughCitName(node,'editors');
          }
          else if (name === 'article-title') {
            if (typeof id === 'undefined') {
              SetID(rid)
            }
            GetText(node,id,name,"title");
          }
          else if (name === 'pub-id' || name === 'ext-link') {
            document['nodes'][id]["doi"] = 'http://dx.doi.org/';
            AddText(node,id,"doi");
          }
          else {
            if (typeof id === 'undefined') {
              SetID(rid)
            }
            AddText(node,id,name);
          }
        };
        node.ontext = function(text) {
          var name = node["tagName"];
          if (name === 'label') { 
            lbl = text;
          }
          else if (name.indexOf('citation') >= 0) {
            var mixedtext = text; 
          }
        }
        node.onclosetag = function(tag){
          if (tag.indexOf('citation') >=0 && !tags) {
            id = 'citation'+'_'+rid.replace(/[\.\-]/g,'_');
            InitObj("nodes",'citation',id);
            AddToIndex(id,"citations");
            if (format !== '') {
              document['nodes'][id]["format"] = format;
            }
            if (lbl !== '') {
              document['nodes'][id]["label"] = lbl;
            }
            document["nodes"][id]["title"] = mixedtext;
            UpdateInArticle(rid.replace(/[\.\-]/g,'_'));
            ReadBack(node);
          }
          else if (tag === 'ref'){
            SwitchBook(id);
            ReadBack(node);
          }
        }
      };

    function GetCont(node){
      var iid = 'info:author_contributions';
      InitObj("nodes","heading",iid);
      document["nodes"][iid]["content"] = 'Author Contributions';
      document["nodes"][iid]["level"] = 2

      var id = BeginInitObj(node,"paragraph");
      AddToInfoIndex(iid,id);
      
      node.ontext = function(text){
        AddText(text,id,'content');
      }
      node.onclosetag = function(tag){
        if (tag === 'author-notes'){
          ReadFront(node)
        }
      }
    }
    function GetCompInt(node,iid) {
      var id = BeginInitObj(node,"paragraph");
      AddToInfoIndex(iid,id);
      node.onopentag = function(tag){
        var type = tag["attributes"]["fn-type"];
        if (type === 'con'){
          GetCont(node);
        }
      }
      node.ontext = function(text){
        var name = node["tagName"];
        if (name === 'p' || CheckTags(name)){
          ProcessText(node,text,id,'content',name)
        }
      };
      node.onclosetag = function(tag) {
        if (tag === 'p'){
          var cont = document["nodes"][id]["content"];
          var chara = cont.charAt(cont.length-1).indexOf('.')
          if (chara < 0){  
            ProcessText(node,'. ',id,'content',tag)
          }
          else {
            ProcessText(node,' ',id,'content',tag)
          }
        }
        else if (tag === 'author-notes'){
          ReadFront(node);
        }
      };
    };

    // Code for building the resource panel for tables, figures, box, videos and supplements
    // ================
    
    function GetVidURL(id,parent){
      var vid = parent["attributes"][ "xlink:href"].split('.');
      document["nodes"][id]["url"] = "http://static.movie-usa.glencoesoftware.com/mp4/10.7554/"+vid[0]+'.mp4';
      document["nodes"][id]["url_ogv"] = "http://static.movie-usa.glencoesoftware.com/ogv/10.7554/"+vid[0]+'.ogv';
      document["nodes"][id]["poster"] = "http://static.movie-usa.glencoesoftware.com/jpg/10.7554/"+vid[0]+'.jpg';
    };

    function GetTableFooter(node,ident,footid,stag) {
      node.onopentag = function(tag) {
        var name = node["tagName"];
        GetText(node,footid,name,'content');
      }
      node.ontext = function(text){
        var name = node["tagName"];
        if (name === "label") {
          document["nodes"][footid]["label"] = text;
        }
        if (document["nodes"][ident]["footers"].indexOf(footid) < 0){
          document["nodes"][ident]["footers"].push(footid)
        }
      }
      node.onclosetag = function(tag){
        if (tag in convert["xref"]){
          GetFigs(node,ident);
        }
      }
    }

    function GetFigs(node,ident) {
      // Populate the figures node
      node.ontext = function(text){
        var name = node["tagName"];;
        if ( name === 'label'){
          document["nodes"][ident]["label"] = text;
        }
      }
      node.onopentag = function(tag){
        var parent = GetParentTag(node,2)
        if (tag["name"] === 'caption'){
          GetCaptions(node);
        }
        else if (tag["name"] === 'table'){
          document["nodes"][ident]["content"] += "<table>";
          GetTable(node,ident);
        }
        else if (parent["name"] === 'table-wrap-foot' && tag["name"] === 'fn'){
          var id = BeginInitObj(node,'footer');
          GetTableFooter(node,ident,id,"fn")
        }
        else if (tag["name"] === 'graphic' || tag["name"] === 'alternative'){
          document["nodes"][ident]["graphic_id"] = tag["attributes"]["xlink:href"];
          document["nodes"][ident]["format"] = 'image';
        }
        else if (tag["name"] === 'media'){
          var id = BeginInitObj(node,"file");
          document["nodes"][ident]["files"].push(id);
          document["nodes"][id]["graphic_id"] = tag["attributes"]["xlink:href"];
          document["nodes"][id]["name"] = tag["attributes"]["mime-subtype"].toUpperCase();
          document["nodes"][id]["extension"] = '.'+tag["attributes"]["mime-subtype"];
        }
        else {
          CheckOtherTags(node,tag);
        }
      }
      node.onclosetag = function(tag){
        if (tag in convert['xref'] || tag === 'media'){
          ReturnToSec(node);
        }
        else if (tag === 'body'){
          ReadBack(node)
        }
      }
    };
    function GetBox(node,id) {
      node.onopentag = function(tag){
        var name = tag["name"];
        if (name === 'caption'){
          GetCaptions(node)
        }
        else if (name === 'inline-graphic'){
          document["nodes"][id]["graphic"] = 'yes';
        }
        else if (name === 'p') {
          GetText(node,id,name,'content');
        }
      }
      node.ontext = function(text){
        var name = node["tagName"];
        if (name === 'label') {
          document["nodes"][id]["label"] = text;
        } 
      }
      node.onclosetag = function(tag){
        if (tag === 'boxed-text'){
          ReturnToSec(node);
        }
        else if (tag === 'p'){
          AddText('\n',id,'content');
        }
      }
    }

    function GetTable(node,ident) {
      var tagconvert = {
        'table': 'table',
        'thead' : 'thead',
        'tbody' : 'tbody',
        'tfoot' : 'tfoot',
        'td' : 'td',
        'tr' : 'tr',
        'th' : 'th',
        'bold' : 'strong',
        'italic' : 'em',
        'sub' : 'sub',
        'sup' : 'sup',
        'xref' : 'sup'
      };
      node.onopentag = function(tag){
        var attr = tag["attributes"];
        var name = tag["name"];
        if ("rowspan" in attr){
          if ("colspan" in attr){
            document["nodes"][ident]["content"] += "<"+tagconvert[name]+' rowspan='+attr["rowspan"]+' colspan='+attr["colspan"]+'>';
          }
          else{
            document["nodes"][ident]["content"] += "<"+tagconvert[name]+' rowspan='+attr["rowspan"]+'>';
          }
        }
        else if (name.indexOf('mml:') >= 0){
          document["nodes"][ident]["content"] += "<"+name+">";
        }
        else if (name !== 'inline-formula') {
          if (typeof tagconvert[name] !== 'undefined'){
            document["nodes"][ident]["content"] += "<"+tagconvert[name]+'>';
          }
          else {
            document["nodes"][ident]["content"] += "<"+name+' ';
            for (i in attr){
               document["nodes"][ident]["content"] += i+'='+tag["attributes"][i]+ ' '
            }
            document["nodes"][ident]["content"] += '/>'
          }
        }
      }
      node.ontext = function(text) {
        var name = node["tagName"];
        document["nodes"][ident]["content"] += text;
      }
      node.onclosetag = function(tag){
        if (tag === 'table'){
          document["nodes"][ident]["content"] += "</table>";
          GetFigs(node,ident);
        }
        else if (tag.indexOf('mml') >= 0){
          document["nodes"][ident]["content"] += "</"+tag+">";
        }
        else if (tag !== "inline-formula" ){
          if (typeof tagconvert[tag] !== 'undefined'){
            document["nodes"][ident]["content"] += '</'+tagconvert[tag]+'>';
          }
          else {
            document["nodes"][ident]["content"] += '</'+tag+'>'
          }
        }
      }
    }
     
    function GetCaptions(node){
      // Create a node for each caption that is associated with a figure
      
      var lastfig = document["nodes"]["figures"]["nodes"][document["nodes"]["figures"]["nodes"].length-1];
      if (document["nodes"][lastfig]["caption"] === ''){
        var id = "paragraph_"+document["nodes"][lastfig]["id"];
        InitObj("nodes","paragraph",id);
        document["nodes"][lastfig]["caption"] = id;
      }
      else {
        var id = document["nodes"][lastfig]["caption"];
      }

      node.onopentag = function(tag){
        var name = tag["name"];
        var parent = GetParentTag(node,2);
        if (name === "supplementary-material"){
          CheckOtherTags(node,tag);
        }
        else if (name === 'inline-formula'){
          if (parent["name"] === 'title'){
            var key = 'title';
          }
          else if (parent["name"] === 'p'){
            var key = 'content';
          }

          try {
            var stpos = document["nodes"][id][key].length
          }
          catch (TypeError) {
            var stpos = 0;
          }

          var formid = BeginInitObj(node,"formula");
          var annot = GetNodeId("annotation");
          InitObj("nodes","inline_formula",annot);
          
          document["nodes"][annot]["target"] = formid;
          document["nodes"][annot]["path"] = [id,key];
          document["nodes"][annot]["pos"] = [stpos,stpos];

          GetInline(node,formid,id)
        }
        else if (name === 'p') {
          if (document["nodes"][id]["content"] === ''){
            GetText(node,id,'p','content');
          }
        }
        else if (name === 'ext-link') {
          GetText(node,lastfig,name,"doi")
        }
        else if (name === 'title') {
          GetText(node,lastfig,name,'title');
        }
      }
      node.ontext = function(text){
        var name = node["tag"]["name"];
        var older = GetParentTag(node,2);
        var parent = GetParentTag(node,1);
        if (CheckTags(name)) {
          if (name === 'ext-link'){
            if (text.indexOf('doi') >=0 ){
              document["nodes"][lastfig]["doi"] = text;
            }
            var parent = GetParentTag(node,3);
            if (parent["name"] === 'media'){
              GetVidURL(lastfig,parent);
            }
          }
        }
        else if (name === 'inline-formula' && older["name"] === 'p'){
          AddText(text,id,'content');
        }
        else if (name === 'inline-formula' && older["name"] === 'title'){
          AddText(text,id,'title');
        }
      };

      node.onclosetag = function(tag){
        if (tag === 'caption' && lastfig.indexOf('box') >= 0){
          GetBox(node,lastfig,'boxed-text');
        }
        else if (tag === 'caption'){
          GetFigs(node,lastfig);
        }
      };
    };

    // Code to process the text and associated formulas
    // ===============
    function StartMath(node,formid,id) {
      node.onopentag = function(tag) {
        var name = tag["name"];
        if (name === 'graphic'){
          document["nodes"][formid]["graphic_id"] = tag["attributes"]["xlink:href"];
          document["nodes"][formid]["format"] = "image";
          GetMath(node,formid,id);
        }
        else if (name === 'mml:math') {
          document["nodes"][formid]["format"] = "mathml"
          GetMath(node,formid,id);
        }
      }
      node.ontext = function(text) {
        var name = node["tagName"];
        if (name === 'label'){
          document["nodes"][formid]["label"] = text;
        }
        else {
          GetText(node,formid,name,"content");
        }

        var annot = BeginInitObj(node,"formula");
       
        var stpos = document["nodes"][id]["content"].length;

        document["nodes"][annot]["key"] = "content";
        document["nodes"][annot]["source"] = id;
        document["nodes"][annot]["target"] = formid;
        document["nodes"][annot]["pos"] = [stpos,1]

        GetMath(node,formid,id);
      };
      node.onclosetag = function(tag) {
        if (tag === 'disp-formula' || tag === 'inline-formula') {
          ReturnToSec(node);
        }
      };
    };
    
    function GetMath(node,ident,tid) {
      node.onopentag = function(tag){
        var attr = tag["attributes"];
        var name = tag["name"];
        if ("mathvariant" in attr){
          document["nodes"][ident]["content"] += "<"+name+' mathvariant='+attr["mathvariant"]+'>';
        }
        else if (name !== 'mml:math' && name.indexOf('mml') >= 0) {
          document["nodes"][ident]["content"] += "<"+name+'>';
        }
      }
      node.ontext = function(text) {
        var parent = GetParentTag(node,1);
        if (node["tagName"] === 'label'){
          document["nodes"][ident]["label"] = text; 
        }
        else if (CheckTags(parent["name"]) || CheckTags(node["tagName"]) || parent["name"] === 'p' || node["tagName"] === 'inline-formula'){
          var id = GetNodeId("paragraph");
          InitObj("nodes","paragraph",id);
          AddToIndex(id,"content");
          AddText(text,id,"content");
          GetText(node,id,'p','content');
        }
        else if (parent["name"].indexOf('mml:') >= 0){
          document["nodes"][ident]["content"] += text;
        }
      }
      node.onclosetag = function(tag){
        if (tag === 'mml:math' || tag === 'disp-formula'){
          ReturnToSec(node);
        }
        else if (tag !== 'mml:math' && tag.indexOf('mml') >= 0){ 
          document["nodes"][ident]["content"] += '</'+tag+'>';
        }
      }
    }

    var listcount = 0;
    function GetList(node) {
      var id = '';
      var i = 1;
      while (id.indexOf('list') < 0){
        id = document["nodes"]["content"]["nodes"][document["nodes"]["content"]["nodes"].length-i];
        i += 1;
      }
      var items = document["nodes"][id]["items"];
      if (items.length > 1){
        if (items[items.length-1].indexOf('list') >=0){
          var id = items[items.length-1];
        }
      }
      node.onopentag = function(tag) {
        var name = node["tagName"];
        if (name === 'list-item'){
          var listid = BeginInitObj(node,"paragraph")
          document["nodes"][id]["items"].push(listid);
          GetText(node,listid,'p','content');
        }
        else if (name === 'list'){
          var listid = BeginInitObj(node,'list');
          document["nodes"][id]["items"].push(listid);
          listcount += 1
          GetList(node);
        }
      }
      node.onclosetag = function(tag){
        if (tag === 'list' && listcount === 0) {
          ReturnToSec(node);
        }
        else if (tag === 'list') {
          listcount -= 1;
          GetList(node)
        }
      }
    }

    function GetInline(node,id,textid) {
      node.onopentag = function(tag) {
        var name = tag["name"];
        if (name === 'inline-graphic'){
          document["nodes"][id]["graphic_id"] = tag["attributes"]["xlink:href"];
          document["nodes"][id]["format"] = "image";
        }
        else if (name !== 'mml:math'){
          document["nodes"][id]["content"] += "<"+name+">";
        }
        else if (name === 'disp-formula'){
          var ident = BeginInitObj(node,"formula");
          AddToIndex(ident,"content");
          StartMath(node,ident,textid);
        }
        else if (name !== 'inline-graphic'){
          GetText(node,textid,name,"content");
        }
      }

      node.ontext = function(text) {
        var name = node["tagName"];
        if (name.indexOf('mml:') >= 0){
          document["nodes"][id]["format"] = 'mml';
          document["nodes"][id]["content"] += text;
        }
      }
      node.onclosetag = function(tag){
        if (tag === 'inline-formula' && textid.indexOf('caption') < 0){
          ReturnToSec(node);
        }
        else if (tag === 'inline-formula' && textid.indexOf('caption') >= 0){
           GetCaptions(node);
        }
        else if (tag !== 'mml:math' && tag.indexOf('mml') >= 0) {
          document["nodes"][id]["content"] += "</"+tag+">";
        }
      }
    };  
    
    // Check other type of tags other than p, box, title
    // ======================

    function CheckOtherTags(node,tag) {
      var name = tag["name"]
      if (name === 'fig'){
        var id = BeginInitObj(node,"image");
        AddToIndex(id,"figures");
        GetFigs(node,id);
      }
      else if (name === 'list') {
        var id = BeginInitObj(node,'list');
        AddToIndex(id,'content');
        GetList(node);
      }
      else if (name === 'boxed-text'){
        var id = BeginInitObj(node,"box");
        AddToIndex(id,"figures");
        GetBox(node,id);
      }
      else if (name === 'media' && tag["attributes"]["mimetype"] === "video") {
        var id = BeginInitObj(node,"video");
        AddToIndex(id,"figures");
        GetFigs(node,id);
      }
      else if (tag["name"] === 'table-wrap'){
        var id = BeginInitObj(node,"table");
        AddToIndex(id,"figures");
        GetFigs(node,id);
      } 
      else if (name === 'disp-formula'){
        var id = BeginInitObj(node,"formula");
        var textid = document["nodes"]["content"]["nodes"][document["nodes"]["content"]["nodes"].length-1];
        AddToIndex(id,"content");
        StartMath(node,id,textid);
      }
      else if (name === 'supplementary-material') {
        var id = BeginInitObj(node,"supplement");
        document["nodes"][id]["graphic_id"] = tag["attributes"]["xlink:href"];
        AddToIndex(id,"figures");
        GetFigs(node,id);
      }
      else if (name === 'inline-formula'){
        var textid = document["nodes"]["content"]["nodes"][document["nodes"]["content"]["nodes"].length-1];
        
        var stpos = document["nodes"][textid]["content"].length

        var formid = BeginInitObj(node,"formula");
        var annot = GetNodeId("annotation");
        InitObj("nodes","inline_formula",annot);

        document["nodes"][annot]["source"] = textid;
        document["nodes"][annot]["target"] = formid;
        document["nodes"][annot]["key"] = "content";
        document["nodes"][annot]["pos"] = [stpos,0];
        GetInline(node,formid,textid)
      }
    };

    // Get the abstract. This includes the eLife Digest as well
    // ===============
    
    function GetAbstract(node){
      // Get the abstract text for the properties key

      node.onopentag = function(tag){
        var name = tag["name"];
        if (name === 'p'){
          var abid = GetNodeId("paragraph");
          InitObj("nodes","paragraph",abid);
          AddToIndex(abid,'content');
          GetText(node,abid,'p','content');
        }
        else if (name === 'title'){
          GetHeading(node,name);
        }
      };
      node.onclosetag = function(tag){
        if (tag === 'abstract'){
          ReadFront(node);
        }
      };
    };

    function GetCommentary(node) {

      node.onopentag = function(tag){
        var name = tag["name"];
        if (name === 'article-title'){
          var id = BeginInitObj(node,'heading');
          AddToIndex(id,"content")
          document["nodes"][id]["level"] = 2;
          AddText(node,id,"content");
        }
        else if (name === 'p'){
          var id = BeginInitObj(node,"paragraph");
          AddToIndex(id,"content");
          GetText(node,id,'p','content');
        }
        else if (name === 'boxed-text') {
          var id = BeginInitObj(node,"paragraph");
          AddToIndex(id,"content");
          GetText(node,id,"boxed-text","content")
        }
        else {
          CheckOtherTags(node,tag)
        }
      }
        
      node.onclosetag = function(tag){
        if (tag === 'body'){
          ReadBack(node);
        }
      }
    }

    // Begin parsing the XML and building the document JSON
    // ===============

    function ParsePaper(parser){
      // Begin parsing the paper

      parser.onopentag = function(tag){
        if (tag["name"] === 'front'){
          ReadFront(parser)
        }
      }  
      parser.write(xml)
    };

    // At the front of the paper
    // Get the title, authors, abstract and paper identifiers
    // ===============

    function ReadFront(data) {
      // Read through the front portion of the paper to populate the properties key of the document object.

      // Get the paper DOI information and links to the xml and json
      // ===============================

      function GetPaperDOI(node){
        
        node.ontext = function(text){
          if (document["id"] === ''){
            var id = text.split('/');
            if (id[1].indexOf('eLife') >= 0) {
              var id = id[1].split('eLife.')
            }
            document["id"] = id[1].replace(/\./g,'_');
            document["nodes"]["document"]["guid"] = document["id"];
          }
        }
        ReadFront(node);
      }

      // Get the journal name
      // ========================

      function GetJournal(node) {
        node.ontext = function(text){
          if (node["tag"]["attributes"]["journal-id-type"] === 'nlm-ta') {
            document["nodes"]["document"]["journal"] = text;
          }
        }
        node.onclosetag = function(tag){
          if (tag === 'journal-meta'){
            ReadFront(node);
          }
        }
      }

      // Go through the authors names and get the relevant
      // affiliation information
      // =============

      function RunThroughName(node,type,ath) {
        // Create dictionary of the author's names
        var author = {}

        node.onopentag = function(tag){
          var name = node["tagName"];
          if ("ref-type" in tag["attributes"]){
            var aff = tag["attributes"]["ref-type"];
            if (aff.indexOf("aff") >= 0){
              var type = "institution:"+tag["attributes"]["rid"]
              try {
                affmap[type].push(ath)
              }
              catch (TypeError){
                affmap[type] = [ath]
              } 
            }
            else if (aff.indexOf('corresp') >= 0){
              var type = "email:"+tag["attributes"]["rid"]
              try {
                affmap[type].push(ath)
              }
              catch (TypeError){
                affmap[type] = [ath]
              }
            }
          }
        }
        
        node.ontext = function(text){
          var name = node["tagName"];
          if (name === 'given-names'){
            document["nodes"][ath]["given-names"] = text;
          }
          else if  (name === 'surname'){
            document["nodes"][ath]["last-name"] = text;
          }
        };

        node.onclosetag = function(tag){
          if (tag === 'contrib'){
            GetPaperAuthors(node)
          }
        }
      };

      function GetAffiliations(node) {
        var aff = {
          "label" : '',
          "department" : '',
          "institution" : ''
        };

        var id = BeginInitObj(node,"institution");
        //AddToIndex(id,"institution");

        aff["institution"] = id;

        node.ontext = function(text){
          var name = node["tagName"];
          var dept = node["tag"]["attributes"]["content-type"]
          if (name === 'label'){
            aff[name] = text;
          }
          else if (name === 'named-content' && dept === "department"){
            aff["department"] = text;
          }
          else if (name === 'named-content' && dept === "city"){
            document["nodes"][id]["city"] = text;
          }
          else if (name === 'institution') {
            document["nodes"][id]["name"] = text;
          }
          else if (name === 'country') {
            document["nodes"][id]["country"] = text;
          } 
          else if (name === 'email') {
            document["nodes"][id]["email"] = text;
          }
          else if (name === 'addr-line' && aff["department"] === '' && document["nodes"][id]["name"] === ''){
            aff["department"] = text;
          }
        }
        node.onclosetag = function(tag){
          if (tag === 'aff'){
            if (id in affmap){
              var ath = affmap[id];
              for (var i=0;i<ath.length;i++){
                document["nodes"][ath[i]]["affiliations"].push(aff);
              }
            }
            ReadFront(node);
          }
        };
      }

      function GetPaperAuthors(node) {
        // Add the paper's authors to the cover:document node
        node.onopentag = function(tag){
          if (tag["attributes"]["contrib-type"] === "author"){
            var athid = BeginInitObj(node,"person");
            document["nodes"][athid]["role"] = 'author'
            RunThroughName(node,"author",athid);
            document["nodes"]["document"]["authors"].push(athid);
          }
          else if (tag["attributes"]["contrib-type"] === "editor"){
            edid = BeginInitObj(node,"person");
            RunThroughName(node,"editor",edid);
            document["nodes"][edid]["role"] = 'editor'
            var iid = 'info:review';
            InitObj("nodes","heading",iid);
            document["nodes"][iid]["content"] = 'Reviewing Editor';
            document["nodes"][iid]["level"] = 2;
            AddToInfoIndex(iid,edid);
          }
          else if (tag["name"] === 'aff'){
            GetAffiliations(node)
          }
        };
        node.onclosetag = function(tag){
          if (tag === 'contrib-group'){
            ReadFront(node);
          }
        };
      };
      
      // Get the author's keywords
      // ==============

      function GetKeyWords(node) {
        var iid = node["tag"]["attributes"]["kwd-group-type"];
        if (iid === 'research-organism') {
          iid = "research_organisms";
        }
        else {
          iid = 'keywords';
        }
        var keywords = [];
        node.ontext = function(text){
          var name = node["tagName"];
          if (name === "kwd") {
            keywords.push(text);
          }
        };
        
        node.onclosetag = function(tag) {
          if (tag === 'kwd-group'){
            document["nodes"]["document"][iid] = keywords;
            ReadFront(node);
          }
        };
      };

      // Get the corresponding author's email information
      // ===============

      function GetEmail(node,iid) {
        node.ontext = function(text) {
          var name = node['tagName'];
          if (name === 'email' && text.indexOf('@') >= 0){
            if (document["nodes"][iid]["email"] !== ''){
              iid = BeginInitObj(node,"email");
            }
            ProcessText(node,text,iid,'email',name);
            try {
              affmap['email'].push(iid);
            }
            catch (TypeError){
              affmap['email'] = [iid];
            }
          }
        };
        node.onclosetag = function(tag){
          if (tag === 'corresp'){
            ReadFront(node);
          }
        };
      };

      function AppendEmail(){
        var count = 0;
        for (i in affmap){
          if (i.indexOf('cor') >= 0){
            count += 1
          }
        }
        for (email in affmap) {
          if (email.indexOf('email:cor') >=0) {
            var val = affmap[email];
            for (var j=0;j<val.length;j++) {
              if (count === 1) {
                document["nodes"][val[j]]["email"] = affmap["email"][j];
              }
              else {
                document["nodes"][val[j]]["email"] = email; 
              }
            }
          }
        }
      };
      // Get the publication date information
      // ===============

      function GetDate(node) {
        var id = 'publication_info';
        var date = {
          'day' : '',
          'month' : '',
          'year' : ''
        }

        function SanitizeDate(dat) {
          var frags = dat.split('-');
          return _.map(frags, function(f) {
            var num = parseInt(f, 10);
            return num < 10 ? "0"+num : num.toString();
          }).join('-');
        }
        node.ontext = function(text){
          var name = node["tagName"];
          if (name in date){
            date[name] = text;
          }
        }
        node.onclosetag = function(tag){
          if (tag === 'date'){
            
            var attr = node["tag"]["attributes"]["date-type"]
            
            if (attr === 'received'){
              text = SanitizeDate(date["year"]+'-'+date["month"]+'-'+date["day"]);
              document["nodes"]["document"]["received_on"] = text;
            } 
            else if (attr === 'accepted'){
              text = SanitizeDate(date["year"]+'-'+date["month"]+'-'+date["day"]);
              document["nodes"]["document"]["accepted_on"] = text;
            }
            ReadFront(node);
          }
          else if (tag === 'pub-date'){
            var pubattr = node["tag"]["attributes"]["pub-type"];
            if (pubattr === 'epub'){
              text = SanitizeDate(date["year"]+'-'+date["month"]+'-'+date["day"]);
              document["nodes"]["document"]["published_on"] = text;
            }
            ReadFront(node);
          }
        };
      };

      // Add funding information for the authors
      // ===================

      function GetFunding(node,iid) {
        var id = BeginInitObj(node,"funding")
        node.ontext = function(text){
          var name = node["tagName"];
          if (name === 'funding-source'){
            document["nodes"][id]["institution"] = text;
          }
          else if (name === "award-id"){
            document["nodes"][id]["accession"] = text;
          }
          else if (name === 'given-names'){
            document["nodes"][id]["given-names"] = text;
          }
          else if (name === 'surname'){
            document["nodes"][id]["last-name"] = text;
          }
        }
        node.onclosetag = function(tag) {
          if (tag === 'award-group'){
            var authors = document["nodes"]["document"]["authors"];
            for (var i=0;i<authors.length;i++){
              if (document["nodes"][id]["given-names"] === document["nodes"][authors[i]]["given-names"]){
                document["nodes"][authors[i]]["funding"].push(id);
                document["nodes"][id]["person"] = authors[i];
                AddToInfoIndex(iid,authors[i])
              }
            }
            delete document["nodes"]["info:funding"];
            ReadFront(node);
          }
        }
      }

      // Get the subject matter and article type
      // ===================

      function GetSubj(node) {

        node.ontext = function(text){
          var parent = GetParentTag(node,1);
          var attr = parent["attributes"]["subj-group-type"];
          if (attr === 'heading'){
            document["nodes"]["document"]["subjects"].push(text);
          }
          else if (attr === 'display-channel') {
            var index = text.toLowerCase().indexOf('article');
            if (index >= 0){
              var text = text.substring(0,index-1)+' '+text[index].toUpperCase()+text.substring(index+1);
            }
            //document["nodes"]["document"]["type"] = text;
          }
        }
       
      }

      // Read through the front part of the XML and send to different "modules"
      // =====================

      data.onopentag = function(tag){
        var name = tag["name"];
        
        if (name === "kwd-group"){
          GetKeyWords(data);
        }
        else if (name === "article-id" && tag["attributes"]["pub-id-type"] === 'doi'){
          GetPaperDOI(data);
        }
        else if (name === 'contrib-group'){
          GetPaperAuthors(data);
        }
        else if (name === 'title-group'){
          GetText(data,"document",name,"title");
        }
        else if (name === 'abstract'){
          
          var attr = tag["attributes"]["abstract-type"];
          if (attr !== 'executive-summary'){
            var id = 'abstract';
            if (!(id in document["nodes"])){
              InitObj("nodes","heading",id);
              document["nodes"][id]["content"] = 'Abstract';
              document["nodes"][id]['level'] = 1;
              AddToIndex(id,'content');
            }
          }
          GetAbstract(data);
        }
        else if (name === 'corresp'){
          var id = BeginInitObj(data,"email");
          GetEmail(data,id);
        }
        else if (name === 'date' || name === 'pub-date'){
          GetDate(data);
        }
        else if (name === 'fn' && tag["attributes"]["fn-type"] === 'conflict'){
          var id = "info:competing_interest";
          InitObj("nodes","heading",id);
          document["nodes"][id]["content"] = "Competing Interests";
          document["nodes"][id]["level"] = 2;
          var textid = BeginInitObj(data,"paragraph");
          AddToInfoIndex(id,textid);
          GetText(data,textid,'p',"content");
        }
        else if (name === 'aff'){
          GetAffiliations(data);
        }
        else if (name === 'award-group') {
          var id = 'info:funding';
          InitObj("nodes","heading",id);
          document["nodes"][id]["content"] = 'Funding';
          document["nodes"][id]["level"] = 2;
          GetFunding(data,'info:funding');
        }
        else if (name === 'journal-meta') {
          GetJournal(data);
        }
        else if (name === "custom-meta" && tag["attributes"]["specific-use"] === 'meta-only'){
          var id = "info:impact";
          InitObj("nodes","heading",id);
          document["nodes"][id]["content"] = 'Impact';
          document["nodes"][id]["level"] = 2;

          var textid = BeginInitObj(data,"paragraph")
          AddToInfoIndex(id,textid)
          GetText(data,id,'meta-value',"content");
        }
        else if (name === 'license'){
          var id = 'info:copyright';
          InitObj("nodes","heading",id);
          document["nodes"][id]["content"] = 'Copyright'
          document["nodes"][id]["level"] = 2;

          var textid = BeginInitObj(data,"paragraph");
          AddToInfoIndex(id,textid);
          GetText(data,textid,'license-p',"content");
        }
        else if (name === 'subj-group'){
          GetSubj(data);
        }
      }; 
      data.onclosetag = function(tag){
        if (tag === 'front'){
          AppendEmail();
          ReadBody(data);
        }
      } 
    };

    // At the body of the paper
    // ===============

    function ReadBody(node){
      // Read through the body portion of the paper
      
      node.onopentag = function(tag) {
        var name = tag["name"];
        if (name === 'title'){
          GetHeading(node,name);
        }
        else if (name === 'boxed-text'){
          var id = BeginInitObj(node,"box");
          AddToIndex(id,"figures");
          GetBox(node,id);
        }
        else if (name === 'disp-quote'){
          var id = BeginInitObj(node,"quote");
          AddToIndex(id,"content");
          GetText(node,id,name,'content');
        }
        else if (name === 'p'){
          var id = BeginInitObj(node,"paragraph");
          AddToIndex(id,"content");
          GetText(node,id,name,'content');
        }
        else {
          CheckOtherTags(node,tag);
        }
      };
      node.onclosetag = function(tag){
        if (tag === 'body' || tag === 'ref-list'){
          fs.writeFileSync('./data/'+document["id"]+'.json',JSON.stringify(document,null,2))
          ReadBack(node);
        }
      }
    };

    // Build the full list of references
    // ==============
    
    function ReadBack(data){
      // Get competing interests
      // ================

      function GetCompInt(node,iid) {
        var id = BeginInitObj(node,"paragraph");
        AddToInfoIndex(iid,id);
        node.ontext = function(text){
          var name = node["tagName"];
          if (name === 'p' || CheckTags(name)){
            ProcessText(node,text,id,'content',name)
          }
        };
        node.onclosetag = function(tag) {
          if (tag === 'p'){
            var cont = document["nodes"][id]["content"];
            var chara = cont.charAt(cont.length-1).indexOf('.')
            if (chara < 0){  
              ProcessText(node,'. ',id,'content',tag)
            }
            else {
              ProcessText(node,' ',id,'content',tag)
            }
          }
          if (tag === 'fn-group'){
            ReadBack(node);
          }
        };
      };

      // Get author contributions
      // ================
      function GetAuthCont(node) {
        var i = 0;
        var authors = document["nodes"]["document"]["authors"];
        var id = 'info:author_contribution';
        InitObj("nodes","heading",id);
        document["nodes"][id]["content"] = 'Authors';
        document["nodes"][id]["level"] = 2;

        node.ontext = function(text) {
          var name = node["tagName"];
          if (name === 'p') {
            try {
              if (text.indexOf(':') >=0) {
                var txt = text.split(':');
                var tx = txt[1];
              }
              else if (text.indexOf(',') >= 0){
                var txt = text.split(',');
                var tx = txt[1];
                for (var j=2;j<txt.length;j++){
                  tx = tx.concat(',',txt[j]);
                }
              }
              var txt = tx.substr(0,2).toUpperCase() + tx.substr(2);
              
              document["nodes"][authors[i]]["contribution"] = txt;
              AddToInfoIndex(id,authors[i]);
              i++;
            }
            catch (TypeError){

            }
          }
        };
        node.onclosetag = function(tag){
          if (tag === 'fn-group'){
            ReadBack(node);
          }
        };
      };

      // Get acknowledgements
      // ==============

      function GetAck(node,iid) {
        var id = BeginInitObj(node,"paragraph");
        AddToInfoIndex(iid,id);

        node.ontext = function(text){
          var name = node["tagName"];
          if (name === 'p' || CheckTags(name)) {
            ProcessText(node,text,id,"content",name);
          }
        };
        node.onclosetag = function(tag){
          if (tag === 'p'){
            ReadBack(node);
          }
        };
      };

      // Get any major datasets that are listed
      // ================

      function GetMajorData(node,id) {

        node.ontext = function(text) {
          var parent = GetParentTag(node,1);
          var name = node["tagName"];
          
          if (name === 'surname'){
            AddText(text,id,'content');
          }
          else if (name === 'given-names') {
            AddText(', '+text,id,'content');
          }
          else if (name === 'comment' || (parent["name"] === 'comment' && CheckTags(name) && name !== 'p') || name !== 'p'){
            try {
              if (name === 'object-id'){
                linkname = text.toUpperCase();
              }
              else if (linkname === ''){
                if (text.indexOf('rcsb') >= 0){
                  linkname = 'RCSB';
                }
                else if (text.indexOf('dryad') >= 0){
                  linkname = 'Dryad';
                }
                else if (text.indexOf('ncbi') >= 0 ){
                  linkname = 'NCBI domain';
                }
                else if (text.indexOf('ebi.') >= 0){
                  linkname = 'EBI';
                }
                else if (text.indexOf('http') >= 0) {
                  linkname = 'Additional information';
                }
              }
            }
            catch (TypeError){}
            if (name !== 'title'){
              AddText(text,id,'content');
            }
          }
        }
        node.onclosetag = function(tag){
          if (tag === 'p') {
            ReadBack(node);
          }
        }
      }

      // Read through the back of the article and shoot off into "modules"
      // ===================

      data.onopentag = function(tag){
        var name = tag["name"];
        var type = tag["attributes"]["content-type"]

        if (name === 'ref'){
          GetCitations(data);
        }
        else if (name === 'ack'){
          var id = "info:ack";
          InitObj("nodes","heading",id);
          document["nodes"][id]["content"] = "Acknowledgements";
          document["nodes"][id]["level"] = 2;

          var textid = BeginInitObj(data,"paragraph");
          AddToInfoIndex(id,textid);
          GetText(data,textid,'p',"content")
        }
        else if (name === 'fn-group' && type === 'competing-interest'){
          var id = "info:competing-interest";
          InitObj("nodes","heading",id);
          document["nodes"][id]["content"] = "Competing Interests";
          document["nodes"][id]["level"] = 2;

          var textid = BeginInitObj(data,"paragraph");
          AddToInfoIndex(id,textid);
          GetText(data,textid,name,"content")
        }
        else if (name === 'fn-group' && type === 'author-contribution'){
          GetAuthCont(data);
        }
        else if (name === 'supplementary-material'){
          var id = BeginInitObj(data,"supplement");
          AddToIndex(id,"figures");
          GetFigs(data,id,'supplementary-material');
        }
        else if (name === 'related-object') {
          var infid = 'info:dataset';
          if (!document["nodes"][infid]){
            InitObj("nodes","heading",infid);
            document["nodes"][infid]["content"] = 'Major Datasets';
            document["nodes"][infid]["level"] = 2;
          }

          var dataid = BeginInitObj(data,"paragraph");
          AddToInfoIndex(infid,dataid);
          GetMajorData(data,dataid);
        }
        else if (name === 'sub-article'){
          var id = name;
          InitObj("nodes","heading",id);
          document["nodes"][id]["content"] = 'Article Commentary';
          document["nodes"][id]["level"] = 1;
          AddToIndex(id,'content');
          GetCommentary(data);
        }
      }
      data.onclosetag = function(tag) {
        // Return the final document object
        if (tag === 'article'){
          urlMagic();
          TabletoImage();
          BuildStats();
          //CompileInfo();
          AddToLibrary();
          ClearEmpty();
          
          SaveJSON();
          
          cb(null,null);
        }
      }
    };

    // Begin parsing the XML file using sax
    // ==============

    ParsePaper(parser)
  }

  // Later we can delegate to different converters here
  this.convert = function(options, cb) {
    util.loadXML(options.url, function(err, xml) {
      if (err) return cb(err);
      try {
        convert(xml, function(err, doc) {
          // Hotpatch id
          // Is there a better way?
          if (doc) doc.id = options.id;

          cb(err, doc);
        });
      } catch(err) {
        console.log('error during conversion', err.stack);
        cb(err);
      }
    });
  }
};


module.exports = Converter;
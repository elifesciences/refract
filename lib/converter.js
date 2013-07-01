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
    var section = '';
    var linkname = '';
    var figcount = 1;
    
    
    // Create the document object for the JSON
    // ============

    var document = {
      "id" : "",
      "views": {
        "content" : [],
        "institution" : [],
        "figures" : [],
        "publications" : [],
        "info" : []
      },
      "properties" : {
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
      "nodes": {},
    };

    // Supported reference and font style tags
    // =============

    var convert = {
      'xref' : {
        'bibr' : ['publication_reference','publication'],
        'boxed-text' : ["figure_reference","box"],
        'fig' : ['figure_reference','image'],
        'table' : ['figure_reference','table'],
        'other' : ['figure_reference','video'],
        'movie' : ['figure_reference','video'],
        'video' : ['figure_reference','video'],
        'disp-formula' : ['formula_reference','formula'],
        'inline-formula' : ['formula_reference','inline-formula'],
        'aff' : ['affiliation_reference', 'affiliation'],
        'supplementary-material' : ['figure_reference','supplement'],
        'supplement-material' : ['figure_reference','supplement'],
        'table-fn' : ["figure_reference","table"]
      },
      'bold' : 'strong',
      'italic' : 'emphasis',
      'underline' : 'underline',
      'sup' : 'superscript',
      'sub' : 'subscript',
      'ext-link' : 'link',
      'research-organism' : 'Research Organism',
      'author-keywords' : 'Keywords',
      'journal' : 'article',
      'book' : 'book',
      'web' : 'website',
      'thesis' : 'thesis',
      'other' : 'article'
    }

    // Dictionary of keys that are affiliated with each annotation type
    // =============

    var nodetype = {
      'image' : ['type','id','label','url','object_id','content_type','large_url','content','group','doi'],
      'box' : ['type','id','label','url','caption','content','doi'],
      'table' : ['type','id','label','content','footers','doi'],
      'supplement' : ['type','id','label','source','content','doi'],
      'text' : ['type','id','content'],
      'quote' : ['type','id','content'],
      'thesis' : ['type','id','authors','title','year','volume','source','issue','fpage','lpage','edition','comment','publisher-name','publisher-loc','doi','citation_url'],
      'article' : ['type','id','authors','title','year','volume','source','issue','fpage','lpage','edition','publisher-name','publisher-loc','doi','citation_url'],
      'website' : ['type','id','authors','title','collab','year','volume','issue','source','fpage','lpage','edition','comment','publisher-name','publisher-loc','doi','citation_url'],
      'book' : ['type','id','authors','title','year','volume','issue','source','fpage','lpage','edition','publisher-name','publisher-loc','doi','citation_url'],
      'caption' : ['type','id','title','content'],
      'video' : ['type','id','label','content_type','url_ogv','url_jpg','url_mp4','doi'],
      'publication' : ['type','id','authors','title','year','source','volume','issue','fpage','lpage','edition','publisher-name','publisher-loc','doi','citation_url'],
      'cover' : ['type','id','title','authors'],
      'person' : ['type','id','given-names','last-name','role','affiliations','image','contribution','email','funding'],
      'annotation' : ['type','id','source','target','key','content','pos'],
      'institution' : ['type','id','name','city','country','email','image'],
      'funding' : ['type','id','institution','accession','person','given-names','last-name'],
      'footer' : ['type','id','content','label'],
      'formula' : ['type','id','label','content'],
      'heading' : ['type','id','level','content','nodes'],
      'dataset' : ['type','id','content'],
      'email' : ['type','id','node','email'],
      'citation' : ['type','id','label','url'],
      'publication_info' : ['type','id','accepted_on','journal','article_type','received_on','published_on','keywords','research_organisms','subjects','pdf_link','xml_link','json_link','doi','nodes']
    }

    // Keys that require lists when initializing
    // =============

     var keylist = ['authors','affiliations','keywords','dataset','editor','funding','subjects','nodes','footers','subject','citation_url'];

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
      var authors = document["nodes"]["cover:document"]["authors"];
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

    function BuildProperties() {
      document["properties"]["title"] = document["nodes"]["cover:document"]["title"];
      document["properties"]["authors"] = document["nodes"]["cover:document"]["authors"];
      var keys = document["nodes"]["publication_info"];
      for (var subkey in keys) {
        
        if (subkey === 'type' || subkey === 'id'){
          continue
        }
        document["properties"][subkey] = document["nodes"]["publication_info"][subkey];
      }
    }

    // Initialize the node object
    // =================

    function BeginInitObj(node,type){
      var id = IfIdPres(node,type);
      InitObj("nodes",type,id);
      return id
    }

    function InitObj(node,type,id) {
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
      var id = type + ':' + nodeCount;
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
          return type+':'+parent["attributes"]["id"]
        }
        var id = node["tag"]["attributes"]["id"];
        if (typeof id !== 'undefined'){
          return type+':'+id.replace(/[\.\-]/g,'_');
        }
        else{
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
      if (CheckTags(name) || type.indexOf('link') >= 0) {
        var id = GetNodeId("annotation");
      }
      else{
        var id = GetNodeId(type);
      }
      return id
    }
    
    function ReturnToSec(node) {
      if (section === 'Body'){
        ReadBody(node); 
      }
      else if (section === 'Back') {
        ReadBack(node);
      }
      else if (section === 'Commentary'){
        GetCommentary(node);
      }
      else{
        GetAbstract(node);
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

    function GetAnnotations(node,text,index,stag,key) {
      // Get text and annotations coming from reference and font styling tags
      var parent = GetParentTag(node,1);
      if (stag === 'xref') {
        try {
          var type = convert[stag][node["tag"]["attributes"]["ref-type"]][0];
          var id = convert[stag][node["tag"]["attributes"]["ref-type"]][1] +':'+node["tag"]["attributes"]["rid"].replace(/[\.\-]/g,'_');
        }
        catch (TypeError) {
          var error = document["id"] + ': xref annotation error in text node ' + document["views"]["content"][document["views"]["content"].length-1];
          AddText(text,index,key);
          return
        }
      }
      else{
        var type = convert[stag];
        var id = null;
      }
      CheckSplitRefID(node,text,index,stag,key,id,type);
    }

    function CheckSplitRefID(node,text,index,stag,key,ref,type) {
      // Make sure that there are not 2 targets within a reference key.
      // Use only the first value
      try {
        var ids = ref.split(' ');
        for (var i=0;i<ids.length;i++){
          if (i > 0){
            var name = ids[0].split(':');
            BuildAnnotation(node,text,index,stag,key,name[0]+':'+ids[i],type,i);
          }
          else {
            BuildAnnotation(node,text,index,stag,key,ids[i],type,i);
          }
        }
      }
      catch (TypeError){
        BuildAnnotation(node,text,index,stag,key,ref,type,0);
      }
    }

    function CheckNested(node,text,index,key,refid) {
      //Deal with nested instances of font styling

      var parent = GetParentTag(node,1);
      if (CheckTags(parent["name"])){
        var stpos = document["nodes"][index][key].length;
        var reflen = text.length;
        if (reflen === 0){
          reflen = 1;
        }

        if (parent["name"] === 'xref'){
          try {
            var type = convert[parent["name"]][parent["attributes"]["ref-type"]][0];
            refid = convert[parent["name"]][parent["attributes"]["ref-type"]][1] + ':' + parent["attributes"]["rid"].replace(/[\.\-]/g,'_');
          }
          catch (TypeError) {
            var error = document["id"] + ': xref annotation error in text node ' + document["views"]["content"][document["views"]["content"].length-1];
            AddText(text,index,key);
            return
          }
        }
        else {
          var type = convert[parent["name"]];
        }
        
        var annot = BeginInitObj(node,type);

        document["nodes"][annot]["source"] = index;
        document["nodes"][annot]["content"] = text;
        document["nodes"][annot]["key"] = key;
        document["nodes"][annot]["target"] = refid;
        document["nodes"][annot]["pos"] = [stpos,reflen];
        
      }
    }
    
    function BuildAnnotation(node,text,index,stag,key,refid,type,count) {
      // Build annotation for only text that is contained between the tags
      if (typeof refid === 'undefined' && refid !== null) {
        AddText(text,index,key);
      }
      else if (parseInt(node["state"]) !== 30){
        // This defines the text that is on the outside of font style tags
        var parent = GetParentTag(node,2);
        if (CheckTags(parent["name"])){
          var stpos = document["nodes"][index][key].length;
          var reflen = text.length;
          if (reflen === 0){
            reflen = 1;
          }

          var type = convert[parent["name"]];
          var annot = BeginInitObj(node,type);

          document["nodes"][annot]["source"] = index;
          document["nodes"][annot]["content"] = text;
          document["nodes"][annot]["key"] = key;
          document["nodes"][annot]["target"] = refid;
          document["nodes"][annot]["pos"] = [stpos,reflen];
        }
        AddText(text,index,key);
      }
      else {
        // Create reference/font style annotation with the appropriate position reported too
        try {
          var stpos = document["nodes"][index][key].length;
        }
        catch (TypeError){
          var stpos = 0;
        }

        var annot = BeginInitObj(node,type);

        CheckNested(node,text,index,key,refid);

        if (type === 'link'){
          var url = node["tag"]["attributes"]["xlink:href"];
          try {
            if (url.indexOf('http') >= 0){
              document["nodes"][annot]["url"] = url;
            }
            else{
              document["nodes"][annot]["url"] = text;
            }
          }
          catch (TypeError){
            document["nodes"][annot]["url"] = text;
          }
        }
        
        if (linkname !== ''){
          var text = linkname;
          linkname = '';
        }
        
        var reflen = text.length;
    
        if (count === 0){
          document["nodes"][annot]["source"] = index;
          document["nodes"][annot]["content"] = text;
          document["nodes"][annot]["key"] = key;
          document["nodes"][annot]["target"] = refid;
          document["nodes"][annot]["pos"] = [stpos,reflen];

          AddText(text,index,key);
        }
        else {
          document["nodes"][annot]["source"] = index;
          document["nodes"][annot]["content"] = text;
          document["nodes"][annot]["key"] = key;
          document["nodes"][annot]["target"] = refid;
          document["nodes"][annot]["pos"] = [null,null];
        }

        
      }
    }

    // Add the node to the index list
    // ==============

    function AddToIndex(id,type) {
      if (id in document["views"][type]){
        return
      }
      else {
        document["views"][type].push(id);
      }
    }

    function AddToInfoIndex(infoid,nodeid){
      document["nodes"][infoid]["nodes"].push(nodeid);
    };

    // Code for building the header nodes
    // ==============

    function GetHeading(node,tag) {
      // Create and populate the heading node
      var parent = GetParentTag(node,2);
      if (parent["name"] !== 'sec') {
        var parent = GetParentTag(node,1);
      }
      
      var level = GetHeadingLevel(parent);
      var id = BeginInitObj(node,"heading");
      AddToIndex(id,"content");

      document["nodes"][id]["level"] = level;
      
      GetText(node,id,tag);
    };

    function GetHeadingLevel(parent) {
      // Figure out if it is a sub header or a section header
      var id = parent["attributes"]["id"];
      try {
        return id.length-1
      }
      catch (TypeError){
        return 2;
      }
    };

    // Code for adding paragraph text into text nodes
    // ================

    function GetText(node,id,stag) {
      node.onopentag = function(tag) {
        var name = tag["name"];
        if (name === 'boxed-text'){
          var id = BeginInitObj(node,"box");
          AddToIndex(id,"figures");
          GetBox(node,id,name);
        } 
        else if (name !== 'p' && !CheckTags(name)){
          CheckOtherTags(node,tag);
        } 
      }
      node.ontext = function(text){
        var name = node["tagName"];
        if (name === 'funding-statement'){
          if (text.replace(/\s/g,"") !== ""){
            var ident = BeginInitObj(node,"text");
            AddToInfoIndex("info:funding",ident);
            ProcessText(node,text,ident,"content",name);
          }
        }
        else if (!(name === 'title' && stag !== 'title')){
          ProcessText(node,text,id,'content',name);
        }
      };
      node.onclosetag = function(tag){
        if (tag === stag){
          ReturnToSec(node);
        }
      };
    };

    function GetCont(node){
      var iid = 'info:author_contributions';
      InitObj("nodes","heading",iid);
      document["nodes"][iid]["content"] = 'Author Contributions';
      document["nodes"][iid]["level"] = 2

      var id = BeginInitObj(node,"text");
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
      var id = BeginInitObj(node,"text");
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

    // Code for building the figure node
    // ================
    
    function GetVidURL(id,parent){
      var vid = parent["attributes"][ "xlink:href"].split('.');
      document["nodes"][id]["url"] = "http://static.movie-usa.glencoesoftware.com/mp4/10.7554/"+vid[0]+'.mp4';
      document["nodes"][id]["url_ogv"] = "http://static.movie-usa.glencoesoftware.com/ogv/10.7554/"+vid[0]+'.ogv';
      document["nodes"][id]["poster"] = "http://static.movie-usa.glencoesoftware.com/jpg/10.7554/"+vid[0]+'.jpg';
    };

    function GetTableFooter(node,ident,footid,type,stag) {

      node.ontext = function(text){
        var name = node["tagName"];
        if (name === "label") {
          document["nodes"][footid]["label"] = text;
        }
        else {
          ProcessText(node,text,footid,'content',name)
        }
        if (document["nodes"][ident]["footers"].indexOf(footid) < 0){
          document["nodes"][ident]["footers"].push(footid)
        }
      }
      node.onclosetag = function(tag){
        if (tag === stag){
          GetFigs(node,ident,type);
        }
      }
    }

    function GetFigs(node,ident,type) {
      // Populate the figures node
      node.ontext = function(text){
        var name = node["tag"]["name"];
        if ( name === 'label'){
          document["nodes"][ident]["label"] = text;
        }
        else if (name === 'attrib'){
          var capid = document["nodes"][ident]["caption"];
          ProcessText(node,' '+text,capid,'content',name);
        }
      }
      node.onopentag = function(tag){
        var parent = GetParentTag(node,2)
        if (tag["name"] === 'caption'){
          GetCaptions(node,ident,type);
        }
        else if (tag["name"] === 'table'){
          document["nodes"][ident]["content"] += "<table>";
          GetTable(node,ident,type);
        }
        else if (parent["name"] === 'table-wrap-foot' && tag["name"] === 'fn'){
          var id = BeginInitObj(node,'footer');
          GetTableFooter(node,ident,id,type,"fn")
        }
        else if (tag["name"] === 'graphic'){
          document["nodes"][ident]["graphic_id"] = tag["attributes"]["xlink:href"];
          document["nodes"][ident]["url"] = 'http://www.plosone.org/article/fetchObject.action?uri='+document["nodes"][ident]["graphic_id"]+'&representation=PNG_M';
          document["nodes"][ident]["large_url"] = 'http://www.plosone.org/article/fetchObject.action?uri='+document["nodes"][ident]["graphic_id"]+'&representation=PNG_L';
        }
        else if (tag["name"] === 'media'){
          document["nodes"][ident]["graphic_id"] = tag["attributes"]["xlink:href"];
        }
        else {
          CheckOtherTags(node,tag);
        }
      }
      node.onclosetag = function(tag){
        if (tag === type){
          ReturnToSec(node);
        }
      }
    };
    function GetBox(node,id,type) {
      node.onopentag = function(tag){
        var name = tag["name"];
        if (name === 'caption'){
          GetCaptions(node,id,type)
        }
        if (name === 'inline-graphic'){
          document["nodes"][id]["graphic"] = 'yes';
        }
      }
      node.ontext = function(text){
        var name = node["tagName"];
        var parent = GetParentTag(node,2);
        if (name === 'label') {
          document["nodes"][id]["label"] = text;
        } 
        else{          
          ProcessText(node,text,id,'content',name);
        }
      }
      node.onclosetag = function(tag){
        if (tag === type){
          ReturnToSec(node);
        }
        else if (tag === 'p'){
          AddText('\n',id,'content');
        }
      }
    }

    function GetTable(node,ident,type) {
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
          document["nodes"][ident]["content"] += "<"+tagconvert[name]+'>';
        }
      }
      node.ontext = function(text) {
        var name = node["tagName"];
        document["nodes"][ident]["content"] += text;
      }
      node.onclosetag = function(tag){
        if (tag === 'table'){
          document["nodes"][ident]["content"] += "</table>";
          GetFigs(node,ident,type);
        }
        else if (tag.indexOf('mml') >= 0){
          document["nodes"][ident]["content"] += "</"+tag+">";
        }
        else if (tag !== "inline-formula"){
          document["nodes"][ident]["content"] += '</'+tagconvert[tag]+'>';
        }
      }
    }
     
    function GetCaptions(node,ident,type){
      // Create a node for each caption that is associated with a figure
      
      var id = BeginInitObj(node,"caption");

      document["nodes"][ident]["caption"] = id;
      document["nodes"][id]["source"] = ident;

      node.onopentag = function(tag){
        var name = tag["name"];
        if (name === "supplementary-material"){
          CheckOtherTags(node,tag);
        }
      }
      node.ontext = function(text){
        var name = node["tag"]["name"];
        if (CheckTags(name)) {
          if (name === 'ext-link'){
            if (text.indexOf('doi') >=0 ){
              document["nodes"][ident]["doi"] = text;
            }
            var parent = GetParentTag(node,3);
            if (parent["name"] === 'media'){
              GetVidURL(ident,parent);
            }
          }
          var older = GetParentTag(node,2);
          var parent = GetParentTag(node,1);
          if (parent["name"] === 'title' || older["name"] === 'title'){
            GetAnnotations(node,text,id,name,'title');
          }
          else {
            if (text.toUpperCase().indexOf('DOI') <0 ) {
              if (node["tag"]["attributes"]["ref-type"] === 'table-fn'){
                GetAnnotations(node,text,id,'sup','content');
              }
              else{
                GetAnnotations(node,text,id,name,'content');
              }
            }
          }
        }
        else if (name === 'title' || (type === 'boxed-text' && name === 'p')){
          AddText(text,id,'title');
        }
        else if (name === 'p'){
          AddText(text,id,'content');
        }
      };

      node.onclosetag = function(tag){
        if (tag === 'caption' && type === 'boxed-text'){
          GetBox(node,ident,type);
        }
        else if (tag === 'caption'){
          GetFigs(node,ident,type);
        }
      };
    };

    // Code to process the text and associated formulas
    // ===============
    function StartMath(node,formid,id) {
      node.onopentag = function(tag) {
        var name = tag["name"];
        if (name === 'mml:math') {
          GetMath(node,formid,id);
        }
      }
      node.ontext = function(text) {
        var name = node["tagName"];
        if (name === 'label'){
          document["nodes"][formid]["label"] = text;
        }
        else {
          ProcessText(node,text,formid,'content',name);
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
        if (tag === 'disp-formula'){//} || tag === 'inline-formula') {
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
        else if (CheckTags(parent["name"]) || parent["name"] === 'p' || node["tagName"] === 'inline-formula'){
          var id = GetNodeId("text");
          InitObj("nodes","text",id);
          AddToIndex(id,"content");
          AddText(text,id,"content");
          GetText(node,id,'p');
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

    function GetInline(node,id,textid) {
      node.onopentag = function(tag) {
        var name = tag["name"];
        if (name !== 'mml:math'){
          document["nodes"][id]["content"] += "<"+name+">";
        }
      }

      node.ontext = function(text) {
        var name = node["tagName"];
        if (name.indexOf('mml:') >= 0){
          document["nodes"][id]["content"] += text;
        }
        else if (name === 'disp-formula'){
          var ident = BeginInitObj(node,"formula");
          AddToIndex(ident,"content");
          StartMath(node,ident,textid);
        }
        else {
          ProcessText(node,text,textid,'content',name);
        }
      }
      node.onclosetag = function(tag){
        if (tag === 'inline-formula'){
          ReturnToSec(node);
        }
        else if (tag !== 'mml:math' && tag.indexOf('mml') >= 0) {
          document["nodes"][id]["content"] += "</"+tag+">";
        }
      }
    };  
    
    function CheckOtherTags(node,tag) {
      var name = tag["name"]
      if (name === 'fig'){
        var id = BeginInitObj(node,"image");
        AddToIndex(id,"figures");
        document["nodes"][id]["object_id"] = 'F'+figcount;
        if (typeof node["tag"]["attributes"]["specific-use"] === 'undefined'){
          figgroup = id;
          document["nodes"][id]["group"] = ['parent',null];
        }
        else {
          document["nodes"][id]["group"] = ['child',figgroup];
        } 
        
        figcount += 1; 
        GetFigs(node,id,'fig');
      }
      else if (name === 'media' && tag["attributes"]["mimetype"] === "video") {
        var id = BeginInitObj(node,"video");
        AddToIndex(id,"figures");
        GetFigs(node,id,name);
      }
      else if (tag["name"] === 'table-wrap'){
        var id = BeginInitObj(node,"table");
        AddToIndex(id,"figures");
        GetFigs(node,id,name);
      } 
      else if (name === 'disp-formula'){
        var id = BeginInitObj(node,"formula");
        var textid = document["views"]["content"][document["views"]["content"].length-1];
        AddToIndex(id,"content");
        StartMath(node,id,textid);
      }
      else if (name === 'supplementary-material') {
        var id = BeginInitObj(node,"supplement");
        AddToIndex(id,"figures");

        var attr = tag["attributes"]["xlink:href"];
        document["nodes"][id]["source"] = "http://www.plosone.org/article/fetchSingleRepresentation.action?uri=" + attr;
        GetFigs(node,id,'supplementary-material');
      }
      else if (name === 'inline-formula'){
        var textid = document["views"]["content"][document["views"]["content"].length-1];
        
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
          var abid = GetNodeId("text");
          InitObj("nodes","text",abid);
          AddToIndex(abid,'content');
          GetText(node,abid,'p');
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
      section = 'Commentary';

      function GetCommTitle(node,id,stag) {
        node.ontext = function(text){
          var name = node["tagName"];
          if (name === 'article-title'){
            ProcessText(node,text,id,'content',name);
            document["nodes"][id]["level"] = 2;
          }
        };
        node.onclosetag = function(tag){
          if (tag === stag){
            GetCommentary(node);
          }
        };
      };

      node.onopentag = function(tag){
        var name = tag["name"];
        if (name === 'title-group'){
          var id = BeginInitObj(node,'heading');
          AddToIndex(id,"content")
          GetCommTitle(node,id,name);
        }
        else if (name === 'p'){
          var id = BeginInitObj(node,"text");
          AddToIndex(id,"content");
          GetText(node,id,'p');
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
      InitObj("nodes","cover","cover:document")
      AddToIndex("cover:document","content");

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

      function GetPaperDOI(node){
        var id = 'publication_info';
        // Get the paper DOI information
        node.ontext = function(text){
          if (document["id"] === ''){
            var doi = text.split('/');
            var ident = doi[1].replace(/[\.\-]/g,'_');
  
            document["id"] = ident;

            document["nodes"][id]["doi"] = 'http://www.plosone.org/article/info:doi/'+text;
            document["nodes"][id]["json_link"] = 'http://localhost:1441/documents/' + ident;
            document["nodes"][id]["pdf_link"] = 'http://www.plosone.org/article/fetchObjectAttachment.action?uri=info%3Adoi%2F10.1371%2F'+ident+'&representation=PDF';
            document["nodes"][id]["xml_link"] = 'http://www.plosone.org/article/fetchObjectAttachment.action?uri=info%3Adoi%2F10.1371%2F'+doi[1]+'&representation=XML';
          }
        }
        ReadFront(node);
      }

      function GetJournal(node) {
        var id = 'publication_info';
        if (!(id in document["nodes"])){
          InitObj("nodes","publication_info",id)
        }
        node.ontext = function(text){
          if (node["tag"]["attributes"]["journal-id-type"] === 'nlm-ta') {
            document["nodes"]["publication_info"]["journal"] = text;
          }
        }
        node.onclosetag = function(tag){
          if (tag === 'journal-meta'){
            ReadFront(node);
          }
        }
      }

      function GetTitle(node) {
        // Add the paper's title to the cover:document node
        var id = 'cover:document';
        var content = 'title';

        node.ontext = function(text){
          var name = node["tagName"];
          var parent = GetParentTag(node,2);
          if (name === 'article-title' || parent["name"] === 'article-title' || parent["name"] === 'title-group') {
            var parent = GetParentTag(node,1);
            if (!(parent["name"] === 'alt-title' || name === 'alt-title')) {
              ProcessText(node,text,id,content,name)
            }
          }
        };

        node.onclosetag = function(tag){
          if (tag === 'article-title'){
            ReadFront(node);
          }
        };
      };

      // Go through the authors names and get the relevant
      // affiliation information
      // =============

      function RunThroughName(node,type,ath) {
        // Create dictionary of the author's names
        var author = {}
        
        node.ontext = function(text){
          var name = node["tagName"];
          var parent = GetParentTag(node,1);
          if (name === 'given-names'){
            document["nodes"][ath]["given-names"] = text;
          }
          else if  (name === 'surname'){
            document["nodes"][ath]["last-name"] = text;
          }
          else if (CheckTags(name) && parent["name"] === 'contrib' && node["tag"]["attributes"]["ref-type"].indexOf("aff") >= 0){
            var type = "institution:"+node["tag"]["attributes"]["rid"]
            try {
              affmap[type].push(ath)
            }
            catch (TypeError){
              affmap[type] = [ath]
            } 
          }
          if (text.indexOf('*') >= 0){
            var type = "email:"+parent["attributes"]["rid"];
            try {
              affmap[type].push(ath)
            }
            catch (TypeError){
              affmap[type] = [ath]
            } 
            // var id = 'info:for_correspondence';
            // InitObj("nodes","heading",id);
            // document["nodes"][id]["content"] = 'For correspondence';
            // document["nodes"][id]["level"] = 2;

            // var types = document["nodes"];
            // for (i in types){
            //   if (types[i]["type"] === 'email'){
            //     if (types[i]["node"] === ''){
            //       types[i]["node"] = ath;
            //       document["nodes"][ath]["email"] = types[i]["id"];
            //       break
            //     }
            //   }
            // }
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
        AddToIndex(id,"institution");

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
          else if (name === 'addr-line'){
            aff["department"] = text;
          }
        }
        node.onclosetag = function(tag){
          if (tag === 'aff'){
            try {
              if (!(id in affmap)){
                document["nodes"][edid]["affiliations"].push(aff);
              }
              for (var i=0;i<affmap[id].length;i++){
                document["nodes"][affmap[id][i]]["affiliations"].push(aff);
              }
              ReadFront(node);
            }
            catch (TypeError) {
              ReadFront(node);
            }
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
            document["nodes"]["cover:document"]["authors"].push(athid);
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
          else if(node["tagName"] === 'aff') {
            GetAffiliations(node);
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
            document["nodes"]["publication_info"][iid] = keywords;
            ReadFront(node);
          }
        };
      };

      // Get the corresponding author's email information
      // ===============

      function GetEmail(node,iid) {
        var ath = affmap[iid];
        node.ontext = function(text) {
          var name = node['tagName'];
          if (name === 'email' && text.indexOf('@') >= 0){
            var id = BeginInitObj(node,"email");
            ProcessText(node,text,id,'email',name);
            try {
              for (var i=0;i<ath.length;i++){
                if (document["nodes"][ath[i]]["email"] === ''){
                  document["nodes"][ath[i]]["email"] = id;
                  break
                }
              }
            }
            catch (TypeError){
              var header = 'info:corresponding';
              InitObj("nodes","heading",header);
              document["nodes"][header]["level"] = 2;
              document["nodes"][header]["content"] = "For correspondence";
              var txtid = BeginInitObj(node,"text");
              AddToInfoIndex(header,txtid)
              ProcessText(node,text,txtid,"content",name)
            }
          }
        };
        node.onclosetag = function(tag){
          if (tag === 'corresp'){
            ReadFront(node);
          }
        };
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
              ProcessText(node,text,id,'received_on',attr)
            } 
            else if (attr === 'accepted'){
              text = SanitizeDate(date["year"]+'-'+date["month"]+'-'+date["day"]);
              ProcessText(node,text,id,'accepted_on',attr)
            }
            ReadFront(node);
          }
          else if (tag === 'pub-date'){
            var pubattr = node["tag"]["attributes"]["pub-type"];
            if (pubattr === 'epub'){
              text = SanitizeDate(date["year"]+'-'+date["month"]+'-'+date["day"]);
              ProcessText(node,text,id,'published_on',pubattr)
            }
            ReadFront(node);
          }
        };
      };

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
            var authors = document["nodes"]["cover:document"]["authors"];
            for (var i=0;i<authors.length;i++){
              if (document["nodes"][id]["given-names"] === document["nodes"][authors[i]]["given-names"]){
                document["nodes"][authors[i]]["funding"].push(id);
                document["nodes"][id]["person"] = authors[i];
                AddToInfoIndex(iid,authors[i])
                ReadFront(node);
              }
            }
          }
        }
      }

      function GetLicense(node,iid) {

        var id = BeginInitObj(node,"text");
        AddToInfoIndex(iid,id);

        node.ontext = function(text){
          var name = node["tagName"];
          if (name === 'copyright-statement' || (name === 'copyright-year' && document["nodes"][id]["content"] === '')) {
            ProcessText(node,text+'. ',id,'content',name);
          }
          else if (name === 'license-p' || CheckTags(name) || name === 'p' || name === 'copyright-holder'){
            ProcessText(node,text,id,'content',name);
          }     
        };
        node.onclosetag = function(tag){
          if (tag === 'permissions'){
            ReadFront(node);
          }
        };
      };

      function GetImpact(node,iid) {
        var id = BeginInitObj(node,"text");
        AddToInfoIndex(iid,id);
        node.ontext = function(text){
          var name = node["tagName"];
          if (name === 'meta-value' || CheckTags(name)){
            ProcessText(node,text,id,'content',name)
          }
        };
        node.onclosetag = function(tag){
          if (tag === "custom-meta") {
            ReadFront(node);
          }
        };
      };

      function GetSubj(node) {

        node.ontext = function(text){
          var parent = GetParentTag(node,1);
          var attr = parent["attributes"]["subj-group-type"];
          if (attr === 'heading'){
            document["nodes"]["publication_info"]["article_type"] = text;
          }
          else if (attr === 'Discipline') {
            document["nodes"]["publication_info"]["subjects"].push(text);
          }
        }
       
      }

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
          GetTitle(data);
        }
        else if (name === 'abstract'){
          var id = "info:funding";
          InitObj("nodes","heading",id);
          document["nodes"][id]["content"] = 'Funding Information'
          document["nodes"][id]["level"] = 2;

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
          var id = "email:"+tag["attributes"]["id"];
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
          GetCompInt(data,id);
        }
        else if (name === 'aff'){
          GetAffiliations(data);
        }
        else if (name === 'funding-group') {
          var id = 'info:funding';
          InitObj("nodes","heading",id);
          document["nodes"][id]["content"] = 'Funding';
          document["nodes"][id]["level"] = 2;
        }
        else if (name === 'award-group') {
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
          GetImpact(data,id);
        }
        else if (name === 'permissions'){
          var id = 'info:copyright';
          InitObj("nodes","heading",id);
          document["nodes"][id]["content"] = 'Copyright'
          document["nodes"][id]["level"] = 2;
          GetLicense(data,id);
        }
        else if (name === 'subj-group'){
          GetSubj(data);
        }
      }; 
      data.onclosetag = function(tag){
        if (tag === 'front'){
          ReadBody(data);
        }
      } 
    };

    // At the body of the paper
    // ===============

    function ReadBody(node){
      // Read through the body portion of the paper
      section = 'Body';
      node.onopentag = function(tag) {
        var name = tag["name"];
        if (name === 'title'){
          GetHeading(node,name);
        }
        else if (name === 'boxed-text'){
          var id = BeginInitObj(node,"box");
          AddToIndex(id,"figures");
          GetBox(node,id,name);
        }
        else if (name === 'disp-quote'){
          var id = BeginInitObj(node,"quote");
          AddToIndex(id,"content");
          GetText(node,id,name);
        }
        else if (name === 'p'){
          var id = BeginInitObj(node,"text");
          AddToIndex(id,"content");
          GetText(node,id,name);
        }
        else {
          CheckOtherTags(node,tag);
        }
      };
      node.onclosetag = function(tag){
        if (tag === 'body' || tag === 'ref-list'){
          ReadBack(node);
        }
      }
    };

    // Build the full list of references
    // ==============
    
    function ReadBack(data){
      // Read through the full list of references at the end of the paper
      
      section = 'Back';
      function GetCitations(node,rid){
        function RunThroughCitName(node){
          // Create dictionary of the author's names
          var author = {
            "given-names" : '',
            "last-name" : '',
          };
          var i = 0;
          node.ontext = function(text){
            if (i === 2){
              return true
            }
            if (node["tagName"] === 'given-names'){
              author["given-names"] = text;
            }
            else if  (node["tagName"] === 'surname'){
              author["last-name"] = text;
            }
            i += 1
          };
          return author
        };
        
        function GetRefMaterial(node,id){
          // Get additional information about the citation
          
          node.ontext = function(text){
            var name = node["tagName"];
            if (name in document["nodes"][id]) {
              document["nodes"][id][name] = text;
            }
            else if (id.indexOf('website') >= 0 && name === 'collab'){
             ProcessText(node,text,id,'source',name);
            }
            else if (id.indexOf('website') >= 0 && name === 'ext-link'){
              if (text.indexOf('http') >=0){
                var citid = GetNodeId("citation");
                InitObj("nodes","citation",citid);
            
                document["nodes"][id]["citation_url"].push(citid);

                document["nodes"][citid]["label"] = text;
                document["nodes"][citid]["url"] = node["tag"]["attributes"]["xlink:href"];
              }
            }
            else if (name === 'article-title' || (CheckTags(name) && name !== 'ext-link')){
              ProcessText(node,text,id,'title',name);
            }
            else if (name === 'pub-id' || (name === 'ext-link' && text.indexOf('10.') >= 0)){
              document["nodes"][id]["doi"] = 'http://dx.doi.org/'+text;
            }
          };
        };

        function FixRelevantAnnotations(id){
          var spid = id.split(':');
          for (var i in document["nodes"]){
            if (i.indexOf('annotation') >= 0){
              var target = document["nodes"][i]["target"];
              if (target !== null){
                var tgt = target.split(':')
                if (spid[1] === tgt[1]){
                  var ntgt = spid[0]+':'+tgt[1];
                  document["nodes"][i]["target"] = ntgt;
                }
              }
            }
          }
        }

        function SwitchBook(id){
          if (document["nodes"][id]["title"] === ''){
            document["nodes"][id]["title"] = document["nodes"][id]["source"];
            document["nodes"][id]["source"] = '';
          }
        }
        
        node.onopentag = function(tag){
          var name = tag["name"];
          if (name === 'mixed-citation'){
            var type = convert[tag["attributes"]['publication-type']];
            id = type+':'+rid.replace(/[\.\-]/g,'_');
            InitObj("nodes",type,id);
            AddToIndex(id,"publications");
          }
          else if (name === 'name'){
            var auth = RunThroughCitName(node);
            document["nodes"][id]["authors"].push(auth);
          }
          else if (name === 'article-title'){
            GetRefMaterial(node,id);
          }
        };
        node.onclosetag = function(tag){
          if (tag === 'ref'){
            var id = document["views"]["publications"][document["views"]["publications"].length-1];
            if (document["nodes"][id]["title"][0] === '.'){
              document["nodes"][id]["title"] = document["nodes"][id]["title"].substring(1);
            }
            FixRelevantAnnotations(id);
            SwitchBook(id);
            ReadBack(node);
          }
        }
      };

      function GetAuthCont(node) {
        var i = 0;
        var authors = document["nodes"]["cover:document"]["authors"];
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

      function GetAck(node,iid) {
        var id = BeginInitObj(node,"text");
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
      function GetMajorData(node,id) {

        node.ontext = function(text) {
          var parent = GetParentTag(node,1);
          var name = node["tagName"];
          
          if (name === 'surname'){
            ProcessText(node,text,id,'content',name);
          }
          else if (name === 'given-names') {
            ProcessText(node,', '+text,id,'content',name)
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
              ProcessText(node,text,id,'content',name);
            }
          }
        }
        node.onclosetag = function(tag){
          if (tag === 'p') {
            ReadBack(node);
          }
        }
      }

      data.onopentag = function(tag){
        var name = tag["name"];
        var type = tag["attributes"]["content-type"]
        if (name === 'ref'){
          var attr = tag["attributes"]["id"];
          GetCitations(data,attr);
        }
        else if (name === 'ack'){
          var id = "info:ack";
          InitObj("nodes","heading",id);
          document["nodes"][id]["content"] = "Acknowledgements";
          document["nodes"][id]["level"] = 2;
          GetAck(data,id);
        }
        else if (name === 'fn-group' && type === 'author-contribution'){
          GetAuthCont(data);
        }
        else if (name === 'supplementary-material'){
          var id = BeginInitObj(data,"supplement");
          AddToIndex(id,"figures");
          GetFigs(data,id,'supplementary-material','back');
        }
        else if (name === 'related-object') {
          var infid = 'info:dataset';
          if (!document["nodes"][infid]){
            InitObj("nodes","heading",infid);
            document["nodes"][infid]["content"] = 'Major Datasets';
            document["nodes"][infid]["level"] = 2;
          }

          var dataid = BeginInitObj(data,"text");
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
          // var url = "/content/1/e"+document["id"];
          // util.loadText(url, function(err,paper,pth){
          // if (pth.indexOf('/1/') >=0){
          //   var pid = 1;
          // }
          // else {
          //   var pid = 2;
          // }

          // var pdf = 'http://elife.elifesciences.org/content/'+pid+"/e"+document["id"]+".full-text.pdf";
          // document["nodes"]["publication_info"]["pdf_link"] = pdf;
          // document["properties"]["pdf_link"] = pdf;

          // function GetFigURL(id){
          //   var doi = document["id"];
          //   var label = document["nodes"][id]["label"];
          //   if (typeof label !== 'undefined' && id.indexOf('image') >= 0){
          //     if (document["nodes"][id]["group"][0] === 'child') {
          //       var parent = document["nodes"][id]["group"][1];
          //       document["nodes"][id]["url"] = "http://elife.elifesciences.org/content/elife/"+pid+"/e"+doi+"/"+document["nodes"][parent]["object_id"]+"/"+document["nodes"][id]["object_id"]+".medium.gif";
          //       document["nodes"][id]["large_url"] = "http://elife.elifesciences.org/content/elife/"+pid+"/e"+doi+"/"+document["nodes"][parent]["object_id"]+"/"+document["nodes"][id]["object_id"]+".large.jpg";
          //     }
          //     else if (label.indexOf('Figure') >= 0){
          //       document["nodes"][id]["url"] = "http://elife.elifesciences.org/content/elife/"+pid+"/e"+doi+"/"+document["nodes"][id]["object_id"]+".medium.gif";
          //       document["nodes"][id]["large_url"] = "http://elife.elifesciences.org/content/elife/"+pid+"/e"+doi+"/"+document["nodes"][id]["object_id"]+".large.jpg";
          //     }
          //     else{
          //       document["nodes"][id]["url"] = 'http://elife.elifesciences.org/content/elife/'+pid+'/e'+doi+'/'+pid+'/'+document["nodes"][id]["object_id"]+'.medium.gif';
          //       document["nodes"][id]["large_url"] = "http://elife.elifesciences.org/content/elife/"+pid+"/e"+doi+"/"+pid+'/'+document["nodes"][id]["object_id"]+".large.jpg";
          //     }
          //   }
          //   else if (typeof label === 'undefined' && id.indexOf("image:fig") >=0){
          //     document["nodes"][id]["url"] = 'http://elife.elifesciences.org/content/elife/'+pid+'/e'+doi+'/'+pid+'/'+document["nodes"][id]["object_id"]+'.medium.gif';
          //     document["nodes"][id]["large_url"] = "http://elife.elifesciences.org/content/elife/"+pid+"/e"+doi+"/"+pid+'/'+document["nodes"][id]["object_id"]+".large.jpg";
          //   }
          //   else if (id.indexOf('box') >= 0 && typeof document["nodes"][id]["graphic"] !== 'undefined'){
          //     document["nodes"][id]["url"] = "http://dex3165296d6d.cloudfront.net/sites/default/files/highwire/elife/"+pid+"/e"+document["id"]+"/embed/inline-graphic-1.gif";
          //   }
          // };

          // function runFigs(article) {
          //   var figs = document["views"]["figures"];
          //   for (var i=0;i<figs.length;i++){
          //     var id = document["nodes"][figs[i]]["id"];
          //     GetFigURL(id);
          //   }
          // }
          // function pubURL(pubtitle,nxttitle,article,id,lastindex){
          //   var index = article.indexOf(pubtitle,lastindex); 
          //   if (nxttitle === ''){
          //     var nextid = article.lastIndexOf(')')
          //   }
          //   else {
          //     var nextid = article.indexOf(nxttitle,index);
          //   }
            
          //   if (index < 0 || nextid < 0) {
          //     return 0
          //   }
          //   var idx = index+1

          //   while (idx < nextid-2 && idx > index){
          //     var tidx = article.indexOf('doi: ',idx);
          //     if (tidx < 0 || tidx > nextid){
          //       tidx = article.indexOf('[',idx);
          //     }
          //     else {
          //       var end = article.indexOf('\n',tidx);
          //       var doi = article.substring(tidx+5,end);
          //       if (doi[0] === '['){
          //         var end = doi.indexOf(']');
          //         doi = doi.substring(1,end);
          //       }
          //       if (doi[doi.length-1] === '.') {
          //         doi = doi.substring(0,doi.length-1);
          //       }
          //       var url = 'http://dx.doi.org/' + doi;
          //       document["nodes"][id]["doi"] = url;
          //       return end
          //       break
          //     }
          //     if (tidx > nextid){
          //       return idx
          //       break
          //     }

          //     var label = article.substring(tidx+1,article.indexOf(']',tidx));
          //     var sidx = article.indexOf('(',tidx);
          //     var thidx = article.indexOf('\n',sidx);
          //     if (thidx < 0) {
          //       var thidx = nextid
          //     }
          //     var url = article.substring(sidx+1,thidx-2);
          //     idx = thidx
              
          //     if (url.indexOf('http') <0){
          //       return idx
          //       break
          //     }

          //     var citid = GetNodeId("citation");
          //     InitObj("nodes","citation",citid);
          
          //     document["nodes"][id]["citation_url"].push(citid);

          //     document["nodes"][citid]["label"] = label;
          //     document["nodes"][citid]["url"] = url;
          //     return idx
          //   }     
          // }
          
          // function runPubs(article) {
          //   var pubs = document["views"]["publications"];
          //   for (var i=0;i<pubs.length;i++) {
          //     var doi = document["nodes"][pubs[i]]["doi"];
          //     var type = document["nodes"][pubs[i]]["type"];
          //     var cit = document["nodes"][pubs[i]]["citation_url"]
          //     if (typeof doi !== 'undefined' || (type === 'website' && cit.length >0)){
          //       continue
          //     }

          //     var title = document["nodes"][pubs[i]]["title"];
          //     try {
          //       var nexttitle = document["nodes"][pubs[i+1]]["title"];
          //     }
          //     catch (TypeError) {
          //       var nexttitle = '';
          //     }
          //     if (i === 0){
          //       var lastidx = pubURL(title,nexttitle,article,pubs[i],0);
          //     }
          //     else{
          //       lastidx = pubURL(title,nexttitle,article,pubs[i],lastidx);
          //     }
          //   }
          // }
          // runFigs(paper);
          // runPubs(paper);
        //});

        CompileInfo();
        ClearEmpty();
        BuildProperties();
        //console.log(document["views"])
        cb(null, document);
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
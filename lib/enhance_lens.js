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

var library = JSON.parse(require('./data/lens_library.json'));
var stats = JSON.parse(require('./data/lens_stats.json'));

function ReadJSONs(articles) {
	function UpdateCits(json) {
		var cits = json["nodes"]["citation"]["nodes"];
		for (var citation=0;citation<cits.length;citation++){
			var doi = json["nodes"][cit[citation]]["doi"];
			if (doi in stats["nodes"]){
				json["nodes"][cit[citation]]["display"] = stats["nodes"][doi]["display"];
			}
		}
		fs.writeFileSync('./data/'+json["id"]+'.json',JSON.stringify(json,null,2))
	}
	for (var art=0;art<articles.length;art++) {
		var article = library["nodes"][articles[art]]["url"];
		var json_article = JSON.parse(require('./data/'+article))
		UpdateCits(json_article);
	}
}

function UpdateJSONs() {
	var collections = library["nodes"]["library"]["collections"];
	for (var col=0;col<collections){
		var article_list = library["nodes"][col[i]]["records"];
		RecordJSONs(article_list);
	}
}

function UpdateStats() {
	function FindMax(images) {
		var default_prop = 'abstract';
		var default_count = 0;
		for (fig_id in images){
			if (images[figid] > default_count){
				default_prop = figid;
				default_count = images[figid];
			}
		}
		return default_prop
	}
	for (var avail_article in stats["nodes"]) {
		var display = FindMax(stats["nodes"][avail_article]["figures"])
		stats["nodes"][avail_article]["display"] = display;
	}
	fs.writeFileSync('./data/lens_stats.json',JSON.stringify(stats,null,2))
}

UpdateStats();
UpdateJSONs();
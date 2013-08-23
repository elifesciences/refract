# Setup of Lens 0.1.x


## Setup Refract
  
    $ git clone https://github.com/elifesciences/refract
    $ cd refract
    $ git checkout master

Install dependencies

    $ npm install

Prepare a custom cache warm file and host it somewhere (e.g. `http://quasipartikel.at/xml_files.txt`):

    https://myserver.com/example1.xml
    https://myserver.com/example1.xml

Refract expects to be pointed at a file that lists the documents that it should convert. It first looks for an 
environment variable `CACHE_WARM_FILE`, and if it doesn't find one, it defailts to `http://s3.amazonaws.com/elife-lens/xml_files.txt`. 
_Before_ running refract, either change the default value in `lib/cache_warmer.js` or set an enviornment variable `CACHE_WARM_FILE`.

Then run refract with 

    $ node server.js
    
## Setup Lens

    $ git clone https://github.com/elifesciences/lens
    $ cd lens
    $ git checkout gh-pages

Change the configuration `src/config.js` like so:

    Lens.ENV = 'development';
    Lens.API_URL_DEV = 'http://localhost:1441';

Open Lens in the browser

    $ open index.html

# Setup of Lens 0.1.x


## Setup Refract
  
    $ git clone https://github.com/elifesciences/refract
    $ git checkout master

Install dependencies

    $ npm install

Prepare a custom cache warm file and host it somewhere (e.g. `http://quasipartikel.at/xml_files.txt`):

    https://myserver.com/example1.xml
    https://myserver.com/example1.xml

Run refract and tell it the use the custom CACHE_WARM FILE.

    $ CACHE_WARM_FILE=http://quasipartikel.at/xml_files.txt node server.js
    
    Refract will run at http://localhost:1441


## Setup Lens

    $ git clone https://github.com/elifesciences/lens
    $ cd lens
    $ git checkout gh-pages

Change the configuration `src/config.js` like so:

    Lens.ENV = 'development';
    Lens.API_URL_DEV = 'http://localhost:1441';

Open Lens in the browser

    $ open index.html
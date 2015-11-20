# Demo Angular application with ARJS-builder

## Install

    npm install
    npm install -g bower
    npm install -g gulp
    bower install

## Start (develop and build)

    gulp
    open "http://localhost:7000" #with livereload
    open "http://localhost:7100" #with liveCSS only (use https://chrome.google.com/webstore/detail/livereload/jnihajbhpnppcggbcgedagnkighmdlei)
    open "http://localhost:7200" #build
    open "http://localhost:7201 ... 72xx" #separate projects builds

## Build

    gulp build

    gulp build [--enviroment] [--project]
    gulp build --dev --admin
    
## Test

    gulp test
    
## Config

    use `projects/<project_name>/_config` for project configs
    use `configs` for local configs
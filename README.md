# node-arjs-builder [![NPM version](https://badge.fury.io/js/arjs-builder.svg)](http://badge.fury.io/js/arjs-builder)

> Builder for Angular + RequireJS projects

## Install with [npm](npmjs.org)

```sh
npm install arjs-builder
```

## Usage
Example of application structure. Also see [node-projects-config documentations](https://github.com/tamtakoe/node-projects-config)
```
configs/       * local configs
projects/
 ├──admin/     * project
 ├──build/     * bulded projects
 ├──compiled/  * compiled files for local work
 ├──files/     * non included assets
 ├──main/      * project
 └──vendor/    * bower libraries
```

```js
//gulpfile.js
var gulp = require('gulp');
var arjs = require('arjs-builder')();

gulp.task('build', arjs.build);
gulp.task('test', arjs.test);
gulp.task('default', arjs.run); //compile and run local servers
```

## API
### arjsBuilder([params])

Return instance of builder

#### params

- **localConfigsPath** (`String`)  
  Default: `process.cwd() + '/configs'`  
  Folder for local configs.

- **karmaConfigPath** (`String`)  
  Default: `process.cwd() + '/karma.conf.js'`
  Path to Karma config

- **projectsPath** (`String`)  
  Default: `process.cwd() + '/projects'`  
  Root folder for projects etc.

- **configsDir** (`String`)  
  Default: `'*/_config'`  
  [Glob](https://github.com/isaacs/node-glob)-pattern for project config folders.

- **compiledDir** (`String`)  
  Default: `'compiled'`  
  Folder for compiled files for local work (styles, compiled vendors)

- **buildDir** (`String`)  
  Default: `'build'`  
  Folder for builded files

- **filesDir** (`String`)  
  Default: `'files'`  
  Assets (big images, fonts, video) which don't include into css-files. Better to store on a separate file server

- **vendorDir** (`String`)  
  Default: `'vendor'`  
  Vendor libraries (f.e. from bower)

- **maxListeners** (`Integer`)  
  Default: `100`  
  Set `EventEmitter._maxListeners`. Increase this value if there are EventEmitter errors of build of big project

- **browsers** (`Array` of `String`)  
  Default: `['chrome >= 35', 'ff >= 20', 'safari >= 7', 'ie >= 10', 'opera >= 12.10', 'android >= 4.4', 'ios >= 7', 'phantomjs >= 1.9']`  
  Defines supporting browsers. It use for old browsers checking and [Autoprefixer](https://github.com/postcss/autoprefixer)

## Config API

Structure

```js
//default.json
{
    public: { ... },
    localhost: {
        webserver: { ... },
        manifest: { ... }
    },
    build: {
        <every module params>
        ...
        manifest: { ... },
        modules: { ... },
        copy: { ... }
    },
    vendor: { ... },
}
```

#### public

Config for web. It will be export to `window.project.config`

```js
{
    resources: {
        api: '//my-site/api/v1'
    }
}
```

#### localhost

Config for development on local device.

#### webserver

Config for local webserver. May be array of configs for several servers. See [node-webserver-lite documentation](https://github.com/tamtakoe/node-webserver-lite)

```js
{
    root: 'build',
    port: 7200,
    livereload: true
}
```

#### manifest

List of resources which will be included to index.html as link or scripts tags.
Paths for builded files add to manifest of builded projects.
You can see current project manifest (with extra fields) in `window.project`.
For local and builded project uses different manifests.

```js
//localhost manifest
{
    resources: {
        js: [{ //load require.js
            'src': 'vendor/requirejs/require.js'
            'data-main': 'main/requireconfig'
        }],
        css: [
            '//fonts.googleapis.com/css?family=Open+Sans:300italic,300,700,600,400&subset=cyrillic-ext,latin-ext',
            'compiled/main/vendor/angularStrap.css', //You can include vendor's styles to vendor module or use it directly: 'vendor/bootstrap/dist/css/bootstrap.css'
            'compiled/main/style.css',
        ]
}
```

```js
//build manifest
{
    browsers: [ //you can override default versions of browsers
        "chrome >= 30",
        "ff >= 20",
        "safari >= 7",
        "ie >= 10",
        "opera >= 12.10",
        "android >= 4.4",
        "ios >= 7",
        "phantomjs >= 1.9"
    ],
    resources: {
        html: [
            'main/common/directives/header/template.html', //You can cache some templates, wich will be showed until js-framework loaded
            'main/common/directives/headerMenu/template.html'
        ],
        css: [
            '//fonts.googleapis.com/css?family=Open+Sans:300italic,300,700,600,400&subset=cyrillic-ext,latin-ext',
            /* <project styles are added automatically during build of the project> */
        ],
        /* js: [<project modules are added automatically during build of the project>] */
}
```

#### build

Config for build project for final testing and production

#### copy

`copy` is a map where keys are [Glob](https://github.com/isaacs/node-glob)-pattern of source files relative to project directory,
and values — destination paths or filenames relative to build directory.

```js
//default value of `copy`
{
    'favicon.ico': 'favicon.ico', //copy file to build directory
    'files/**': 'files/' //copy folder to build directory. (`files` is value of `filesDir` option)
}
```

You can add custom files for copying in your config:

```js
{
    'robots.txt': 'robots.txt'
}
```

#### modules

`modules` is a map with modules configs. Configs from `modules` merge on corresponding modules with `<every module params>`

```js
//build
{
    //every module params
    styles: [
        'main/import.styl' //add to each module including vendor and common
    ],
    inlineImgToCss: true,
    includeCss: true,
    uglifyJs: false,
    //
    
    modules: {
        vendor: {
            //sortIndex: 0, //by default. Vendor loads and runs first
            includeCss: false
            scripts: [
                'vendor/requirejs/require.js'
            ],
            styles: [
                'compiled/main/vendor/bootstrap.css' //add vendor style to vendor module
            ],
            uglifyJs: {
                mangle: false //vendor will be uglified
            }
        },
        common: {
            sortIndex: 1, //Will be load and run second
            includeCss: false
        }
    }
}
```

#### vendor

Has structure like `modules`. You can compile custom bundles of vendors

```js
//vendor
{
    angularStrap: { //module name to compiled directory
        rev: false, //don't uglify module name
        templateCacheModule: 'angularStrap',
        root: 'vendor/angular-strap/src',
        includeCss: false //it will create a separate file `angularStrap.css`
        annotate: {
            createMainModule: 'angularStrap',
            add: true,
            rename: [{
                from: '$tooltip',
                to: '$asTooltip'
            }]
        },
        scripts: [
            'helpers/date-parser.js',
            'helpers/date-formatter.js',
            'helpers/dimensions.js',
            'tooltip/tooltip.js',
            'datepicker/datepicker.js'
        ],
        templates: [
            'tooltip/tooltip.tpl.html',
            'datepicker/datepicker.tpl.html'
        ],
        styles: [ //you can include third-party styles to module
            '../../vendor/bootstrap/dist/css/bootstrap.less'
        ]
    }
}   
```

#### module params

- **sortIndex** (`Integer`)  
  Defines order of modules loading. Use for `build.modules` array

- **baseUrl** (`String`)  
  Default: `projectsPath` (`process.cwd() + '/projects'`)  
  Base path for module files

- **root** (`String`)  
  Default: `''`  
  Path for module files relatively `baseUrl`

- **index** (`String`)  
  Default: `false`  
  Use local index.html. Can be `false`, `true`, `'external'`. If `true` or `'external'` index.html copy to builded project folder.

  `'external'` is usually used for server redirects to project folder. Example for `admin` project:

  *localhost config*  
  ```js
  localhost: {
    webserver: {
      root: 'build'
      proxies: true
      port: 7201
    }
  }
  ```

  *nginx*  
  ```js
  location /admin {
    include /etc/nginx/conf.d/auth.conf;
     try_files $uri @admin;
  }
    
  location @admin {
    rewrite .* /admin/index.html break;
  }
  ```
  
- **system** (`String`)  
  Default: `'angularAmd'`  
  Shorcuts for module wrapper. Can be:

  **amd**  
  **`http:`** `define("<%= name %>", [], function(){ var cache = window.lib.Cache("resource"); <%= contents %> });`  
  **`template:`** `define("<%= name %>", [], function(){ var cache = window.lib.Cache("resource"); <%= contents %> });`
  
  **angularAmd**  
  **`http:`** `define("<%= name %>", ["app"], function(app){ app.run(["$cacheFactory", function($cacheFactory) {var cache = $cacheFactory.get("$http"); <%= contents %> }]); });`  
  **`template:`** `define("<%= name %>", ["app"], function(app){ app.run(["$templateCache", function(cache) {<%= contents %> }]); });`

  **angular**  
  **`http:`** `angular.module("<%= name %>").run(["$cacheFactory", function($cacheFactory) {var cache = $cacheFactory.get("$http"); <%= contents %> }]);`  
  **`template:`** `angular.module("<%= name %>").run(["$templateCache", function(cache) {<%= contents %> }]);`

  or *custom wrappers object* (`<%= name %>` is name of http or template cache module)  
  ```js
  {
    http: '<wrapper for http cache>'
    template: '<wrapper for template cache>'
  }
  ```

  See [gulp-resource-cache](https://github.com/tamtakoe/gulp-resource-cache) config

- **templatePathPrefix** (`String`)  
  Default: `''`  
  Prefix for templates paths

- **httpPathPrefix** (`String`)  
  Default: `''`  
  Prefix for http url paths

- **templateCacheModule** (`String`)  
  Name of module with template cache

- **httpCacheModule** (`String`)  
  Name of module with http cache

- **wrapScript** (`String`)  
  Wrapper for each module script. F.e.:  
  ```js
  vendor: {
    xlsxAmd: {
      rev: false,
      root: 'vendor/js-xlsx/dist',
      wrapScript: 'define(["JSZip"], function(JSZip) {<%= contents %> window.XLSX = XLSX; return XLSX;})',
      scripts: ['xlsx.js']
    }
  }
  ```

- **scripts** (`Array` of `String`)  
  Array with paths of projects scripts (js)

- **templates** (`Array` of `String`)  
  Array with paths of projects templates

- **styles** (`Array` of `String`)  
  Array with paths of projects styles

- **httpCache** (`String`)  
  Array with urls which will be requested and cached to framework cache. It useful for small resources like languages or city lists

- **templateName** (`String`)  
  Default: `'template.html'`  
  Name of template related to the script

- **styleName** (`Array` of `String`)  
  Default: `['style.css', 'style.styl', 'style.less', 'style.scss', 'style.sass']`  
  Array names of styles related to the script

- **filesDir** (`String`)  
  Default: `'files'`  
  Name of files folder

- **rev** (`Boolean`)  
  Default: `true`  
  Uglify filename to md5 of content

- **uglifyJs** (`Boolean`/`Object`)  
  Default: `false`  
  [UglifyJS](https://github.com/terinjokes/gulp-uglify) config

- **minifyHtml** (`Boolean`/`Object`)  
  Default: `true` (`{empty: true, spare: true, loose: true}`)  
  [minifyHtml config](https://github.com/murphydanger/gulp-minify-html)

- **minifyCss** (`Boolean`/`Object`)  
  Default: `false`  
  [minifyCss config](https://github.com/murphydanger/gulp-minify-css)

- **autoprefixer** (`Boolean`/`Object`)  
  Default: `false`  
  [autoprefixer config](https://github.com/postcss/autoprefixer#options)

- **includeCss** (`Boolean`)  
  Default: `true`  
  Include CSS to JS

- **cssImport** (`Object`)  
  Default: `{}`  
  Replace `@import` on the css content. See [cssimport config](https://github.com/unlight/gulp-cssimport)

- **inlineImgToCss** (`Boolean`/`Object`)  
  Default: `true` (`baseDir: <baseUrl>, maxImageSize: Infinity, exclude: [new RegExp('^[\"\']?((http|https|\/\/)|\/?' + <filesDir> +  ')')]`)  
  Inline resources to css in base64. See [base64 config](https://github.com/Wenqer/gulp-base64)

- **stylus** (`Object`)  
  Default: `{'include-css': true}`  
  [stylus config](https://github.com/stevelacy/gulp-stylus)

- **sass** (`Object`)  
  Default: `{}`  
  [sass config](https://github.com/sass/node-sass#options)

- **scss** (`Object`)  
  Default: `{}`  
  [scss config](https://github.com/sass/node-sass#options)

- **less** (`Object`)  
  Default: `{}`  
  [less config](http://lesscss.org/#using-less-configuration)

- **annotate** (`Object`)  
  Default: `{}`  
  [angular annotate config](https://github.com/tamtakoe/gulp-ng-annotate-plus)


## License

© Oleg Istomin 2015.
Released under the MIT license

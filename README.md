# node-arjs-builder [![NPM version](https://badge.fury.io/js/arjs-builder.svg)](http://badge.fury.io/js/arjs-builder)

> Builder for Angular + RequireJS projects

## Install with [npm](npmjs.org)

```sh
npm install arjs-builder
```

## Usage
Example of application structure. Also see [node-projects-config documentations](https://github.com/tamtakoe/node-projects-config)
```
_configs/      * local configs
public/
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

##### localConfigsPath
Type: `String`

Default: `process.cwd() + '/_configs'`

Folder for local configs.

##### karmaConfigPath
Type: `String`

Default: `process.cwd() + '/karma.conf.js'`

Path to Karma config

##### publicPath
Type: `String`

Default: `process.cwd() + '/public'`

Root folder for projects etc.

##### configsDir
Type: `String`

Default: `'*/_config'`

[Glob](https://github.com/isaacs/node-glob)-pattern for project config folders.

##### compiledDir
Type: `String`

Default: `'compiled'`

Folder for compiled files for local work (styles, compiled vendors)

##### buildDir
Type: `String`

Default: `'build'`

Folder for builded files

##### filesDir
Type: `String`

Default: `'files'`

Assets (big images, fonts, video) which don't include into css-files. Better to store on a separate file server

##### maxListeners
Type: `Number`

Default: `100`

Set `EventEmitter._maxListeners`. Increase this value if there are EventEmitter errors of build of big project


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
        modules: { ... }
    },
    vendor: { ... },
}
```

####public####

Config for web. This will be export to `window.project.config`

```js
{
    resources: {
        api: '//my-site/api/v1'
    }
}
```

####localhost####

Config development on local device.

####webserver####

Config for local webserver. May be array of configs for several servers. See [node-webserver-lite documentation](https://github.com/tamtakoe/node-webserver-lite)

```js
{
    root: 'build',
    port: 7200,
    livereload: true
}
```

####manifest####

List of resources which will be included to index.html as link or scripts tags.
Paths for builded files add to manifest of builded projects.
You can see current project manifest (with extra fields) in `window.project`

```js
//localhost manifest
{
    resources: {
        js: [{ //only for localhost
            'src': 'vendor/requirejs/require.js'
            'data-main': 'main/requireconfig'
        }],
        css: [
            '//fonts.googleapis.com/css?family=Open+Sans:300italic,300,700,600,400&subset=cyrillic-ext,latin-ext',
            'compiled/main/vendor/bootstrap.css', //only for localhost. You can include vendor's styles to vendor module
            'compiled/main/style.css', //only for localhost
        ]
}
```

####modules, vendor####

`modules` and `vendor` is a map with modules configs. Configs from `modules` merge on corresponding modules with `<every module params>`

```js
//build
{
    styles: [
        'main/import.styl' //add to each module including vendor and common
    ],
    inlineImgToCss: true,
    includeCss: true,
    uglifyJs: false,
    
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
```js
//vendor. You can compile custom bundles of vendors
{
    angularStrap: { //module name to compiled directory
        rev: false, //don't uglify module name
        templateCacheModule: 'angularStrap',
        root: 'vendor/angular-strap/src',
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
        ]
    }
}   
```

## License

© Oleg Istomin 2015.
Released under the MIT license
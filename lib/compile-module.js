var path                  = require('path');
var through               = require('through2');
var series                = require('stream-series');
var gulp                  = require('gulp');
var gulpBase64            = require('gulp-base64');
var gulpIf                = require('gulp-if');
var gulpClipEmptyFiles    = require('gulp-clip-empty-files');
var gulpCssimport         = require('gulp-cssimport');
var gulpMinifyCss         = require('gulp-minify-css');
var gulpAmd               = require('gulp-amd');
var gulpMark              = require('gulp-mark');
var gulpAutoprefixer      = require('gulp-autoprefixer');
var gulpMinifyHtml        = require('gulp-minify-html');
var gulpCssToJs           = require('gulp-css-to-js');
var gulpAddImportedStyles = require('gulp-add-imported-styles');
var gulpNgAnnotate        = require('gulp-ng-annotate-plus');
var gulpWrap              = require('gulp-wrap');
var gulpUglify            = require('gulp-uglify');
var gulpCssPreprocessor   = require('gulp-css-preprocessor');
var gulpRemoteSrc         = require('gulp-remote-src');
var gulpResourceCache     = require('gulp-resource-cache');

function addToArray(array, value) {
    return through.obj(function(file, enc, callback) {
        array && array.push(value);

        callback(null, file);
    });
}

function compileModule(name, params) {
    var cwd = path.join(params.baseUrl, params.root);

    //Scripts and configs
    var configStream = through.obj();
    var scriptsContentStream = through.obj();
    var scriptsSrcStream   = gulp.src(params.scripts, {cwd: cwd});

    for (var i = 0; i < params.scriptsContents.length; i++) {
        scriptsContentStream.push(params.scriptsContents[i]);
    }
    scriptsContentStream.end();

    var uglifyJsConfig = params.uglifyJs === true ? {} : params.uglifyJs;

    params.stylus.import = resolvePathArr(params.stylesImport, cwd);

    function resolvePathArr(paths, cwd) {
        paths = paths || [];
        var result = [];

        paths.forEach(function(link) {
            result.push(path.resolve(cwd || '', link));
        });

        return result;
    }

    var scriptsStream = series(scriptsSrcStream, scriptsContentStream)
        .pipe(gulpNgAnnotate(params.annotate))
        .pipe(gulpIf(!!params.wrapScript, gulpWrap(params.wrapScript || '<%= contents %>')))
        .pipe(gulpIf(!!params.uglifyJs, gulpUglify(uglifyJsConfig)))
        .pipe(gulpMark.set('script'))
        .pipe(gulpMark.set('config', name + '/' + params.indexFile))
        .pipe(gulpMark.separate('config', configStream));

    //Http
    var httpTemplates = {
        'amd':        'define("<%= name %>", [], function(){ var cache = window.lib.Cache("resource"); <%= contents %> });',
        'angularAmd': 'define("<%= name %>", ["app"], function(app){ app.run(["$cacheFactory", function($cacheFactory) {var cache = $cacheFactory.get("$http"); <%= contents %> }]); });',
        'angular':    'angular.module("<%= name %>").run(["$cacheFactory", function($cacheFactory) {var cache = $cacheFactory.get("$http"); <%= contents %> }]);'
    };

    var httpPath = params.project + '/' + name + '/http';

    if (params.httpCacheModule) {
        params.system = 'angular';
    }

    var http = httpTemplates[params.system] || params.system.http;

    var httpCacheStream = gulpRemoteSrc(params.httpCache || [], {base: ''})
        .pipe(gulpResourceCache({root: params.httpPathPrefix, base: cwd, wrapperTpl: http, data: {name: params.httpCacheModule || httpPath}}))
        .pipe(addToArray(params.amdNames, httpPath))
        .pipe(gulpIf(!!params.uglifyJs, gulpUglify(uglifyJsConfig)))
        .pipe(gulpMark.set('http'));

    //Templates
    var templates = {
        'amd':        'define("<%= name %>", [], function(){ var cache = window.lib.Cache("resource"); <%= contents %> });',
        'angularAmd': 'define("<%= name %>", ["app"], function(app){ app.run(["$templateCache", function(cache) {<%= contents %> }]); });',
        'angular':    'angular.module("<%= name %>").run(["$templateCache", function(cache) {<%= contents %> }]);'
    };

    var templatesPath = params.project + '/' + name + '/templates';

    if (params.templateCacheModule) {
        params.system = 'angular';
    }

    var template = templates[params.system] || params.system.template;

    var minifyHtmlDefaultConfig = {
        empty: true,
        spare: true,
        loose: true
    };
    var minifyHtmlConfig = params.minifyHtml === true ? minifyHtmlDefaultConfig : params.minifyHtml;
    var templatesStream = gulp.src(params.templates, {cwd: cwd})
        .pipe(gulpIf(!!params.minifyHtml, gulpMinifyHtml(minifyHtmlConfig)))
        .pipe(gulpResourceCache({root: params.templatePathPrefix, base: cwd, wrapperTpl: template, data: {name: params.templateCacheModule || templatesPath}}))
        .pipe(addToArray(params.amdNames, templatesPath))
        .pipe(gulpIf(!!params.uglifyJs, gulpUglify(uglifyJsConfig)))
        .pipe(gulpMark.set('template'));


    //Styles
    var base64DefaultConfig = {
        baseDir: params.baseUrl,
        maxImageSize: Infinity,
        exclude: [new RegExp('^[\"\']?((http|https|\/\/)|\/?' + params.filesDir +  ')')] //external and files folder
    };


    var autoprefixerBrowsers = (params.manifest && params.manifest.browsers || []).filter(function(browser) {
        return !(browser.toLowerCase().indexOf('phantomjs') + 1);
    });
    var autoprefixerConfig = params.autoprefixer === true ? {browsers: autoprefixerBrowsers} : params.autoprefixer;
    var minifyCssConfig = params.minifyCss === true ? {} : params.minifyCss; //{keepBreaks:true}
    var base64Config = params.inlineImgToCss === true ? base64DefaultConfig : params.inlineImgToCss;

    var stylesStream = gulp.src(params.styles, {cwd: cwd})
        .pipe(gulpClipEmptyFiles())
        .pipe(gulpAddImportedStyles({name: name, exclude: ['css'], cwd: cwd}))
        .pipe(gulpCssPreprocessor(params))
        .pipe(gulpCssimport(params.cssImport))
        .pipe(gulpIf(!!params.autoprefixer, gulpAutoprefixer(autoprefixerConfig)))
        .pipe(gulpIf(!!params.minifyCss, gulpMinifyCss(minifyCssConfig)))
        .pipe(gulpIf(!!params.inlineImgToCss, gulpBase64(base64Config)))
        .pipe(gulpIf(!!params.includeCss, gulpCssToJs()))
        .pipe(gulpMark.set('style'));


    //All
    return series(scriptsStream, httpCacheStream, templatesStream, configStream, stylesStream)
        .pipe(gulpMark.after('http',     gulpMark.if('config', gulpAmd({add: httpPath}))))
        .pipe(gulpMark.after('template', gulpMark.if('config', gulpAmd({add: templatesPath}))));
}

module.exports = compileModule;
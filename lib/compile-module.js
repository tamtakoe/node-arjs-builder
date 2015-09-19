var path                     = require('path');
var through                  = require('through2');
var series                   = require('stream-series');
var gulp                     = require('gulp');
var gulpBase64               = require('gulp-base64');
var gulpIf                   = require('gulp-if');
var gulpClipEmptyFiles       = require('gulp-clip-empty-files');
var gulpCssimport            = require('gulp-cssimport');
var gulpMinifyCss            = require('gulp-minify-css');
var gulpAmd                  = require('gulp-amd');
var gulpMark                 = require('gulp-mark');
var gulpAutoprefixer         = require('gulp-autoprefixer');
var gulpMinifyHtml           = require('gulp-minify-html');
var gulpCssToJs              = require('gulp-css-to-js');
var gulpAddImportedStyles    = require('gulp-add-imported-styles');
var gulpAngularTemplatecache = require('gulp-angular-templatecache');
var gulpNgAnnotate           = require('gulp-ng-annotate-plus');
var gulpWrap                 = require('gulp-wrap');
var gulpUglify               = require('gulp-uglify');
var gulpCssPreprocessor      = require('gulp-css-preprocessor');

var ANGULAR_MODULE = 'app';

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
        .pipe(gulpMark.set('config', name + '/config.js'))
        .pipe(gulpMark.separate('config', configStream));


    //Templates
    var TEMPLATE_HEADER = 'define("' + name + '/templates", ["<%= module %>"], function(<%= module %>){ <%= module %>.run(["$templateCache", function($templateCache) {';
    var TEMPLATE_FOOTER = '}]) });';

    if (params.templateCacheModule) {
        TEMPLATE_HEADER = 'angular.module("<%= module %>").run(["$templateCache", function($templateCache) {';
        TEMPLATE_FOOTER = '}]);';
    }

    var minifyHtmlDefaultConfig = {
        empty: true,
        spare: true,
        loose: true
    };
    var minifyHtmlConfig = params.minifyHtml === true ? minifyHtmlDefaultConfig : params.minifyHtml;
    var templatesStream = gulp.src(params.templates, {cwd: cwd})
        .pipe(gulpIf(!!params.minifyHtml, gulpMinifyHtml(minifyHtmlConfig)))
        .pipe(gulpAngularTemplatecache(name + '/templates.js', {
            module: params.templateCacheModule || ANGULAR_MODULE,
            root: params.templatePathPrefix,
            base: cwd,
            templateHeader: TEMPLATE_HEADER,
            templateFooter: TEMPLATE_FOOTER
        }))
        .pipe(through.obj(function(file, enc, callback) {
            params.amdNames && params.amdNames.push(name + '/templates');

            callback(null, file);
        }))
        .pipe(gulpMark.set('template'));

    //Styles
    var base64DefaultConfig = {
        baseDir: params.baseUrl,
        maxImageSize: Infinity,
        exclude: [new RegExp('^[\"\']?((http|https|\/\/)|\/?' + params.filesDir +  ')')] //external and files folder
    };

    var minifyCssConfig = params.minifyCss === true ? {} : params.minifyCss; //{keepBreaks:true}
    var base64Config = params.inlineImgToCss === true ? base64DefaultConfig : params.inlineImgToCss;

    var stylesStream = gulp.src(params.styles, {cwd: cwd})
        .pipe(gulpClipEmptyFiles())
        .pipe(gulpAddImportedStyles({name: name, exclude: ['css'], cwd: cwd}))
        .pipe(gulpCssPreprocessor(params))
        .pipe(gulpCssimport(params.cssImport))
        .pipe(gulpIf(!!params.autoprefixer, gulpAutoprefixer(params.autoprefixer)))
        .pipe(gulpIf(!!params.minifyCss, gulpMinifyCss(minifyCssConfig)))
        .pipe(gulpIf(!!params.inlineImgToCss, gulpBase64(base64Config)))
        .pipe(gulpIf(!!params.includeCss, gulpCssToJs()))
        .pipe(gulpMark.set('style'));


    //All
    return series(scriptsStream, templatesStream, configStream, stylesStream)
        .pipe(gulpMark.after('template', gulpMark.if('config', gulpAmd({add: name + '/templates'}))));
}

module.exports = compileModule;
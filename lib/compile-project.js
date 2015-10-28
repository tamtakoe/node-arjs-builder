var path          = require('path');
var through       = require('through2');
var _             = require('lodash');
var gulpIf        = require('gulp-if');
var gulpData      = require('gulp-data');
var gulpRev       = require('gulp-rev');
var merge         = require('merge-stream');
var amd           = require('amd-parser2');
var msg           = require('gulp-msg');
var gulpMark      = require('gulp-mark');
var utils         = require('./utils');
var compileModule = require('./compile-module');

var defaults = {
    //project:             undefined,
    //baseUrl:             undefined,
    //index:               undefined, //false/true/'external'
    //sortIndex:           undefined,
    root:                '',
    system:              'angularAmd',
    templateCacheModule: false,
    httpCacheModule:     false,
    wrapScript :         false,
    scripts:             [],
    templates:           [],
    styles:              [],
    scriptsContents:     [],
    templatesContents:   [],
    stylesContents:      [],
    templateName:        'template.html',
    styleName:           ['style.css', 'style.styl', 'style.less', 'style.scss', 'style.sass'],
    templatePathPrefix:  '',
    httpPathPrefix:      '',
    filesDir:            'files',
    rev:                 true, //uglify filename
    uglifyJs:            false,
    minifyHtml:          false,
    minifyCss:           false,
    autoprefixer:        false,
    includeCss:          true,
    cssImport:           {},
    stylus:              {'include-css': true},
    sass:                {},
    less:                {}
};

function compileProject(baseUrl, options) {
    options = _.merge({}, options);
    options.baseUrl = baseUrl;

    var modules = _.merge({}, options.modules);
    var modulesStreamCache = {};

    _.forEach(modules, function(module) {
        _.defaults(module, options, defaults);
    });

    function transform(file, enc, callback) {
        var projectInfo = utils.projectInfoFromPath(file.path, options.baseUrl, options);
        var dirPath     = projectInfo.dirPath;
        var moduleName  = projectInfo.moduleName;
        var amdObj      = amd.parse(file).get();

        file.data                 = file.data || {};
        file.data.amdName         = amdObj.name;
        file.data.amdDependencies = amdObj.dependencies;

        modules[moduleName] = _.merge({amdNames: [], amdDependencies: []}, defaults, projectInfo.defaults, options, modules[moduleName]); //_.defaults doesn't work
        modules[moduleName].templatePathPrefix = '/';
        modules[moduleName].scriptsContents.push(file);
        modules[moduleName].templates.push(path.join(dirPath, modules[moduleName].templateName));

        var styleNames = modules[moduleName].styleName instanceof Array ? modules[moduleName].styleName : [modules[moduleName].styleName];

        styleNames.forEach(function(styleName) {
            modules[moduleName].styles.push(path.join(dirPath, styleName));
        });

        if (amdObj.name) {
            modules[moduleName].amdNames.push(amdObj.name);
        }

        callback();
    }

    function flush(generalCallback) {
        var generalStream    = this;
        var stream = merge();

        _.forEach(modules, function(module, name) {
            module.module = name;

            if (module.styleOnly) {
                module.scriptsContents = [];
                module.scripts = [];
                module.templates = [];
            }

            var moduleStream;

            if (module.cache && module.cache !== name && modulesStreamCache[name]) {
                moduleStream = modulesStreamCache[name];
            } else {
                moduleStream = compileModule(name, module)
                    .pipe(gulpMark.concat(getConcatOptions(name, module.includeCss)))
                    .pipe(gulpData(function() {
                        return module; //copy module options to file.data
                    }))
                    .pipe(msg.info('<%= file.basename %> is compiled'))
                    .pipe(gulpIf(module.rev, gulpRev()))
                    .pipe(moveToProjectFolder())
                    .pipe(createOnloadEvent());

                modulesStreamCache[name] = moduleStream;
            }

            stream.add(moduleStream);
        });

        stream
            .pipe(gulpIf(!!options.combine, gulpMark.concat(getConcatOptions(options.combine, options.includeCss))))
            .pipe(through.obj(function(file, enc, callback){
                callback(null, file);
                generalStream.push(file);
            }, function(callback) {
                callback();
                generalCallback();
            }))
            .resume();
    }

    return through.obj(transform, flush);
}

function getConcatOptions(name, includeCss) {
    if (includeCss) {
        return [{path: name + '.js',  marks: ['script', 'http', 'template', 'config', 'style']}];
    } else {
        return [{path: name + '.js',  marks: ['script', 'http', 'template', 'config']}, {path: name + '.css', marks: 'style'}];
    }
}

function moveToProjectFolder(base) {
    base = base || '/';

    function transform(file, enc, callback) {
        file.base = base;
        file.path = path.join(base, file.data.project || '', path.basename(file.path));

        callback(null, file);
    }

    return through.obj(transform);
}

function createOnloadEvent() {
    function transform(file, enc, callback) {
        if (path.extname(file.path) === '.js') {
            var content = file.contents.toString() + '\n' + 'lib.fireEvent("onload:' + file.data.module + '");';

            file.contents = new Buffer(content);
        }
        callback(null, file);
    }

    return through.obj(transform);
}

module.exports = compileProject;

module.exports.src = function(src, options) {
    var source = compileProject(src, options);

    process.nextTick(function() {
        return source.end();
    });
    return source;
};
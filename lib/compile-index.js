var path         = require('path');
var fs           = require('fs');
var through      = require('through2');
var gutil        = require('gulp-util');
var htmlMinifier = require('html-minifier');
var inline       = require('inline-source');
var git          = require('git-info-sync')(['branch', 'tag']);
var _            = require('lodash');

var projectConfigs     = {};
var defaultProjectConfig = {
    manifest: {
        resources: {
            js: []
        },
        requirejs: {//TODO: use requirejs.config.config and other fields
            baseUrl: '/',
            bundles: {},
            deps: []
        }
    }
};

function compileIndex(baseDir, options) {
    baseDir = baseDir || __dirname;
    options = options || {};
    options.configWrap = _.template(options.configWrap || 'window.manifests = <%= contents %>');

    var indexName    = options.indexName || 'index.html';

    function transform(file, enc, callback) {

        var moduleConfig    = file.data;
        var moduleName      = moduleConfig.module;
        var projectName     = moduleConfig.project;
        var projectConfig   = projectConfigs[projectName] = projectConfigs[projectName] || _.merge({}, defaultProjectConfig, moduleConfig);
        var projectPath     = projectConfig.index === true ? '' : projectName + '/';
        var fileName        = projectPath + path.basename(file.path);
        var fileExt         = path.extname(file.path).slice(1);
        var resources       = projectConfig.manifest.resources[fileExt] = projectConfig.manifest.resources[fileExt] || [];
        var sortIndex       = Number(moduleConfig.sortIndex);

        if (fileExt === 'js') {
            //requirejs config
            projectConfig.manifest.requirejs.bundles[projectPath + path.basename(file.path, '.js')] = moduleConfig.amdNames;

            fileName = { //for running files in order
                src: fileName,
                async: false
            };
        }

        //resources config. 0-100 - initial manifest, 100-200 - sorted files, 200-x - other files
        if (resources.length < 200) {
            resources.length = 200;
        }

        if (isNaN(sortIndex)) {
            resources.push(fileName);
        } else {
            resources[sortIndex + 100] = fileName;
        }

        callback(null, file);
    }

    function flush(callback) {
        var stream = this;
        var manifests = {};
        var indexContent = inline.sync(path.resolve(baseDir, indexName), { //read index.html
            compress: false,
            rootpath: baseDir
        });

        //populate manifests
        _.forEach(projectConfigs, function(projectConfig, projectName) {
            var manifest = projectConfig.manifest;

            manifest.deployment = {
                client: {
                    branch: git.branch,
                    tag: git.tag,
                    date: (new Date()).toISOString()
                }
            };
            manifest.requirejs.deps.push(projectName + '/bootstrap');

            manifest.resources = _.mapValues(manifest.resources, function(resource) {
                return _.compact(resource); //remove empty values
            });

            cacheTemplates(projectConfig.baseUrl, manifest.resources);

            if (projectConfig.index) {
                //Compile local index for each project
                var projectOptions = _.extend(projectConfig, options);
                var projectManifests = {};

                projectManifests[projectName] = manifest;

                var indexFile = compileProjectIndex(path.join('/', projectName, indexName), indexContent, projectManifests, projectOptions);

                stream.push(indexFile);

            } else {
                manifests[projectName] = manifest;
            }
        });

        //Compile global index
        var projectOptions = _.extend(projectConfigs.main, options);
        var indexFile = compileProjectIndex(path.join('/', indexName), indexContent, manifests, projectOptions);

        stream.push(indexFile);

        callback();
    }

    return through.obj(transform, flush);
}

function compileProjectIndex(projectIndexPath, content, manifests, options) { //include manifest and minify
    var COMPILED_REGEXP = /<script.*config.*?>[\s\S]*?(?:<\/script>)?/;
    var minifyHtml = !!options.minifyHtml;
    var minifierOptions = {
        removeComments: minifyHtml,
        removeCommentsFromCDATA: minifyHtml,
        collapseWhitespace: minifyHtml,
        conservativeCollapse: minifyHtml,
        preserveLineBreaks: minifyHtml,
        preventAttributesEscaping: minifyHtml,
        removeRedundantAttributes: minifyHtml,
        removeOptionalTags: minifyHtml,
        minifyJS: options.uglifyJs,
        minifyCSS: options.minifyCss
    };
    var scriptTag = '<script>' + options.configWrap({contents: JSON.stringify(manifests, null, 4)}) + '</script>';
    var compiledContent = content.replace(COMPILED_REGEXP, scriptTag);
    var minifiedContent = htmlMinifier.minify(compiledContent, minifierOptions);

    return new gutil.File({
        base: '/',
        contents: new Buffer(minifiedContent, 'utf8'),
        path: projectIndexPath
    });
}

function sortResources(unsorted, moduleOrder, sorted) {
    sorted = sorted || {};

    moduleOrder.forEach(function(module) {
        if (module !== '*') {
            addResource(module, unsorted, sorted);
        } else {
            _.forEach(unsorted, function(resources, module) {
                addResource(module, unsorted, sorted);
            });
        }
    });

    function addResource(module, unsorted, sorted) {
        _.forEach(unsorted[module], function(resource, ext) {
            sorted[ext] = sorted[ext] || [];

            sorted[ext].push(resource);

            delete unsorted[module];
        });
    }

    return sorted;
}

function cacheTemplates(baseUrl, resources) {
    if (!baseUrl || !resources.html) return;

    resources.cache = resources.cache || {};

    _.forEach(resources.html, function(htmlPath) {
        var filename = path.resolve(baseUrl, htmlPath);
        var content = fs.readFileSync(filename);

        if (content) {
            resources.cache[htmlPath] = content.toString().replace(/\s+/g, ' ').replace(/<!--.*?-->/g,'');
        }
    });
}

module.exports = compileIndex;
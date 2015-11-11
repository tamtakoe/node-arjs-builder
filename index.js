var fs              = require('fs');
var path            = require('path');
var events          = require('events');
var _               = require('lodash');
var through         = require('through2');
var series          = require('stream-series');
var del             = require('del');
var gulp            = require('gulp');
var gulpWatch       = require('gulp-watch');
var gulpWrap        = require('gulp-wrap');
var gulpRename      = require('gulp-rename');
var livereload      = require('gulp-livereload');
var msg             = require('gulp-msg');
var amdOptimize     = require('amd-optimize');
var configs         = require('projects-config');
var karma           = require('karma');
var WebServer       = require('webserver-lite');
var args            = require('get-gulp-args')();
var compileProject  = require('./lib/compile-project');
var compileIndex    = require('./lib/compile-index');
var utils           = require('./lib/utils');

process.env.NODE_ENV = args[0] || 'dev';
process.env.PROJECT  = args[1] || '*';

msg.Success('--', 'Enviroment: <%= env.NODE_ENV %>. Project: <%= env.PROJECT %>', '--');

var rootPath = process.cwd();
var defaults = {
    projectsPath:     path.join(rootPath, 'projects'),
    localConfigsPath: path.join(rootPath, 'configs'),
    karmaConfigPath:  path.join(rootPath, 'karma.conf.js'),
    configsDir:       '*/_config',
    compiledDir:      'compiled',
    buildDir:         'build',
    filesDir:         'files',
    vendorDir:        'vendor',
    maxListeners:     100,
    browsers:         ['chrome >= 35', 'ff >= 20', 'safari >= 7', 'ie >= 10', 'opera >= 12.10', 'android >= 4.4', 'ios >= 7', 'phantomjs >= 1.9']
};

function createBuilder(options) {
    var opts = _.defaults(options || {}, defaults);

    opts.configsPath  = path.join(opts.projectsPath, opts.configsDir);
    opts.compiledPath = path.join(opts.projectsPath, opts.compiledDir);
    opts.buildPath    = path.join(opts.projectsPath, opts.buildDir);
    opts.projectsDir  = path.basename(opts.projectsPath);

    events.EventEmitter.prototype._maxListeners = opts.maxListeners;

    configs.load(opts.configsPath, opts.localConfigsPath, {defaults: setProjectConfig});

    function setProjectConfig(env, projectName) {
        var publicConfig = this.public || {};

        publicConfig.project = projectName;

        var defaults = {
            project: projectName,
            localhost: {
                project: projectName,
                manifest: {
                    env: 'local',
                    name: projectName,
                    config: publicConfig,
                    browsers: opts.browsers
                }
            },
            build: {
                project: projectName,
                filesDir: opts.filesDir,
                manifest: {
                    env: env,
                    name: projectName,
                    config: publicConfig,
                    browsers: opts.browsers
                },
                copy: {
                    'favicon.ico': 'favicon.ico'
                }
            }
        };
        defaults.build.copy[opts.filesDir + '/**'] = opts.filesDir + '/';

        return defaults;
    }

    function config() {
        return configs.stream({name: 'manifests.js', section: 'localhost.manifest'})
            .pipe(gulpWrap('window.manifests = <%= contents %>'))
            .pipe(gulp.dest(opts.compiledPath));
    }

    function webserver() {
        var defaultSettings = {
            fallback: 'index.html',
            root: opts.projectsPath
        };

        var livereloadPort = 2300;

        function startWebServer(settings, name) {
            if (settings.root) {
                settings.root = path.resolve(opts.projectsPath, settings.root);
            }

            if (settings.livereload === true) {
                settings.livereload = livereloadPort++;
            }

            var webServer = new WebServer(_.defaults(settings, {segment: name}, defaultSettings));

            return webServer.start();
        }

        return configs.forEach('localhost.webserver', startWebServer)
            .pipe(msg.flush.info('', 'Webservers started!', '-'));
    }

    function compileStyles(params) {
        params = params || {};
        var projectsSrcCache = {};

        function compileProjectStyle(projectName, config, moduleName) {
            var projectSrcStream;

            if (projectsSrcCache[projectName] && projectsSrcCache[projectName].complete) {
                projectSrcStream = through.obj();

                projectsSrcCache[projectName].forEach(function(file) {
                    projectSrcStream.push(file);
                });

                projectSrcStream.end();
            } else {
                projectsSrcCache[projectName] = [];

                projectSrcStream = amdOptimize.src(projectName + '/bootstrap', {
                        baseUrl: opts.projectsPath,
                        configFile: path.join(opts.projectsPath, projectName, 'requireconfig.js')
                    })
                    .pipe(through.obj(function(file, enc, callback) {
                        projectsSrcCache[projectName].push(file);
                        callback(null, file);
                    }, function(callback) {
                        projectsSrcCache[projectName].complete = true;
                        callback();
                    }));
            }

            return projectSrcStream.pipe(msg.flush.info('', projectName + ' styles compiled', '-'))
                .pipe(compileProject(opts.projectsPath, _.merge({
                    styleOnly: true,
                    rev: false,
                    includeCss: false,
                    minifyCss: false,
                    combine: 'style',
                    styles: config.build.styles,
                    cache: moduleName
                }, opts)))
                .pipe(msg.flush.info('', projectName + ' styles compiled', '-'))
                .pipe(gulp.dest(path.join(opts.compiledPath, projectName)));
        }

        var totalStream = configs.forEach(function(config, projectName) {
            if (params.watch) {
                return gulpWatch(path.join(opts.projectsPath, projectName, '**', '!(*.html|*.js)'), function(file) {
                    var projectInfo = utils.projectInfoFromPath(file.path, opts.projectsPath, opts);

                    return compileProjectStyle(projectName, config, projectInfo.moduleName)
                        .pipe(livereload())
                        .pipe(msg.flush.note('Listening...'));
                });
            } else {
                return compileProjectStyle(projectName, config);
            }
        });

        return totalStream.pipe(msg.flush.info('', 'Styles compiled!', '-'));
    }

    function copy() {
        var streams = [], generalCopiesMap = {};

        configs.forEach(function(config, projectName) { //clean build folder
            del.sync(path.join(opts.buildPath, projectName, '**/!(index.html)')); //except index because it conflicts with livereload
        });

        configs.forEach(function(config, projectName) {
            if (config.build.index) { //copying for local projects
                streams = streams.concat(copy(config.build.copy, opts.projectsPath, path.join(opts.buildPath, projectName)));
            } else {
                _.extend(generalCopiesMap, config.build.copy);
            }
        });

        streams = streams.concat(copy(generalCopiesMap, opts.projectsPath, opts.buildPath)); //copying for other projects

        function copy(copiesMap, projectsPath, buildPath) {
            return _.map(copiesMap, function(dstPath, srcPath) {
                if (/\/$/.test(dstPath)) {
                    //copy directory
                    return gulp.src(path.join(projectsPath, srcPath))
                        .pipe(gulp.dest(path.join(buildPath, dstPath)));
                } else {
                    //copy file
                    return gulp.src(path.join(projectsPath, srcPath))
                        .pipe(gulpRename(dstPath))
                        .pipe(gulp.dest(buildPath));
                };
            });
        }

        return series.apply(series, streams);
    }

    function compileVendor() {
        var stream = through.obj();

        config()
            .on('end', function() {
                var totalStream = configs.forEach(function(config, projectName) {
                    if (!config.vendor) {
                        return;
                    }

                    return compileProject.src(opts.projectsPath,  _.merge({
                            modules: config.vendor
                        }, opts))
                        .pipe(gulp.dest(path.join(opts.compiledPath, projectName, opts.vendorDir)))
                        .pipe(msg.flush.info('', 'Vendor for <%= project %> is created', '-', config));
                });



                return totalStream
                    .pipe(msg.flush.info('', 'Vendors created!', '-'))
                    .pipe(through.obj(function(file, enc, cb) {cb(null, file);}, function(callback) {
                        callback();
                        stream.end();
                    }));
            });

        return stream;
    }

    function build() {
        var stream = through.obj();

        series(copy(), compileVendor())
            .on('end', function() {
                return configs.forEach(function(config, projectName) {
                        return amdOptimize.src(projectName + '/bootstrap', {
                                baseUrl: opts.projectsPath,
                                configFile: path.join(opts.projectsPath, projectName, 'requireconfig.js')
                            })
                            .pipe(compileProject(opts.projectsPath, _.merge(config.build, opts)))
                            .pipe(msg.flush.info('', 'Project <%= project %> is compiled', '-', config))
                    })
                    .pipe(compileIndex(opts.projectsPath, {configWrap: 'window.manifests = <%= contents %>'}))
                    .pipe(msg.flush.info('', 'Build for <%= env.NODE_ENV %> completed!', '-'))
                    .pipe(through.obj(function(file, enc, cb) {cb(null, file);}, function(callback) {
                        callback();
                        stream.end();
                    }))
                    .pipe(gulp.dest(opts.buildPath));
            });

        return stream;
    }

    function test(done) {
        var karmaConfigPath = opts.karmaConfigPath;
        var karmaConfig     = {
            frameworks: ['jasmine-jquery', 'jasmine', 'requirejs'],
            singleRun: true,
            plugins: [
                'karma-requirejs',
                'karma-jasmine',
                'karma-phantomjs-launcher',
                'karma-jasmine-jquery',
                'karma-ng-html2js-preprocessor',
                'karma-requirejs-preprocessor'
            ],
            requirejsPreprocessor: {
                config: {
                    baseUrl: '/base/' + opts.projectsDir + '/',
                    paths: {
                        angular: opts.vendorDir + '/angular/angular', //for no-angular projects
                        angularMocks: opts.vendorDir + '/angular-mocks/angular-mocks'
                    },
                    shim:  {
                        angularMocks: ['angular']
                    },
                    deps:  [
                        'angularMocks'
                    ]
                }
            },
            exclude: [
                opts.projectsDir + '/' + opts.vendorDir + '/**/*spec.js'
            ]
        };

        if (fs.existsSync(karmaConfigPath)) {
            karmaConfig.set = function(config) {
                _.merge(this, config, function(a, b) {
                    if (_.isArray(a)) {
                        return _.union(a, b);
                    }
                });
            };
            require(karmaConfigPath)(karmaConfig);
            delete karmaConfig.set;
        }

        var startKarmaServers = configs.reduceRight(function(next, config, projectName) {
            return function(err, result) {
                msg.Info('-', 'Start Karma-server for <%= project %>', '-', config);
                createKarmaServer(projectName, next).start();
            };
        }, done);

        startKarmaServers();

        function createKarmaServer(projectName, done) {
            if (!karmaConfig.browsers) {
                karmaConfig.browsers = ['PhantomJS'];
            }

            karmaConfig.files = [
                {pattern: opts.projectsDir + '/' + opts.vendorDir + '/**/*.js', included: false, watched: false},
                {pattern: opts.projectsDir + '/' + opts.compiledDir + '/' + projectName + '/**/*.js', included: false, watched: false},
                {pattern: opts.projectsDir + '/' + projectName + '/**/!(requireconfig).js', included: false},
                {pattern: opts.projectsDir + '/' + projectName + '/**/*.html', included: false},
                opts.projectsDir + '/' + opts.compiledDir +'/manifests.js',
                opts.projectsDir + '/lib.js',
                // needs to be last http://karma-runner.github.io/0.12/plus/requirejs.html
                opts.projectsDir + '/' + projectName + '/requireconfig.js'
            ];
            karmaConfig.preprocessors = {};
            karmaConfig.preprocessors[opts.projectsDir + '/' + projectName + '/**/*.html'] = 'ng-html2js';
            karmaConfig.preprocessors[opts.projectsDir + '/' + projectName + '/requireconfig.js'] = 'requirejs';

            return new karma.Server(karmaConfig, done);
        }
    }

    function watch() {
        livereload.listen();
        return compileStyles({watch: true});
    }

    function compile() {
        return series(config(), compileVendor(), compileStyles());
    }

    function run() {
        return series(webserver(), compile().pipe(msg.flush.note('Listening...')), watch());
    }

    return {
        config: config,
        webserver: webserver,
        watch: watch,
        compileStyles: compileStyles,
        copy: copy,
        compileVendor: compileVendor, //[config]
        compile: compile, //[config, compileVendor, compileStyles] order is important
        build: build, //[copy, compileVendor]
        test: test,
        run: run //[compile, webserver, watch]
    }
}

module.exports = createBuilder;
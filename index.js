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
    publicPath:       path.join(rootPath, 'public'),
    localConfigsPath: path.join(rootPath, 'configs'),
    karmaConfigPath:  path.join(rootPath, 'karma.conf.js'),
    configsDir:       '*/_config',
    compiledDir:      'compiled',
    buildDir:         'build',
    filesDir:         'files',
    maxListeners:     100
};

function createBuilder(options) {
    var opts = _.defaults(options || {}, defaults);

    opts.configsPath  = path.join(opts.publicPath, opts.configsDir);
    opts.compiledPath = path.join(opts.publicPath, opts.compiledDir);
    opts.buildPath    = path.join(opts.publicPath, opts.buildDir);

    events.EventEmitter.prototype._maxListeners = opts.maxListeners;

    configs.load(opts.configsPath, opts.localConfigsPath, {defaults: setProjectConfig});

    function setProjectConfig(env, projectName) {
        var publicConfig = this.public || {};

        publicConfig.project = projectName;

        return {
            project: projectName,
            localhost: {
                project: projectName,
                manifest: {
                    env: 'local',
                    name: projectName,
                    config: publicConfig
                }
            },
            build: {
                project: projectName,
                filesDir: opts.filesDir,
                manifest: {
                    env: env,
                    name: projectName,
                    config: publicConfig
                }
            }
        };
    }

    function config() {
        return configs.stream({name: 'manifests.js', section: 'localhost.manifest'})
            .pipe(gulpWrap('window.manifests = <%= contents %>'))
            .pipe(gulp.dest(opts.compiledPath));
    }

    function webserver() {
        var defaultSettings = {
            fallback: 'index.html',
            root: opts.publicPath
        };

        var livereloadPort = 2300;

        function startWebServer(settings, name) {
            if (settings.root) {
                settings.root = path.resolve(opts.publicPath, settings.root);
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
                    baseUrl: opts.publicPath,
                    configFile: path.join(opts.publicPath, projectName, 'requireconfig.js')
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
                .pipe(compileProject(opts.publicPath, {
                    styleOnly: true,
                    rev: false,
                    includeCss: false,
                    minifyCss: false,
                    combine: 'style',
                    styles: config.build.styles,
                    cache: moduleName
                }))
                .pipe(msg.flush.info('', projectName + ' styles compiled', '-'))
                .pipe(gulp.dest(path.join(opts.compiledPath, projectName)));
        }

        var totalStream = configs.forEach(function(config, projectName) {
            if (params.watch) {
                return gulpWatch(path.join(opts.publicPath, projectName, '**/!(.html, .js)'), function(file) {
                    var changedProjectInfo = utils.projectInfoFromPath(file.path, opts.publicPath);

                    return compileProjectStyle(projectName, config, changedProjectInfo.moduleName)
                        .pipe(livereload());
                });
            } else {
                return compileProjectStyle(projectName, config);
            }
        });

        return totalStream.pipe(msg.flush.info('', 'Styles compiled!', '-'));
    }

    function copy() {
        configs.forEach(function(config, projectName) { //clean build folder
            del.sync(path.join(opts.buildPath, projectName, '**/!(index.html)')); //except index because it conflicts with livereload
        });

        //copy favicon and files folder to build
        var faviconStream = gulp.src(path.join(opts.publicPath, '/favicon.ico'))
            .pipe(gulp.dest(opts.buildPath));

        var filesStream = gulp.src(path.join(opts.publicPath, opts.filesDir, '**/*'))
            .pipe(gulp.dest(path.join(opts.buildPath, opts.filesDir)));

        configs.forEach(function(config, projectName) {
            if (config.build.index) {
                faviconStream.pipe(gulp.dest(path.join(opts.buildPath, projectName)));
                filesStream.pipe(gulp.dest(path.join(opts.buildPath, projectName, opts.filesDir)));
            }
        });

        return series(faviconStream, filesStream);
    }

    function compileVendor() {
        var stream = through.obj();

        config()
            .on('end', function() {
                var totalStream = configs.forEach(function(config, projectName) {
                    if (!config.vendor) {
                        return;
                    }

                    return compileProject.src(opts.publicPath, {
                        modules: config.vendor
                    })
                        .pipe(gulp.dest(path.join(opts.compiledPath, projectName, 'vendor')))
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
                        baseUrl: opts.publicPath,
                        configFile: path.join(opts.publicPath, projectName, 'requireconfig.js')
                    })
                        .pipe(compileProject(opts.publicPath, config.build))
                        .pipe(msg.flush.info('', 'Project <%= project %> is compiled', '-', config))
                })
                    .pipe(compileIndex(opts.publicPath, {configWrap: 'window.manifests = <%= contents %>'}))
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
                    baseUrl: '/base/public/',
                    paths: {
                        angular: 'vendor/angular/angular', //for no-angular projects
                        angularMocks: 'vendor/angular-mocks/angular-mocks'
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
                'public/vendor/**/*spec.js'
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
                {pattern: 'public/vendor/**/*.js', included: false, watched: false},
                {pattern: 'public/compiled/' + projectName + '/**/*.js', included: false, watched: false},
                {pattern: 'public/' + projectName + '/**/!(requireconfig).js', included: false},
                {pattern: 'public/' + projectName + '/**/*.html', included: false},
                'public/compiled/manifests.js',
                'public/lib.js',
                // needs to be last http://karma-runner.github.io/0.12/plus/requirejs.html
                'public/' + projectName + '/requireconfig.js'
            ];
            karmaConfig.preprocessors = {};
            karmaConfig.preprocessors['public/' + projectName + '/**/*.html'] = 'ng-html2js';
            karmaConfig.preprocessors['public/' + projectName + '/requireconfig.js'] = 'requirejs';

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
        return series(compile(), webserver(), watch());
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
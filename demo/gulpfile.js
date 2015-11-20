var gulp = require('gulp');
var arjs = require('arjs-builder')();

gulp.task('build', arjs.build);
gulp.task('test', arjs.test);
gulp.task('default', arjs.run);
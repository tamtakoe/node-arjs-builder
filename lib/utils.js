var path = require('path');

function projectInfoFromPath(resourcePath, base) {
    var vendorMatch = resourcePath.match(/(.*)vendor/);

    if (vendorMatch) {
        base = vendorMatch[1];
    }

    var dirPath     = path.dirname(resourcePath),
        splitedPath = path.relative(base, resourcePath).split(path.sep),
        projectName = splitedPath.shift(),
        moduleName  = splitedPath.shift().replace('.js', ''),
        defaults    = {};

    if (!moduleName
        || moduleName  === 'app'
        || moduleName  === 'bootstrap'
        || projectName === 'vendor'
        || projectName === 'compiled') {

        moduleName = 'vendor';
        defaults.sortIndex = 0;
    }

    return {
        dirPath: dirPath,
        projectName: projectName,
        moduleName: moduleName,
        defaults: defaults
    };
}

module.exports = {
    projectInfoFromPath: projectInfoFromPath
};
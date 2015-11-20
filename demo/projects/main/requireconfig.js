require.config({
    baseUrl: '/',
    paths: {
        app: 'main/app',
        angular: 'vendor/angular/angular'
    },
    shim: {
        angular: {
            exports: 'angular'
        }
    },
    deps: ['main/bootstrap']
});

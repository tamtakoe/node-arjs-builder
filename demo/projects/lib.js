var lib = (function() {
    //Common
    function extend(){
        for(var i = 1; i < arguments.length; i++)
            for(var k in arguments[i])
                if(arguments[i].hasOwnProperty(k))
                    arguments[0][k] = arguments[i][k];
        return arguments[0];
    }

    //Browser
    function Browser(supported, aliases) {
        this.aliases   = aliases   || {firefox: 'ff', explorer: 'ie', edge: 'ie'};
        this.supported = supported || ['chrome >= 35', 'ff >= 20', 'safari >= 7', 'ie >= 10', 'opera >= 12.10', 'android >= 4.4', 'ios >= 7', 'phantomjs >= 1.9'];
        this.info      = this.getInfo();
    }

    Browser.prototype.getInfo = function(ua){
        ua = ua || navigator.userAgent;

        var mathes = ua.match(/(opera|chrome|crmo|crios|phantomjs|safari|firefox|msie|trident(?=\/))\/?\s*([0-9.]+)/i) || [],
            browser = mathes[1],
            version = mathes[2] || '';

        if (/msie|trident/i.test(browser)) {
            mathes = /\brv[ :]+([0-9.]+)/g.exec(ua) || [];

            return ['Explorer', mathes[1] || version];
        }

        if (/chrome|crmo|crios/i.test(browser)) {
            mathes = ua.match(/\b(OPR|Edge)\/([0-9.]+)/);

            if (mathes) {
                return [mathes[1].replace('OPR', 'Opera'), mathes[2] || ''];
            }

            browser = 'Chrome';
        }

        if (/safari/i.test(browser)) {
            mathes = ua.match(/(android|mobile\/)\s*([0-9a-zA-Z.]+)/i);

            if (mathes) {
                if (/android/i.test(mathes[1])) {
                    return [mathes[1], mathes[2] || ''];

                } else {
                    browser = 'iOS';
                }
            }
        }

        mathes = ua.match(/version\/([0-9.]+)/i);

        if (mathes) {
            version = mathes[1];
        }

        return browser && version ? [browser, version] : [navigator.appName, navigator.appVersion || ''];
    };

    Browser.prototype.check = function(supported) {
        supported = supported || this.supported;

        var SIGN_REGEXP = /^(\w+) (>=?|<=?)\s*([\d\.]+)/;
        var currentBrowserName = this.info[0].toLowerCase();
        var currentBrowserVersion = parseFloat(this.info[1]);

        for (var i = 0, matches; i < supported.length; i++) {
            matches = supported[i].match(SIGN_REGEXP);

            var browserName = matches[1].toLowerCase();

            if (browserName === currentBrowserName || browserName === this.aliases[currentBrowserName]) {
                return checkVersion(currentBrowserVersion, matches[2], parseFloat(matches[3]));
            }
        }

        function checkVersion(version1, sign, version2) {
            switch (sign) {
                case '>':  return version1 >  version2;
                case '>=': return version1 >= version2;
                case '<':  return version1 <  version2;
                case '<=': return version1 <= version2;
            }
        }
    };

    //Class list
    function classList(element) {
        function updateClass(removedClass, addedClass) {
            return (element.className.replace(removedClass, '') + ' ' + addedClass || '').replace(/\s+/,' ');
        }

        return {
            add: function (addedClass) {
                element.className = updateClass(addedClass, addedClass);
            },
            remove: function (removedClass) {
                element.className = updateClass(removedClass);
            }
        };
    }

    //Flash message
    function FlashMessage() {
        this.messages = [];
        this.element = document.getElementById('flashMessage');
    }

    FlashMessage.prototype.addClass = function(className) {
        var element = this.element;

        ['ng-hide', 'error', 'warn', 'info'].forEach(function(className) {
            classList(element).remove(className);
        });

        if (className) {
            classList(element).add(className);
        }
    };

    FlashMessage.prototype.add = function(type, title, options) {
        options = options || {};
        console[type] && console[type]('FlashMessage:', title, options.description);

        var messages = this.messages;
        var message = {
            type: type,
            title: title,
            description: options.description,
            pin: options.pin,
            delay: options.delay || 7000
        };

        if (message.pin) {
            var messagesCount = messages.length;

            if (messagesCount) {
                if (message.title === messages[messagesCount - 1].title && message.description === messages[messagesCount - 1].description || messagesCount > 9) {
                    return;
                }
            } else {
                this.show(message);
            }

            messages.push(message);

        } else {
            if (messages[0] && !messages[0].pin) {
                clearTimeout(messages[0].timeoutId);
                messages[0] = message;

            } else {
                messages.unshift(message);
            }

            this.show(message);
        }
    };

    FlashMessage.prototype.show = function(message) {
        if (!message) {
            return;
        }

        var element = this.element;
        var close = this.close.bind(this);

        element.innerHTML = '';

        if (message.pin) {
            var closeElement = document.createElement('button');
            closeElement.innerHTML = '×';
            element.appendChild(closeElement);
            closeElement.onclick = close;
        } else {
            message.timeoutId = setTimeout(close, message.delay);
        }

        var textElement = document.createElement('div');
        textElement.innerHTML = '<p class="app-flashMessage-title">' + message.title + '</p>' + (message.description ? '<p class="app-flashMessage-description">' + message.description + '</p>' : '');

        element.appendChild(textElement);
        this.addClass(message.type);
    };

    FlashMessage.prototype.close = function() {
        var messages = this.messages;
        var element = this.element;

        messages.shift();

        element.innerHTML = '';
        this.addClass('ng-hide');
        this.show(messages[0]);
    };

    FlashMessage.prototype.error = function(title, options) {
        this.add('error', title, options);
    };

    FlashMessage.prototype.warn = function(title, options) {
        this.add('warn', title, options);
    };

    FlashMessage.prototype.info = function(title, options) {
        this.add('info', title, options);
    };

    //Cache factory
    var Cache = (function() {
        var caches = {};

        return function(cacheId, options) {
            cacheId = cacheId || '';
            options = options || {};

            var cache = {};

            function get(key) {
                return cache[key];
            }

            function put(key, value) {
                cache[key] = value;

                if (options.ttl) {
                    setTimeout(function() {
                        remove(key);
                    }, options.ttl);
                }
            }

            function load(data) {
                for (var key in data) {
                    if (data.hasOwnProperty(key)) {
                        put(key, data[key]);
                    }
                }
            }

            function remove(key) {
                delete cache[key];
            }

            function destroy() {
                delete caches[cacheId];
            }

            return caches[cacheId] = caches[cacheId] || {
                    get: get,
                    put: put,
                    load: load,
                    remove: remove,
                    destroy: destroy
                };
        };
    })();

    //Initialize
    var n = navigator;
    var systemLocale = (n.language || n.browserLanguage || n.systemLanguage || n.userLanguage || 'en').split('-').shift();
    var hash = window.location.hash.substr(1).split('=');
    var browser = new Browser();
    var resourceCache = Cache('resource', {ttl: 5000});

    //Config
    window.prerenderReady  = false;
    window.projectResolved = false;
    window.project = detectProject(browser);

    //DOM
    function setAttrs(element, attrs) {
        for (var k in attrs) {
            if (attrs.hasOwnProperty(k)) {
                element.setAttribute(k, attrs[k]); //doesn't set async property
                element[k] = attrs[k];
            }
        }
    }

    function appendElems(elements, elementType, defaultsAttrs, parent, templateFn, templateValue) {
        if (!elements || !elements.length) return;

        function appendHtml(data) {
            if (templateFn) {
                data = templateFn(data.replace(/\s/g, ' '))(templateValue);
            }
            (parent || document.body).innerHTML += data;
        }

        for (var i = 0; i < elements.length; i++) {
            var element = document.createElement(elementType);
            var attrs   = defaultsAttrs || {};

            if (elementType === 'script') {
                attrs.src = elements[i];
            }

            if (elementType === 'link') {
                attrs.href = elements[i];

                if (attrs.rel === 'import') {
                    var template = resourceCache.get(attrs.href);
                    element = null;

                    if (template !== undefined) {
                        appendHtml(template);

                    } else {
                        //TODO use parallel
                        ajax(attrs.href, appendHtml);
                    }
                }
            }

            if (elementType === 'template') {
                element = null;

                appendHtml(elements[i]);
            }


            if (typeof elements[i] === 'object') {
                attrs = elements[i];
            }

            if (element) {
                setAttrs(element, extend({}, defaultsAttrs, attrs));

                if (attrs.content) {
                    element.innerHTML = attrs.content;
                    delete attrs.content;
                }

                (function(element, parent) { //not block window.onload
                    setTimeout(function() {
                        (parent || document.getElementsByTagName('HEAD')[0]).appendChild(element);
                    }, 0);
                })(element, parent);
            }
        }
    }

    function ajax(options, success, error) {
        var header, xhr = new XMLHttpRequest();

        if (typeof options === 'string') {
            options = {url: options};
        }

        xhr.open('GET', options.url);

        for (header in options.headers || {}) {
            if (options.headers.hasOwnProperty(header)) {
                xhr.setRequestHeader(header, options.headers[header]);
            }
        }

        xhr.onreadystatechange = function(){
            if (this.readyState === 4) {
                if (this.status === 200) {
                    success && success(this.responseText);
                } else {
                    error && error(this.status);
                }
            }
        };
        xhr.send(null);
    }


    //Url
    function getUrlSegments(url) {
        return (url || location.pathname).match(/([^\/\?]+)/g) || [''];
    }


    //Events
    function fireEvent(name) {
        var project = window.project;

        if (name === 'onload:vendor' && require && project.requirejs) {
            require.config(project.requirejs); //run application
        }
    }

    //Deployment label
    function deploymentLabel(project) {
        var deployment   = project.deployment || {};
        var resources    = project.config.resources;
        var labelElement = document.getElementById('deploymentLabel');
        var closeElement = document.createElement('button');

        classList(labelElement).remove('ng-hide');

        closeElement.innerHTML = '×';
        labelElement.appendChild(closeElement);
        closeElement.onclick = function() {
            classList(labelElement).add('ng-hide');
        };

        if (deployment.client) {
            addLabel(labelElement, 'client', deployment.client.branch, project.env, deployment.client.date);
        }

        if (typeof resources === 'object') {
            for (var name in resources) {
                var resource = resources[name];

                if (resources.hasOwnProperty(name) && resource.info) {
                    (function(name) {
                        var options = {
                            url: resource.info,
                            headers: resource.login && btoa ? {Authorization: 'Basic ' + btoa(resource.login + ':' + resource.password)} : {}
                        };

                        ajax(options, function(data) {
                            deployment[name] = data = JSON.parse(data).deployment; //TODO move deployment to root

                            addLabel(labelElement, name, data.branch, data.env, data.date);
                        });
                    })(name);
                }
            }
        }

        function addLabel(parent, label, branch, env, date) {
            var element = document.createElement('p');
            var text = '<b>' + branch + (env ? ' [' + env + ']': '') + '</b>' + ' ' + (new Date(date)).toLocaleString();

            element.innerHTML = '<span class="app-deployment-label">' + label + '</span> <span class="app-deployment-info">' + text + '</span>';
            parent.appendChild(element);
        }
    }

    //Preloader
    function showPreloader() {
        classList(document.getElementById('bodyPreloader')).remove('ng-hide');
    }

    function hidePreloader() {
        classList(document.getElementById('bodyPreloader')).add('ng-hide');
    }

    function detectProject(browser) {
        var manifests   = window.manifests;
        var projectName = getUrlSegments()[0];
        var project     = manifests[projectName] || manifests.main;

        if (browser && !browser.check(project.browsers) && hash[0] !== 'compatible' && hash[1] !== 1) {
            project = manifests['old-browser'];
        }

        return project;
    }

    function loadResources() {
        var resources = window.project.resources || {};

        resourceCache.load(resources.cache);
        delete resources.cache;
        appendElems(resources.css,    'link',   {rel: 'stylesheet', type: 'text/css'});
        appendElems(resources.html,   'link',   {rel: 'import'}, document.getElementById('body'));
        appendElems(resources.js,     'script', {type: 'text/javascript'});
    }

    //On load
    window.onload = function() {
        var project = window.project;

        if (window.__karma__) {
            return;
        }

        loadResources();
        window.flashMessage = new FlashMessage();
        app.flashMessage = new FlashMessage();

        if (project.env !== 'production' && project.env !== 'local') {
            deploymentLabel(project);
        }

        //show cached templates after styles loading
        setTimeout(function() {
            classList(document.body).remove('rendering');
        }, 500);
    };

    var app = {
        systemLocale:     systemLocale,
        ajax:             ajax,
        browser:          browser,
        setAttrs:         setAttrs,
        extend:           extend,
        appendElems:      appendElems,
        classList:        classList,
        getUrlSegments:   getUrlSegments,
        detectProject:    detectProject,
        fireEvent:        fireEvent,
        loadResources:    loadResources,
        showPreloader:    showPreloader,
        hidePreloader:    hidePreloader,
        Cache: Cache
    };

    return app;
})();
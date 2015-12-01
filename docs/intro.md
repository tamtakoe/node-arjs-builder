##Intro

In recent years, the systems of build of web projects greatly evolved. Starting from the console utilities, Grunt, Gulp and ending WebPack.
The main problem of existing builders is excessive flexibility. Many people believe this is a advantage, but I see a problem.
The flexibility forces developers to read a lot of documentation (WebPack documentation is comparable by volume with JavaScript documentation), but also allows them to implement bad decisions.
An ideal builder cannot be created in isolation from the architecture of the project, so I will write about the basic architecture in a special section.


##Philosophy

1. The programmer must make a minimum number of steps to set up, develop and build the project.
   Ideally, He should only write the business logic. All settings are declarative.
   The best code generator — copy-paste. 90% of programmers are not a guru.
2. Do not create unnecessary problems. Do not use the new technologies only because they are new.
   Use technologies that are supported by the main browser (Chrome) in the development.
   Minimize the quantity of processes that are in the watch.
3. The builder is designed for large and medium-sized projects working in production.
   The result of the build should provide the fastest loading site.
 

##The build for the production
 
To determine the optimal structure of the built project, you need to analyze the structure of several large projects.
We will see that more than a half of the code includes library modules (Angular, jQuery, React, Bootstrap, etc.) that must be loaded before the application get started.
Before it was fashionable to connect every library in a separate script tag or take it from CDN, so it likely would be in the user's cache.
Now many libraries are modular and developers use their own build of these libraries, so the easiest way is to combine all the libraries and plugins in a single file.
It will be the biggest and the most rarely changing file in the project and it will hold just one browser stream.

The second important file/files is `common`, which describes the general logic and common styles of the entire project.
It is not possible to run the project without it and it changes rather rarely.
 
Further, there are 10-20 modules for pages and different business logic.
They often change, but weigh little (if the module is heavy, it means that the module contains inline pictures that should be in the file server).

Let's see how will pass the first loading of an average project (gzip enabled):

![network](https://raw.githubusercontent.com/tamtakoe/node-arjs-builder/master/docs/assets/network.png)

It is clearly seen while the vendor is loading all the resources of the project are almost loaded.
We conclude that even for a large project, there is no point in lazy loading of the modules.
Moreover, it will slow down the working of the site, because you will have to wait to download some really small file, if the user navigates to the other page (request of the first byte is very long).
Got rid of the necessity of the lazy load we just got rid of a headache with the connection of modules during the development. A double benefit. 
 
 
##The build for the development
 
The architecture of the project involves the use of AMD modules, because they are supported by the browser. Therefore, there is no need to build scripts in the development (no build — no headaches). Of course, this decision is also the fastest. For the same reason, none of HTML template engines is not supported. According to a reasonable approach for building of the application, you will not have templates of more than 100 lines, and the native HTML knows and reads any web developer. Only styles compile, besides css, less, sass, scss, stylus are supported. You don't need to put any plugins, everything works out of the box — just write code. 
The collector makes it easy to do builds for the libraries that support modularity (Bootstrap, Angular Bootstrap, jQuery, Moment, Lodash, etc.), just not to drag in the project unnecessary things. 
 
The basic architecture of the project 
The working directory of your app will have the following structure: 

```
projects/
├──project1/ 
├──project2/ 
├──project3/ 
├──files/ 
├──vendor/ 
├──compiled/ 
├──build/ 
├──index.html 
├──lib.js 
└──lib.css 
.bowerrc 
bower.json 
package.json 
gulpfile.js 
```

project1..3 — folders with projects. The project describes an isolated section of the site or a separate site. Projects can be written in different frameworks or without them. For projects can be used as a General index.html as well as their own. In the mid-level application will be a minimum of three projects: 
main — main site 
admin — admin panel 
old-browser — plug for older browsers, written in the most primitive JS 
 
In large applications, a lib project may appear which will contain the basic modules, which are used in other projects (routing, authorization, resource...). 
 
In the individual projects you should make a new version of the website (in order to arrange a smooth transition), Assembly for A/B testing, temporary landing GM pages, etc. 
 
Files are placed in files that will not be inserted in CSS (the candidates for transferring to the file server). The rest will be converted to base64 and added to the styles, even if it is a 2GB video. Because the project only describes the interface, the content should come from other places. 
In vendor libraries from bower are copied. 
In a compiled are temporary files for local work (styles, vendor libraries). 
In build there are the collected projects ready to download on the server. 
 
Example index.html you can find here. It, as well as gulpfile.js changes never. To add scripts into it or connect Analytics through an array of scripts in the config or in the corresponding module in the project 
 
In lib.js there is a microframework the most essential methods that should be available before the download of the main framework. Such as: the definition of the browser, the locale of the user, loading scripts, etc. The idea is that there should be no need to change this file, but until it is so tweaked to ensure it. 
 
Now let's consider a simplified structure of a single project: 

```
_config/
├──default.yaml 
├──dev.yaml 
└──production.yaml 
module1/ 
├──_tests 
├──someFolder1/ 
│ ├──some.js 
│ ├──style.sass 
│ └──template.html 
├──someFolder2/ 
└──config.js 
module2/ 
module3/ 
bootstrap.js 
requireconfig.js 
```

Let's go from the end. 
 
requireconfig.js — connect the library files to the project 
bootstrap.js — connect the project files. The standard scheme of work require.js 
module1..3 modules of the project. During the Assembly each module is collected in a separate file 
There are_tests in tests and they are related to files in the current folder. Tests deal with the files ending in spec.js. 
config.js describes the dependence of the corresponding module 
someFolder can have any structure  the most important point is that all dependencies must be described) 
If near the script file is template.html or style.s/.sass/.scss/.less/.stylus, they will be added to cache templates or Stoneley stylesheet. A very simple rule. The collector does not drag anything, and takes only what belongs to the script file in the order in which scripts are loaded. 
 
The most interesting _config 
Here are stored the configuration for different environments. Supported formats are json, json5, hjson, cson, yaml. As soon as the IDE starts to support json5, I will translate all the examples to it and leave it to be the only supported format. The common for all the environments settings are described in Default. Other configs ___________ to default. 
 
To build the project with the right config you need to specify the name of the first parameter

```
gulp --qa 
gulp build --production 
```

The default dev.
 
Configuration file structure:

```
{ 
    public: { ... }, //options available in the application through project.config
    localhost: {
        webserver: { ... }, //setup a local web server
        manifest: { ... } //add resources for local work
    },
    build: {
        /* General settings for all modules */
        ...
        manifest: { ... }, //add resources for the assembled project
        modules: { ... }, //individual settings for each module, for example, that vendor has contracted with the parameter mangle: true, and the style of the main module would be loaded as a separate file
        copy: { ... } //copied to the build of some files, for example robots.txt
    },
    vendor: { ... }, //settings for the build vendors. For example, you can collect bootstrap or angularStrap with its own set of components
} 
```

The config is probably the most difficult that is in the collector. It is better to look at the more difficult sample applications in order to imagine it, or the easy way - look everything in the documentation.
const cors = require('cors');
const express = require('express');
const serveStatic = require('serve-static');
var fs = require('fs');
var browserify = require('browserify');
var watchify = require('watchify');

var b = browserify("./frontend/index.js", {
        debug: true,
        cache: {},
        packageCache: {}
    }).ignore(['./frontend/js/jquery-ui-1.12.1', './frontend/js/jquery-3.4.1.min.js', 'jquery', "frontend/bootstrap-3.3.5-dist"]);

b.plugin(watchify);
b.transform("babelify", {
    presets: ["@babel/preset-env"], 
    plugins: ["@babel/plugin-transform-runtime"], 
    sourceMaps: true
}).bundle().pipe(fs.createWriteStream("frontend/bundle.js"));

b.on('update', bundle);
bundle();

function bundle() {
    b.bundle()
        .on('error', console.error)
        .pipe(fs.createWriteStream("frontend/bundle.js"));
}


let app = express();
app.use(cors());
app.options('*', cors());
app.use(serveStatic(__dirname))

app.listen(8080, "0.0.0.0", function(){
    console.log('Server running on 8080...');
});
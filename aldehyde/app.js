'use strict';

const shortid = require('shortid');
const fs = require('fs');
const hashFiles = require('hash-files');
const db = require('level-party')('./db');
const restify = require('restify');

function getChecksum(path) {
	return new Promise((resolve) => {
		hashFiles({ files: [path] }, (err, hash) => {
			if (!err)
				resolve(hash);
		});
	});
}

function objectExists(checksum) {
	return new Promise((resolve) => {
		db.get(checksum, (err, value) => resolve(value));
	});
}

var app = restify.createServer({
	name: 'aldehyde',
	version: '1.0.0'
});

app.listen(8081);

app.on('ResourceNotFound', (req, res, err, next) => {
    restify.serveStatic({
		'directory': './public/',
        'file': 'index.html'
    })(req, res, next);
});

app.get(/\/?.*/,(req, res, next) => {
    req.on('ResourceNotFound', (req, res, err, next) => {
		restify.serveStatic({
			'directory': './public/',
		})(req, res, next);
    });

    restify.serveStatic({
        'directory': './uploads/'
    })(req, res, next);
});

app.post('/upload', restify.multipartBodyParser(), (req, res) => {
	for (let index in req.files) {
        if (!req.files.hasOwnProperty(index))
			continue;
		
	    const file = req.files[index];

	    getChecksum(file.path)
	        .then(checksum => objectExists(checksum))
	        .then((object) => {
	            if (object) {
	                res.json({ url: object });

	                fs.unlinkSync(file.path);
	            } else {
	                let id = shortid.generate() + '.' + file.name.split('.').slice(1).join('.');

	                fs.renameSync(file.path, './uploads/' + id);

	                res.json({ url: id });

	                db.put(hashFiles.sync({ files: ['./uploads/' + id] }), id);
	            }
	        });
	}
});
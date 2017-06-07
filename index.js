#!/usr/bin/env node
var _ = require('lodash');
var cheerio = require('cheerio');
var Entities = require('html-entities').AllHtmlEntities;
var mkdirp = require('mkdirp');
var cmd=require('node-cmd');
function getVForPre(_str) {
	var str = _.trim(_str);
	var element, index, collection;
	var cursor = 0;
	var tokens = [];
	var len = str.length;
	for (var i = 0; i < len; ++i) {
		var temp = str[i];
		if (temp == ' ' && (i < len - 1) && (str[i + 1] != ' ')) {
			cursor++;
		} else {
			if (tokens[cursor]) {
				tokens[cursor] += temp;
			} else {
				tokens[cursor] = temp;
			}
		}
	}
	collection = tokens.pop();
	tokens.pop();
	var params = tokens.join(',');
	var code = `{ ${collection}.map((${params})=>(`;
	return code;
}

function parseFunction() {

}
function getJsx(vue) {
	var $ = cheerio.load(vue);
	var forElements = $('*[v-for]');
	forElements.each(function (index, element) {
		var el = $(element);
		var f = el.attr('v-for');
		el.removeAttr('v-for');
		el.before(getVForPre(f));
		el.after('))}');
	});
	var slots = $('*[slot]');
	slots.each(function (index, element) {
		var el = $(element);
		var slotName = el.attr('slot');
		el.removeAttr('slot');
		el[0].name = _.capitalize(slotName);
	});
	const entities = new Entities();
	vue = entities.decode($('body').html());
	vue = vue.replace(/class\=/g, 'className=');
	vue = vue.replace(/([\w|-]+)=/g, function (str) {
		return _.camelCase(str) + '=';
	});
	vue = vue.replace(/<\/?[\w|-]+/g, function (str) {
		if (str.indexOf('-') == -1) {
			return str;
		}
		var str = str.replace(/([\w|-]+)/g, function (_str) {

			var temp = _.camelCase(_str);
			if (temp.indexOf('el') == 0) {
				temp = (temp.slice(2));
			}
			return temp[0].toUpperCase() + temp.slice(1);
		});
		return str;

	});
	vue = vue.replace(/:[\w]+=[\"]{1}([^\"]+)[\"]{1}/g, function (str, match) {
		var arr = str.split('"');
		return arr[0].slice(1) + "{" + arr[1] + "} ";
	});
	vue = vue.replace(/\@[\w]+=[\"]{1}([^\"]+)[\"]{1}/g, function (str, match) {
		var arr = str.split('"');
		return arr[0].slice(1) + "{ this." + arr[1] + " } ";
	});
	vue = vue.replace(/{{/gi, function (str, match) {
		return '{';
	});
	vue = vue.replace(/}}/gi, function (str, match) {
		return '}';
	});
	vue = vue.replace(/vHtml=[\"]{1}([^\"]+)[\"]{1}/gi, function (str, match) {
		return `dangerouslySetInnerHTML={{__html:${match}}}`;
	});
	vue = vue.replace(/style=[\"]{1}([^\"]+)[\"]{1}/g, function (str, style) {
		var styleArr = style.split(';');
		var lastLine = styleArr.pop();
		if (_.trim(lastLine)) {
			styleArr.push(lastLine);
		}
		var obj = styleArr.map((line) => {

			var arr = line.split(':');
			var key = _.camelCase(_.trim(arr[0]));
			var value = _.trim(arr[1]);
			if (value.indexOf('"') != 0) {
				value = '"' + value + '"';
			}
			return key + ' : ' + value;
		}).join(', ');
		return `style={{${obj}}}`;
	});
	vue = vue.replace(/vIf=[\"]{1}([^\"]+)[\"]{1}/g, function (str, match) {
		return 'data-if={' + match + '}';
	});
	vue = vue.replace(/vShow=[\"]{1}([^\"]+)[\"]{1}/g, function (str, match) {
		return 'data-show={' + match + '}';
	});
	return vue;
}

var fs = require('fs');
var path = require('path');
var process = require('process');
function loadContent(fileName) {
	try {
		var content = fs.readFileSync(fileName);
		return content;

	} catch (e) {
		console.log('file path error');
	}
	return null;
}
function getVueTemplate(content) {

	var template = ((/\<template>([\W|\w|.|\s|\n]+)<\/template>/gi).exec(content))[1];
	return template;
}

function getStyle(content) {
	var style = ((/\<style[^>]*>([\W|\w|.|\s|\n]+)<\/style>/gi).exec(content));
	if (style) {
		return style[1];
	} else {
		return null;
	}
}
function getScript(content) {
	var js = ((/\<script[^>]*>([\W|\w|.|\s|\n]+)<\/script>/gi).exec(content));
	if (js) {
		return js[1];
	} else {
		return null;
	}
}
function work() {
	var fileName = process.argv[2];
	if (fileName) {
		var fileRealName = fileName.split('/').pop().split('.vue')[0];
		var to = process.argv[3] || fileRealName;
		var file = path.resolve(__dirname, fileName);
		var content = loadContent(file);
		var template = getVueTemplate(content);
		var jsx = getJsx(template);
		var style = getStyle(content);
		var js = getScript(content);
		mkdirp('./temp/' + to, function (err) {
			if (jsx) {
				fs.writeFileSync('./temp/' + to + '/index.jsx', jsx);
			}
			if (style) {
				fs.writeFileSync('./temp/' + to + '/index.scss', style);
			}
			if (js) {
				fs.writeFileSync('./temp/' + to + '/index.js', js);
			}
			cmd.run('code -n ' + path.resolve(__dirname, `./temp/${to}`));
		});
		
		console.log('finished');
	} else {
		console.log('error : no input filename');
	}

}
work();


var Runnable = require('./Runnable')
  , util = require('util')

/**
 * Defines a root node which are used to tie test execution back in locally or globally
 * RootNodes are also used to being and end the entire test suite
 *
 * @param {String} title Title of the runnable
 *
 * @constructor
 */
var RootNode = function (title) {
    RootNode.super_.call(this, title, function () {})
}

util.inherits(RootNode, Runnable)
module.exports = RootNode

RootNode.prototype.run = function () {
    this.emit('start')
    this.emit('finish')
}

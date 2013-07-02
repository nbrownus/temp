var Runnable = require('./Runnable')
  , util = require('util')

/**
 * Defines a beforeEach or afterEach function for all tests within a suite/child suites
 * EachHooks are cloned into each Test and run within their context
 *
 * @param {String} title Title of the hook
 * @param {function} func Function to execute for the hook
 *
 * @constructor
 */
var EachHook = function (title, func) {
    EachHook.super_.call(this, title, func)
}

util.inherits(EachHook, Runnable)
module.exports = EachHook

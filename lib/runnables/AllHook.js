var BaseRunnable = require('./BaseRunnable')
  , util = require('util')

/**
 * Defines a beforeAll or afterAll function for a suite
 *
 * @param {String} title Title of the hook
 * @param {function} func Function to execute for the hook
 *
 * @constructor
 */
var AllHook = function (title, func) {
    AllHook.super_.call(this, title, func)
}

util.inherits(AllHook, BaseRunnable)

module.exports = AllHook

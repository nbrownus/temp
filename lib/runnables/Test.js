var Runnable = require('./Runnable')
  , util = require('util')

/**
 * Defines an actual test
 *
 * @param {String} title Title of the hook
 * @param {function} func Function to execute for the hook
 *
 * @constructor
 */
var Test = function (title, func) {
    Test.super_.call(this, title, func)
}

util.inherits(Test, Runnable)
module.exports = Test

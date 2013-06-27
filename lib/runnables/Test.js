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

    this.only = false
    this.hooks = {
        before: []
      , after: []
    }
}

util.inherits(Test, Runnable)
module.exports = Test

/**
 * Marks this test as the only thing that should run
 * All suites/tests marked as only will run, everything else will show as skipped
 *
 * @returns {Test} This for chaining
 */
Test.prototype.setOnly = function () {
    this.only = true
    this.emit('only')
    return this
}


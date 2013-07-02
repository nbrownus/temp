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

/**
 * Clones the hook
 *
 * @returns {EachHook} The cloned hook
 */
EachHook.prototype.clone = function () {
    var hook = new EachHook(this.title, this.func)

    hook.skip = this.skip
    hook._timeout = this._timeout
    hook.exclusivity = this.exclusivity
    hook.parent = this.parent

    return hook
}

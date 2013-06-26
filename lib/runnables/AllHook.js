var Runnable = require('./Runnable')
  , Constants = require('../Constants')
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

util.inherits(AllHook, Runnable)
module.exports = AllHook

/**
 * Runs the AllHook
 */
AllHook.prototype.run = function () {
    var self = this

    if (self.state !== Constants.RUN_STATE.WAITING) {
        return
    }

    if (self.errors.length > 0) {
        self.complete()
        self.state = Constants.RUN_STATE.COMPLETED
        self.emit('finish')
        return
    }

    self.state = Constants.RUN_STATE.RUNNING
    self.emit('start')

    self.actualRun(function () {
        var suite
        self.state = Constants.RUN_STATE.COMPLETED

        if (self.errors.length > 0) {
            var suites = [this.parent]
              , error = new Error(self.fullTitle('/') + ' failed')

            while (suite = suites.pop()) {
                failRunnables(suite.runnables.beforeAll, error)
                failRunnables(suite.runnables.tests, error)
                failRunnables(suite.runnables.afterAll, error)
                suites = suites.concat(suite.suites)
            }
        }

        self.emit('finish')
    })

    function failRunnables (runnables, error) {
        runnables.forEach(function (runnable) {
            if (runnable.skip) {
                return
            }

            runnable.errors.push(error)
        })
    }
}

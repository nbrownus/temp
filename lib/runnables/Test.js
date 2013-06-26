var Runnable = require('./Runnable')
  , Constants = require('../Constants')
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

Test.prototype.addHooks = function (type, runnables) {
    var self = this

    runnables.forEach(function (runnable) {
        self.hooks[type].push(runnable.clone())
    })
}

/**
 * Run the test and every before each and after each
 */
Test.prototype.run = function () {
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

    self.state = Constants.RUN_STATE.BEFORE_HOOKS
    self.emit('start')

    self._eachHook(self.hooks.before, function () {
        console.log('running')
        self.state = Constants.RUN_STATE.RUNNING

        self.actualRun(function () {
            self.state = Constants.RUN_STATE.AFTER_HOOKS

            self._eachHook(self.hooks.after, function () {
                self.state = Constants.RUN_STATE.COMPLETED
                self.emit('finish')
            })
        })
    })
}

/**
 * Runs all the provided hooks in series
 * //TODO: Support exclusivity here
 *
 * @param {Array.<Runnable>} hooks Array of hooks to run
 * @param {function} callback A function to call when all hooks have completed
 *
 * @private
 */
Test.prototype._eachHook = function (hooks, callback) {
    var self = this
      , completed = 0

    if (hooks.length === 0 || self.errors.length > 0) {
        return callback()
    }

    var runHook = function (hook, innerCallback) {
        var next = true

        //TODO need to print the hook error out somehow
        hook.run(function () {
            if (hook.errors.length > 0) {
                self.complete(new Error(hook.fullTitle('/') + ' failed'))
                next = false
            }

            innerCallback(next)
        })
    }

    var nextHook = function () {
        runHook(hooks[completed], function (runNext) {
            if (runNext === false) {
                return callback()
            }

            completed += 1
            if (completed >= hooks.length) {
                callback()
            } else {
                nextHook()
            }
        })
    }

    nextHook()
}

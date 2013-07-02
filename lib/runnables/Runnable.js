var util = require('util')
  , Constants = require('../Constants')
  , EventEmitter = require('events').EventEmitter
  , domain = require('domain')

/**
 * Base runnable class, all runnables should extend this class
 *
 * @param {String} title Title of the runnable
 * @param {function} func Function to execute for the runnable
 *
 * @constructor
 */
var Runnable = function (title, func) {
    Runnable.super_.call(this)

    this.id = undefined
    this.title = title
    this.func = func
    this.skip = !func
    this.exclusivity = undefined
    this.parent = undefined
    this.async = func && func.length
    this.state = Constants.RUN_STATE.WAITING
    this.result = undefined
    this.error = undefined

    this._timeout = undefined

    this.priorRunnables = []
    this.nextRunnables = []
    this._completedPriors = 0
    this._totalPriors = 0

    this.dependencies = []

    this.setMaxListeners(0)
}

util.inherits(Runnable, EventEmitter)
module.exports = Runnable

/**
 * Adds other runnables as a prior for this runnable to run
 *
 * @param {Array.<Runnable>} priors An array of runnables
 */
Runnable.prototype.addPriorRunnables = function (priors) {
    var self = this

    if (!priors) {
        return
    }

    priors = (Array.isArray(priors)) ? priors : [priors]

    priors.forEach(function (runnable) {
        if (self.priorRunnables.hasOwnProperty(runnable.id)) {
            return
        }

        runnable.nextRunnables.push(self)
        self.priorRunnables[runnable.id] = runnable
        self._totalPriors++

        runnable.once('finish', function () {
            self._completedPriors++
            self.run()
        })
    })
}

/**
 * Sets an array of runnables as dependencies for this test to succeed
 * Used to cascade hook failures
 *
 * @param {Array.<Runnable>} dependencies An array of runnables
 */
Runnable.prototype.addDependencies = function (dependencies) {
    if (!dependencies) {
        return
    }

    dependencies = (Array.isArray(dependencies)) ? dependencies : [dependencies]
    this.dependencies = this.dependencies.concat(dependencies)
}

/**
 * No other runnables can run during a globally exclusive runnable
 *
 * @returns {Runnable} This for chaining
 */
Runnable.prototype.globallyExclusive = function () {
    this.exclusivity = Constants.EXCLUSIVITY.GLOBAL
    return this
}

/**
 * No sibling runnables can run during a locally exclusive runnable
 *
 * @returns {Runnable} This for chaining
 */
Runnable.prototype.locallyExclusive = function () {
    this.exclusivity = Constants.EXCLUSIVITY.LOCAL
    return this
}

/**
 * Any other sibling runnable that is also a non exclusive runnable can run together
 *
 * @returns {Runnable} This for chaining
 */
Runnable.prototype.nonExclusive = function () {
    this.exclusivity = Constants.EXCLUSIVITY.NONE
    return this
}

/**
 * Gets the full title of this runnable
 *
 * @param {String} [separator=' '] A separator to use between parents
 *
 * @returns {String} The full title
 */
Runnable.prototype.fullTitle = function (separator) {
    separator = separator || ' '
    var title = (this.parent) ? this.parent.fullTitle(separator) + separator : ''
    title += (this.title) ? this.title : ''
    return title
}

/**
 * Sets the timeout in milliseconds
 *
 * @param {Number} ms Number of milliseconds to wait before marking timing out
 *
 * @returns {Runnable} This for chaining
 */
Runnable.prototype.timeout = function (ms) {
    if (!arguments.length) {
        return this._timeout
    }

    this._timeout = ms
    return this
}

/**
 * Clears the timeout timer
 */
Runnable.prototype.clearTimeout = function () {
    clearTimeout(this.timer)
}

/**
 * Resets the timeout timer
 */
Runnable.prototype.resetTimeout = function () {
    var self = this

    self.clearTimeout()
    if (this._timeout) {
        this.timer = setTimeout(function () {
            self.complete(new Error('timeout of ' + self._timeout + 'ms exceeded'), Constants.RESULT.TIMEOUT)
        }, self._timeout)
    }
}

/**
 * Executes the runnable if all prior runnables have completed
 */
Runnable.prototype.run = function () {
    if (this._completedPriors < this._totalPriors) {
        return
    }

    var self = this
      , context = self.parent.context()

    self.dependencies.some(function (runnable) {
        if (runnable.result === Constants.RESULT.FAILURE || runnable.result === Constants.RESULT.TIMEOUT) {
            //TODO: Better errors, which hook type?
            self.complete(new Error(runnable.fullTitle('/') + ' dependency failed'), Constants.RESULT.HOOK_FAILURE)
            return true
        }
    })

    if (self.state !== Constants.RUN_STATE.WAITING) {
        return
    }

    self.domain = domain.create()
    self.startTime = Date.now()

    if (self.skip) {
        return self.complete(undefined, Constants.RESULT.SKIPPED)
    }

    self.domain.on('error', function (error) {
        self.complete(error)
    })

    self.emit('start')
    process.nextTick(function () {
        self.domain.run(function () {
            try {
                self.resetTimeout()
                self.state = Constants.RUN_STATE.RUNNING

                var returnValue = self.func.call(
                    context
                  , function (error) {
                        self.complete(error)
                    }
                )

                if (self._handlePromise(returnValue)) {
                    return
                }

                if (returnValue instanceof Error) {
                    return self.complete(returnValue)
                } else if (!self.async) {
                    return self.complete()
                }

            } catch (error) {
                return self.complete(error)
            }
        })
    })
}

/**
 * Completes the test
 *
 * @param {*} [error] An error, if there was one, to record for the test
 * @param {Number} [result] An override to the normal result value. Useful for timeout, skip, etc
 */
Runnable.prototype.complete = function (error, result) {
    var self = this

    if (self.state === Constants.RUN_STATE.COMPLETED) {
        if (self.result === Constants.RESULT.TIMEOUT) {
            return
        }

        //TODO: If we had an error already probably don't want to wipe it out
        self.error = error || new Error('done() called multiple times')
        self.result = Constants.RESULT.FAILURE
        return
    }

    if (error) {
        if (error instanceof Error === false) {
            error = new Error('done() invoked with non-Error: ' + JSON.stringify(error))
        }

        self.error = error
        result = result || Constants.RESULT.FAILURE
    } else {
        result = result || Constants.RESULT.SUCCESS
    }

    self.result = result
    self.state = Constants.RUN_STATE.COMPLETED
    self.clearTimeout()
    self.duration = (new Date - this.startTime) || 0

    if (self.domain) {
        self.domain.dispose()
    }

    self.emit('finish')
}

/**
 * Checks the return value from running the test for a promise and handles it if necessary
 *
 * @param {*} returnValue The return value of the test function
 *
 * @returns {boolean} True if the tests return value was a promise, false if not
 *
 * @private
 */
Runnable.prototype._handlePromise = function (returnValue) {
    var self = this

    if (typeof returnValue !== 'object' || returnValue === null || typeof returnValue.then !== 'function') {
        return false
    }

    returnValue.then(
        function () {
            self.complete()
        }
      , function (reason) {
            if (reason === null || reason === undefined) {
                reason = new Error('Promise rejected with no rejection reason.')
            }

            self.complete(reason)
        }
    )

    return true
}

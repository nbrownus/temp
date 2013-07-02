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

    this.timedOut = false
    this._timeout = undefined

    this.errors = []

    this.dependencies = []
    this.dependants = []
    this._completedDependencies = 0
    this._totalDependencies = 0

    this.setMaxListeners(0)
}

util.inherits(Runnable, EventEmitter)
module.exports = Runnable

/**
 * Adds other runnables as a dependency for this runnable to run
 *
 * @param {Array.<Runnable>} dependencies An array of dependencies
 */
Runnable.prototype.addDependencies = function (dependencies) {
    var self = this

    if (!dependencies) {
        return
    }

    dependencies = (Array.isArray(dependencies)) ? dependencies : [dependencies]

    dependencies.forEach(function (dependency) {
        if (self.dependencies.hasOwnProperty(dependency.id)) {
            return
        }

        dependency.dependants.push(self)
        self.dependencies[dependency.id] = dependency
        self._totalDependencies++

        dependency.once('finish', function () {
            self._completedDependencies++
            self.run()
        })
    })
}

/**
 * Adds a list of runnables as dependant on the outcome of this runnable
 * Mainly used to cascade hook failures
 *
 * @param {Array.<Runnable>} dependants Array of runnables that are dependencies
 */
Runnable.prototype.addDependants = function (dependants) {
    if (!dependants) {
        return
    }

    dependants = (Array.isArray(dependants)) ? dependants : [dependants]
    //this.dependants = this.dependants.concat(dependants)
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
            self.complete(new Error('timeout of ' + self._timeout + 'ms exceeded'))
            self.timedOut = true
        }, self._timeout)
    }
}

/**
 * Executes the runnable if all dependencies have completed
 */
Runnable.prototype.run = function () {
    if (this._completedDependencies < this._totalDependencies) {
        return
    }

    var self = this
      , context = self.parent.context()

    if (self.errors.length > 0) {
        return
    }

    self.domain = domain.create()
    self.start = Date.now()

    if (self.skip) {
        return self.complete()
    }

    self.domain.on('error', function (error) {
        self.complete(error)
    })

    self.emit('start')
    process.nextTick(function () {
        self.domain.run(function () {
            try {
                self.resetTimeout()

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
 */
Runnable.prototype.complete = function (error) {
    var self = this

    var addError = function (err) {
        if (err instanceof Error === false && err.toString() !== "[object Error]") {
            err = new Error('done() invoked with non-Error: ' + JSON.stringify(err))
        }

        self.errors.push(err)
    }

    if (self.state === Constants.RUN_STATE.COMPLETED) {
        if (self.timedOut) {
            return
        }

        self.errors.push(error || new Error('done() called multiple times'))
        return
    }

    if (error) {
        addError(error)
    }

    self.clearTimeout()
    self.duration = (new Date - this.start) || 0
    self.domain.dispose()

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

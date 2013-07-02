var util = require('util')
  , Constants = require('./Constants')
  , EventEmitter = require('events').EventEmitter
  , domain = require('domain')

/**
 * Contains a test function
 * A test can be a beforeEach/All, afterEach/All, or an actual test
 *
 * @param {String} title Title of the test
 * @param {function} func Function to execute for the test
 * @param {String} [type=Constants.TEST_TYPE.TEST] The type of test
 *
 * @constructor
 */
var Test = function (title, func, type) {
    Test.super_.call(this)

    this.id = undefined
    this.title = title
    this.func = func
    this.exclusivity = undefined
    this.parent = undefined
    this.async = func && func.length
    this.state = Constants.RUN_STATE.WAITING
    this.result = undefined
    this.error = undefined
    this.type = type || Constants.TEST_TYPE.NORMAL

    this._skip = !func
    this._only = false
    this._timeout = undefined

    this.priorTests = []
    this.nextTests = []
    this._completedPriors = 0
    this._totalPriors = 0

    this.dependencies = []

    this.setMaxListeners(0)
}

util.inherits(Test, EventEmitter)
module.exports = Test

/**
 * Adds other tests as a prior for this test to run
 *
 * @param {Array.<Test>} priors An array of tests
 */
Test.prototype.addPriorTests = function (priors) {
    var self = this

    if (!priors) {
        return
    }

    priors = (Array.isArray(priors)) ? priors : [priors]

    priors.forEach(function (test) {
        if (self.priorTests.hasOwnProperty(test.id)) {
            return
        }

        test.nextTests.push(self)
        self.priorTests[test.id] = test
        self._totalPriors++

        test.once('finish', function () {
            self._completedPriors++
            self.run()
        })
    })
}

/**
 * Sets an array of tests as dependencies for this test to succeed
 * Used to cascade hook failures
 *
 * @param {Array.<Test>} dependencies An array of tests
 */
Test.prototype.addDependencies = function (dependencies) {
    if (!dependencies) {
        return
    }

    dependencies = (Array.isArray(dependencies)) ? dependencies : [dependencies]
    this.dependencies = this.dependencies.concat(dependencies)
}

/**
 * No other tests can run during a globally exclusive test
 *
 * @returns {Test} This for chaining
 */
Test.prototype.globallyExclusive = function () {
    this.exclusivity = Constants.EXCLUSIVITY.GLOBAL
    return this
}

/**
 * No sibling tests can run during a locally exclusive test
 *
 * @returns {Test} This for chaining
 */
Test.prototype.locallyExclusive = function () {
    this.exclusivity = Constants.EXCLUSIVITY.LOCAL
    return this
}

/**
 * Any other sibling test that is also a non exclusive test can run together
 *
 * @returns {Test} This for chaining
 */
Test.prototype.nonExclusive = function () {
    this.exclusivity = Constants.EXCLUSIVITY.NONE
    return this
}

/**
 * Gets the full title of this test
 *
 * @param {String} [separator=' '] A separator to use between parents
 *
 * @returns {String} The full title
 */
Test.prototype.fullTitle = function (separator) {
    separator = separator || ' '
    var title = (this.parent) ? this.parent.fullTitle(separator) + separator : ''
    title += (this.title) ? this.title : ''
    return title
}

/**
 * Getter/setter timeout in milliseconds
 *
 * @param {Number} ms Number of milliseconds to wait before marking timing out
 *
 * @returns {Test|Number} This for chaining if setting, the timeout in ms if getting
 */
Test.prototype.timeout = function (ms) {
    if (!arguments.length) {
        return this._timeout
    }

    this._timeout = ms
    return this
}

/**
 * Getter/setter marks this test to be skipped
 *
 * @returns {Test|Boolean} This for chaining if setting, whether or not this is test will be skipped if getting
 */
Test.prototype.skip = function (skip) {
    if (!arguments.length) {
        return this._skip
    }

    this._skip = skip
    return this
}

/**
 * Getter/setter Marks this test as the only thing that should run
 * All suites/tests marked as only will run, everything else will show as skipped
 *
 * @returns {Test|Boolean} This for chaining if setting, whether or not this is an only test if getting
 */
Test.prototype.only = function (only) {
    if (!arguments.length) {
        return this._only
    }

    this._only = only
    if (only) {
        this.emit('only')
    }

    return this
}

/**
 * Clears the timeout timer
 */
Test.prototype.clearTimeout = function () {
    clearTimeout(this.timer)
}

/**
 * Resets the timeout timer
 */
Test.prototype.resetTimeout = function () {
    var self = this

    self.clearTimeout()
    if (this._timeout) {
        this.timer = setTimeout(function () {
            self.complete(new Error('timeout of ' + self._timeout + 'ms exceeded'), Constants.RESULT.TIMEOUT)
        }, self._timeout)
    }
}

/**
 * Clones the test
 * Title, function, timeout, skip, only, exclusivity, and parent is shallow copied over
 *
 * @param {Suite} [parent] A parent to use instead of the origins parent
 *
 * @returns {Test} The cloned test
 */
Test.prototype.clone = function (parent) {
    var test = new Test(this.title, this.func)

    test.timeout(this.timeout())
    test.skip(this._skip)
    test.only(this._only)
    test.exclusivity = this.exclusivity
    test.parent = parent || this.parent
    test.type = this.type

    return test
}

/**
 * Executes the test if all prior tests have completed
 */
Test.prototype.run = function () {
    if (this._completedPriors < this._totalPriors) {
        return
    }

    var self = this
      , context = self.parent.context()

    self.dependencies.some(function (test) {
        if (test.result === Constants.RESULT.FAILURE || test.result === Constants.RESULT.TIMEOUT) {
            //TODO: Better errors, which hook type?
            self.complete(new Error(test.fullTitle('/') + ' dependency failed'), Constants.RESULT.HOOK_FAILURE)
            return true
        }
    })

    if (self.state !== Constants.RUN_STATE.WAITING) {
        return
    }

    self.domain = domain.create()
    self.startTime = Date.now()

    if (self._skip) {
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
Test.prototype.complete = function (error, result) {
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
Test.prototype._handlePromise = function (returnValue) {
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

Test.newRoot = function (title) {
    return new Test(title, function () {}, Constants.TEST_TYPE.ROOT)
}

Test.newBeforeEach = function (title, func) {
    return new Test(title, func, Constants.TEST_TYPE.BEFORE_EACH)
}

Test.newBeforeAll = function (title, func) {
    return new Test(title, func, Constants.TEST_TYPE.BEFORE_ALL)
}

Test.newAfterEach = function (title, func) {
    return new Test(title, func, Constants.TEST_TYPE.AFTER_EACH)
}

Test.newAfterAll = function (title, func) {
    return new Test(title, func, Constants.TEST_TYPE.AFTER_ALL)
}

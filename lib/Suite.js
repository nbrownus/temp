var EXCLUSIVITY = require('./Constants').EXCLUSIVITY
  , util = require('util')
  , EventEmitter = require('events').EventEmitter
  , RootNode = require('./runnables').RootNode

/**
 * Contains a set of tests and children suites
 *
 * @param {String} title Title for the suite
 *
 * @constructor
 */
var Suite = function (title) {
    Suite.super_.call(this)

    this.title = title
    this.suites = []
    this.skip = false
    this.exclusivity = EXCLUSIVITY.NONE
    this.testExclusivity = undefined
    this.parent = undefined
    this.only = false
    this.nextRunnables = []
    this.globalRunnables = []
    this.testContainer = false

    this._timeout = undefined
    this._prepared = false
    this._hasOnlyTest = false
    this._nonExclusives = []
    this._context = undefined

    this.runnables = {
        beforeAll: []
      , beforeEach: []
      , tests: []
      , afterEach: []
      , afterAll: []
    }
}

util.inherits(Suite, EventEmitter)
module.exports = Suite

/**
 * Gets the full title of this suite
 *
 * @param {String} [separator=' '] A separator to use between parents
 *
 * @returns {String} The full title
 */
Suite.prototype.fullTitle = function (separator) {
    separator = separator || ' '
    var title = (this.parent) ? this.parent.fullTitle(separator) + separator : ''
    title += (this.title) ? this.title : ''
    return title
}

/**
 * Adds a child suite under the current suite
 *
 * @param {Suite} suite The suite to add as a child
 */
Suite.prototype.addSuite = function (suite) {
    var self = this
    suite.parent = this

    suite.on('only', function () {
        self.skip = true
        self.emit('only')
    })

    this.suites.push(suite)
}

/**
 * Adds a test under the current suite
 *
 * @param {Test} test The test to add
 */
Suite.prototype.addTest = function (test) {
    var self = this

    test.parent = this
    this.runnables.tests.push(test)

    test.on('only', function () {
        self._hasOnlyTest = true
        self.emit('only')
    })
}

/**
 * Adds a before all hook that will run before all runnables in this suite
 *
 * @param {AllHook} beforeAll The AllHook to add as a beforeAll
 */
Suite.prototype.addBeforeAll = function (beforeAll) {
    beforeAll.parent = this
    this.runnables.beforeAll.push(beforeAll)
}

/**
 * Adds an after all hook that will run after all runnables in this suite
 *
 * @param {AllHook} afterAll The Allhook to add as an afterAll
 */
Suite.prototype.addAfterAll = function (afterAll) {
    afterAll.parent = this
    this.runnables.afterAll.push(afterAll)
}

/**
 * Adds a before each hook that will run before every Test in this suite and all child suites
 *
 * @param {EachHook} beforeEach The EachHook to add as a beforeEach
 */
Suite.prototype.addBeforeEach = function (beforeEach) {
    beforeEach.parent = this
    this.runnables.beforeEach.push(beforeEach)
}

/**
 * Adds an after each hook that will run after every Test in this suite and all child suites
 *
 * @param {EachHook} afterEach The EachHook to add as an afterEach
 */
Suite.prototype.addAfterEach = function (afterEach) {
    afterEach.parent = this
    this.runnables.afterEach.push(afterEach)
}

/**
 * No other suites can run during a globally exclusive suite
 *
 * @returns {Suite} This for chaining
 */
Suite.prototype.globallyExclusive = function () {
    this.exclusivity = EXCLUSIVITY.GLOBAL
    return this
}

/**
 * No sibling suites can run during a locally exclusive suite
 *
 * @returns {Suite} This for chaining
 */
Suite.prototype.locallyExclusive = function () {
    this.exclusivity = EXCLUSIVITY.LOCAL
    return this
}

/**
 * Sets that all runnables within this suite and children suites should default to globally exclusive
 *
 * @returns {Suite} This for chaining
 */
Suite.prototype.globallyExclusiveTests = function () {
    this.testExclusivity = EXCLUSIVITY.GLOBAL
    return this
}

/**
 * Sets that all runnables within this suite and children suites should default to locally exclusive
 *
 * @returns {Suite} This for chaining
 */
Suite.prototype.locallyExclusiveTests = function () {
    this.testExclusivity = EXCLUSIVITY.LOCAL
    return this
}

/**
 * Sets that all runnables within this suite and children suites should default to non exclusive
 *
 * @returns {Suite} This for chaining
 */
Suite.prototype.nonExclusiveTests = function () {
    this.testExclusivity = EXCLUSIVITY.NONE
    return this
}

/**
 * Marks this suite and all runnables underneath it as the only things that should run
 * All suites/tests marked as only will run, everything else will show as skipped
 *
 * @returns {Suite} This for chaining
 */
Suite.prototype.setOnly = function () {
    this.only = true
    this.emit('only')
    return this
}

/**
 * Sets the default timeout for tests under this suite
 *
 * @param {Number} ms Number of milliseconds to wait before marking a runnable as timed out
 *
 * @returns {Suite} This for chaining
 */
Suite.prototype.timeout = function (ms) {
    if (!arguments.length) {
        return this._timeout
    }

    this._timeout = ms
    return this
}

/**
 * Gets the context that tests under this suite should run in
 * Shallow copies the parent context
 *
 * @return {Object} the context to run tests in
 */
Suite.prototype.context = function () {
    if (!this._context) {
        if (this.testContainer) {
            this.context = this.parent.context
        } else if (this.parent) {
            this._context = util._extend({}, this.parent.context())
        } else {
            this._context = {}
        }
    }

    return this._context
}

/**
 * Prepares the runnables to be run
 * Skips things not marked as only if anything is marked as only. Timeouts are set from suite to runnable.
 * EachHooks are cloned into each test
 */
Suite.prototype.prepare = function () {
    var self = this

    if (self._prepared) {
        return
    }

    //Get a global lock if we need it
    if (self.exclusivity === EXCLUSIVITY.GLOBAL) {
        var suiteStart = new RootNode('Global exclusive start')
        suiteStart.parent = self
        suiteStart.globallyExclusive()
        self.nextRunnables = [suiteStart]
        self.emit('runnable', suiteStart)
    }

    //TODO: Not currently supporting beforeAll/beforeEach hook failure conditions

    //Run the beforeAlls
    if (self.runnables.beforeAll.length) {
        self.runnables.beforeAll.forEach(function (runnable) {
            self._setRunnableProperties(runnable)
        })
        self._closeNonExclusives()
    }

    //Run the actual tests, giving them every beforeEach and afterEach
    if (self.runnables.tests.length) {
        var testSuites = []
        self.runnables.tests.forEach(function (runnable) {
            if (!self.runnables.beforeEach.length && !self.runnables.afterEach.length) {
                self._setRunnableProperties(runnable)
                return
            }

            var testSuite = self._createTestContainer(runnable)
            testSuites.push(testSuite)
        })

        if (!testSuites.length) {
            self._closeNonExclusives()
        } else {
            self._prepareSuites(testSuites)
        }
    }

    //Build up all child suites
    self._prepareSuites(self.suites)

    //Run the afterAlls
    if (self.runnables.afterAll.length) {
        self.runnables.afterAll.forEach(function (runnable) {
            self._setRunnableProperties(runnable)
        })
        self._closeNonExclusives()
    }

    //Release the global lock if we had one
    if (self.exclusivity === EXCLUSIVITY.GLOBAL) {
        var suiteEnd = new RootNode('Global exclusive finish')
        suiteEnd.parent = self
        suiteEnd.globallyExclusive()
        self.nextRunnables = [suiteEnd]
        self.globalRunnables = [suiteEnd]
        self.emit('runnable', suiteEnd)
    }

    self._prepared = true
}

/**
 * Prepares the suites/test containers to be run
 *
 * @param {Array.<Suite>} suites An array of suites to prepare
 *
 * @private
 */
Suite.prototype._prepareSuites = function (suites) {
    var self = this

    suites.forEach(function (suite) {
        if (!suite.only && !suite.skip) {
            suite.skip = self.skip || self._hasOnlyTest
        }

        if (typeof suite.testExclusivity === 'undefined') {
            suite.testExclusivity = self.testExclusivity
        }

        if (typeof suite.timeout() === 'undefined') {
            suite.timeout(self.timeout())
        }

        if (!suite.testContainer) {
            suite.runnables.beforeEach = self.runnables.beforeEach.concat(suite.runnables.beforeEach)
            suite.runnables.afterEach = suite.runnables.afterEach.concat(self.runnables.afterEach)
        }

        suite.on('suite', function (suite) {
            self.emit('suite', suite)
        })

        suite.on('runnable', function (runnable) {
            if (runnable.exclusivity === EXCLUSIVITY.GLOBAL) {
                self.globalRunnables = suite.globalRunnables.slice()
            }

            self.emit('runnable', runnable)
        })

        if (suite.exclusivity !== EXCLUSIVITY.NONE) {
            self._closeNonExclusives()
        }

        suite.nextRunnables = self.nextRunnables.slice()
        suite.prepare()
        self.emit('suite', suite)

        if (suite.exclusivity === EXCLUSIVITY.NONE) {
            if (suite.globalRunnables.length) {
                self.nextRunnables = suite.globalRunnables.slice()
                self._nonExclusives = []

            } else {
                self._nonExclusives = self._nonExclusives.concat(suite.nextRunnables.slice())
            }

        } else {
            self.nextRunnables = suite.nextRunnables.slice()
        }
    })

    //TODO: May have to add this back in if we see weird connections everywhere
    //self._closeNonExclusives()
}

/**
 * Gets all titles for an array of suites or runnables
 *
 * @param {Array.<Runnable|Suite>} items An array of suites or runnables to get titles for
 * @param {String} [separator=' '] The seperator to use for parents
 *
 * @returns {string} A string of all titles
 */
Suite.prototype.allTitles = function (items, separator) {
    var titles = []

    items = (Array.isArray(items)) ? items : [items]
    items.forEach(function (item) {
        titles.push(item.fullTitle(separator))
    })

    return titles.join(', ')
}

/**
 * Creates a test container for a test
 * Copies beforeEachs and afterEachs in as beforeAlls and afterAlls
 *
 * @param {Runnable} runnable The runnable to build the container around
 *
 * @returns {Suite} The suite that represents the test container
 *
 * @private
 */
Suite.prototype._createTestContainer = function (runnable) {
    var suite = new Suite(runnable.title + ' Container')
      , self = this

    function addHooks (type) {
        var adder = (type === 'beforeEach') ? 'addBeforeAll' : 'addAfterAll'

        self.runnables[type].forEach(function (hook) {
            var newHook = hook.clone()

            if (runnable.skip) {
                newHook.skip = true
            }

            suite[adder](newHook)
        })
    }

    addHooks('beforeEach')
    addHooks('afterEach')

    suite.skip = runnable.skip
    suite.only = runnable.only
    suite.timeout(self.timeout())
    suite.testExclusivity = self.testExclusivity
    suite.exclusivity = suite.testExclusivity

    suite.parent = self
    suite.testContainer = true

    suite.addTest(runnable)

    return suite
}

/**
 * Closes out any non exclusive tests that may currently exist
 * May place a runnable on the graph
 *
 * @private
 */
Suite.prototype._closeNonExclusives = function () {
    if (this._nonExclusives.length) {
        if (this._nonExclusives.length === 1) {
            this.nextRunnables = this._nonExclusives
            this._nonExclusives = []
            return
        }

        var localEnd = new RootNode('Non exclusives end')
        localEnd.parent = this
        localEnd.locallyExclusive()
        localEnd.addPriorRunnables(this._nonExclusives)

        this._nonExclusives = []
        this.nextRunnables = [localEnd]
        this.emit('runnable', localEnd)
    }
}

/**
 * Copies runnable properties from the this suite and sets up the graph
 *
 * @param {Runnable} runnable The runnable to prepare
 *
 * @private
 */
Suite.prototype._setRunnableProperties = function (runnable) {
    var self = this

    if (typeof runnable.exclusivity === 'undefined') {
        runnable.exclusivity = self.testExclusivity
    }

    if (typeof runnable.timeout() === 'undefined') {
        runnable.timeout(self.timeout())
    }

    if (!runnable.only && !runnable.skip) {
        runnable.skip = self.skip || self._hasOnlyTest
    }

    if (runnable.exclusivity === EXCLUSIVITY.NONE) {
        self._nonExclusives.push(runnable)
        runnable.addPriorRunnables(self.nextRunnables)

    } else {
        //Skip adding dependencies if it is global, Pocha class handles this for us
        if (runnable.exclusivity !== EXCLUSIVITY.GLOBAL) {
            if (self._nonExclusives.length) {
                runnable.addPriorRunnables(self._nonExclusives)
            } else {
                runnable.addPriorRunnables(self.nextRunnables)
            }
        } else {
            self.globalRunnables = [runnable]
        }


        self._nonExclusives = []
        self.nextRunnables = [runnable]
    }

    self.emit('runnable', runnable)
}

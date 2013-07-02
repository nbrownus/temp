var Constants = require('./Constants')
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
    this.exclusivity = Constants.EXCLUSIVITY.NONE
    this.testExclusivity = undefined
    this.parent = undefined
    this.only = false
    this.nextTestDependencies = []
    this.globalDependencies = []
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
 * @param {runnables.Test} test The test to add
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
 * @param {runnables.AllHook} beforeAll The AllHook to add as a beforeAll
 */
Suite.prototype.addBeforeAll = function (beforeAll) {
    beforeAll.parent = this
    this.runnables.beforeAll.push(beforeAll)
}

/**
 * Adds an after all hook that will run after all runnables in this suite
 *
 * @param {runnables.AllHook} afterAll The Allhook to add as an afterAll
 */
Suite.prototype.addAfterAll = function (afterAll) {
    afterAll.parent = this
    this.runnables.afterAll.push(afterAll)
}

/**
 * Adds a before each hook that will run before every Test in this suite and all child suites
 *
 * @param {runnables.EachHook} beforeEach The EachHook to add as a beforeEach
 */
Suite.prototype.addBeforeEach = function (beforeEach) {
    beforeEach.parent = this
    this.runnables.beforeEach.push(beforeEach)
}

/**
 * Adds an after each hook that will run after every Test in this suite and all child suites
 *
 * @param {runnables.EachHook} afterEach The EachHook to add as an afterEach
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
    this.exclusivity = Constants.EXCLUSIVITY.GLOBAL
    return this
}

/**
 * No sibling suites can run during a locally exclusive suite
 *
 * @returns {Suite} This for chaining
 */
Suite.prototype.locallyExclusive = function () {
    this.exclusivity = Constants.EXCLUSIVITY.LOCAL
    return this
}

/**
 * Sets that all runnables within this suite and children suites should default to globally exclusive
 *
 * @returns {Suite} This for chaining
 */
Suite.prototype.globallyExclusiveTests = function () {
    this.testExclusivity = Constants.EXCLUSIVITY.GLOBAL
    return this
}

/**
 * Sets that all runnables within this suite and children suites should default to locally exclusive
 *
 * @returns {Suite} This for chaining
 */
Suite.prototype.locallyExclusiveTests = function () {
    this.testExclusivity = Constants.EXCLUSIVITY.LOCAL
    return this
}

/**
 * Sets that all runnables within this suite and children suites should default to non exclusive
 *
 * @returns {Suite} This for chaining
 */
Suite.prototype.nonExclusiveTests = function () {
    this.testExclusivity = Constants.EXCLUSIVITY.NONE
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
      , allRunnables

    if (self._prepared) {
        return
    }

    allRunnables = self.allRunnables()

    //Get a global lock if we need it
    if (self.exclusivity === Constants.EXCLUSIVITY.GLOBAL) {
        var suiteStart = new RootNode('Global exclusive start')
        suiteStart.parent = self
        suiteStart.globallyExclusive()
        self.nextTestDependencies = [suiteStart]
        self.emit('runnable', suiteStart)
    }

    //TODO: Need to setup timeouts
    //Run the beforeAlls
    if (self.runnables.beforeAll.length) {
        self.runnables.beforeAll.forEach(function (runnable, index) {
            //TODO: Not sure this works for the new each container thing
            runnable.addDependants(allRunnables.slice(index))
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
    if (self.exclusivity === Constants.EXCLUSIVITY.GLOBAL) {
        var suiteEnd = new RootNode('Global exclusive finish')
        suiteEnd.parent = self
        suiteEnd.globallyExclusive()
        self.nextTestDependencies = [suiteEnd]
        self.globalDependencies = [suiteEnd]
        self.emit('runnable', suiteEnd)
    }

    self._prepared = true
}

Suite.prototype._prepareSuites = function (suites) {
    var self = this

    suites.forEach(function (suite) {
        if (!suite.only && !suite.skip) {
            suite.skip = self.skip || self._hasOnlyTest
        }

        if (typeof suite.testExclusivity === 'undefined') {
            suite.testExclusivity = self.testExclusivity
        }

        if (!suite.testContainer) {
            suite.runnables.beforeEach = self.runnables.beforeEach.concat(suite.runnables.beforeEach)
            suite.runnables.afterEach = suite.runnables.afterEach.concat(self.runnables.afterEach)
        }

        suite.on('suite', function (suite) {
            self.emit('suite', suite)
        })

        suite.on('runnable', function (runnable) {
            if (runnable.exclusivity === Constants.EXCLUSIVITY.GLOBAL) {
                self.globalDependencies = suite.globalDependencies.slice()
            }

            self.emit('runnable', runnable)
        })

        if (suite.exclusivity !== Constants.EXCLUSIVITY.NONE) {
            self._closeNonExclusives()
        }

        suite.nextTestDependencies = self.nextTestDependencies.slice()
        suite.prepare()
        self.emit('suite', suite)

        if (suite.exclusivity === Constants.EXCLUSIVITY.NONE) {
            if (suite.globalDependencies.length) {
                self.nextTestDependencies = suite.globalDependencies.slice()
                self._nonExclusives = []

            } else {
                self._nonExclusives = self._nonExclusives.concat(suite.nextTestDependencies.slice())
            }

        } else {
            self.nextTestDependencies = suite.nextTestDependencies.slice()
        }
    })

    self._closeNonExclusives()
}

Suite.prototype.allTitles = function (items) {
    var titles = []

    items = (Array.isArray(items)) ? items : [items]
    items.forEach(function (item) {
        titles.push(item.fullTitle('/'))
    })

    return titles.join(', ')
}

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
    suite.testExclusivity = self.testExclusivity

    //TODO: Don't need to handle global here, either none or local?
    if (runnable.exclusivity !== Constants.EXCLUSIVITY.NONE || suite.testExclusivity !== Constants.EXCLUSIVITY.NONE) {
        suite.exclusivity = Constants.EXCLUSIVITY.LOCAL
    }

    suite.parent = self
    suite.testContainer = true

    suite.addTest(runnable)

    return suite
}

Suite.prototype._closeNonExclusives = function () {
    if (this._nonExclusives.length) {
        if (this._nonExclusives.length === 1) {
            this.nextTestDependencies = this._nonExclusives
            this._nonExclusives = []
            return
        }

        var localEnd = new RootNode('Non exclusives end')
        localEnd.parent = this
        localEnd.locallyExclusive()
        localEnd.addDependencies(this._nonExclusives)

        this._nonExclusives = []
        this.nextTestDependencies = [localEnd]
        this.emit('runnable', localEnd)
    }
}

Suite.prototype._setRunnableProperties = function (runnable) {
    var self = this

    if (typeof runnable.exclusivity === 'undefined') {
        runnable.exclusivity = self.testExclusivity
    }

    if (!runnable.only && !runnable.skip) {
        runnable.skip = self.skip || self._hasOnlyTest
    }

    if (runnable.exclusivity === Constants.EXCLUSIVITY.NONE) {
        self._nonExclusives.push(runnable)
        console.log(runnable.fullTitle('/'), self.allTitles(self.nextTestDependencies))
        runnable.addDependencies(self.nextTestDependencies)

    } else {
        //Skip adding dependencies if it is global, Pocha class handles this for us
        if (runnable.exclusivity !== Constants.EXCLUSIVITY.GLOBAL) {
            if (self._nonExclusives.length) {
                runnable.addDependencies(self._nonExclusives)
            } else {
                runnable.addDependencies(self.nextTestDependencies)
            }
        } else {
            console.log('Runnable global', runnable.title)
            self.globalDependencies = [runnable]
        }


        self._nonExclusives = []
        self.nextTestDependencies = [runnable]
    }

    self.emit('runnable', runnable)
}

Suite.prototype.allRunnables = function () {
    var runnables = []

    runnables = this.runnables.beforeAll.concat(
        this.runnables.beforeEach
      , this.runnables.tests
      , this.runnables.afterEach
      , this.runnables.afterAll
    )

    this.suites.forEach(function (suite) {
        runnables = runnables.concat(suite.allRunnables())
    })
    return runnables
}

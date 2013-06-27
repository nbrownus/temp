var Constants = require('./Constants')
  , util = require('util')
  , EventEmitter = require('events').EventEmitter
  , RootNode = require('./runnables').RootNode

/**
 * Contains a set of tests and children suites
 *
 * @param {String} title Title for the suite
 * @param {Pocha} pocha Reference to the main Pocha object
 *
 * @constructor
 */
var Suite = function (title, pocha) {
    Suite.super_.call(this)

    this.title = title
    this.suites = []
    this.skip = false
    this.exclusivity = Constants.EXCLUSIVITY.NONE
    this.testExclusivity = undefined
    this.parent = undefined
    this._timeout = undefined
    this.only = false
    this.pocha = pocha
    this.rootDependencies = []

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
    if (this._context) {
        return this._context
    }

    return {}
}

/**
 * Prepares the runnables to be run
 * Skips things not marked as only if anything is marked as only. Timeouts are set from suite to runnable.
 * EachHooks are cloned into each test
 */
Suite.prototype.prepare = function (rootDependencies) {
    //TODO: Probably need start nodes again for suites

    var self = this
      , finalDependencies = []
      , testSuites = []
      , globalRunnable

    if (self._prepared) {
        return
    }

    self.rootDependencies = rootDependencies

    //Make a global lock node if we need to

    var suiteStart = new RootNode(self.fullTitle('/') + '/Suite start')
    if (self.exclusivity === Constants.EXCLUSIVITY.GLOBAL) {
        suiteStart.globallyExclusive()
        suiteStart.addDependencies(self.pocha.getEdges())
    } else {
        suiteStart.locallyExclusive()
        suiteStart.addDependencies((self.rootDependencies))
    }
    self.pocha.addRunnable(suiteStart)
    self.rootDependencies = [suiteStart]

    //TODO: Need to setup timeouts
    //Run the beforeAlls
    self.runnables.beforeAll.forEach(function (runnable, index) {
        //TODO: Not sure this works for the new each container thing
        runnable.addRunnableDependants(self.allRunnables().slice(index))
        globalRunnable = self._setRunnableProperties(runnable)
    })

    self._closeNonExclusives()

    //Run the actual tests, giving them every beforeEach and afterEach
    self.runnables.tests.forEach(function (runnable) {
        if (!self.runnables.beforeEach.length && !self.runnables.afterEach.length) {
            globalRunnable = self._setRunnableProperties(runnable)
        } else {
            testSuites.push(self._createTestContainer(runnable))
        }
    })
    self._closeNonExclusives()

    self.suites = testSuites.concat(self.suites)

    //Build up all child suites
    //TODO: This is going to make a downward right trending graph, non optimized
    self.suites.forEach(function (suite) {
        if (!suite.only && !suite.skip) {
            suite.skip = self.skip || self._hasOnlyTest
        }

        if (typeof suite.testExclusivity === 'undefined') {
            suite.testExclusivity = self.testExclusivity
        }

        if (suite.exclusivity === Constants.EXCLUSIVITY.LOCAL && finalDependencies.length) {
            self.rootDependencies = finalDependencies
            finalDependencies = []
        }

        suite._context = util._extend({}, self._context)

        //TODO: Need these!
        if (!suite.ignoreShit) {
            suite.runnables.beforeEach = self.runnables.beforeEach.concat(suite.runnables.beforeEach)
            suite.runnables.afterEach = suite.runnables.afterEach.concat(self.runnables.afterEach)
        }

        globalRunnable = suite.prepare(self.rootDependencies)

        if (suite.exclusivity !== Constants.EXCLUSIVITY.NONE) {
            self.rootDependencies = suite.rootDependencies
            finalDependencies = suite.rootDependencies

        } else {
            if (globalRunnable) {
                self.rootDependencies = suite.rootDependencies
            } else {
                finalDependencies = finalDependencies.concat(suite.rootDependencies)
            }
        }
    })

    //If any child suites had runnables we need to collect their rootDependencies to handle afterAlls or global locks
    if (finalDependencies.length > 0) {
        self.rootDependencies = finalDependencies
    }

    //Run the afterAlls
    self.runnables.afterAll.forEach(function (runnable) {
        globalRunnable = self._setRunnableProperties(runnable)
    })
    self._closeNonExclusives()

    //Release our global lock if we had one

    var suiteEnd = new RootNode(self.fullTitle('/') + '/Suite finish')
    if (this.exclusivity === Constants.EXCLUSIVITY.GLOBAL) {
        suiteEnd.globallyExclusive()
        suiteEnd.addDependencies(self.pocha.getEdges())
    } else {
        suiteEnd.locallyExclusive()
        suiteEnd.addDependencies(self.rootDependencies)
    }
    self.pocha.addRunnable(suiteEnd)
    self.rootDependencies = [suiteEnd]

    self._prepared = true
    return globalRunnable
}

Suite.prototype._createTestContainer = function (runnable) {
    var suite = new Suite('#Each Container', this.pocha)

    this.runnables.beforeEach.forEach(function (hook) {
        var newHook = hook.clone()

        if (runnable.skip) {
            newHook.skip = true
        }

        suite.addBeforeAll(newHook)
    })

    this.runnables.afterEach.forEach(function (hook) {
        var newHook = hook.clone()

        if (runnable.skip) {
            newHook.skip = true
        }

        suite.addAfterAll(newHook)
    })

    if (typeof runnable.exclusivity === 'undefined') {
        runnable.exclusivity = this.testExclusivity
    }

    if (!runnable.only && !runnable.skip) {
        runnable.skip = this.skip || this._hasOnlyTest
    }

    suite.parent = this
    suite.skip = runnable.skip
    suite.addTest(runnable)
    //TODO: This needs to be part of the suite!
    suite.ignoreShit = true
    return suite
}

Suite.prototype._closeNonExclusives = function () {
    if (this._nonExclusives.length) {
        if (this._nonExclusives.length === 1) {
            this.rootDependencies = this._nonExclusives
            this._nonExclusives = []
            return
        }

        var localEnd = new RootNode('Non exclusives end')
        localEnd.parent = this
        localEnd.locallyExclusive()
        localEnd.addDependencies(this._nonExclusives)

        this._nonExclusives = []
        this.pocha.addRunnable(localEnd)
        this.rootDependencies = [localEnd]
    }
}

Suite.prototype._setRunnableProperties = function (runnable) {
    var self = this
      , globalRunnable

    if (typeof runnable.exclusivity === 'undefined') {
        runnable.exclusivity = self.testExclusivity
    }

    if (!runnable.only && !runnable.skip) {
        runnable.skip = self.skip || self._hasOnlyTest
    }

    switch (runnable.exclusivity) {
        case Constants.EXCLUSIVITY.GLOBAL:
            runnable.addDependencies(self.pocha.getEdges())
            self._nonExclusives = []
            self.rootDependencies = [runnable]
            globalRunnable = runnable
            break

        case Constants.EXCLUSIVITY.LOCAL:
            if (self._nonExclusives.length) {
                runnable.addDependencies(self._nonExclusives)
            } else {
                runnable.addDependencies(self.rootDependencies)
            }

            self._nonExclusives = []
            self.rootDependencies = [runnable]
            break

        case Constants.EXCLUSIVITY.NONE:
            self._nonExclusives.push(runnable)
            runnable.addDependencies(self.rootDependencies)
            break
    }

    self.pocha.addRunnable(runnable)
    return globalRunnable
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

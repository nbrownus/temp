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
    var self = this
      , finalDependencies = []

    if (self._prepared) {
        return
    }

    self.rootDependencies = rootDependencies

    //Make a global lock node if we need to
    if (self.exclusivity === Constants.EXCLUSIVITY.GLOBAL) {
        var globalStart = new RootNode('Global exclusive start')
        globalStart.globallyExclusive()
        globalStart.addDependencies(self.pocha.getEdges(globalStart))
        self.pocha.addRunnable(globalStart)
        self.rootDependencies = [globalStart]
    }

    //TODO: Need to setup timeouts
    //Run the beforeAlls
    self._setRunnableProperties(self.runnables.beforeAll)

    //Run the actual tests, giving them every beforeEach and afterEach
    self._setRunnableProperties(self.runnables.tests, function (runnable) {
        runnable.addHooks('before', self.runnables.beforeEach)
        runnable.addHooks('after', self.runnables.afterEach)
    })

    //Build up all child suites
    self.suites.forEach(function (suite) {
        if (!suite.only && !suite.skip) {
            suite.skip = self.skip || self._hasOnlyTest
        }

        if (typeof suite.testExclusivity === 'undefined') {
            suite.testExclusivity = self.testExclusivity
        }

        suite._context = util._extend({}, self._context)

        suite.runnables.beforeEach = self.runnables.beforeEach.concat(suite.runnables.beforeEach)
        suite.runnables.afterEach = suite.runnables.afterEach.concat(self.runnables.afterEach)
        suite.prepare(self.rootDependencies)

        if (suite.exclusivity === Constants.EXCLUSIVITY.LOCAL) {
            self.rootDependencies = suite.rootDependencies
            finalDependencies = suite.rootDependencies
        } else {
            finalDependencies = finalDependencies.concat(suite.rootDependencies)
        }
    })

    //If any child suites had runnables we need to collect their rootDependencies to handle afterAlls or global locks
    if (finalDependencies.length > 0) {
        self.rootDependencies = finalDependencies
    }

    //Run the afterAlls
    self._setRunnableProperties(self.runnables.afterAll)

    //Release our global lock if we had one
    if (this.exclusivity === Constants.EXCLUSIVITY.GLOBAL) {
        var globalEnd = new RootNode('Global exclusive end')
        globalEnd.globallyExclusive()
        globalEnd.addDependencies(self.pocha.getEdges(globalEnd))
        self.pocha.addRunnable(globalEnd)
        self.rootDependencies = [globalEnd]
    }

    self._prepared = true
}

Suite.prototype._closeNonExclusives = function () {
    if (this._nonExclusives.length) {
        var localEnd = new RootNode('Non exclusives end')
        localEnd.parent = this
        localEnd.locallyExclusive()
        localEnd.addDependencies(this._nonExclusives)
        this.pocha.addRunnable(localEnd)
        this.rootDependencies = [localEnd]
    }
}

Suite.prototype._setRunnableProperties = function (runnables, onEach) {
    var self = this
    onEach = (typeof onEach === 'function') ? onEach : function () {}

    runnables.forEach(function (runnable) {
        if (typeof runnable.exclusivity === 'undefined') {
            runnable.exclusivity = self.testExclusivity
        }

        if (!runnable.only && !runnable.skip) {
            runnable.skip = self.skip || self._hasOnlyTest
        }

        onEach(runnable)

        //TODO: Need to account for EachHook exclusivity here
        switch (runnable.exclusivity) {
            case Constants.EXCLUSIVITY.GLOBAL:
                runnable.addDependencies(self.pocha.getEdges(runnable))
                self.rootDependencies = [runnable]
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
    })

    self._closeNonExclusives()
}

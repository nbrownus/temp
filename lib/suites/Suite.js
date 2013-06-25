var Constants = require('./../Constants')
  , util = require('util')
  , EventEmitter = require('events').EventEmitter

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
    this.timeout = undefined
    this.only = false

    this._prepared = false
    this._hasOnlyTest = false

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
    suite.setTimeout(this.timeout)

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
    this.runnables.beforeEach.push(beforeEach)
}

/**
 * Adds an after each hook that will run after every Test in this suite and all child suites
 *
 * @param {runnables.EachHook} afterEach The EachHook to add as an afterEach
 */
Suite.prototype.addAfterEach = function (afterEach) {
    this.runnables.afterEach.push(afterEach)
}

/**
 * No other suites can run during a globally exclusive suite
 *
 * @returns {Suite} This for chaining
 */
Suite.prototype.setGloballyExclusive = function () {
    this.exclusivity = Constants.EXCLUSIVITY.GLOBAL
    return this
}

/**
 * No sibling suites can run during a locally exclusive suite
 *
 * @returns {Suite} This for chaining
 */
Suite.prototype.setLocallyExclusive = function () {
    this.exclusivity = Constants.EXCLUSIVITY.LOCAL
    return this
}

Suite.prototype.setTestsGloballyExclusive = function () {
    this.testExclusivity = Constants.EXCLUSIVITY.GLOBAL
    return this
}

Suite.prototype.setTestsLocallyExclusive = function () {
    this.testExclusivity = Constants.EXCLUSIVITY.LOCAL
    return this
}

Suite.prototype.setTestsNonExclusive = function () {
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
Suite.prototype.setTimeout = function (ms) {
    this.timeout = ms
    return this
}

/**
 * Prepares the runnables to be run
 * Skips things not marked as only if anything is marked as only. Timeouts are set from suite to runnable.
 * EachHooks are cloned into each test
 */
Suite.prototype.prepare = function (rootNode) {
    var self = this
      , props = {
            skip: self.skip || self._hasOnlyTest
          , testExclusivity: self.testExclusivity
        }

    if (this._prepared) {
        return
    }

    function setProps (runnable) {
        if (typeof runnable.exclusivity === 'undefined') {
            runnable.exclusivity = props.testExclusivity
        }

        if (!runnable.only && props.skip) {
            runnable.skip = props.skip
        }
    }

    self.runnables.beforeAll.forEach(setProps)
    self.runnables.beforeEach.forEach(setProps)
    self.runnables.tests.forEach(setProps)
    self.runnables.afterEach.forEach(setProps)
    self.runnables.afterAll.forEach(setProps)

    self.suites.forEach(function (suite) {
        if (!suite.only && props.skip) {
            suite.skip = props.skip
        }

        if (typeof suite.testExclusivity === 'undefined') {
            suite.testExclusivity = props.testExclusivity
        }
    })

    //TODO: Need to setup timeouts
    //TODO: Need to push every EachHook down to each suite (Suite#insertHook)

    //Go through all child suites and prepare them
    self.suites.forEach(function (suite) {
        suite.prepare()
    })

    this._prepared = true
}

Suite.prototype.allRunnables = function () {
    if (!this._prepared) {
        throw new Error('The suite must be prepared before calling this')
    }

    var runnables = []
    runnables = this.runnables.beforeAll.concat(this.runnables.tests)

    this.suites.forEach(function (suite) {
        runnables = runnables.concat(suite.allRunnables())
    })

    return runnables.concat(this.runnables.afterAll)
}

Suite.prototype.insertHook = function (type, hook) {

}

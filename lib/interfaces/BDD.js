var Suite = require('../suites').Suite
  , runnables = require('../runnables')

/**
 * BDD style interface
 *
 * @param {Suite} suite Suite to use as the root suite
 * @param {Object} context Context to install methods on to provide the interface
 * @param {Pocha} pocha Main pocha object
 *
 * @constructor
 */
var BDD = function (suite, context) {
    var self = this

    self.suites = [suite]
    self.context = context

    self._setupContext()
}

module.exports = BDD

/**
 * Adds a child suite under the current suite
 * If no function is provided the suite will be skipped
 *
 * @param {String} title Title of the suite, used in reporting
 * @param {function} func Function that builds the tests within the suite
 *
 * @returns {Suite} Suite that was created
 */
BDD.prototype.describe = function (title, func) {
    var suite = new Suite(title)
    this.suites[0].addSuite(suite)
    this.suites.unshift(suite)

    if (typeof func === 'function') {
        func.call(suite)
    } else {
        suite.skip = true
    }

    this.suites.shift()
    return suite
}

/**
 * Adds a child suite under the current suite and sets it to be skipped
 * If any tests are described in the suite they will be skipped as well
 *
 * @param {String} title Title of the suite, used in reporting
 * @param {function} func Function that builds the tests within the suite
 *
 * @returns {Suite} Suite that was created
 */
BDD.prototype.describe.skip = function (title, func) {
    var suite = this.describe(title, func)
    suite.skip = true
    return suite
}

BDD.prototype.describe.only = function (title, func) {
    var suite = this.describe(title, func)
    suite.setOnly()
    return suite
}

BDD.prototype.it = function (title, func) {
    var suite = this.suites[0]
      , test = new runnables.Test(title, func)

    suite.addTest(test)
    return test
}

BDD.prototype.it.skip = function (title, func) {
    var test = this.it(title, func)
    test.skip = true
    return test
}

BDD.prototype.it.only = function (title, func) {
    var test = this.it(title, func)
    test.setOnly()
    return test
}

BDD.prototype.before = function (func) {
    console.log('before')
}

BDD.prototype.before.skip = function (func) {
    console.log('before.skip')
}

BDD.prototype.after = function (func) {
    console.log('after')
}

BDD.prototype.after.skip  = function (func) {
    console.log('after.skip')
}

BDD.prototype.beforeEach = function (func) {
    console.log('beforeEach')
}

BDD.prototype.beforeEach.skip = function (func) {
    console.log('beforeEach.skip')
}

BDD.prototype.afterEach = function (func) {
    console.log('afterEach')
}

BDD.prototype.afterEach.skip = function (func) {
    console.log('afterEach.skip')
}

/**
 * Puts the methods that provide this interface on the context given to us
 *
 * @private
 */
BDD.prototype._setupContext = function () {
    var self = this

    self.context.describe = function () { return self.describe.apply(self, arguments) }
    self.context.describe.skip = function () { return self.describe.skip.apply(self, arguments) }
    self.context.describe.only = function () { return self.describe.only.apply(self, arguments) }

    self.context.it = function () { return self.it.apply(self, arguments) }
    self.context.it.skip = function () { return self.it.skip.apply(self, arguments) }
    self.context.it.only = function () { return self.it.only.apply(self, arguments) }

    self.context.before = function () { return self.before.apply(self, arguments) }
    self.context.before.skip = function () { return self.before.skip.apply(self, arguments) }

    self.context.after = function () { return self.after.apply(self, arguments) }
    self.context.after.skip = function () { return self.after.skip.apply(self, arguments) }

    self.context.beforeEach = function () { return self.beforeEach.apply(self, arguments) }
    self.context.beforeEach.skip = function () { return self.beforeEach.skip.apply(self, arguments) }

    self.context.afterEach = function () { return self.afterEach.apply(self, arguments) }
    self.context.afterEach.skip = function () { return self.afterEach.skip.apply(self, arguments) }
}

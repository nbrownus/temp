var Suite = require('./Suite')
  , BDD = require('./interfaces/BDD')
  , Constants = require('./Constants')
  , EventEmitter = require('events').EventEmitter
  , util = require('util')

var path = require('path')

//TODO: Pocha should extend from Suite?

/**
 * Creates a new Pocha object
 *
 * @constructor
 */
var Pocha = function () {
    Pocha.super_.call(this)

    this.rootSuite = new Suite(undefined)
    this.allTests = []

    this._nextId = 1

    //TODO: need to make this configurable
    this.interface = new BDD(this.rootSuite, global)

    this._files = []
}

util.inherits(Pocha, EventEmitter)
module.exports = Pocha

/**
 * Adds a file that contains tests to be run
 *
 * @param {String} file Path to the file
 */
Pocha.prototype.addFile = function (file) {
    this._files.push(path.resolve(file))
}

/**
 * Loads/requires the files and builds the test suites
 *
 * @private
 */
Pocha.prototype._loadFiles = function () {
    var self = this

    self._files.forEach(function (file) {
        //TODO: Emit pre-require and require
        require(file)
    })
}

/**
 * Runs the test suites
 *
 * @param {function} callback A function to call after finish is emitted
 */
Pocha.prototype.run = function (callback) {
    this._loadFiles()

    var self = this

    self.rootSuite.globallyExclusive()

    //TODO: Make this configurable
    self.rootSuite.timeout(2000)
    self.rootSuite.locallyExclusiveTests()

    self.rootSuite.on('test', function (test) {
        self._addTest(test)
    })

    self.rootSuite.on('suite', function (suite) {
        suite.id = self._nextId++
    })

    self.rootSuite.prepare()

    self.emit('start')
    self.allTests[0].run()
    self.allTests[self.allTests.length - 1].on('finish', function () {
        self.emit('finish')
        callback()
    })
}

/**
 * Adds a test to the list and wires up events
 *
 * @param {Test} newTest The test to add
 */
Pocha.prototype._addTest = function (newTest) {
    var self = this

    newTest.id = this._nextId++

    newTest.on('start', function () {
        self.emit('test start', newTest)
    })

    newTest.on('finish', function () {
        self.emit('test finish', newTest)
    })

    newTest.on('error', function (error) {
        console.error('Test had an error', error)
        self.emit('test error', newTest, error)
    })

    if (newTest.exclusivity === Constants.EXCLUSIVITY.GLOBAL) {
        var edges = []

        this.allTests.forEach(function (test) {
            if (test.nextTests.length) {
                return
            }

            edges.push(test)
        })

        newTest.addPriorTests(edges)
    }

    this.allTests.push(newTest)
}

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
    this.allRunnables = []

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
    self.rootSuite.locallyExclusiveTests()

    function prepare (suites) {
        var suite
          , exclusives = []

        while (suite = suites.shift()) {
            console.log('PREPARING', suite.title, suite.exclusivity)

            suite.id = self._nextId++
            suite.on('runnable', function (runnable) {
                self._addRunnable(runnable)
            })

            if (suite.exclusivity !== Constants.EXCLUSIVITY.NONE) {
                exclusives.push(suite)
                continue
            }

            suites = suites.concat(suite.prepare())
        }

        exclusives.forEach(function (suite) {
            var subSuites = suite.prepare()
            prepare(subSuites)
        })
    }

    prepare([this.rootSuite])

    self.emit('start')
    self.allRunnables[0].run()
    self.allRunnables[self.allRunnables.length - 1].on('finish', function () {
        self.emit('finish')
        callback()
    })
}

/**
 * Adds a runnable to the list and wires up events
 *
 * @param {Runnable} newRunnable The runnable to add
 */
Pocha.prototype._addRunnable = function (newRunnable) {
    var self = this

    newRunnable.id = this._nextId++

    newRunnable.on('start', function () {
        self.emit('runnable start', newRunnable)
    })

    newRunnable.on('finish', function () {
        self.emit('runnable finish', newRunnable)
    })

    newRunnable.on('error', function (error) {
        console.error('Runnable had an error', error)
        self.emit('runnable error', newRunnable, error)
    })

    if (newRunnable.exclusivity === Constants.EXCLUSIVITY.GLOBAL) {
        var edges = []

        this.allRunnables.forEach(function (runnable) {
            //TODO: Track suites for this
            var parent = runnable.parent
            do {
                parent.nextTestDependencies = [newRunnable]
            } while (parent = parent.parent)

            if (runnable.dependants.length) {
                return
            }

            edges.push(runnable)
        })

        newRunnable.addDependencies(edges)
    }

    this.allRunnables.push(newRunnable)
}

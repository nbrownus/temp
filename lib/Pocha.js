var Suite = require('./Suite')
  , BDD = require('./interfaces/BDD')
  , RootNode = require('./runnables').RootNode
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

    this.rootSuite = new Suite(undefined, this)
    this.allRunnables = []

    //TODO: need to make this configurable
    this.interface = new BDD(this, global)

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
 */
Pocha.prototype.run = function () {
    this._loadFiles()

    var self = this

    self.rootSuite.globallyExclusive()

    //TODO: Make this configurable
    self.rootSuite.locallyExclusiveTests()
    self.rootSuite.prepare()


    /*finishNode.on('finish', function () {
        self.emit('finish')
        console.log('Fully finished, call something back?')
    })*/

    self.emit('start')
    //startNode.run()
}

/**
 * Adds a runnable to the list and wires up events
 *
 * @param {Runnable} runnable The runnable to add
 */
Pocha.prototype.addRunnable = function (runnable) {
    var self = this

    runnable.on('start', function () {
        self.emit('runnable start', runnable)
    })

    runnable.on('finish', function () {
        self.emit('runnable finish', runnable)
    })

    runnable.on('error', function (error) {
        console.error('Runnable had an error', error)
        self.emit('runnable error', runnable, error)
    })

    this.allRunnables.push(runnable)
}

/**
 * Gets all edges for the added runnables and optional replaces the root dependency on the parent suite
 * Useful for terminating runnables for a globally exclusive item
 *
 * @param {Runnable} [rootNode] The new root dependency for all parent suites
 *
 * @returns {Array.<Runnable>} An array containing the runnables that are edges
 */
Pocha.prototype.getEdges = function (rootNode) {
    var edges = []

    if (rootNode) {
        this.rootSuite.rootDependencies = rootNode
    }

    //TODO: Track suites not runnables for this
    this.allRunnables.forEach(function (runnable) {
        if (rootNode && runnable.parent) {
            runnable.parent.rootDependencies = rootNode
        }

        if (runnable.dependants.length) {
            return
        }

        edges.push(runnable)
    })

    return edges
}

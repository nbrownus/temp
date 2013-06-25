var RootSuite = require('./suites').RootSuite
  , RootNode = require('./runnables/RootNode')
  , BDD = require('./interfaces/BDD')
  , EventEmitter = require('events').EventEmitter
  , util = require('util')

var path = require('path')

/**
 * Creates a new Pocha object
 *
 * @constructor
 */
var Pocha = function () {
    Pocha.super_.call(this)

    this._files = []
    this.rootSuite = new RootSuite()
    this.allRunnables = []

    //TODO: need to make this configurable
    this.interface = new BDD(this.rootSuite, global)
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

    var startNode = new RootNode('start', function () {
            /**
             * Fired directly before the first test is run
             *
             * @event Pocha#start
             */
            self.emit('start')
        })
      , finishNode = new RootNode('finish', function () {
            /**
             * Fired directly after the last test finishes
             *
             * @event Pocha#finish
             */
            self.emit('finish')
        })

    startNode.setGloballyExclusive()
    finishNode.setGloballyExclusive()

    //TODO: Make this configurable
    self.rootSuite.setTestsLocallyExclusive()[]

    self.rootSuite.prepare(startNode, finishNode)
    self.allRunnables = self.rootSuite.allRunnables()
}

Pocha.prototype._setupDependencies = function (rootNode, suiteQueue) {
    var self = this
        , suiteLevel
        , nextSuiteQueue = []
        , exclusives = []

    do {
        suiteLevel = []

        while (suiteQueue.length > 0) {
            var subSuite = suiteQueue.shift()

            if (subSuite.exclusive()) {
                exclusives.push(subSuite)
            } else {
                suiteLevel.push(subSuite.allTests()) //TODO: Don't have this method anymore
                nextSuiteQueue = nextSuiteQueue.concat(subSuite.suites)
            }
        }

        self._walk_tests(root_node, suiteLevel)
        suiteQueue = nextSuiteQueue
        nextSuiteQueue = []
    } while (suiteQueue.length > 0)

    exclusives.forEach(function (exclusiveSuite) {
        var waitNode = new RootNode('Wait node for ' + exclusiveSuite.fullTitle(), function () {})
        waitNode.addDependencies(self._get_edges([waitNode]))
        self.all_tests.push(wait_node)

        self._walk_tests(wait_node, [exclusive_suite.allTests()])
        self._setup_dependencies(wait_node, exclusive_suite.suites)

        root_node = new RootNode('Final node for ' + exclusive_suite.full_title(), function () {})
        root_node.add_dependencies(self._get_edges([root_node]))
        self.all_tests.push(root_node)
    })
}

Pocha.prototype._walk_tests = function (root_node, suite_graph) {
    var self = this
        , exclusives = []
        , next_dependencies
        , test

    while(suite_graph.length > 0) {
        exclusives = []

        suite_graph.forEach(function (tests, index) {
            if (!(test = tests.shift())) {
                suite_graph.splice(index, 1)
                return
            }

            self._setup_test_hooks(test)

            //Put exclusive tests at the end
            if (test.exclusive()) {
                return exclusives.push(test)
            }

            next_dependencies = test.parent.next_dependencies()
            if (next_dependencies.length === 0) {
                next_dependencies = [root_node]
            }

            test.add_dependencies(next_dependencies)
            test.parent.next_dependencies([test])
            self.all_tests.push(test)
        })

        exclusives.forEach(function (test) {
            test.add_dependencies(self._get_edges([test]))
            self.all_tests.push(test)
        })
    }
}

Pocha.prototype._get_edges = function (new_root) {
    var edges = []

    //TODO: We can do better than brute forcing it but is it worth the time
    this.all_tests.forEach(function (test) {
        if (new_root && test.parent) {
            test.parent.next_dependencies(new_root)
        }

        if (test.dependants.length) {
            return
        }

        edges.push(test)
    })

    return edges
}

Pocha.prototype._setup_test_hooks = function (test) {
    //TODO: Not all events are wired up!
    //TODO: put test events onto suite and capture suite events
    var self = this
    test.on('started', function () {
        self.emit('test start', test)
    })

    test.on('completed', function () {
        if (test.errors.length > 0) {
            self.failures++
            self.emit('test fail', test, test.err)

        } else if (test.skipped) {
            self.emit('test skip', test)

        } else {
            self.emit('test pass', test)
        }

        self.emit('test end', test)
    })

    test.on('error', function (error) {
        console.log('************ ERROR', test.full_title(), error)
        console.log(error.stack)
    })
}

var Suite = require('./Suite')
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
    this.rootSuite = new Suite(undefined, this)
    this.allRunnables = []
    this.startNode = new RootNode('start')
    this.finishNode = new RootNode('finish')

    this.startNode.setGloballyExclusive()
    this.finishNode.setGloballyExclusive()

    //TODO: need to make this configurable
    this.interface = new BDD(this, global)
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

    //TODO: switch the emits to listeners on the node completion

    //TODO: Make this configurable
    self.rootSuite.setTestsLocallyExclusive()
    self.rootSuite.nextDependencies = [self.startNode]

    self.rootSuite.prepare()
    self.finishNode.addDependencies(self.getAllEdges())
    self._allRunnables.push(this.finishNode)

    self.getAllRunnables().forEach(function (runnable) {
        console.log(runnable.fullTitle('/'))
    })

    self.emit('start')
}

Pocha.prototype.getAllEdges = function (rootNode) {
    var edges = []

    var allRunnables = this.getAllRunnables()

    //TODO: We can do better than brute forcing it but is it worth the time
    allRunnables.forEach(function (runnable) {
        if (rootNode && runnable.parent) {
            console.log('Setting next', runnable.parent.title)
            runnable.parent.nextDependencies = [rootNode]
        }

        if (runnable.dependants.length) {
            return
        }

        edges.push(runnable)
    })

    return edges
}

Pocha.prototype.getAllRunnables = function () {
    if (typeof this._allRunnables === 'undefined') {
        this._allRunnables = this.rootSuite.getAllRunnables()
        this._allRunnables.unshift(this.startNode)
    }

    return this._allRunnables
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

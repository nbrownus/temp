var BaseReporter = require('./BaseReporter')
  , runnables = require('../runnables')
  , util = require('util')

var GraphViz = function (pocha, writer) {
    GraphViz.super_.call(this, pocha, writer)
    var self = this

    self.subgraphs = []

    pocha.on('start', function () {
        writer('digraph G {')
        self.printNodes()
        self.printSubGraphs()
        self.printEdges()
        writer('}')
    })
}

util.inherits(GraphViz, BaseReporter)
module.exports = GraphViz

GraphViz.prototype.printNodes = function () {
    var self = this
      , nodeId = 1
      , color = ''
      , line = ''
      , subGraphId = 1

    self.pocha.allRunnables.forEach(function (runnable) {
        runnable.nodeId = 'node' + (nodeId++)

        if (runnable.skip) {
            color = 'azure4'

        } else if (runnable.exclusive()) {
            if (runnable instanceof runnables.RootNode) {
                color = 'blue'
            } else {
                color = 'red'
            }
        } else {
            color = 'white'
        }

        var allRows = []
        if (runnable instanceof runnables.Test) {
            //TODO: Fix this
            /*test.allBeforeEach().forEach(function (hook) {
                allRows.push(hook.fullTitle('/'))
            })
            */
            allRows.push(runnable.title)
            /*
            test.allAfterEach().forEach(function (hook) {
                allRows.push(hook.fullTitle('/'))
            })
            */
        } else {
            allRows.push(runnable.title)
        }

        line = '    ' + runnable.nodeId + ' [shape=record' +
            ', label="{' + allRows.join('|') + '}"' +
            ', style=filled, fillcolor=' + color + '];'

        self.writer(line)

        if (runnable.parent) {
            if (!runnable.parent.subGraphId) {
                runnable.parent.subGraphId = subGraphId++
                self.subgraphs[runnable.parent.subGraphId] = {
                    id: runnable.parent.subGraphId
                  , label: runnable.parent.fullTitle('/')
                  , tests: []
                }
            }

            self.subgraphs[runnable.parent.subGraphId].tests.push(runnable)
        }
    })

    self.writer()
}

GraphViz.prototype.printSubGraphs = function () {
    var self = this
        , line = ''

    self.subgraphs.forEach(function (subgraph) {
        line = '    subgraph cluster_' + subgraph.id + ' {\n'
        line += '        label="' + subgraph.label + '";\n'
        line += '        graph[style=dotted];'

        self.writer(line + '\n')

        subgraph.tests.forEach(function (test) {
            self.writer('        ' + test.nodeId + ';')
        })

        self.writer('    }')
    })

    self.writer()
}

GraphViz.prototype.printEdges = function () {
    var self = this

    self.pocha.allRunnables.forEach(function (runnable) {
        //TODO: fix dependencies
        runnable._dependencies.forEach(function (dependency) {
            self.writer('    ' + dependency.nodeId + ' -> ' + runnable.nodeId + ';')
        })
    })
}

var BaseReporter = require('./BaseReporter')
  , runnables = require('../runnables')
  , util = require('util')

var GraphViz = function (pocha, writer) {
    GraphViz.super_.call(this, pocha, writer)
    var self = this

    self.subGraphs = []

    pocha.on('start', function () {
        writer.write('digraph G {')
        self.printNodes()
        self.printSubGraphs()
        self.printEdges()
        writer.write('}')
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

        } else if (runnable.exclusivity > 1) {
            if (runnable instanceof runnables.RootNode) {
                color = 'blue'
            } else {
                color = 'red'
            }
        } else {
            color = 'white'
        }

        var allRows = []
        if (runnable instanceof runnables.Test || runnable.parent.testContainer) {
            allRows.push(runnable.title)
        } else {
            allRows.push(runnable.fullTitle('/'))
        }

        line = '    ' + runnable.nodeId + ' [shape=record' +
            ', label="{' + allRows.join('|').replace(/(>|<)/g, '\\$1') + '}"' +
            ', style=filled, fillcolor=' + color + '];'

        self.writer.write(line)

        if (runnable.parent.testContainer || ((runnable instanceof runnables.Test) && runnable.parent)) {
            if (!runnable.parent.subGraphId) {
                runnable.parent.subGraphId = subGraphId++
                self.subGraphs[runnable.parent.subGraphId] = {
                    id: runnable.parent.subGraphId
                  , label: runnable.parent.fullTitle('/')
                  , tests: []
                }
            }

            self.subGraphs[runnable.parent.subGraphId].tests.push(runnable)
        }
    })

    self.writer.write()
}

GraphViz.prototype.printSubGraphs = function () {
    var self = this
        , line = ''

    self.subGraphs.forEach(function (subgraph) {
        line = '    subgraph cluster_' + subgraph.id + ' {\n'
        line += '        label="' + subgraph.label + '";\n'
        line += '        graph[style=dotted];'

        self.writer.write(line + '\n')

        subgraph.tests.forEach(function (test) {
            self.writer.write('        ' + test.nodeId + ';')
        })

        self.writer.write('    }')
    })

    self.writer.write()
}

GraphViz.prototype.printEdges = function () {
    var self = this

    self.pocha.allRunnables.forEach(function (runnable) {
        //TODO: fix dependencies
        runnable.dependencies.forEach(function (dependency) {
            self.writer.write('    ' + dependency.nodeId + ' -> ' + runnable.nodeId + ';')
        })
    })
}

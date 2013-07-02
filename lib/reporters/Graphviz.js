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
      , color = ''
      , line = ''

    self.pocha.allRunnables.forEach(function (runnable) {
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

        line = '    node' + runnable.id + ' [shape=record' +
            ', label="{' + allRows.join('|').replace(/(>|<)/g, '\\$1') + '}"' +
            ', style=filled, fillcolor=' + color + '];'

        self.writer.write(line)

        if (runnable.parent.testContainer || ((runnable instanceof runnables.Test) && runnable.parent)) {
            var parent = (runnable.parent.testContainer) ? runnable.parent.parent : runnable.parent

            if (!parent.subGraphed) {
                parent.subGraphed = true
                self.subGraphs[parent.id] = {
                    id: parent.id
                  , label: parent.fullTitle('/')
                  , tests: []
                  , node: parent
                }
            }

            self.subGraphs[parent.id].tests.push(runnable)
        }
    })

    self.writer.write()
}

GraphViz.prototype.printSubGraphs = function () {
    var self = this
        , line = ''

    self.subGraphs.forEach(function (subgraph) {
        //TODO: this sucks
        var style = (subgraph.node.exclusivity === 1) ? 'solid' : 'dotted'

        line = '    subgraph cluster_' + subgraph.id + ' {\n'
        line += '        label="' + subgraph.label + '";\n'
        line += '        graph[style=' + style + '];'

        self.writer.write(line + '\n')

        subgraph.tests.forEach(function (test) {
            self.writer.write('        node' + test.id + ';')
        })

        self.writer.write('    }')
    })

    self.writer.write()
}

GraphViz.prototype.printEdges = function () {
    var self = this

    self.pocha.allRunnables.forEach(function (runnable) {
        runnable.nextRunnables.forEach(function (nextRunnable) {
            self.writer.write('    node' + nextRunnable.id + ' -> node' + runnable.id + ';')
        })
    })
}

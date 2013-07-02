var BaseReporter = require('./BaseReporter')
  , Constants = require('../Constants')
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

    self.pocha.allTests.forEach(function (test) {
        if (test.skip()) {
            color = 'azure4'

        } else if (test.exclusivity == Constants.EXCLUSIVITY.GLOBAL) {
            if (test.type === Constants.TEST_TYPE.ROOT) {
                color = 'blue'
            } else {
                color = 'red'
            }
        } else {
            color = 'white'
        }

        var allRows = []
        if (test.type === Constants.TEST_TYPE.NORMAL || test.parent.testContainer) {
            allRows.push(test.title)
        } else {
            allRows.push(test.fullTitle('/'))
        }

        line = '    node' + test.id + ' [shape=record' +
            ', label="{' + allRows.join('|').replace(/(>|<)/g, '\\$1') + '}"' +
            ', style=filled, fillcolor=' + color + '];'

        self.writer.write(line)

        if (test.parent.testContainer || (test.type === Constants.TEST_TYPE.NORMAL && test.parent)) {
            var parent = (test.parent.testContainer) ? test.parent.parent : test.parent

            if (!parent.subGraphed) {
                parent.subGraphed = true
                self.subGraphs[parent.id] = {
                    id: parent.id
                  , label: parent.fullTitle('/')
                  , tests: []
                  , node: parent
                }
            }

            self.subGraphs[parent.id].tests.push(test)
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

    self.pocha.allTests.forEach(function (test) {
        test.nextTests.forEach(function (nextTest) {
            self.writer.write('    node' + test.id + ' -> node' + nextTest.id + ';')
        })
    })
}

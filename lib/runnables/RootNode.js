var BaseRunnable = require('./BaseRunnable')
  , util = require('util')

/**
 * Defines a root node which are used to tie test execution back in locally or globally
 * RootNodes are also used to being and end the entire test suite
 *
 * @param {String} title Title of the runnable
 * @param {Suite} rootSuite The root suite from Pocha
 *
 * @constructor
 */
var RootNode = function (title, rootSuite) {
    RootNode.super_.call(this, title, function () {})

    this.rootSuite = rootSuite
    this._allRunnables = undefined
}

util.inherits(RootNode, BaseRunnable)

module.exports = RootNode

RootNode.prototype.getAllEdges = function (rootNode) {
    var edges = []

    //TODO: We can do better than brute forcing it but is it worth the time
    this.getAllRunnables().forEach(function (runnable) {
        if (rootNode && runnable.parent) {
            runnable.parent.nextDependencies(rootNode)
        }

        if (runnable.dependants.length) {
            return
        }

        edges.push(runnable)
    })

    return edges
}

RootNode.prototype.getAllRunnables = function () {
    if (typeof this._allRunnables === 'undefined') {
        this._allRunnables = this.rootSuite.getAllRunnables()
    }

    return this._allRunnables
}

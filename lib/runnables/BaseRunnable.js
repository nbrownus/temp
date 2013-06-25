var util = require('util')
  , Constants = require('../Constants')
  , EventEmitter = require('events').EventEmitter

/**
 * Base runnable class, all runnables should extend this class
 *
 * @param {String} title Title of the runnable
 * @param {function} func Function to execute for the runnable
 *
 * @constructor
 */
var BaseRunnable = function (title, func) {
    BaseRunnable.super_.call(this)

    this.title = title
    this.func = func
    this.skip = !func
    this.dependencies = []
    this.dependants = []
    this.exclusivity = undefined
    this.parent = undefined
}

util.inherits(BaseRunnable, EventEmitter)
module.exports = BaseRunnable

BaseRunnable.prototype.addDependencies = function (dependencies) {
    var self = this

    dependencies = (Array.isArray(dependencies)) ? dependencies : [dependencies]

    dependencies.forEach(function (dependency) {
        dependency.dependants.push(self)
        self.dependencies.push(dependency)
        console.log('need to wire up the dependency')
    })
}

BaseRunnable.prototype.setGloballyExclusive = function () {
    this.exclusivity = Constants.EXCLUSIVITY.GLOBAL
    return this
}

BaseRunnable.prototype.setLocallyExclusive = function () {
    this.exclusivity = Constants.EXCLUSIVITY.LOCAL
    return this
}

BaseRunnable.prototype.fullTitle = function (separator) {
    separator = separator || ' '
    var title = (this.parent) ? this.parent.fullTitle(separator) + separator : ''
    title += (this.title) ? this.title : ''
    return title
}

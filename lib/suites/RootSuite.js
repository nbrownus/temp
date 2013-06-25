var util = require('util')
  , Suite = require('./Suite')

var RootSuite = function () {
    RootSuite.super_.call(this, 'Root Suite')

    this._allRunnables = undefined
}

util.inherits(RootSuite, Suite)
module.exports = RootSuite

/*
RootSuite.prototype.allRunnables = function () {
    if (typeof this._allRunnables === 'undefined') {
        this._allRunnables = RootSuite.super_.prototype.allRunnables()
    }

    retu
}
    */

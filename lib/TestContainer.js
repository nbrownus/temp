var Suite = require('./Suite')
  , util = require('util')

var TestContainer = function (title) {
    TestContainer.super_.call(this, title)
}

util.inherits(TestContainer, Suite)
module.exports = TestContainer

/**
 * Gets the context that tests under this suite should run in
 * Shallow copies the parent context
 *
 * @return {Object} the context to run tests in
 */
Suite.prototype.context = function () {
    if (!this._context) {
        this._context = this.parent.context()
    }

    return this._context
}

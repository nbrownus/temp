var BaseReporter = require('./BaseReporter')
  , Constants = require('../Constants')
  , Colors = require('./Colors')
  , Symbols = require('./Symbols')
  , runnables = require('../runnables')
  , util = require('util')

var List = function (pocha, writer) {
    List.super_.call(this, pocha, writer)

    var self = this
        , n = 0

    pocha.on('start', function () {
        writer.write()
    })

    pocha.on('runnable start', function (runnable) {
        runnable.slowInterval = setInterval(function () {
            if (typeof runnable.state !== Constants.RUN_STATE.RUNNING) {
                return clearInterval(runnable.slowInterval)
            }

            self.writer.write(
                'Running:', runnable.fullTitle('/'),
                //'Timeout:', runnable.timeout(),
                'Running for:' + (Date.now() - runnable.start)
            )

        }, 10000)
    })

    pocha.on('runnable finish', function (runnable) {
        var fmt
        clearInterval(runnable.slowInterval)

        if (runnable.error) {
            writer.write(Colors.wrap(Colors.red, '  %d) %s'), ++n, runnable.fullTitle('/'))
            writer.write(Colors.wrap(Colors.red, '       %s'), runnable.error)
        } else if (runnable instanceof runnables.Test) {
            if (runnable.skip) {
                fmt = Colors.wrap(Colors.green, '  -') + Colors.wrap(Colors.cyan, ' %s')
                writer.write(fmt, runnable.fullTitle('/'))
            } else {
                fmt = Colors.wrap(Colors.green, '  ' + Symbols.ok) + Colors.wrap(Colors.intenseBlack, ' %s: ') + '%dms'
                writer.write(fmt, runnable.fullTitle('/'), runnable.duration)
            }
        }
    })

    pocha.on('finish', function () {
        self.epilogue()
    })
}

util.inherits(List, BaseReporter)
module.exports = List

var BaseReporter = require('./BaseReporter')
  , Constants = require('../Constants')
  , Colors = require('./Colors')
  , Symbols = require('./Symbols')
  , util = require('util')

var List = function (pocha, writer) {
    List.super_.call(this, pocha, writer)

    var self = this
        , n = 0

    pocha.on('start', function () {
        writer.write()
    })

    pocha.on('test start', function (test) {
        test.slowInterval = setInterval(function () {
            if (test.state !== Constants.RUN_STATE.RUNNING) {
                return clearInterval(test.slowInterval)
            }

            self.writer.write(
                'Running:', test.fullTitle('/'),
                'Timeout:', test.timeout(),
                'Running for:' + (Date.now() - test.startTime)
            )

        }, 10000)
    })

    pocha.on('test finish', function (test) {
        var format
        clearInterval(test.slowInterval)

        switch (test.result) {
            case Constants.RESULT.HOOK_FAILURE:
                if (test.type !== Constants.TEST_TYPE.NORMAL) {
                    break
                }

            case Constants.RESULT.FAILURE:
            case Constants.RESULT.TIMEOUT:
                writer.write(Colors.wrap(Colors.red, '  %d) %s'), ++n, test.fullTitle('/'))
                writer.write(Colors.wrap(Colors.red, '       %s'), test.error)
                break

            case Constants.RESULT.SKIPPED:
                if (test.type === Constants.TEST_TYPE.NORMAL) {
                    format = Colors.wrap(Colors.green, '  -') + Colors.wrap(Colors.cyan, ' %s')
                    writer.write(format, test.fullTitle('/'))
                }
                break

            case Constants.RESULT.SUCCESS:
                if (test.type === Constants.TEST_TYPE.NORMAL) {
                    format = Colors.wrap(Colors.green, '  ' + Symbols.ok)
                        + Colors.wrap(Colors.intenseBlack, ' %s: ') + '%dms'

                    writer.write(format, test.fullTitle('/'), test.duration)
                }
        }
    })

    pocha.on('finish', function () {
        self.epilogue()
    })
}

util.inherits(List, BaseReporter)
module.exports = List

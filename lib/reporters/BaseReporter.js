var RESULT = require('../Constants').RESULT
  , TEST_TYPE = require('../Constants').TEST_TYPE
  , Colors = require('./Colors')
  , Symbols = require('./Symbols')

var BaseReporter = function (pocha, writer) {
    var self = this

    self.pocha = pocha
    self.writer = writer
    self.failures = []

    self.stats = {
        suites: 0
      , tests: 0
      , skipped: 0
      , passes: 0
      , failures: 0
      , startTime: 0
    }

    pocha.on('start', function () {
        self.stats.startTime = new Date
    })

    pocha.on('test finish', function (test) {
        if (test.type === TEST_TYPE.NORMAL) {
            self.stats.tests++

            switch (test.result) {
                case RESULT.SUCCESS:
                    self.stats.passes++
                    break

                case RESULT.HOOK_FAILURE:
                    if (test.type !== TEST_TYPE.NORMAL) {
                        break
                    }

                case RESULT.TIMEOUT:
                case RESULT.FAILURE:
                    self.failures.push(test)
                    self.stats.failures++
                    break

                case RESULT.SKIPPED:
                    self.stats.skipped++
                    break
            }
        }

        //TODO: Need to report all test failures
    })

    pocha.on('finish', function () {
        self.stats.end = new Date
        self.stats.duration = new Date - self.stats.startTime
    })
}

module.exports = BaseReporter

BaseReporter.prototype.listFailures = function () {
    var self = this
    self.writer.write()

    self.failures.forEach(function (test, i) {
        // format
        var fmt = Colors.wrap(Colors.default, '  %s) %s:\n')
            + Colors.wrap(Colors.red, '     %s')
            + Colors.wrap(Colors.intenseBlack, '\n%s\n')

        // msg
        var err = test.error
          , message = err.message || ''
          , stack = err.stack || message
          , index = stack.indexOf(message) + message.length
          , msg = stack.slice(0, index)
          , actual = err.actual
          , expected = err.expected
          , escape = true

        // explicitly show diff
        if (err.showDiff) {
            escape = false
            err.actual = actual = JSON.stringify(actual, null, 2)
            err.expected = expected = JSON.stringify(expected, null, 2)
        }

        // actual / expected diff
        if ('string' == typeof actual && 'string' == typeof expected) {
            var len = Math.max(actual.length, expected.length)

            if (len < 20) {
                msg = errorDiff(err, 'Chars', escape)
            } else {
                msg = errorDiff(err, 'Words', escape)
            }

            // linenos
            var lines = msg.split('\n')
            if (lines.length > 4) {
                var width = String(lines.length).length
                msg = lines.map(function(str, i){
                    return pad(++i, width) + ' |' + ' ' + str
                }).join('\n')
            }

            // legend
            msg = '\n'
                + Colors.wrap(Colors.bgRed, 'actual')
                + ' '
                + Colors.wrap(Colors.bgGreen, 'expected')
                + '\n\n'
                + msg
                + '\n'

            // indent
            msg = msg.replace(/^/gm, '      ')

            fmt = Colors.wrap(Colors.black, '  %s) %s:\n%s')
                + Colors.wrap(Colors.intenseBlack, '\n%s\n')
        }

        // indent stack trace without msg
        stack = stack.slice(index ? index + 1 : index).replace(/^/gm, '  ')
        self.writer.write(fmt, (i + 1), test.fullTitle('/'), msg, stack)
    })
}

BaseReporter.prototype.epilogue = function () {
    var stats = this.stats
      , fmt

    this.writer.write()

    function pluralize (n) {
        return 1 == n ? 'test' : 'tests'
    }

    if (stats.failures) {
        fmt = Colors.wrap(Colors.intenseRed, '  ' + Symbols.error)
            + Colors.wrap(Colors.red, ' %d of %d %s failed')
            + Colors.wrap(Colors.intenseBlack, ':')

        this.writer.write(fmt, stats.failures, stats.tests, pluralize(stats.tests))

        this.listFailures()
        this.writer.write()
        return
    }

    fmt = Colors.wrap(Colors.intenseGreen, ' ')
        + Colors.wrap(Colors.green, ' %d %s complete')
        + Colors.wrap(Colors.intenseBlack, ' (%sms)')

    //TODO: Duration needs to be stringified
    this.writer.write(fmt, stats.tests, pluralize(stats.tests), stats.duration)

    if (stats.skipped) {
        fmt = Colors.wrap(Colors.cyan, ' ') + Colors.wrap(Colors.cyan, ' %d %s skipped')
        this.writer.write(fmt, stats.skipped, pluralize(stats.skipped))
    }

    this.writer.write()
}

function errorDiff(err, type, escape) {
    return
    return diff['diff' + type](err.actual, err.expected).map(function(str){
        if (escape) {
            str.value = str.value
                .replace(/\t/g, '<tab>')
                .replace(/\r/g, '<CR>')
                .replace(/\n/g, '<LF>\n');
        }
        if (str.added) return colorLines('diff added', str.value);
        if (str.removed) return colorLines('diff removed', str.value);
        return str.value;
    }).join('');
}

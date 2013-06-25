/*global it:false, describe:false, before:false, beforeEach:false, after:false, afterEach:false  */

var Suite = require('./suites').Suite
  , runnables = require('../lib/runnables')
  , Constants = require('../lib/Constants')
  , assert = require('assert')

describe('Suite', function () {

    //TODO: This is a functional test more or less, move it to the proper place
    describe('Functional tests', function () {
        it('Should skip all tests but the only test', function () {
            var suite = new Suite('suite')
              , innerSuite1 = new Suite('suite1')
              , innerSuite2 = new Suite('suite2')
              , innerSuite2a = new Suite('suite2a')

            suite.addTest(new runnables.Test('test1', function () {}))

            suite.addSuite(innerSuite1)
            innerSuite1.addTest(new runnables.Test('test2', function () {}))

            innerSuite1.addSuite(innerSuite2)
            innerSuite2.addTest(new runnables.Test('test3', function () {}))

            innerSuite2.addSuite(innerSuite2a)
            var onlyTest = new runnables.Test('test4', function () {})
            innerSuite2a.addTest(onlyTest)
            onlyTest.setOnly()

            var allRunnables = suite.allRunnables()
            assert.equal(allRunnables[0].skip, true, 'test1 should be skipped')
            assert.equal(allRunnables[1].skip, true, 'test2 should be skipped')
            assert.equal(allRunnables[2].skip, true, 'test3 should be skipped')
            assert.equal(allRunnables[3].skip, false, 'test4 should not be skipped')
        })

        it('Should inherit test exclusivity from the parent suite if not already defined', function () {
            var suite = new Suite('suite')
              , innerSuite1 = new Suite('suite1')
              , innerSuite2 = new Suite('suite2')
              , innerSuite2a = new Suite('suite2a')

            suite.addTest(new runnables.Test('test1', function () {}))
            suite.setTestsLocallyExclusive()

            suite.addSuite(innerSuite1)
            innerSuite1.addTest(new runnables.Test('test2', function () {}))

            innerSuite1.addSuite(innerSuite2)
            var globalTest = new runnables.Test('test3', function () {})
            innerSuite2.addTest(globalTest)
            globalTest.setGloballyExclusive()

            innerSuite2.addSuite(innerSuite2a)
            innerSuite2a.addTest(new runnables.Test('test4', function () {}))
            innerSuite2a.addTest(new runnables.Test('test5', function () {}))
            innerSuite2a.setTestsNonExclusive()

            var allRunnables = suite.allRunnables()
            assert.equal(allRunnables[0].exclusivity, Constants.EXCLUSIVITY.LOCAL, 'test1 should be locally exclusive')
            assert.equal(allRunnables[1].exclusivity, Constants.EXCLUSIVITY.LOCAL, 'test2 should be locally exclusive')
            assert.equal(allRunnables[2].exclusivity, Constants.EXCLUSIVITY.GLOBAL, 'test3 should be globally exclusive')
            assert.equal(allRunnables[3].exclusivity, Constants.EXCLUSIVITY.NONE, 'test4 should not be non exclusive')
            assert.equal(allRunnables[4].exclusivity, Constants.EXCLUSIVITY.NONE, 'test5 should not be non exclusive')
        })
    })
})

/*global it:false, describe:false, before:false, beforeEach:false, after:false, afterEach:false  */

var Suite = require('../lib/Suite')
  , Pocha = require('../lib/Pocha')
  , runnables = require('../lib/runnables')
  , Constants = require('../lib/Constants')
  , assert = require('assert')

describe('Suite', function () {

    describe('Execution Graphs', function () {
        it('Should have the correct graph with 2 tests and a before each', function () {
            var pocha = new Pocha()
              , suite = new Suite('suite', pocha)

            suite.addBeforeEach(new runnables.EachHook('each', function () {}))
            suite.addTest(new runnables.Test('test1', function () {}))
            suite.addTest(new runnables.Test('test2', function () {}))
            suite.nonExclusiveTests()

            var start = new runnables.RootNode('start')
            pocha.addRunnable(start)
            suite.prepare(start)

            var finish = new runnables.RootNode('finish')
            finish.addDependencies(pocha.getEdges())
            pocha.addRunnable(finish)

            var allRunnables = pocha.allRunnables
            assert.equal(allRunnables[0].dependants.length, 2, 'Start node has the wrong number of dependants')
            assert.equal(allRunnables[0].dependants[0].title, 'each', 'Start node has the wrong dependants')
            assert.equal(allRunnables[0].dependants[1].title, 'each', 'Start node has the wrong dependants')
            assert.equal(allRunnables[1].dependants[0].title, 'test1', 'First each has the wrong dependants')
            assert.equal(allRunnables[2].dependants[0].title, 'finish', 'First test does not end correctly')
            assert.equal(allRunnables[3].dependants[0].title, 'test2', 'Second each has the wrong dependants')
            assert.equal(allRunnables[4].dependants[0].title, 'finish', 'Second test does not end correctly')
        })
    })

    //TODO: This is a functional test more or less, move it to the proper place
    describe.skip('Functional tests', function () {
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
            suite.locallyExclusiveTests()

            suite.addSuite(innerSuite1)
            innerSuite1.addTest(new runnables.Test('test2', function () {}))

            innerSuite1.addSuite(innerSuite2)
            var globalTest = new runnables.Test('test3', function () {})
            innerSuite2.addTest(globalTest)
            globalTest.globallyExclusive()

            innerSuite2.addSuite(innerSuite2a)
            innerSuite2a.addTest(new runnables.Test('test4', function () {}))
            innerSuite2a.addTest(new runnables.Test('test5', function () {}))
            innerSuite2a.nonExclusiveTests()

            suite.prepare(new runnables.RootNode())
            var allRunnables = suite.allRunnables()
            assert.equal(allRunnables[0].exclusivity, Constants.EXCLUSIVITY.LOCAL, 'test1 should be locally exclusive')
            assert.equal(allRunnables[1].exclusivity, Constants.EXCLUSIVITY.LOCAL, 'test2 should be locally exclusive')
            assert.equal(allRunnables[2].exclusivity, Constants.EXCLUSIVITY.GLOBAL, 'test3 should be globally exclusive')
            assert.equal(allRunnables[3].exclusivity, Constants.EXCLUSIVITY.NONE, 'test4 should not be non exclusive')
            assert.equal(allRunnables[4].exclusivity, Constants.EXCLUSIVITY.NONE, 'test5 should not be non exclusive')
        })
    })
})

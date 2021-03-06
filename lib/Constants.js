module.exports = {
    EXCLUSIVITY: {
        NONE: 0
      , LOCAL: 1
      , GLOBAL: 2
    }
  , RUN_STATE: {
        WAITING: 0
      , RUNNING: 1
      , COMPLETED: 2
    }
  , RESULT: {
        SUCCESS: 1
      , FAILURE: 2
      , TIMEOUT: 3
      , HOOK_FAILURE: 4
      , SKIPPED: 5
    }
  , TEST_TYPE: {
        NORMAL: 'normal'
      , BEFORE_EACH: 'beforeEach'
      , AFTER_EACH: 'afterEach'
      , BEFORE_ALL: 'beforeAll'
      , AFTER_ALL: 'afterAll'
      , ROOT: 'root'
    }
}

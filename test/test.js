describe('outer', function () {
    before(function () {
        console.log('outer before')
    })

    describe('inner', function () {
        it('inner test', function () {
            console.log('inner test')
        })
        describe('inner inner', function () {
            it('inner inner test', function () {
                console.log('inner inner test')
            })
        })
    })

    after(function () {
        console.log('outer after')
    })
})

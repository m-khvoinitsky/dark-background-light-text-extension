var utils = require('./utils.js');

exports['test count_char_in_string'] = function(assert) {
    return assert.ok(
        (utils.count_char_in_string('(', '123(asdf(asdf))ads()asdf') === 3) &&
        (utils.count_char_in_string('1', '11111111111111111111111') === 23) &&
        (utils.count_char_in_string(' ', '111111 111 111 1111111 ') === 4),
        'count_subs_in_string');
};

exports['test split_background_image'] = function(assert) {
    let res = utils.split_background_image(
        'url("../../img/icons/go-arrow.png?ad8fa66"), linear-gradient(#84C63C, #489615)'
    );
    return assert.ok((
    res[0] == 'url("../../img/icons/go-arrow.png?ad8fa66")' &&
    res[1] == 'linear-gradient(#84C63C,#489615)' &&
    res.length == 2
    ), 'split_background_image');
};
/*
exports['test RGB_TO_HSL speed'] = function(assert) {
    let color_utils = require('./color_utils.js');
    let start = (new Date()).getTime();
    for (let i = 0; i < 1000000; i++)
        color_utils.RGB_to_HSL([128, 128, 200]);
    let end = (new Date()).getTime();
    let time = end - start;
    console.log('Execution time: ' + time);
    return assert.ok(true, 'time measure');
};*/
/*
exports['test count_char_in_string speed'] = function(assert) {
    let start = (new Date()).getTime();
    for (let i = 0; i < 2000000; i++) {
        utils.count_char_in_string('1', '11111111111111111111111');
    }
    let end = (new Date()).getTime();
    let time = end - start;
    console.log('Execution time: ' + time);
    return assert.ok(true, 'just speed')
};*/
exports['test split_background_image speed'] = function(assert) {
    let start = (new Date()).getTime();
    for (let i = 0; i < 1000000; i++) {
        utils.split_background_image(
            'url("../../img/icons/go-arrow.png?ad8fa66"), linear-gradient(#84C63C, #489615)'
        )
    }
    let end = (new Date()).getTime();
    let time = end - start;
    console.log('Execution time: ' + time);
    return assert.ok(true, 'just speed')
};

require("sdk/test").run(exports);
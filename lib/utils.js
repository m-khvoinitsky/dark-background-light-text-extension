var count_char_in_string = function(char, str) {
    let count = 0;
    for (let index = 0; index < str.length; index++)
        count += (str[index] == char) ? 1 : 0
    return count
};
exports.count_char_in_string = count_char_in_string;

var split_background_image = function(value, separator) {
    // TODO: handle more complex cases
    if (!separator)
        separator = ',';
    let result = [];
    let current = [];
    let depth = 0;
    value.split(separator).forEach(function(val){
        current.push(val.trim());
        depth += count_char_in_string('(', val);
        depth -= count_char_in_string(')', val);
        if (depth === 0) {
            result.push(current.join(separator));
            current = [];
        }
    });
    return result;
};
exports.split_background_image = split_background_image;

var intersect = function(set1, set2) {
    return set1.some(
            set1_cur => set2.some(
                    set2_cur => (set2_cur.indexOf(set1_cur) >= 0 || set1_cur.indexOf(set2_cur) >= 0)
            )
    )
};
exports.intersect = intersect;
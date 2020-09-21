exports.splitRegex = regex => {
    const regexs = [];
    regex.split('\n').forEach(singular_regex => {
        if (singular_regex !== null && singular_regex.length > 0) {
            regexs.push(singular_regex);
        }
    });
    return regexs;
};

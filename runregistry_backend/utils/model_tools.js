// Returns the Maximum id number of a model in the db so that when saving the record does not collide:
exports.getMaxIdPlusOne = async Model => {
    let max_id = await Model.max('id');
    if (typeof max_id === NaN) {
        max_id = 0;
    }
    return max_id + 1;
};

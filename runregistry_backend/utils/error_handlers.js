// Handle Generic Errors:
exports.handleErrors = (fn, error_message) => {
    return function (...params) {
        return fn(...params).catch(err => {
            console.error(err);
            console.error(error_message, err.message);
            // console.log(err.stack);
        });
    };
};

exports.catchAPIError = fn => {
    return function (req, res, next) {
        return fn(req, res, next).catch(next);
    };
};

exports.catchAPIErrorHotShot = fn => (req, res, next) =>
    fn(req, res, next).catch(next);

exports.expressError = (err, req, res, next) => {
    console.error(err.message || err);
    console.error(err);
    res.status(500).json({ err: err.message || err });
};

// We want the error to fail so that a run does not get saved/updated
exports.handleCronErrors = (fn, error_message) => {
    return function (...params) {
        return fn(...params).catch(err => {
            console.error(error_message, err.message);
            // console.log(err.stack);
            throw err;
        });
    };
};

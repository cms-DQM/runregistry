const JSONBDeduplication = require('../models').JSONBDeduplication;
const sequelize = require('../models').sequelize;

// It will try to find one JSONB already in the JSONBDeduplication table. If it finds it, it will return it, if it doesn't find it, it will create it.
exports.findOrCreateJSONB = async (jsonb, tries) => {
    if (!tries) {
        tries = 1;
    }
    if (tries > 1000) {
        throw 'Error saving jsonb';
    }
    let saved_jsonb = null;
    // We generate a hash and then see if the hash already exists in the db, if it does, it means there is already an entry
    const [generated_hash_result] = await sequelize.query(
        "select ENCODE( DIGEST( :stringified_jsonb, 'sha1'), 'hex')",
        {
            type: sequelize.QueryTypes.SELECT,
            replacements: {
                stringified_jsonb: JSON.stringify(jsonb)
            }
        }
    );
    const generated_hash = generated_hash_result.encode;
    const result = await sequelize.query(
        `SELECT "id", "unique_hash" FROM "JSONBDeduplication" WHERE "JSONBDeduplication"."unique_hash" = :hash;`,
        {
            type: sequelize.QueryTypes.SELECT,
            replacements: {
                hash: generated_hash
            }
        }
    );

    if (result.length !== 0) {
        saved_jsonb = result[0];
    }
    if (saved_jsonb === null) {
        try {
            saved_jsonb = await JSONBDeduplication.create({
                jsonb,
                unique_hash: generated_hash
            });
            saved_jsonb = saved_jsonb.dataValues;
        } catch (e) {
            // It may happen when adding several records, it may try to save the same jsonb twice, we try 1000 times just to be sure:
            if (e.name === 'SequelizeUniqueConstraintError') {
                console.log(
                    `Race condition saving JSONBs, trying again for ${tries} time`
                );
                // This means the jsonb already existed (race with other one trying to save the same jsonb ), so we run the method again recursively:
                tries += 1;
                return exports.findOrCreateJSONB(jsonb, tries);
            } else {
                console.log(e);
            }
        }
    }
    return saved_jsonb;
};

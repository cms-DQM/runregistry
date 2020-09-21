module.exports = (sequelize, DataTypes) => {
    const JSONBDeduplication = sequelize.define(
        'JSONBDeduplication',
        {
            id: {
                primaryKey: true,
                type: DataTypes.INTEGER,
                autoIncrement: true
            },
            jsonb: {
                type: DataTypes.JSONB,
                allowNull: false
            },
            unique_hash: {
                type: DataTypes.TEXT,
                allowNull: false,
                unique: true
            }
        },
        {
            timestamps: false
        },
        {
            indexes: [
                {
                    name: 'JSONBDeduplication_jsonb_index_hash',
                    fields: ['unique_hash']
                }
            ]
        }
    );
    return JSONBDeduplication;
};

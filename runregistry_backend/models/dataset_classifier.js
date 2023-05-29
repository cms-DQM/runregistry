module.exports = (sequelize, DataTypes) => {
  const DatasetClassifier = sequelize.define(
    'DatasetClassifier',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      class: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      classifier: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
      created_by: { type: DataTypes.TEXT, allowNull: true },
      updated_by: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      // the RR DB was created and filled only with createdAt field. But for the operation we need updatedAt instead, actually. 
      // So, we alias updatedAt as createdAt for sequelize that will update it properly.
      createdAt: false,
      updatedAt: 'createdAt',
      name: {
        singular: 'DatasetClassifier',
        plural: 'DatasetClassifier',
      },
    }
  );
  DatasetClassifier.associate = function (models) {
    DatasetClassifier.belongsToMany(models.DatasetClassifierList, {
      through: models.DatasetClassifierEntries,
      foreignKey: 'id',
      otherKey: 'DCL_id',
    });
  };
  return DatasetClassifier;
};

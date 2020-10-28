module.exports = (sequelize, DataTypes) => {
  const OfflineDatasetClassifier = sequelize.define(
    'OfflineDatasetClassifier',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      classifier: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      workspace: {
        type: DataTypes.STRING,
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
      updatedAt: false,
      name: {
        singular: 'OfflineDatasetClassifier',
        plural: 'OfflineDatasetClassifier',
      },
    }
  );
  OfflineDatasetClassifier.associate = function (models) {
    OfflineDatasetClassifier.belongsToMany(
      models.OfflineDatasetClassifierList,
      {
        through: models.OfflineDatasetClassifierEntries,
        foreignKey: 'id',
        otherKey: 'ODCL_id',
      }
    );
  };
  return OfflineDatasetClassifier;
};

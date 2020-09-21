module.exports = (sequelize, DataTypes) => {
  const Dataset = sequelize.define(
    'Dataset',
    {
      run_number: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      name: { type: DataTypes.TEXT, allowNull: false, primaryKey: true },
      dataset_attributes: { type: DataTypes.JSONB, allowNull: false },
      datasets_in_gui: { type: DataTypes.JSONB, allowNull: false },
      deleted: { type: DataTypes.BOOLEAN, allowNull: false },
      version: { type: DataTypes.INTEGER, allowNull: false },
    },
    {
      timestamps: false,
      indexes: [
        { name: 'Dataset_version_index', fields: ['version'] },
        { name: 'Dataset_deleted_index', fields: ['deleted'] },
      ],
    }
  );
  Dataset.associate = function (models) {
    Dataset.belongsTo(models.Run, { foreignKey: 'run_number' });
    Dataset.hasOne(models.DatasetTripletCache, {
      constraints: false,
      foreignKey: 'run_number',
      sourceKey: 'run_number',
      scope: {
        name: sequelize.where(
          sequelize.col('Dataset.name'),
          '=',
          sequelize.col('DatasetTripletCache.name')
        ),
      },
    });
  };
  return Dataset;
};

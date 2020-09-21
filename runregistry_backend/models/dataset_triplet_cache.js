module.exports = (sequelize, DataTypes) => {
  const DatasetTripletCache = sequelize.define(
    'DatasetTripletCache',
    {
      // run_number and name are a composite foreign key to Dataset.
      run_number: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      name: { type: DataTypes.TEXT, allowNull: false, primaryKey: true },
      triplet_summary: { type: DataTypes.JSONB, allowNull: false },
      dcs_summary: { type: DataTypes.JSONB, allowNull: false },
      rr_ranges: { type: DataTypes.JSONB, allowNull: false },
      dcs_ranges: { type: DataTypes.JSONB, allowNull: false },
      brilcalc_recorded_luminosity: { type: DataTypes.FLOAT, allowNull: false },
      brilcalc_delivered_luminosity: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      version: { type: DataTypes.INTEGER, allowNull: false },
    },
    {
      timestamps: false,
      indexes: [
        {
          name: 'DatasetTripleCache_version_index',
          fields: ['version'],
        },
      ],
      name: {
        singular: 'DatasetTripletCache',
        plural: 'DatasetTripletCache',
      },
    }
  );
  DatasetTripletCache.associate = function (models) {
    DatasetTripletCache.belongsTo(models.Run, { foreignKey: 'run_number' });
    // DatasetTripletCache.belongsTo(models.Dataset, {
    //     constraints: false,
    //     foreignKey: 'run_number',
    //     sourceKey: 'run_number',
    //     foreignKey: 'run_number',
    //     scope: { name: 'DatasetTripletCache.name' }
    // });
  };
  return DatasetTripletCache;
};

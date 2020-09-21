module.exports = (sequelize, DataTypes) => {
  const DatasetEvent = sequelize.define(
    'DatasetEvent',
    {
      version: {
        primaryKey: true,
        type: DataTypes.INTEGER,
        autoIncrement: true,
      },
      run_number: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      name: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      dataset_metadata: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      datasets_in_gui: { type: DataTypes.JSONB, allowNull: false },
      deleted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
    },
    {
      timestamps: false,
      indexes: [
        {
          name: 'DatasetEvent_datasetId_index',
          fields: ['run_number', 'name'],
        },
      ],
    }
  );
  DatasetEvent.associate = function (models) {
    DatasetEvent.belongsTo(models.Event, { foreignKey: 'version' });
    DatasetEvent.belongsTo(models.Run, { foreignKey: 'run_number' });
    // THE FOLLOWING 3 LINES ARE NOT YET SUPPORTED IN SEQUELIZE, WE HAVE TO INITIALIZE THE COMPOUND FOREIGN KEY TO DATASET IN initialization/initialize.js file
    // DatasetEvent.belongsTo(models.Dataset, {
    //     foreignKey: ['run_number','name']
    // })
  };

  return DatasetEvent;
};

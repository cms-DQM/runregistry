module.exports = (sequelize, DataTypes) => {
  const Cycle = sequelize.define('Cycle', {
    id_cycle: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    cycle_name: { type: DataTypes.TEXT, allowNull: false, unique: true },
    cycle_attributes: { type: DataTypes.JSONB, allowNull: false },
    deadline: { type: DataTypes.DATE, allowNull: false },
    deleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
  });
  Cycle.associate = function (models) {
    Cycle.hasMany(models.CycleDataset, {
      foreignKey: 'id_cycle',
    });
  };
  return Cycle;
};

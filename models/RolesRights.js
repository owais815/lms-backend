
const Sequelize = require('sequelize');
const sequelize = require('../utils/database');
const Role = require('./Roles');

const RolesRights = sequelize.define('RolesRights', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    rights: {
        type: Sequelize.STRING,
        allowNull: false
    },
    roleId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
            model: Role,
            key: 'id'
        },
        onDelete: 'CASCADE'
    }
});

// Define the association
RolesRights.belongsTo(Role, { foreignKey: 'roleId' });
Role.hasMany(RolesRights, { foreignKey: 'roleId' });

module.exports = RolesRights;

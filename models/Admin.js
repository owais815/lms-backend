const Sequelize = require('sequelize');
const sequelize = require('../utils/database');
const Role = require('./Roles');

const Admin = sequelize.define('Admin', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false
    },
    username: {
        type: Sequelize.STRING,
        allowNull: false
    },
    // Nullable: existing rows have no address, so NOT NULL would fail the alter.
    // Uniqueness is added later in raw SQL once the data is clean -- never via
    // `unique: true`, which alter-sync duplicates on every boot.
    email: {
        type: Sequelize.STRING,
        allowNull: true
    },
    password: {
        type: Sequelize.STRING,
        allowNull: false
    },
    profileImg: {
        type: Sequelize.STRING,
        allowNull: true
    }
});

// Association with Role model
Admin.belongsTo(Role, { foreignKey: 'roleId' });
Role.hasMany(Admin, { foreignKey: 'roleId' });

module.exports = Admin;

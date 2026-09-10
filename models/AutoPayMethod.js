const { DataTypes } = require('sequelize');
const sequelize = require('../utils/database');

// Placeholder for a stored payment method. No real payment gateway is wired
// up yet (see controllers/autoPay.js `attemptCharge`) — this model only lets
// the auto-pay lifecycle (retry, card removed, deactivate) be represented and
// notified on until a real processor (e.g. Stripe) is integrated.
const AutoPayMethod = sequelize.define('AutoPayMethod', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  studentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Students', key: 'id' },
  },
  provider: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'manual-stub',
  },
  tokenRef: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  last4: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('active', 'removed', 'failed'),
    allowNull: false,
    defaultValue: 'active',
  },
});

module.exports = AutoPayMethod;

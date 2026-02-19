"use strict";

const bcrypt = require("bcryptjs");

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    // 1. Create the Super Admin role
    await queryInterface.bulkInsert(
      "Roles",
      [
        {
          role: "SUPER_ADMIN",
          createdAt: now,
          updatedAt: now,
        },
      ],
      {},
    );

    const [roles] = await queryInterface.sequelize.query(`SELECT id FROM Roles WHERE role = 'SUPER_ADMIN' LIMIT 1;`);
    const roleId = roles[0].id;

    // 2. Create the admin user
    const hashedPassword = await bcrypt.hash("MualimulQuran123@", 12);

    await queryInterface.bulkInsert(
      "Admins",
      [
        {
          name: "Super Admin",
          username: "admin",
          password: hashedPassword,
          roleId: roleId,
          createdAt: now,
          updatedAt: now,
        },
      ],
      {},
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("Admins", { username: "admin" }, {});
    await queryInterface.bulkDelete("Roles", { role: "SUPER_ADMIN" }, {});
  },
};

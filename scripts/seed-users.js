/**
 * LMS Seed Script — Teacher, Student, Parent test users
 *
 * Usage:
 *   node scripts/seed-users.js
 *
 * Idempotent: safe to run multiple times (uses findOrCreate).
 * Creates one user per role. Prints credentials at the end.
 */

const bcrypt = require("bcryptjs");

// Load models through the central association file so all relations are wired
require("../models/association");
const sequelize = require("../utils/database");
const Plan    = require("../models/Plan");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const Parent  = require("../models/Parent");

// ─── Credentials ─────────────────────────────────────────────────────────────

const SEED_USERS = {
  teacher: {
    firstName : "Demo",
    lastName  : "Teacher",
    email     : "teacher@lms.test",
    username  : "teacher.demo",
    password  : "Teacher@1234",
    contact   : "03001234567",
    cnic      : "3520112345671",
  },
  student: {
    firstName : "Demo",
    lastName  : "Student",
    email     : "student@lms.test",
    username  : "student.demo",
    password  : "Student@1234",
    contact   : "03009876543",
  },
  parent: {
    firstName : "Demo",
    lastName  : "Parent",
    email     : "parent@lms.test",
    username  : "parent.demo",
    password  : "Parent@1234",
    contact   : "03331112233",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const hash = (plain) => bcrypt.hash(plain, 12);

const banner = (text) => {
  const line = "─".repeat(text.length + 4);
  console.log(`\n┌${line}┐`);
  console.log(`│  ${text}  │`);
  console.log(`└${line}┘`);
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  banner("LMS User Seed Script");

  // 1. Connect
  await sequelize.authenticate();
  console.log("✔  Database connected");

  // 2. Sync tables (non-destructive)
  await sequelize.sync();
  console.log("✔  Tables synced");

  // 3. Find or create a default Plan (required FK for Student)
  const [plan, planCreated] = await Plan.findOrCreate({
    where: { name: "Default Plan" },
    defaults: {
      name        : "Default Plan",
      price       : 0.00,
      description : "Default seed plan",
      features    : [],
    },
  });
  console.log(`${planCreated ? "✔  Created" : "ℹ  Found"} Plan → id=${plan.id} "${plan.name}"`);

  // 4. Teacher
  const [teacherFound] = await Teacher.findOrCreate({
    where: { username: SEED_USERS.teacher.username },
    defaults: {
      ...SEED_USERS.teacher,
      password: await hash(SEED_USERS.teacher.password),
    },
  });
  console.log(`${teacherFound.isNewRecord !== false ? "✔  Created" : "ℹ  Found"} Teacher → id=${teacherFound.id} username="${teacherFound.username}"`);

  // 5. Student (needs planId)
  const [studentFound] = await Student.findOrCreate({
    where: { username: SEED_USERS.student.username },
    defaults: {
      firstName : SEED_USERS.student.firstName,
      lastName  : SEED_USERS.student.lastName,
      email     : SEED_USERS.student.email,
      username  : SEED_USERS.student.username,
      password  : await hash(SEED_USERS.student.password),
      contact   : SEED_USERS.student.contact,
      planId    : plan.id,
      status    : "active",
    },
  });
  console.log(`${studentFound.isNewRecord !== false ? "✔  Created" : "ℹ  Found"} Student → id=${studentFound.id} username="${studentFound.username}"`);

  // 6. Parent (needs studentId — linked to the student above)
  const [parentFound] = await Parent.findOrCreate({
    where: { username: SEED_USERS.parent.username },
    defaults: {
      firstName : SEED_USERS.parent.firstName,
      lastName  : SEED_USERS.parent.lastName,
      email     : SEED_USERS.parent.email,
      username  : SEED_USERS.parent.username,
      password  : await hash(SEED_USERS.parent.password),
      contact   : SEED_USERS.parent.contact,
      studentId : studentFound.id,
    },
  });
  console.log(`${parentFound.isNewRecord !== false ? "✔  Created" : "ℹ  Found"} Parent  → id=${parentFound.id} username="${parentFound.username}"`);

  // 7. Print credentials table
  banner("Test Credentials");

  const rows = [
    ["Role",    "Username",                  "Password",                  "Login Endpoint"           ],
    ["─────",   "────────────────────────",  "─────────────────────────", "────────────────────────" ],
    ["ADMIN",   "admin",                     "MualimulQuran123@",          "POST /api/auth/login"     ],
    ["TEACHER", SEED_USERS.teacher.username, SEED_USERS.teacher.password,  "POST /api/teacher/login" ],
    ["STUDENT", SEED_USERS.student.username, SEED_USERS.student.password,  "POST /api/student/login" ],
    ["PARENT",  SEED_USERS.parent.username,  SEED_USERS.parent.password,   "POST /api/parent/login"  ],
  ];

  rows.forEach(([role, user, pass, endpoint]) => {
    console.log(`  ${role.padEnd(8)}  ${user.padEnd(24)}  ${pass.padEnd(25)}  ${endpoint}`);
  });

  console.log("\n✅  Seeding complete.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌  Seed failed:", err.message);
  console.error(err);
  process.exit(1);
});

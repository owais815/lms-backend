const express      = require('express');
const router       = express.Router();
const isAuth       = require('../middleware/is-auth');
const ChatGroup    = require('../models/ChatGroup');
const ChatGroupMember = require('../models/ChatGroupMember');
const ChatMessage  = require('../models/ChatMessage');
const Student      = require('../models/Student');
const Teacher      = require('../models/Teacher');
const Admin        = require('../models/Admin');
const Parent       = require('../models/Parent');

// Helper — normalise any user row to { id, displayName, username, userType, avatarUrl }
function normUser(row, type) {
  if (type === 'admin')   return { id: row.id, displayName: row.name,                                       username: row.username, userType: 'admin',   avatarUrl: null };
  if (type === 'teacher') return { id: row.id, displayName: `${row.firstName} ${row.lastName||''}`.trim(), username: row.username, userType: 'teacher', avatarUrl: row.imageUrl||null };
  if (type === 'student') return { id: row.id, displayName: `${row.firstName} ${row.lastName||''}`.trim(), username: row.username, userType: 'student', avatarUrl: row.profileImg||null };
  if (type === 'parent')  return { id: row.id, displayName: `${row.firstName} ${row.lastName||''}`.trim(), username: row.username, userType: 'parent',  avatarUrl: null };
  return null;
}

// Enrich a member list with display info
async function enrichMembers(members) {
  const byType = { student: [], teacher: [], admin: [], parent: [] };
  members.forEach(m => { if (byType[m.userType]) byType[m.userType].push(m.userId); });

  const [students, teachers, admins, parents] = await Promise.all([
    byType.student.length ? Student.findAll({ where: { id: byType.student }, attributes: ['id','firstName','lastName','username','profileImg'] }) : [],
    byType.teacher.length ? Teacher.findAll({ where: { id: byType.teacher }, attributes: ['id','firstName','lastName','username','imageUrl'] }) : [],
    byType.admin.length   ? Admin.findAll({   where: { id: byType.admin },   attributes: ['id','name','username'] }) : [],
    byType.parent.length  ? Parent.findAll({  where: { id: byType.parent },  attributes: ['id','firstName','lastName','username'] }) : [],
  ]);

  const lookup = {};
  students.forEach(r => { lookup[`student-${r.id}`] = normUser(r, 'student'); });
  teachers.forEach(r => { lookup[`teacher-${r.id}`] = normUser(r, 'teacher'); });
  admins.forEach(r =>   { lookup[`admin-${r.id}`]   = normUser(r, 'admin'); });
  parents.forEach(r =>  { lookup[`parent-${r.id}`]  = normUser(r, 'parent'); });

  return members.map(m => ({
    ...m.toJSON(),
    userInfo: lookup[`${m.userType}-${m.userId}`] || null,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat/groups  — create (admin only)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', isAuth, async (req, res) => {
  try {
    const { name, createdBy, createdByType } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Group name is required.' });
    const group = await ChatGroup.create({ name: name.trim(), createdBy, createdByType: createdByType || 'admin' });
    res.status(201).json({ group });
  } catch (err) {
    console.error('Create group error:', err);
    res.status(500).json({ message: 'Failed to create group.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chat/groups?userId=&userType=  — list groups for this user
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', isAuth, async (req, res) => {
  try {
    const { userId, userType } = req.query;
    let groups;
    if (userType === 'admin') {
      // Admin sees all groups
      groups = await ChatGroup.findAll({ order: [['createdAt', 'DESC']] });
    } else {
      // Others see only groups they're a member of
      const memberships = await ChatGroupMember.findAll({ where: { userId: parseInt(userId), userType } });
      const groupIds = memberships.map(m => m.groupId);
      groups = groupIds.length ? await ChatGroup.findAll({ where: { id: groupIds }, order: [['createdAt', 'DESC']] }) : [];
    }

    // Attach member count to each group
    const counts = await ChatGroupMember.findAll({
      attributes: ['groupId', [require('../utils/database').fn('COUNT', require('../utils/database').col('id')), 'count']],
      group: ['groupId'],
    });
    const countMap = {};
    counts.forEach(c => { countMap[c.groupId] = parseInt(c.dataValues.count); });

    res.json({ groups: groups.map(g => ({ ...g.toJSON(), memberCount: countMap[g.id] || 0 })) });
  } catch (err) {
    console.error('List groups error:', err);
    res.status(500).json({ message: 'Failed to fetch groups.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chat/groups/:id/members  — list members with canSend
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/members', isAuth, async (req, res) => {
  try {
    const members = await ChatGroupMember.findAll({ where: { groupId: req.params.id } });
    const enriched = await enrichMembers(members);
    res.json({ members: enriched });
  } catch (err) {
    console.error('List members error:', err);
    res.status(500).json({ message: 'Failed to fetch members.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat/groups/:id/members  — add member (admin)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/members', isAuth, async (req, res) => {
  try {
    const { userId, userType } = req.body;
    const groupId = parseInt(req.params.id);
    const existing = await ChatGroupMember.findOne({ where: { groupId, userId, userType } });
    if (existing) return res.status(409).json({ message: 'User is already a member.' });
    const member = await ChatGroupMember.create({ groupId, userId, userType, canSend: true });
    const enriched = await enrichMembers([member]);
    res.status(201).json({ member: enriched[0] });
  } catch (err) {
    console.error('Add member error:', err);
    res.status(500).json({ message: 'Failed to add member.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/chat/groups/:id/members/:memberId  — remove member (admin)
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id/members/:memberId', isAuth, async (req, res) => {
  try {
    const member = await ChatGroupMember.findByPk(req.params.memberId);
    if (!member || member.groupId !== parseInt(req.params.id)) return res.status(404).json({ message: 'Member not found.' });
    await member.destroy();
    res.json({ message: 'Member removed.' });
  } catch (err) {
    console.error('Remove member error:', err);
    res.status(500).json({ message: 'Failed to remove member.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/chat/groups/:id/members/:memberId  — toggle canSend (admin)
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/members/:memberId', isAuth, async (req, res) => {
  try {
    const member = await ChatGroupMember.findByPk(req.params.memberId);
    if (!member || member.groupId !== parseInt(req.params.id)) return res.status(404).json({ message: 'Member not found.' });
    member.canSend = req.body.canSend !== undefined ? req.body.canSend : !member.canSend;
    await member.save();
    res.json({ member });
  } catch (err) {
    console.error('Toggle canSend error:', err);
    res.status(500).json({ message: 'Failed to update member.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/chat/groups/:id  — delete group (admin)
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', isAuth, async (req, res) => {
  try {
    await ChatGroupMember.destroy({ where: { groupId: req.params.id } });
    await ChatMessage.destroy({ where: { groupId: req.params.id } });
    await ChatGroup.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Group deleted.' });
  } catch (err) {
    console.error('Delete group error:', err);
    res.status(500).json({ message: 'Failed to delete group.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chat/groups/:id/messages  — message history for a group
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/messages', isAuth, async (req, res) => {
  try {
    const messages = await ChatMessage.findAll({
      where: { groupId: req.params.id },
      order: [['createdAt', 'ASC']],
      limit: 200,
    });
    res.json({ messages });
  } catch (err) {
    console.error('Group messages error:', err);
    res.status(500).json({ message: 'Failed to fetch messages.' });
  }
});

module.exports = router;

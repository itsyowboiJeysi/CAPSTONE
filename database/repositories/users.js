const { getDb } = require('../db');

function listUsers() {
  return getDb().prepare(`
    SELECT id, email, full_name, role, is_active, created_at, last_login_at
    FROM users
    ORDER BY full_name COLLATE NOCASE
  `).all();
}

function findUserByEmail(email) {
  return getDb().prepare(`
    SELECT * FROM users WHERE email = ? COLLATE NOCASE
  `).get(email);
}

function findUserById(id) {
  return getDb().prepare(`
    SELECT id, email, full_name, role, is_active, created_at, last_login_at
    FROM users WHERE id = ?
  `).get(id);
}

function createUser({ email, passwordHash, fullName, role, isActive = 1 }) {
  const result = getDb().prepare(`
    INSERT INTO users (email, password_hash, full_name, role, is_active)
    VALUES (?, ?, ?, ?, ?)
  `).run(email, passwordHash, fullName, role, isActive ? 1 : 0);

  return findUserById(result.lastInsertRowid);
}

function updateUser(id, { email, fullName, role, isActive, passwordHash }) {
  const fields = [];
  const values = [];

  if (email !== undefined) {
    fields.push('email = ?');
    values.push(email);
  }
  if (fullName !== undefined) {
    fields.push('full_name = ?');
    values.push(fullName);
  }
  if (role !== undefined) {
    fields.push('role = ?');
    values.push(role);
  }
  if (isActive !== undefined) {
    fields.push('is_active = ?');
    values.push(isActive ? 1 : 0);
  }
  if (passwordHash) {
    fields.push('password_hash = ?');
    values.push(passwordHash);
  }

  if (!fields.length) return findUserById(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  getDb().prepare(`
    UPDATE users SET ${fields.join(', ')} WHERE id = ?
  `).run(...values);

  return findUserById(id);
}

function deleteUser(id) {
  return getDb().prepare('DELETE FROM users WHERE id = ?').run(id);
}

function recordLogin(id) {
  getDb().prepare(`
    UPDATE users SET last_login_at = datetime('now') WHERE id = ?
  `).run(id);
}

module.exports = {
  listUsers,
  findUserByEmail,
  findUserById,
  createUser,
  updateUser,
  deleteUser,
  recordLogin,
};

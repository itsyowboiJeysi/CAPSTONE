const express = require('express');
const bcrypt = require('bcryptjs');
const { requireAdmin } = require('../middleware/auth');
const usersRepo = require('../database/repositories/users');
const auditLog = require('../services/auditLog');

const router = express.Router();

router.get('/', requireAdmin, (req, res) => {
  res.render('users', {
    users: usersRepo.listUsers(),
    currentUser: req.session.user,
    message: req.query.message || null,
    error: req.query.error || null,
  });
});

router.post('/', requireAdmin, (req, res) => {
  const { email, full_name, role, password, is_active } = req.body;

  if (!email || !full_name || !password) {
    return res.redirect('/users?error=Email, name, and password are required');
  }

  if (usersRepo.findUserByEmail(email.trim())) {
    return res.redirect('/users?error=That email is already registered');
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const created = usersRepo.createUser({
    email: email.trim(),
    passwordHash,
    fullName: full_name.trim(),
    role: role || 'operator',
    isActive: is_active === 'on' || is_active === '1',
  });

  auditLog.logUserCreated(req.session.user, {
    id: created.id,
    email: created.email,
    fullName: created.full_name,
    role: created.role,
  });

  res.redirect('/users?message=User added successfully');
});

router.post('/:id/update', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { email, full_name, role, password, is_active } = req.body;

  const existing = usersRepo.findUserById(id);
  if (!existing) {
    return res.redirect('/users?error=User not found');
  }

  const payload = {
    email: email?.trim(),
    fullName: full_name?.trim(),
    role,
    isActive: is_active === 'on' || is_active === '1',
  };

  const changes = [];
  if (password && password.trim()) {
    payload.passwordHash = bcrypt.hashSync(password.trim(), 10);
    changes.push('password reset');
  }
  if (payload.email && payload.email !== existing.email) changes.push('email changed');
  if (payload.role && payload.role !== existing.role) changes.push(`role → ${payload.role}`);
  if (payload.isActive != null && Number(payload.isActive) !== Number(existing.is_active)) {
    changes.push(payload.isActive ? 'activated' : 'deactivated');
  }

  usersRepo.updateUser(id, payload);
  auditLog.logUserUpdated(
    req.session.user,
    { id: existing.id, email: payload.email || existing.email, fullName: payload.fullName || existing.full_name },
    changes.join(', ') || 'profile updated'
  );
  res.redirect('/users?message=User updated');
});

router.post('/:id/delete', requireAdmin, (req, res) => {
  const id = Number(req.params.id);

  if (id === req.session.user.id) {
    return res.redirect('/users?error=You cannot delete your own account');
  }

  const existing = usersRepo.findUserById(id);
  if (!existing) {
    return res.redirect('/users?error=User not found');
  }

  auditLog.logUserDeleted(req.session.user, {
    id: existing.id,
    email: existing.email,
    fullName: existing.full_name,
  });
  usersRepo.deleteUser(id);
  res.redirect('/users?message=User removed');
});

module.exports = router;

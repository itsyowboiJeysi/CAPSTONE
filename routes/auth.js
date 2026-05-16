const express = require('express');
const bcrypt = require('bcryptjs');
const usersRepo = require('../database/repositories/users');
const auditLog = require('../services/auditLog');

const router = express.Router();

router.get('/logout', (req, res) => {
  const user = req.session?.user;
  if (user) {
    auditLog.logLogout(user);
  }
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = function registerAuth(app) {
  app.get('/', (req, res) => {
    if (req.session?.user) {
      return res.redirect('/dashboard');
    }
    const error = req.query.error || null;
    const message = req.query.registered ? 'Account created. You can sign in now.' : null;
    res.render('login', { error, message });
  });

  app.get('/signup', (req, res) => {
    if (req.session?.user) {
      return res.redirect('/dashboard');
    }
    res.render('signup', { error: null, values: {} });
  });

  app.post('/signup', (req, res) => {
    const { full_name, email, password, confirm_password } = req.body;
    const values = {
      full_name: (full_name || '').trim(),
      email: (email || '').trim(),
    };

    if (!values.full_name || !values.email || !password) {
      return res.render('signup', {
        error: 'Please fill in all fields',
        values,
      });
    }

    if (password.length < 6) {
      return res.render('signup', {
        error: 'Password must be at least 6 characters',
        values,
      });
    }

    if (password !== confirm_password) {
      return res.render('signup', {
        error: 'Passwords do not match',
        values,
      });
    }

    if (usersRepo.findUserByEmail(values.email)) {
      auditLog.logEvent({
        eventType: 'AUTH',
        description: 'Signup attempt rejected',
        valueText: `${values.email} — email already registered`,
      });
      return res.render('signup', {
        error: 'An account with this email already exists',
        values,
      });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const user = usersRepo.createUser({
      email: values.email,
      passwordHash,
      fullName: values.full_name,
      role: 'operator',
      isActive: 1,
    });

    auditLog.logSignup({
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
    });
    usersRepo.recordLogin(user.id);
    req.session.user = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
    };
    auditLog.logLogin(req.session.user);

    res.redirect('/dashboard');
  });

  app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const user = usersRepo.findUserByEmail((email || '').trim());

    const emailTrimmed = (email || '').trim();

    if (!user || !user.is_active) {
      auditLog.logLoginFailed(emailTrimmed);
      return res.render('login', { error: 'Invalid email or password' });
    }

    const valid = bcrypt.compareSync(password || '', user.password_hash);
    if (!valid) {
      auditLog.logLoginFailed(emailTrimmed);
      return res.render('login', { error: 'Invalid email or password' });
    }

    usersRepo.recordLogin(user.id);
    req.session.user = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
    };
    auditLog.logLogin(req.session.user);

    res.redirect('/dashboard');
  });

  app.use(router);
};

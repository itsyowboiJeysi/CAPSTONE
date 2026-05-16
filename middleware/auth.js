function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.redirect('/?error=Please sign in to continue');
}

function requireAdmin(req, res, next) {
  if (req.session?.user?.role === 'admin') {
    return next();
  }
  return res.status(403).send('Admin access required');
}

function attachUser(req, res, next) {
  res.locals.currentUser = req.session?.user || null;
  next();
}

module.exports = {
  requireAuth,
  requireAdmin,
  attachUser,
};

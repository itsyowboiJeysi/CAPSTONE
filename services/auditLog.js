const dataRepo = require('../database/repositories/data');

function userLabel(user) {
  if (!user) return 'Unknown user';
  return user.fullName || user.full_name || user.email || `User #${user.id}`;
}

function logEvent({ eventType, description, valueText = null, deviceId = null, recordedAt = null }) {
  return dataRepo.insertHistoryLog({
    deviceId,
    eventType,
    description,
    valueText,
    recordedAt,
  });
}

function logLogin(user) {
  logEvent({
    eventType: 'AUTH',
    description: 'User signed in',
    valueText: `${userLabel(user)} (${user.email})`,
  });
}

function logLogout(user) {
  logEvent({
    eventType: 'AUTH',
    description: 'User signed out',
    valueText: `${userLabel(user)} (${user.email})`,
  });
}

function logSignup(user) {
  logEvent({
    eventType: 'AUTH',
    description: 'New account registered',
    valueText: `${userLabel(user)} (${user.email}) · role: ${user.role || 'operator'}`,
  });
}

function logLoginFailed(email, reason = 'Invalid email or password') {
  logEvent({
    eventType: 'AUTH',
    description: 'Sign-in attempt failed',
    valueText: email ? `${email} — ${reason}` : reason,
  });
}

function logUserCreated(actor, created) {
  logEvent({
    eventType: 'USER ADMIN',
    description: 'User account created',
    valueText: `By ${userLabel(actor)} → ${userLabel(created)} (${created.email}) · ${created.role}`,
  });
}

function logUserUpdated(actor, target, summary) {
  logEvent({
    eventType: 'USER ADMIN',
    description: 'User account updated',
    valueText: `By ${userLabel(actor)} → ${userLabel(target)} (${target.email})${summary ? ` · ${summary}` : ''}`,
  });
}

function logUserDeleted(actor, target) {
  logEvent({
    eventType: 'USER ADMIN',
    description: 'User account removed',
    valueText: `By ${userLabel(actor)} → ${userLabel(target)} (${target.email})`,
  });
}

function logAlertDeleted(actor, alertId) {
  logEvent({
    eventType: 'SYSTEM',
    description: 'Alert record deleted',
    valueText: actor ? `By ${userLabel(actor)} · alert #${alertId}` : `Alert #${alertId}`,
  });
}

function logManualIngest(actor, result) {
  const count = result?.inserted ?? result?.devices ?? 0;
  logEvent({
    eventType: 'SYSTEM',
    description: 'Manual sensor ingest triggered',
    valueText: actor
      ? `By ${userLabel(actor)} · ${count} device(s)`
      : `${count} device(s)`,
  });
}

module.exports = {
  logEvent,
  logLogin,
  logLogout,
  logSignup,
  logLoginFailed,
  logUserCreated,
  logUserUpdated,
  logUserDeleted,
  logAlertDeleted,
  logManualIngest,
};

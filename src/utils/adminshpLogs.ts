export interface AdminShpLog {
  id: string;
  timestamp: string;
  adminshp: string; // e.g., 'adminshp1'
  action: string;
  details?: string;
}

export function logAdminShpAction(adminshp: string, action: string, details?: string) {
  try {
    const logsStr = localStorage.getItem('gm_adminshp_activity_logs') || '[]';
    let logs: AdminShpLog[] = [];
    try {
      logs = JSON.parse(logsStr);
      if (!Array.isArray(logs)) {
        logs = [];
      }
    } catch (e) {
      logs = [];
    }

    const newLog: AdminShpLog = {
      id: Math.random().toString(36).substring(2, 9) + Date.now(),
      timestamp: new Date().toISOString(),
      adminshp,
      action,
      details
    };
    logs.unshift(newLog); // Newest first
    // Limit to 1000 logs for size constraint
    localStorage.setItem('gm_adminshp_activity_logs', JSON.stringify(logs.slice(0, 1000)));
  } catch (e) {
    console.error('Error writing activity log:', e);
  }
}

export function getAdminShpLogs(): AdminShpLog[] {
  try {
    const logsStr = localStorage.getItem('gm_adminshp_activity_logs') || '[]';
    const parsed = JSON.parse(logsStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function clearAdminShpLogs() {
  try {
    localStorage.removeItem('gm_adminshp_activity_logs');
  } catch (e) {
    console.error('Error clearing activity logs:', e);
  }
}

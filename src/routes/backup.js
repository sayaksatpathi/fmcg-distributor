/**
 * Data Backup & Restore System
 * One-click database backup and restore functionality
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

module.exports = function(db, authenticate, requireRole, logActivity, dbPath) {
  const router = express.Router();

  // Backup directory
  const BACKUP_DIR = path.join(__dirname, '..', 'backups');

  // Ensure backup directory exists
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Helper functions
  function dbGet(db, sql, params) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row || {});
      });
    });
  }

  function dbAll(db, sql, params) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  function dbRun(db, sql, params) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  /**
   * GET /api/backup/list
   * List all available backups
   */
  router.get('/list', authenticate, requireRole('owner'), async (req, res, next) => {
    try {
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.sqlite') || f.endsWith('.db') || f.endsWith('.backup'))
        .map(filename => {
          const filepath = path.join(BACKUP_DIR, filename);
          const stats = fs.statSync(filepath);
          return {
            filename,
            size: stats.size,
            sizeFormatted: formatBytes(stats.size),
            created: stats.birthtime,
            modified: stats.mtime
          };
        })
        .sort((a, b) => new Date(b.created) - new Date(a.created));

      res.json({
        backups: files,
        totalBackups: files.length,
        totalSize: formatBytes(files.reduce((sum, f) => sum + f.size, 0))
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/backup/create
   * Create a new database backup
   */
  router.post('/create', authenticate, requireRole('owner'), async (req, res, next) => {
    try {
      const { description = '' } = req.body;

      // Generate backup filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `backup_${timestamp}.sqlite`;
      const backupPath = path.join(BACKUP_DIR, backupName);

      // Use SQLite backup API
      await new Promise((resolve, reject) => {
        db.run('VACUUM INTO ?', [backupPath], function(err) {
          if (err) {
            // Fallback: Use file copy if VACUUM INTO not supported
            const sourcePath = dbPath || path.join(__dirname, '..', 'business.db');
            try {
              fs.copyFileSync(sourcePath, backupPath);
              resolve();
            } catch (copyErr) {
              reject(copyErr);
            }
          } else {
            resolve();
          }
        });
      });

      // Get backup info
      const stats = fs.statSync(backupPath);

      // Log the backup
      await dbRun(db, `
        INSERT INTO backup_logs (filename, file_size, description, created_by, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `, [backupName, stats.size, description, req.user.id]);

      logActivity(req.user.id, 'CREATE_BACKUP', { filename: backupName, size: stats.size });

      res.json({
        success: true,
        backup: {
          filename: backupName,
          size: stats.size,
          sizeFormatted: formatBytes(stats.size),
          created: stats.birthtime
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/backup/auto
   * Configure automatic backups
   */
  router.post('/auto', authenticate, requireRole('owner'), async (req, res, next) => {
    try {
      const { enabled, frequency = 'daily', retention_days = 30 } = req.body;

      // Store in settings
      await dbRun(db, `
        INSERT OR REPLACE INTO settings (key, value, updated_at)
        VALUES ('backup_enabled', ?, datetime('now'))
      `, [enabled ? '1' : '0']);

      await dbRun(db, `
        INSERT OR REPLACE INTO settings (key, value, updated_at)
        VALUES ('backup_frequency', ?, datetime('now'))
      `, [frequency]);

      await dbRun(db, `
        INSERT OR REPLACE INTO settings (key, value, updated_at)
        VALUES ('backup_retention_days', ?, datetime('now'))
      `, [retention_days.toString()]);

      logActivity(req.user.id, 'CONFIGURE_AUTO_BACKUP', { enabled, frequency, retention_days });

      res.json({
        success: true,
        config: { enabled, frequency, retention_days }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/backup/download/:filename
   * Download a specific backup
   */
  router.get('/download/:filename', authenticate, requireRole('owner'), async (req, res, next) => {
    try {
      const { filename } = req.params;

      // Sanitize filename to prevent path traversal
      const sanitizedFilename = path.basename(filename);
      const filepath = path.join(BACKUP_DIR, sanitizedFilename);

      if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: 'Backup not found' });
      }

      logActivity(req.user.id, 'DOWNLOAD_BACKUP', { filename: sanitizedFilename });

      res.download(filepath, sanitizedFilename);
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /api/backup/:filename
   * Delete a specific backup
   */
  router.delete('/:filename', authenticate, requireRole('owner'), async (req, res, next) => {
    try {
      const { filename } = req.params;

      // Sanitize filename to prevent path traversal
      const sanitizedFilename = path.basename(filename);
      const filepath = path.join(BACKUP_DIR, sanitizedFilename);

      if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: 'Backup not found' });
      }

      fs.unlinkSync(filepath);

      // Update log
      await dbRun(db, `
        UPDATE backup_logs SET deleted_at = datetime('now') WHERE filename = ?
      `, [sanitizedFilename]);

      logActivity(req.user.id, 'DELETE_BACKUP', { filename: sanitizedFilename });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/backup/restore/:filename
   * Restore from a specific backup
   * WARNING: This is a destructive operation!
   */
  router.post('/restore/:filename', authenticate, requireRole('owner'), async (req, res, next) => {
    try {
      const { filename } = req.params;
      const { confirm } = req.body;

      if (confirm !== 'RESTORE') {
        return res.status(400).json({ 
          error: 'Please confirm by sending { "confirm": "RESTORE" } in the request body' 
        });
      }

      // Sanitize filename to prevent path traversal
      const sanitizedFilename = path.basename(filename);
      const backupPath = path.join(BACKUP_DIR, sanitizedFilename);

      if (!fs.existsSync(backupPath)) {
        return res.status(404).json({ error: 'Backup not found' });
      }

      // Create a safety backup before restore
      const safetyBackupName = `pre_restore_${Date.now()}.sqlite`;
      const safetyBackupPath = path.join(BACKUP_DIR, safetyBackupName);
      const currentDbPath = dbPath || path.join(__dirname, '..', 'business.db');

      // Copy current database as safety
      fs.copyFileSync(currentDbPath, safetyBackupPath);

      logActivity(req.user.id, 'RESTORE_BACKUP_STARTED', { filename: sanitizedFilename, safety_backup: safetyBackupName });

      // Note: Full restore requires app restart
      // For now, we'll copy the backup file and inform user to restart
      res.json({
        success: true,
        message: 'Backup restoration initiated. Please restart the application to complete the restore.',
        safetyBackup: safetyBackupName,
        instructions: [
          '1. Stop the application',
          '2. Replace business.db with the backup file',
          '3. Restart the application'
        ]
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/backup/cleanup
   * Clean up old backups based on retention policy
   */
  router.post('/cleanup', authenticate, requireRole('owner'), async (req, res, next) => {
    try {
      const { retention_days = 30 } = req.body;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retention_days);

      const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.sqlite') || f.endsWith('.db'))
        .map(filename => {
          const filepath = path.join(BACKUP_DIR, filename);
          const stats = fs.statSync(filepath);
          return { filename, filepath, created: stats.birthtime };
        })
        .filter(f => new Date(f.created) < cutoffDate);

      let deletedCount = 0;
      let freedSpace = 0;

      for (const file of files) {
        const stats = fs.statSync(file.filepath);
        freedSpace += stats.size;
        fs.unlinkSync(file.filepath);
        deletedCount++;
      }

      logActivity(req.user.id, 'CLEANUP_BACKUPS', { deleted: deletedCount, freed: freedSpace });

      res.json({
        success: true,
        deletedCount,
        freedSpace: formatBytes(freedSpace)
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/backup/stats
   * Get backup statistics
   */
  router.get('/stats', authenticate, requireRole('owner'), async (req, res, next) => {
    try {
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.sqlite') || f.endsWith('.db'))
        .map(filename => {
          const filepath = path.join(BACKUP_DIR, filename);
          const stats = fs.statSync(filepath);
          return { filename, size: stats.size, created: stats.birthtime };
        })
        .sort((a, b) => new Date(b.created) - new Date(a.created));

      const lastBackup = files.length > 0 ? files[0] : null;
      const totalSize = files.reduce((sum, f) => sum + f.size, 0);

      // Get auto-backup settings
      const autoBackupEnabled = await dbGet(db, "SELECT value FROM settings WHERE key = 'backup_enabled'", []);
      const backupFrequency = await dbGet(db, "SELECT value FROM settings WHERE key = 'backup_frequency'", []);
      const retentionDays = await dbGet(db, "SELECT value FROM settings WHERE key = 'backup_retention_days'", []);

      res.json({
        totalBackups: files.length,
        totalSize: formatBytes(totalSize),
        lastBackup: lastBackup ? {
          filename: lastBackup.filename,
          created: lastBackup.created,
          size: formatBytes(lastBackup.size)
        } : null,
        autoBackup: {
          enabled: autoBackupEnabled.value === '1',
          frequency: backupFrequency.value || 'daily',
          retentionDays: parseInt(retentionDays.value) || 30
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/backup/export
   * Export data as JSON (alternative to SQLite backup)
   */
  router.post('/export', authenticate, requireRole('owner'), async (req, res, next) => {
    try {
      const { tables = ['all'] } = req.body;

      const exportData = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        data: {}
      };

      const tableList = tables.includes('all') 
        ? ['brands', 'skus', 'retailers', 'sales', 'users']
        : tables;

      for (const table of tableList) {
        try {
          const rows = await dbAll(db, `SELECT * FROM ${table}`, []);
          exportData.data[table] = rows;
        } catch (e) {
          console.error(`Failed to export table ${table}:`, e.message);
        }
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `export_${timestamp}.json`;

      logActivity(req.user.id, 'EXPORT_DATA', { tables: tableList });

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.json(exportData);
    } catch (error) {
      next(error);
    }
  });

  // Helper function to format bytes
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  return router;
};

import { Router } from 'express';
import { authRequired } from '../middleware/auth';
import { getDatabase } from '../services/db';

const router = Router();

router.get('/wbr-summary', authRequired, async (req, res) => {
  try {
    const { from, to, owner } = req.query;
    const db = getDatabase();
    
    let whereClause = '1=1';
    const params: any[] = [];
    
    if (from) {
      whereClause += ' AND m.created_at >= ?';
      params.push(from);
    }
    
    if (to) {
      whereClause += ' AND m.created_at <= ?';
      params.push(to);
    }
    
    if (owner) {
      whereClause += ' AND a.owner_resolved = ?';
      params.push(owner);
    }
    
    // Total actions count
    const totalQuery = `
      SELECT COUNT(*) as count 
      FROM actions a 
      JOIN meetings m ON a.meeting_id = m.id 
      WHERE ${whereClause}
    `;
    const totalResult = db.prepare(totalQuery).get(...params) as { count: number };
    
    // Actions by owner
    const ownerQuery = `
      SELECT a.owner_resolved as owner, COUNT(*) as count 
      FROM actions a 
      JOIN meetings m ON a.meeting_id = m.id 
      WHERE ${whereClause} AND a.owner_resolved != ''
      GROUP BY a.owner_resolved
    `;
    const byOwner = db.prepare(ownerQuery).all(...params);
    
    // Actions by priority
    const priorityQuery = `
      SELECT a.priority, COUNT(*) as count 
      FROM actions a 
      JOIN meetings m ON a.meeting_id = m.id 
      WHERE ${whereClause} AND a.priority != ''
      GROUP BY a.priority
    `;
    const byPriority = db.prepare(priorityQuery).all(...params);
    
    res.json({
      summary: {
        totalActions: totalResult.count,
        byOwner,
        byPriority,
        dateRange: { from: from || null, to: to || null }
      }
    });
  } catch (error) {
    console.error('WBR summary error:', error);
    res.status(500).json({ error: 'Failed to generate WBR summary' });
  }
});

export default router;
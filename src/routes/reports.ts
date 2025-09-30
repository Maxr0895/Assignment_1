import { Router } from 'express';
import { authRequired } from '../middleware/auth';
import { ddbService } from '../services/ddb';

const router = Router();

/**
 * GET /v1/reports/wbr-summary
 * Generate WBR (Weekly Business Review) summary report
 */
router.get('/wbr-summary', authRequired, async (req, res) => {
  try {
    const { from, to, owner } = req.query;
    
    // Get all actions from DynamoDB
    const allActions = await ddbService.getAllActions();
    
    // Filter actions by date range and owner
    let filteredActions = allActions;
    
    if (from) {
      const fromDate = new Date(from as string);
      filteredActions = filteredActions.filter(action => {
        // Get meeting to check created_at date
        // Note: This is not ideal - in production you'd want to denormalize or use GSI
        return true; // For now, include all (TODO: add created_at to action items)
      });
    }
    
    if (to) {
      const toDate = new Date(to as string);
      toDate.setDate(toDate.getDate() + 1);
      filteredActions = filteredActions.filter(action => {
        return true; // TODO: filter by date when available
      });
    }
    
    if (owner) {
      filteredActions = filteredActions.filter(action => 
        action.owner === owner
      );
    }
    
    // Calculate statistics
    const totalActions = filteredActions.length;
    
    // Group by owner
    const byOwnerMap = new Map<string, number>();
    filteredActions.forEach(action => {
      if (action.owner) {
        byOwnerMap.set(action.owner, (byOwnerMap.get(action.owner) || 0) + 1);
      }
    });
    const byOwner = Array.from(byOwnerMap.entries()).map(([owner, count]) => ({
      owner,
      count
    }));
    
    // Group by priority
    const byPriorityMap = new Map<string, number>();
    filteredActions.forEach(action => {
      if (action.priority) {
        byPriorityMap.set(action.priority, (byPriorityMap.get(action.priority) || 0) + 1);
      }
    });
    const byPriority = Array.from(byPriorityMap.entries()).map(([priority, count]) => ({
      priority,
      count
    }));
    
    res.json({
      summary: {
        totalActions,
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
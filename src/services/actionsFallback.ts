interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

interface ActionItem {
  summary: string;
  owner: string | null;
  due_date: string | null;
  priority: string | null;
  start: number;
  end: number;
  tags: string[];
}

export class ActionsFallbackService {
  extractActions(segments: TranscriptSegment[]): ActionItem[] {
    const actions: ActionItem[] = [];
    
    for (const segment of segments) {
      const text = segment.text.toLowerCase();
      
      // Look for action indicators
      const actionIndicators = [
        'action:', 'action item:', 'todo:', 'follow up:',
        'need to', 'should', 'will', 'let me', 'i\'ll',
        'assign', 'responsible', 'owner', 'due'
      ];
      
      const hasActionIndicator = actionIndicators.some(indicator => 
        text.includes(indicator)
      );
      
      if (hasActionIndicator) {
        // Extract owner using @mentions or names
        const ownerMatch = text.match(/@(\w+)/);
        let owner = ownerMatch ? ownerMatch[1] : null;
        
        // Look for common names if no @mention
        if (!owner) {
          const namePatterns = /\b(john|jane|mike|sarah|david|alex|chris|sam)\b/i;
          const nameMatch = segment.text.match(namePatterns);
          owner = nameMatch ? nameMatch[1] : null;
        }
        
        // Extract due dates
        const datePatterns = [
          /\b(\d{4}-\d{2}-\d{2})\b/,
          /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
          /\b(next week|this week|tomorrow)\b/i
        ];
        
        let dueDate: string | null = null;
        for (const pattern of datePatterns) {
          const match = segment.text.match(pattern);
          if (match) {
            dueDate = match[1];
            break;
          }
        }
        
        // Extract priority
        let priority: string | null = null;
        if (text.includes('urgent') || text.includes('critical') || text.includes('p0')) {
          priority = 'P0';
        } else if (text.includes('important') || text.includes('p1')) {
          priority = 'P1';
        } else if (text.includes('p2') || text.includes('low priority')) {
          priority = 'P2';
        }
        
        // Determine tags
        const tags: string[] = [];
        if (text.includes('metric') || text.includes('kpi') || text.includes('measure')) {
          tags.push('metric');
        }
        if (text.includes('risk') || text.includes('blocker') || text.includes('issue')) {
          tags.push('risk');
        }
        if (text.includes('follow') || text.includes('next step') || text.includes('action')) {
          tags.push('follow-up');
        }
        
        actions.push({
          summary: segment.text.trim(),
          owner,
          due_date: dueDate,
          priority,
          start: segment.start,
          end: segment.end,
          tags: tags.length > 0 ? tags : ['follow-up']
        });
      }
    }
    
    return actions;
  }
}
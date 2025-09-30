const Database = require('better-sqlite3');
const db = new Database('./data/app.db');

console.log('\n=== ACTIONS IN DATABASE ===');
const actions = db.prepare('SELECT * FROM actions').all();
console.log(`Total actions: ${actions.length}`);
if (actions.length > 0) {
  console.log('\nActions:', JSON.stringify(actions, null, 2));
}

console.log('\n=== MEETINGS IN DATABASE ===');
const meetings = db.prepare('SELECT id, title, created_at FROM meetings').all();
console.log(`Total meetings: ${meetings.length}`);
if (meetings.length > 0) {
  console.log('\nMeetings:', JSON.stringify(meetings, null, 2));
}

db.close();

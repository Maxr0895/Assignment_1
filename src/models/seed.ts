import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { initializeDatabase, getDatabase } from '../services/db';

async function seedUsers() {
  initializeDatabase();
  const db = getDatabase();
  
  const users = [
    { username: 'admin', password: 'admin', role: 'admin' },
    { username: 'editor', password: 'editor', role: 'editor' },
    { username: 'viewer', password: 'viewer', role: 'viewer' }
  ];
  
  const insertUser = db.prepare(`
    INSERT OR REPLACE INTO users (id, username, role, pw_hash) 
    VALUES (?, ?, ?, ?)
  `);
  
  for (const user of users) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const id = uuidv4();
    
    insertUser.run(id, user.username, user.role, hashedPassword);
    console.log(`Seeded user: ${user.username} (${user.role})`);
  }
  
  console.log('Database seeding completed');
  db.close();
}

if (require.main === module) {
  seedUsers().catch(console.error);
}

export { seedUsers };
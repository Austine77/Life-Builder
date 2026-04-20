/* Run in mongosh after selecting your database if you want manual setup. */

db.createCollection('projects');
db.createCollection('buildjobs');

db.projects.createIndex({ normalizedSiteUrl: 1 }, { unique: true });
db.projects.createIndex({ packageId: 1 }, { unique: true });
db.projects.createIndex({ updatedAt: -1 });
db.buildjobs.createIndex({ projectId: 1, createdAt: -1 });

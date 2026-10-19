import { createDatabaseRepository, AuditPersistenceService } from '../dist/db/index.js';

// Startup configuration comes from the environment; never print DATABASE_URL or credentials.
let repository = await createDatabaseRepository();
try {
  const service = new AuditPersistenceService(repository);
  const requestedId = process.argv[2];
  let auditId = requestedId;
  if (!auditId) {
    const project = await service.registerProject({ name: 'DevGuardian persistence verification', repoPath: process.cwd(), defaultBranch: 'Dev', runnerType: 'jest' });
    const audit = await service.beginAudit(project.id, 'src/db/index.ts');
    await repository.saveAuditSession({ ...audit, status: 'blocked', finishedAt: new Date().toISOString(),
      summaryJson: { demonstration: 'Persistence-only probe; no code repair was executed.' } });
    auditId = audit.id;
  }
  await repository.close();
  repository = await createDatabaseRepository();
  const recovered = await new AuditPersistenceService(repository).getAuditDetails(auditId);
  console.log(JSON.stringify({ adapter: repository.constructor.name, projectId: recovered.project.id,
    auditId, status: recovered.audit.status, recoveredAfterReopen: true }, null, 2));
} finally { await repository.close(); }

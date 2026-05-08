import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAppLogsPermission1768000003000 implements MigrationInterface {
  name = "AddAppLogsPermission1768000003000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const superAdminRoleId = "00000000-0000-0000-0000-000000000002";
    const appLogsPermissionId = "10000000-0000-0000-0000-000000000009";

    await queryRunner.query(`
      INSERT INTO \`permissions\` (\`id\`, \`name\`, \`displayName\`, \`description\`) VALUES
      ('${appLogsPermissionId}', 'app-logs', 'App Logs', 'Upload app logs by agent UUID')
    `);

    await queryRunner.query(`
      INSERT INTO \`role_permissions\` (\`role_id\`, \`permission_id\`)
      VALUES ('${superAdminRoleId}', '${appLogsPermissionId}')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const appLogsPermissionId = "10000000-0000-0000-0000-000000000009";

    await queryRunner.query(`
      DELETE FROM \`role_permissions\` WHERE \`permission_id\` = '${appLogsPermissionId}'
    `);

    await queryRunner.query(`
      DELETE FROM \`permissions\` WHERE \`id\` = '${appLogsPermissionId}'
    `);
  }
}

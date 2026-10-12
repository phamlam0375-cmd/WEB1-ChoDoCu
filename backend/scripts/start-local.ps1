param(
    [ValidateRange(1, 2147483647)]
    [int]$DemoUserId = 1,
    [switch]$DisableDemo
)

$ErrorActionPreference = 'Stop'
$backendRoot = Split-Path $PSScriptRoot -Parent
$repositoryRoot = Split-Path $backendRoot -Parent
$baseCompose = Join-Path $repositoryRoot 'docker-compose.yml'
$localCompose = Join-Path $repositoryRoot 'docker-compose.local-db.yml'

# Open only the existing local database. Never run Docker API/nginx,
# prepare-db, migrations, seeds, or the CD database/actions-runner.
# Use the normal server entrypoint so the D01 expiration job stays active.
$volumeInfo = docker volume inspect web1-chodocu_mysql_data 2>$null | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or !$volumeInfo -or
    $volumeInfo.Labels.'com.docker.compose.project' -ne 'web1-chodocu') {
    throw 'Existing local volume web1-chodocu_mysql_data not found. Refusing to create/seed a database.'
}

docker compose -p web1-chodocu -f $baseCompose -f $localCompose up -d --no-deps mysql
if ($LASTEXITCODE -ne 0) { throw 'Cannot start local MySQL.' }

$ready = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    $health = docker inspect web1-chodocu-mysql-1 --format '{{.State.Health.Status}}'
    if ($LASTEXITCODE -eq 0 -and $health -eq 'healthy') { $ready = $true; break }
    Start-Sleep -Seconds 1
}
if (!$ready) { throw 'Local MySQL is not healthy. Check docker logs web1-chodocu-mysql-1.' }

$localEnvironment = @{
    NODE_ENV = 'development'
    PORT = '3001'
    DB_HOST = '127.0.0.1'
    DB_PORT = '33307'
    DB_NAME = 'cho_do_cu'
    D01_DEMO_MODE = $(if ($DisableDemo) { 'false' } else { 'true' })
    D01_DEMO_USER_ID = [string]$DemoUserId
}
$previousEnvironment = @{}
foreach ($key in $localEnvironment.Keys) {
    $previousEnvironment[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
    [Environment]::SetEnvironmentVariable($key, $localEnvironment[$key], 'Process')
}

Push-Location $backendRoot
try {
    # Read-only validation using the existing models/configuration.
    # Do not enable demo for an inactive account, ADMIN, or an empty database.
    if (!$DisableDemo) {
        @'
require('dotenv').config();
const { sequelize, Users, Roles } = require('./src/models');
(async () => {
  try {
    const user = await Users.findByPk(Number(process.env.D01_DEMO_USER_ID), {
      include: [{ model: Roles, as: 'Roles' }],
    });
    if (!user || user.Status !== 'ACTIVE' || user.Roles.some(role => role.RoleName === 'ADMIN')) {
      throw new Error('Demo user must be ACTIVE and non-ADMIN');
    }
    console.log('[Local] Verified demo UserId=' + user.UserId);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
'@ | node
        if ($LASTEXITCODE -ne 0) { throw 'Invalid demo account; supply -DemoUserId for an eligible local user.' }
    }
    Write-Host "[Local] Source: $backendRoot"
    Write-Host '[Local] API: http://127.0.0.1:3001; DB: 127.0.0.1:33307/cho_do_cu'
    Write-Host '[Local] Normal server with D01 expiration job; no prepare/migrate/seed.'
    node src/server.js
    if ($LASTEXITCODE -ne 0) { throw 'Local backend stopped with an error. Check the log above.' }
} finally {
    Pop-Location
    foreach ($key in $previousEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable($key, $previousEnvironment[$key], 'Process')
    }
}

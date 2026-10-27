$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$envFile = Join-Path $projectRoot 'server/.env'
$urlLine = Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
if (-not $urlLine) { throw 'server/.env does not contain DATABASE_URL.' }

$connection = $urlLine.Substring('DATABASE_URL='.Length).Trim().Trim('"', "'")
$databaseUrl = [Uri]$connection
if ($databaseUrl.Scheme -ne 'mysql') { throw 'DATABASE_URL must point to MySQL.' }

$credentials = $databaseUrl.UserInfo.Split(':', 2)
if ($credentials.Count -ne 2) { throw 'DATABASE_URL must contain a username and password.' }
$username = [Uri]::UnescapeDataString($credentials[0])
$password = [Uri]::UnescapeDataString($credentials[1])
$database = [Uri]::UnescapeDataString($databaseUrl.AbsolutePath.TrimStart('/'))
if (-not $database) { throw 'DATABASE_URL must contain a database name.' }

$dumpTool = Join-Path $env:ProgramFiles 'MySQL/MySQL Server 8.4/bin/mysqldump.exe'
if (-not (Test-Path -LiteralPath $dumpTool)) {
  $found = Get-Command mysqldump -ErrorAction SilentlyContinue
  if (-not $found) { throw 'mysqldump was not found.' }
  $dumpTool = $found.Source
}

$backupDir = Join-Path $projectRoot '.local-backups'
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupFile = Join-Path $backupDir "mysql-$stamp.sql"
$optionsFile = Join-Path $backupDir ('.mysql-options-' + [guid]::NewGuid().ToString('N') + '.cnf')

try {
  $escapedPassword = $password.Replace('\', '\\').Replace('"', '\"')
  $lines = @(
    '[client]'
    "host=$($databaseUrl.Host)"
    "port=$(if ($databaseUrl.IsDefaultPort) { 3306 } else { $databaseUrl.Port })"
    "user=$username"
    "password=`"$escapedPassword`""
    'default-character-set=utf8mb4'
  )
  [IO.File]::WriteAllLines($optionsFile, $lines, [Text.UTF8Encoding]::new($false))

  & $dumpTool "--defaults-extra-file=$optionsFile" '--single-transaction' '--quick' '--routines' '--triggers' '--events' '--hex-blob' '--no-tablespaces' '--set-gtid-purged=OFF' '--databases' $database "--result-file=$backupFile"
  if ($LASTEXITCODE -ne 0) { throw "mysqldump failed with exit code $LASTEXITCODE. Check $backupFile before using it." }

  $file = Get-Item -LiteralPath $backupFile
  if ($file.Length -eq 0) { throw 'mysqldump created an empty backup.' }
  $hash = (Get-FileHash -LiteralPath $backupFile -Algorithm SHA256).Hash
  Write-Output "Backup: $($file.FullName)"
  Write-Output "Bytes: $($file.Length)"
  Write-Output "SHA256: $hash"
} finally {
  Remove-Item -LiteralPath $optionsFile -Force -ErrorAction SilentlyContinue
}

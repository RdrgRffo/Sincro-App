param(
  [string]$BaseUrl = "http://localhost:13001",
  [string]$Collection = "",
  [string]$Environment = "test/Sincro.local.postman_environment.json",
  [string]$JunitReport = "test/reports/newman-junit.xml"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Newman CI - Sincro ===" -ForegroundColor Cyan
Write-Host "BaseUrl: $BaseUrl" -ForegroundColor Cyan

# Si no se especifica colección, ejecuta todas
if ([string]::IsNullOrWhiteSpace($Collection)) {
  $Collections = @(
    "test/Auth.postman_collection.json",
    "test/Audit.postman_collection.json",
    "test/Schedules.postman_collection.json",
    "test/ScheduleApp.postman_collection.json",
    "test/Users.postman_collection.json",
    "test/Sincro.API.Deployment.postman_collection.json"
  )
} else {
  $Collections = @($Collection)
}

$reportDir = Split-Path -Parent $JunitReport
if (-not (Test-Path $reportDir)) {
  New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
}

$newmanVersion = $null
try {
  $newmanVersion = (& npx newman --version) 2>$null
} catch {
  Write-Host "No se pudo resolver Newman via npx." -ForegroundColor Red
  exit 1
}

if ([string]::IsNullOrWhiteSpace(($newmanVersion | Out-String))) {
  Write-Host "Newman no disponible. Instala Node/npm o habilita npx en CI." -ForegroundColor Red
  exit 1
}

Write-Host "Newman detectado: $($newmanVersion | Out-String)" -ForegroundColor Green

$globalExitCode = 0

foreach ($col in $Collections) {
  $colName = Split-Path -Leaf $col
  Write-Host "`n>>> Ejecutando colección: $colName" -ForegroundColor Yellow

  $npxArgs = @(
    "newman",
    "run", $col,
    "-e", $Environment,
    "--env-var", "baseUrl=$BaseUrl",
    "--reporters", "cli,junit",
    "--reporter-junit-export", $JunitReport,
    "--bail"
  )

  & npx @npxArgs
  $exitCode = $LASTEXITCODE

  if ($exitCode -ne 0) {
    Write-Host "Colección $colName falló con código $exitCode" -ForegroundColor Red
    $globalExitCode = $exitCode
  } else {
    Write-Host "Colección $colName OK" -ForegroundColor Green
  }
}

if ($globalExitCode -ne 0) {
  Write-Host "`nNewman CI finalizó con errores" -ForegroundColor Red
  exit $globalExitCode
}

Write-Host "`nNewman CI finalizado OK" -ForegroundColor Green
Write-Host "Reporte JUnit: $JunitReport" -ForegroundColor Green

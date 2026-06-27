#!/bin/bash
# Newman CI - Sincro
# Ejecuta las colecciones Postman contra el backend

set -euo pipefail

BASE_URL="${1:-http://localhost:13001}"
COLLECTION="${2:-}"
ENVIRONMENT="${3:-test/Sincro.local.postman_environment.json}"
JUNIT_REPORT="${4:-test/reports/newman-junit.xml}"

echo "=== Newman CI - Sincro ==="
echo "BaseUrl: $BASE_URL"

# Si no se especifica colección, ejecuta todas
if [ -z "$COLLECTION" ]; then
  COLLECTIONS=(
    "test/Auth.postman_collection.json"
    "test/Audit.postman_collection.json"
    "test/Schedules.postman_collection.json"
    "test/ScheduleApp.postman_collection.json"
    "test/Users.postman_collection.json"
    "test/Sincro.API.Deployment.postman_collection.json"
  )
else
  COLLECTIONS=("$COLLECTION")
fi

# Crear directorio de reportes
mkdir -p "$(dirname "$JUNIT_REPORT")"

# Verificar Newman
if ! command -v npx &> /dev/null; then
  echo "Error: npx no disponible. Instala Node/npm."
  exit 1
fi

NEWMAN_VERSION=$(npx newman --version 2>/dev/null || true)
if [ -z "$NEWMAN_VERSION" ]; then
  echo "Error: Newman no disponible. Instala Node/npm o habilita npx en CI."
  exit 1
fi

echo "Newman detectado: $NEWMAN_VERSION"

GLOBAL_EXIT_CODE=0

for col in "${COLLECTIONS[@]}"; do
  col_name=$(basename "$col")
  echo ""
  echo ">>> Ejecutando colección: $col_name"

  npx newman run "$col" \
    -e "$ENVIRONMENT" \
    --env-var "baseUrl=$BASE_URL" \
    --reporters cli,junit \
    --reporter-junit-export "$JUNIT_REPORT" \
    --bail || {
      echo "Colección $col_name falló con código $?"
      GLOBAL_EXIT_CODE=1
    }

  if [ $GLOBAL_EXIT_CODE -eq 0 ]; then
    echo "Colección $col_name OK"
  fi
done

if [ $GLOBAL_EXIT_CODE -ne 0 ]; then
  echo ""
  echo "Newman CI finalizó con errores"
  exit $GLOBAL_EXIT_CODE
fi

echo ""
echo "Newman CI finalizado OK"
echo "Reporte JUnit: $JUNIT_REPORT"

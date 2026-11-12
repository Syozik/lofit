#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
docker compose up -d --wait db
docker compose exec -T db pg_restore -U postgres -d lofit --no-owner --clean --if-exists < "${1:-lofit.dump}"
echo "restored into the compose database"

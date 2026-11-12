#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
docker compose exec -T db pg_dump -U postgres -Fc lofit > lofit.dump
echo "wrote lofit.dump"

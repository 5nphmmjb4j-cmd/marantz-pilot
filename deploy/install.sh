#!/usr/bin/env bash
# Instalacja jako usługa systemd (Debian/Ubuntu). Użycie: sudo AMP_HOST=192.168.1.50 ./deploy/install.sh
set -euo pipefail
[ -n "${AMP_HOST:-}" ] || { echo "Ustaw AMP_HOST, np.: sudo AMP_HOST=192.168.1.50 $0"; exit 1; }
SRC="$(cd "$(dirname "$0")/.." && pwd)"; DST=/opt/marantz-pilot
id pilot >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin pilot
mkdir -p "$DST" /var/lib/marantz-pilot
cp -r "$SRC/server.py" "$SRC/index.html" "$SRC/static" "$DST/"
chown -R pilot: /var/lib/marantz-pilot
sed "s/192.168.1.50/$AMP_HOST/" "$SRC/deploy/marantz-pilot.service" > /etc/systemd/system/marantz-pilot.service
systemctl daemon-reload && systemctl enable --now marantz-pilot
echo "Gotowe: http://$(hostname -I | awk '{print $1}'):8135/"

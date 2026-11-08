#!/bin/sh
# Builds the nginx config at container start, then runs nginx.
set -e
if [ -n "$API_UPSTREAM" ]; then
  API_PROXY_BLOCK="    location /api/ { proxy_pass $API_UPSTREAM; proxy_set_header Host \$host; proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto \$scheme; }
    location = /health { proxy_pass $API_UPSTREAM; }"
  echo "Forwarding /api and /health to $API_UPSTREAM"
else
  API_PROXY_BLOCK=""
  echo "API_UPSTREAM not set: /api is expected to be routed by the load balancer"
fi
export API_PROXY_BLOCK
envsubst '${API_PROXY_BLOCK}' < /etc/nginx/templates-custom/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'

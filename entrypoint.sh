#!/bin/sh
set -e

# Substitute the PORT environment variable into the Nginx config template
# and output it to the actual Nginx config file location.
envsubst '$PORT' < /etc/nginx/nginx.template > /etc/nginx/conf.d/default.conf

# Start Nginx
# exec nginx -g 'daemon off;' # Original
# The following is more robust for signals if needed, but -g 'daemon off;' is common for containers
nginx -g 'daemon off;'
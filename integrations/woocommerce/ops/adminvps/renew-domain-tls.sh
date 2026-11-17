#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
exec 9>/run/lock/woodbase-domain-tls.lock
flock -n 9 || exit 0
domain=woodbase-lazer.ru
secrets=/srv/woodbase/secrets
image=certbot/certbot@sha256:c5698da859429ccee0fcc299a8000368198222d1f9e789ab6e388b491e8ce06d
docker run --rm \
    -v "$secrets/letsencrypt:/etc/letsencrypt" \
    -v /srv/woodbase/acme-state:/var/lib/letsencrypt \
    -v /var/log/woodbase-staging/certbot:/var/log/letsencrypt \
    -v woodbase-adminvps-staging_acme:/var/www/acme \
    "$image" certonly --non-interactive --quiet --webroot --webroot-path /var/www/acme \
    --keep-until-expiring --cert-name "$domain" -d "$domain" \
    --agree-tos --register-unsafely-without-email
live="$secrets/letsencrypt/live/$domain"
if ! cmp -s "$live/fullchain.pem" "$secrets/domain-tls/fullchain.pem"; then
    openssl verify -untrusted "$live/chain.pem" -verify_hostname "$domain" "$live/cert.pem"
    cp "$secrets/domain-tls/fullchain.pem" "$secrets/domain-tls/fullchain.previous.pem"
    cp "$secrets/domain-tls/privkey.pem" "$secrets/domain-tls/privkey.previous.pem"
    restore() {
        cp "$secrets/domain-tls/fullchain.previous.pem" "$secrets/domain-tls/fullchain.pem"
        cp "$secrets/domain-tls/privkey.previous.pem" "$secrets/domain-tls/privkey.pem"
    }
    trap restore ERR
    install -m 0644 "$live/fullchain.pem" "$secrets/domain-tls/fullchain.pem"
    install -m 0600 "$live/privkey.pem" "$secrets/domain-tls/privkey.pem"
    docker exec woodbase-adminvps-staging-web-1 nginx -t
    docker exec woodbase-adminvps-staging-web-1 nginx -s reload
    trap - ERR
fi
printf 'Public TLS checked at %s\n' "$(date -u +%FT%TZ)"

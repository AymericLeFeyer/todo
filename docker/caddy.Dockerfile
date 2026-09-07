# Caddy officiel + module DNS Cloudflare : le défi DNS-01 permet d'obtenir un
# certificat Let's Encrypt valide sans exposer le moindre port sur Internet,
# ce qui est exactement ce qu'il faut pour un service accessible par VPN.
#
# Pour un autre registrar, remplacer le module par le vôtre :
# https://github.com/caddy-dns
FROM caddy:2-builder AS builder
RUN xcaddy build --with github.com/caddy-dns/cloudflare

FROM caddy:2
COPY --from=builder /usr/bin/caddy /usr/bin/caddy

FROM node:22-bookworm-slim AS node
FROM ghcr.io/coder/code-server:4.105.1

USER root
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN ln -sf ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -sf ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
 && apt-get update \
 && apt-get install -y --no-install-recommends python3-venv git curl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && python3 -m venv /opt/acis-venv \
 && /opt/acis-venv/bin/pip install --no-cache-dir debugpy==1.8.17 \
 && git config --system --add safe.directory /workspace \
 && mkdir -p /opt/acis/extensions /opt/acis/config /home/coder/.cache \
 && chown -R coder:coder /opt/acis-venv /opt/acis/extensions /opt/acis/config /home/coder/.cache

ENV PATH="/opt/acis-venv/bin:${PATH}" VIRTUAL_ENV=/opt/acis-venv PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
COPY --chown=coder:coder workbench /opt/acis/workbench
COPY --chown=coder:coder extension /opt/acis/extensions/acis.interview-workbench-1.0.0
WORKDIR /workspace
USER coder
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "/opt/acis/workbench/editor.mjs"]

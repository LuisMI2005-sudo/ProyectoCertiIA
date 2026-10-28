FROM node:24-bookworm-slim@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv \
    && rm -rf /var/lib/apt/lists/* \
    && python3 -m venv /opt/pytest \
    && /opt/pytest/bin/pip install --no-cache-dir pytest==8.4.2 pytest-json-report==1.5.0
RUN groupadd --gid 65532 sandbox && useradd --uid 65532 --gid 65532 --create-home sandbox
WORKDIR /opt/runner
COPY sandbox/package.json sandbox/package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund \
    && npm cache clean --force
COPY sandbox/command.mjs ./command.mjs
COPY sandbox/typescript-transform.cjs ./typescript-transform.cjs
ENV NODE_ENV=production NODE_PATH=/opt/runner/node_modules PYTHONDONTWRITEBYTECODE=1
LABEL org.devguardian.runner.schema="1"
USER 65532:65532
WORKDIR /workspace
ENTRYPOINT ["node", "/opt/runner/command.mjs"]
CMD ["idle"]

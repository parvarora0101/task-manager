FROM node:24-bookworm-slim
WORKDIR /app
RUN install -d -o node -g node -m 0750 /data
COPY --chown=node:node package.json server.js ./
COPY --chown=node:node public/ public/
COPY --chown=node:node ops/backup.js ops/backup.js
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATA_DIR=/data
USER node
EXPOSE 3000
CMD ["node", "server.js"]

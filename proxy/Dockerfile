FROM docker.m.daocloud.io/library/node:24-alpine

WORKDIR /app

ENV HOST=0.0.0.0
ENV PORT=8787

COPY server.mjs ./server.mjs

EXPOSE 8787

CMD ["node", "server.mjs"]

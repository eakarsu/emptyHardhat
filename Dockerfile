FROM node:22.22.0-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY hardhat.config.js .solhint.json ./
COPY contracts ./contracts
COPY scripts ./scripts
COPY test ./test
RUN npm run check && npm cache clean --force
USER node
ENTRYPOINT ["npm", "run"]
CMD ["check"]

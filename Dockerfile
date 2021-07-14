FROM node as deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install

FROM node as builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN npm run build

FROM node as runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "./dist/index.js"]
FROM node:15

WORKDIR /app
COPY ./dist ./dist
COPY ./static ./static
COPY ./package.json ./package.json

RUN npm install --production

CMD node ./dist/index.js
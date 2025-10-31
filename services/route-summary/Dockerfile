# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm i --only=production

COPY src ./src

ENV PORT=4010
EXPOSE 4010

CMD ["npm", "start"]

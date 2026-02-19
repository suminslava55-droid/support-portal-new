FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
RUN npm run build

FROM alpine:latest
COPY --from=builder /app/build /app/build
VOLUME /app/build
CMD ["sh", "-c", "cp -r /app/build/. /external/"]

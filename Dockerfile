FROM node:10.15.3 as builder

# copy project to docker
COPY package.json package.json
COPY yarn.lock yarn.lock

# Create production build
RUN yarn install --frozen-lockfile

COPY . .

RUN NODE_ENV=production yarn build

FROM node:10.15.3

COPY --from=builder /build /build
COPY --from=builder /node_modules /node_modules

CMD NODE_ENV=production node build/index.js

EXPOSE 3531

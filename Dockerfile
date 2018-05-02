FROM node:9-alpine

# gitn eeded npm
# FIXME: Why..?
RUN apk update && apk upgrade && apk add --no-cache git

ADD . /usr/src/app
WORKDIR /usr/src/app

# Get dependencies
RUN npm install
# Make sure it works
RUN node index.js --help

EXPOSE 3000
CMD ["node", "index.js"]

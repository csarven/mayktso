FROM node:9-alpine

# gitn eeded npm
# FIXME: Why..?
RUN apk update && apk upgrade && apk add --no-cache git

WORKDIR /usr/src/app

# Get dependencies as a separate layer
ADD package.json /usr/src/app
RUN npm install

# For developers, add the rest after npm install so 
# we don't invalidate the npm layer for any code change
ADD . /usr/src/app
# Make sure it works
RUN node index.js --help

# Document root
RUN mkdir /mayktso
# Copy Dokieli example to root
RUN cp index.html /mayktso
# Persist changes in document root
VOLUME /mayktso
WORKDIR /mayktso

EXPOSE 3000
CMD ["node", "/usr/src/app/index.js"]

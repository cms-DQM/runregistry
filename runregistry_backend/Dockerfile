FROM node:13.8.0-alpine3.11

WORKDIR /usr/src/app

ENV NODE_ENV production

COPY package.json /usr/src/app
RUN npm install && npm audit fix

COPY . .

EXPOSE 9500

# RUN npm run migrate

CMD ["npm", "run", "kubernetes"]
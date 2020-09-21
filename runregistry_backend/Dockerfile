FROM node:13.8-stretch

WORKDIR /usr/src/app

ENV NODE_ENV production

COPY package.json /usr/src/app
RUN npm install

COPY . .

EXPOSE 9500

# RUN npm run migrate

CMD ["npm", "run", "kubernetes"]
FROM node:16.20.1

COPY /nodejs_auto_close_shutdown_archive /nodejs_auto_close_shutdown_archive 

WORKDIR /nodejs_auto_close_shutdown_archive 

# RUN eval `ssh-agent`

# RUN ssh-add /git_ivasiliev

# RUN npm update

CMD ["node", "service.js" ]

# RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

# WORKDIR /home/node/app

# COPY package*.json ./

# USER node

# RUN npm install

# COPY --chown=node:node . .
 
# EXPOSE 8080

# CMD [ "node", "app.js" ]
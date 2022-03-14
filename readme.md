This repository contains all components that make up the CMS DQM Run Registry service.

## What is Run Registry?

The process of monitoring and certifying data in the CMS experiment consists of several stages. Each through which new decision-making information regarding the quality of data is revealed. Run Registry is an application designed to document and aggregate each decision made -and by which actor, either human, automatic or machine learning agent- at every stage. It is then responsible for aggregating and exposing the results of data deemed good or ‘usable for analysis’ to the CMS collaboration in what is known as the **golden** json.

## What is the _stack_?

From a technical standpoint, run registry is a full-stack javascript application. With a frontend built with React and a backend built with Node.js, it uses a PostgreSQL database instance running in **CERN DB on demand** and a redis microservice to handle the job queue for backend processing.

## What is contained in this repository?

- ### [Run Registry Frontend](https://github.com/cms-DQM/runregistry/blob/master/runregistry_frontend/readme.md)

  The frontend of run registry is written in JavaScript using React.js and Next.js. You can read more about it [here](https://github.com/cms-DQM/runregistry/blob/master/runregistry_frontend/readme.md).

- ### [Run Registry Backend](https://github.com/cms-DQM/runregistry/blob/master/runregistry_backend/readme.md)

  The backend of run registry is written in JavaScript using Node.js. You can read more about it [here](https://github.com/cms-DQM/runregistry/blob/master/runregistry_backend/readme.md).

- ### [The Python API Client](https://github.com/cms-DQM/runregistry/tree/master/runregistry_api_client)

  The API client is a Python PIP package that interfaces via HTTP requests with the API of run registry and allows users to read data easily from the application. You can read more about it [here](https://github.com/cms-DQM/runregistry/tree/master/runregistry_api_client).

- ### The Github Action definitions
  They are in charge of building and pushing the frontend and microservices into Dockerhub on every push to the master branch. They are located in the .github folder.

This repository contains all the code from Run Registry. However, it doesn't contain the commit log of how the application was developed. To view them go to the individiual repositories (which are no longer used) of every component mentioned above. To modify the application you must do so however in this repository only.

# Architecture

## Microservices

Run registry is designed using loosely-coupled microservices. This architecture allows for future maintainers to only need to know how a given microservice works either to maintain it or replace it.

Run registry encompasses 5 microservices, each with its respective Dockerfile and dockerhub repository, here is a list of them with its respective dockerhub repository:

1. The API. cmssw/runregistry-backend
2. The service in charge of fetching runs & lumsiections from the OMS API. cmssw/runregistry-workers-oms-fetching
3. The service in charge of pinging the DQM GUI API. cmssw/runregistry-workers-dqm-gui-pinging
4. The service in charge of processing the jsons. cmssw/runregistry-workers-json-processing
5. A helper redis service which serves as a transport queue between service 1 and 4.

<!-- The following will expand on every service.

1. The API.

Run Registry's API is the most complex microservice, it contains all the routes, the ORM definition models and controllers of the application. -->

## Event Sourcing

There are two ways that Run Registry uses Event Sourcing: for configuration, and for data.

- For configuration

Run registry has multiple sources of configuration, some of them can be changed on the fly via the web interface, other configurations need to be changed via a change in the database, and the least commonly modified configurations need to be changed in code in one of the config.js files. Configurations updated via web interface are all event-sourced: The dataset classifier, class classifier, component classifier, datasets accepted in GUI classifier (datasets accepted), JSON classifier, offline dataset classifier. This means that all versions are tracked in the database, when a classifier is deleted it is not really deleted forever, there is a copy of it still hanging in the database. When it is edited, the previous version is also saved.

- For data

There is a great amount of effort in making Run Registry event-sourced on a run and per-lumisection basis.
If there is a human error, for example if a user sometimes batch-updates runs and sets wrong values, there will always be a way to undo it. And there will be a track of what was done, by whom and when.

# How to update Run Registry in development and production VM?

## [Run Registry development](https://dev-cmsrunregistry.web.cern.ch/):

```
 ssh -tCY username@lxplus.cern.ch ssh  -CY username@dev-runregistry.cern.ch
 cd /srv/node && export HOME=$PWD
 export PATH=/srv/node/bin/:$PATH
 cd /srv/
 export NODE_ENV=production
 export ENV=staging
 export CLIENT_SECRET= #Ask DQM core conveners
 sudo chmod -R 777 /srv/
 forever stopall
 rm -rf node
 sudo wget https://nodejs.org/dist/v12.20.0/node-v12.20.0-linux-x64.tar.xz
 sudo tar -xf node-v12.20.0-linux-x64.tar.xz
 sudo mv node-v12.20.0-linux-x64 node
 sudo rm node-v12.20.0-linux-x64.tar.xz
 sudo chmod -R 777 /srv/
 cd node && export HOME=$PWD
 cd ..
 export PATH=/srv/node/bin/:$PATH
 npm install forever -g
 npm i yarn -g
 rm -rf runregistry
 git clone https://github.com/cms-DQM/runregistry
 cd runregistry/runregistry_frontend
 sudo chmod -R 777 /srv/
 mkdir certs
 yarn
 sudo chmod -R 777 /srv/
 yarn build
 sudo chmod -R 777 /srv/
 forever start server.js
 cd ../runregistry_backend
 ## how to generate key and certificate, check the section below
 <!--
 cp your cert usercert.pem certs/usercert.pem
 cp cp your key certs/userkey.pem 
 -->
 yarn
 forever start app.js
```

After starting the project, it's important to check logs, is everything working fine!
Logs can be found by running a command: `forever logs`

## [Run Registry production](https://cmsrunregistry.web.cern.ch/)

```
 ssh -tCY username@lxplus.cern.ch ssh  -CY username@runregistry.cern.ch
 cd /srv/node && export HOME=$PWD
 export PATH=/srv/node/bin/:$PATH
 cd /srv/
 export NODE_ENV=production
 export ENV=production
 export CLIENT_SECRET= #Ask DQM core conveners
 sudo chmod -R 777 /srv/
 forever stopall
 rm -rf node
 sudo wget https://nodejs.org/dist/v12.20.0/node-v12.20.0-linux-x64.tar.xz
 sudo tar -xf node-v12.20.0-linux-x64.tar.xz
 sudo mv node-v12.20.0-linux-x64 node
 sudo rm node-v12.20.0-linux-x64.tar.xz
 sudo chmod -R 777 /srv/
 cd node && export HOME=$PWD
 cd ..
 export PATH=/srv/node/bin/:$PATH
 npm install forever -g
 npm i yarn -g
 rm -rf runregistry
 git clone https://github.com/cms-DQM/runregistry
 cd runregistry/runregistry_frontend
 sudo chmod -R 777 /srv/
 yarn
 sudo chmod -R 777 /srv/
 yarn build
 sudo chmod -R 777 /srv/
 forever start server.js
 cd ../runregistry_backend
 yarn
 mkdir certs
 ## how to generate key and certificate, check the section below
 <!--
 cp your cert usercert.pem certs/usercert.pem
 cp cp your key certs/userkey.pem 
 -->
 forever start app.js
```
After starting the project, it's important to check logs, is everything working fine!
Logs can be found by running a command: `forever logs`

## How to generate key and certificate?
You need to have grid certificate, provoded by CERN, https://ca.cern.ch/ca/

After, execute following commands:
Geberate a private key:
```
openssl pkcs12 -in myCertificate.p12 -nokeys -out usercert.pem -nodes
```
Geberate a certificate:
```
openssl pkcs12 -in myCertificate.p12 -nocerts -out userkey.pem -nodes
```
## Are you Run Registry developer, but cannot connect to RR VMs?
The person, who has sudo rights to dev-runregistry and runregistry machines has to add you as a user:

```
sudo useraddcern username
```
To give sudo rights (optional):
```
sudo usermod -aG wheel username
```
Check, can you connect to the machine(-s):
```
ssh -tCY username@lxplus.cern.ch ssh  -CY username@dev-runregistry.cern.ch
```
```
ssh -tCY username@lxplus.cern.ch ssh  -CY username@runregistry.cern.ch
```
Check do you have sudo rights (optional):
```
sudo whoami
```

## FAQ
Check readme_faq.md  

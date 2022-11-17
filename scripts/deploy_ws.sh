
# install redis server following https://github.com/cms-DQM/runregistry/blob/master/readme_faq.md
# install postgres server with runregistry_database at default port 5432
# https://github.com/cms-DQM/dqmsquare_mirror/blob/master/Dockerfile
# sudo yum install postgresql-contrib
# sudo mkdir /home/XXX
# sudo chmod 775 /home/XXX
# sudo chown postgres /home/XXX
# sudo -i -u postgres
# initdb '/home/XXX'
# echo "local   all             all                                     trust" >> /home/XXX/pg_hba.conf
# pg_ctl -D /home/XXX -l logfile start

# set RR eviroment
# export CLIENT_SECRET= put here OMS secret, ask conviners, check secret value at RR VM
# export ENV=development

# set path to local RR code somewhere
path_to_rr_code=/home/pmandrik/work/projects/DQM/RR_WORKING_SPACE/runregistry/


if [ ! -d `pwd`/"node" ]; then
  wget https://nodejs.org/dist/v12.22.0/node-v12.22.0-linux-x64.tar.xz
  tar -xf node-v12.22.0-linux-x64.tar.xz
  mv node-v12.22.0-linux-x64 node
fi;

export HOME=`pwd`/node/:$HOME
export PATH=`pwd`/node/bin/:$PATH
export ENV=development

cp -r $path_to_rr_code/runregistry_backend .
cp -r $path_to_rr_code/runregistry_frontend .

cd runregistry_backend
yarn
mkdir certs
cp ~/CERT_TEST/userkey.pem ./certs/.
cp ~/CERT_TEST/usercert.pem ./certs/.

cd runregistry_frontend
yarn
yarn build

# Run backend as `node app.js`
# Run frontend as `node server.js`
# Check frontend at
# http://localhost:7001/online/global?
# 
# You may dump RR production DB using 
# python3 scripts/dump_db.py
# Then import to local DB usin
# python scripts/import_db.py

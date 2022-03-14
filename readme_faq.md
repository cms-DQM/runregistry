#### Connect to DB   
Like:  
psql -h dbod-gc005.cern.ch -p 6601 -U username  
using password & username obtained from DQM core   

#### Delete entry from postgresql DB  
\l  
\c runregistry_database_dev  
\dt+  
SELECT * FROM public."Run" WHERE run_number = 346511;  
DELETE FROM public."DatasetEvent" WHERE run_number = 346511;  
DELETE FROM public."DatasetTripletCache" WHERE run_number = 346511;  
DELETE FROM public."LumisectionEvent" WHERE run_number = 346511;  
DELETE FROM public."OMSLumisectionEvent" WHERE run_number = 346511;  
DELETE FROM public."Dataset" WHERE run_number = 346511;  
DELETE FROM public."Run" WHERE run_number = 346511;  
DELETE FROM public."RunEvent" WHERE run_number = 346511;  

#### Change DB password  
Follow:   
https://dbod-user-guide.web.cern.ch/getting_started/postgresql.html   

#### User authorization  
https://auth.docs.cern.ch/user-documentation/faqs/  
   
#### Add logic to GEM RR attributes    
{"and": [{"var": "gem_included"}, {"or": [{"==": [{"var": "gemp_ready"}, false]}, {"==": [{"var": "gemm_ready"}, false]}]}]}  
{"and": [{"var": "gem_included"}, {"and": [{"==": [{"var": "gemp_ready"}, true]}, {"==": [{"var": "gemm_ready"}, true]}]}]}  

#### Moving docker images to cern registry  
docker login docker.com  
docker login registry.cern.ch  

Following https://cms-http-group.docs.cern.ch/k8s_cluster/registry/   

docker pull cmssw/runregistry-workers-dqm-gui-pinging:0.1-cmsweb  
docker pull cmssw/runregistry-backend:0.2-cmsweb  
docker pull cmssw/runregistry-frontend:0.2-cmsweb  

docker tag cmssw/runregistry-workers-dqm-gui-pinging:0.1-cmsweb registry.cern.ch/cmsweb/runregistry-workers-dqm-gui-pinging:0.1-cmsweb  
docker tag cmssw/runregistry-backend:0.2-cmsweb                 registry.cern.ch/cmsweb/runregistry-backend:0.2-cmsweb   
docker tag cmssw/runregistry-frontend:0.2-cmsweb                registry.cern.ch/cmsweb/runregistry-frontend:0.2-cmsweb  

docker push registry.cern.ch/cmsweb/runregistry-workers-dqm-gui-pinging:0.1-cmsweb  
docker push registry.cern.ch/cmsweb/runregistry-backend:0.2-cmsweb  
docker push registry.cern.ch/cmsweb/runregistry-frontend:0.2-cmsweb  
  
There is also tow images we were not able to pull from docker.com:  
cmssw/runregistry-workers-oms-fetching  
cmssw/runregistry-workers-json-processing  

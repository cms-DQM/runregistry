import os
import json
import requests
import time
from cernrequests import get_sso_cookies, certs
from runregistry.utils import transform_to_rr_run_filter, transform_to_rr_dataset_filter
import urllib3

# Silence unverified HTTPS warning:
# urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
PAGE_SIZE = 50

staging_cert = ""
staging_key = ""
api_url = ""
use_cookies = True
email = "api@api"

def setup( target ):
  global api_url
  global staging_cert
  global staging_key
  global use_cookies
  if target == "local" :
    api_url = "http://localhost:9500"
    staging_cert = ""
    staging_key = ""
    use_cookies = False
  if target == "development" :
    api_url = "https://dev-cmsrunregistry.web.cern.ch/api"
    staging_cert = "certs/usercert.pem"
    staging_key = "certs/userkey.pem"
    use_cookies = True
  if target == "production" :
    api_url = "https://cmsrunregistry.web.cern.ch/api"
    staging_cert = "certs/usercert.pem"
    staging_key = "certs/userkey.pem"
    use_cookies = True

def _get_headers():
  headers = {"Content-type": "application/json"}
  if not use_cookies :
    headers["email"] = email
  return headers

setup("production")

def _get_cookies(url, **kwargs):
    if not use_cookies : return {"dummy":"yammy"}
    """
    Gets the cookies required to query RR API
    :return: the cookies required to query Run Registry API. In particular 'connect.sid' is the one we are interested in
    """
    if os.getenv("ENVIRONMENT") == "development":
        return None
    cert = kwargs.pop("cert", None)
    # If no certificate provided, cernrequests will look in default paths:

    if cert == None and os.getenv("ENVIRONMENT") == "staging":
        cert = (staging_cert, staging_key)

    cert = cert if cert else certs.default_user_certificate_paths()

    if cert == ("", ""):
        raise Exception(
            'No certificate passed, pass one in a tuple as cert=(cert,key), to authenticate your request. Or place them in your /private folder on AFS under the names of "usercert.pem" and "userkey.pem", please read authentication on README.md for more details'
        )
    ca_bundle = certs.where()
    # Skip SSL verification since this must be fixed in the cernrequest package
    cookies = get_sso_cookies(url, cert, verify=True)
    return cookies


def _get_page(url,
              page=0,
              data_type="runs",
              ignore_filter_transformation=False,
              **kwargs):
    """
    :param ignore_filter_transformation: If user knows how the filter works (by observing http requests on RR website), and wants to ignore the suggested transformation to query API, user can do it by setting ignore_filter_transformation to True
    :param filter: The filter to be transformed into RR syntax, and then sent for querying
    :return: A page in Run registry
    """
    headers = _get_headers()
    cookies = _get_cookies(url, **kwargs)
    query_filter = kwargs.pop("filter", {})
    if data_type == "runs" and not ignore_filter_transformation:
        query_filter = transform_to_rr_run_filter(run_filter=query_filter)
    elif data_type == "datasets" and not ignore_filter_transformation:
        query_filter = transform_to_rr_dataset_filter(
            dataset_filter=query_filter)
    if os.getenv("ENVIRONMENT") == "development":
        print(url)
        print(query_filter)
    payload = json.dumps({
        "page": page,
        "filter": query_filter,
        "page_size": kwargs.pop("page_size", PAGE_SIZE),
        "sortings": kwargs.pop("sortings", []),
    })
    return requests.post(url, cookies=cookies, headers=headers,
                         data=payload).json()


def get_dataset_names_of_run(run_number, **kwargs):
    """
    Gets the existing dataset names of a run_number 
    :return: Array of dataset names of the specified run_number
    """
    url = "{}/get_all_dataset_names_of_run/{}".format(api_url, run_number)
    cookies = _get_cookies(url, **kwargs)
    return requests.get(url, cookies=cookies, verify=True).json()


def get_run(run_number, **kwargs):
    """
    Gets all the info about a particular run
    :param run_number: run_number of specified run
    """
    run = get_runs(filter={"run_number": run_number}, **kwargs)
    if len(run) != 1:
        return None
    return run[0]


def get_runs(limit=40000, compress_attributes=True, **kwargs):
    """
    Gets all runs that match the filter given in 
    :param compress_attributes: Gets the attributes inside rr_attributes:* and the ones in the DatasetTripletCache (The lumisections insdie the run/dataset) and spreads them over the run object
    :param filter: the filter applied to the runs needed
    """
    url = "{}/runs_filtered_ordered".format(api_url)
    initial_response = _get_page(url=url, data_type="runs", page=0, **kwargs)
    if "err" in initial_response:
        raise ValueError(initial_response["err"])

    resource_count = initial_response["count"]
    page_count = initial_response["pages"]
    runs = initial_response["runs"]
    if resource_count > limit:
        print(
            "ALERT: The specific run registry api request returns more runs than the limit({}), consider passing a greater limit to get_runs(limit=number) to get the whole result."
            .format(limit))
    if resource_count > 10000:
        print(
            "WARNING: fetching more than 10,000 runs from run registry. you probably want to pass a filter into get_runs, or else this will take a while."
        )
    if resource_count > 20000 and "filter" not in kwargs:
        print(
            "ERROR: For run registry queries that retrieve more than 20,000 runs, you must pass a filter into get_runs, an empty filter get_runs(filter={}) works"
        )
        return None
    for page_number in range(1, page_count):
        additional_runs = _get_page(page=page_number,
                                    url=url,
                                    data_type="runs",
                                    **kwargs)
        runs.extend(additional_runs.get("runs"))
        if len(runs) >= limit:
            runs = runs[:limit]
            break

    if compress_attributes:
        compressed_runs = []
        for run in runs:
            compressed_run = {
                "oms_attributes":
                run["oms_attributes"],
                **run["rr_attributes"],
                "lumisections":
                run["DatasetTripletCache"]["triplet_summary"],
                **run,
            }
            del compressed_run["rr_attributes"]
            del compressed_run["DatasetTripletCache"]
            compressed_runs.append(compressed_run)
        return compressed_runs

    return runs


def get_dataset(run_number, dataset_name="online", **kwargs):
    """
    Gets information about the dataset specified by run_number and dataset_name
    :param run_number:  The run number of the dataset
    :param dataset_name: The name of the dataset. 'online' is the dataset of the online run. These are Run Registry specific dataset names e.g. online, /PromptReco/Collisions2018D/DQM, /Express/Collisions2018/DQM 
    """
    dataset = get_datasets(filter={
        "run_number": run_number,
        "dataset_name": dataset_name
    },
                           **kwargs)
    if len(dataset) != 1:
        return None
    return dataset[0]


def get_datasets(limit=40000, compress_attributes=True, **kwargs):
    """
    Gets all datasets that match the filter given
    :param compress_attributes: Gets the attributes inside rr_attributes:* and the ones in the DatasetTripletCache (The lumisections insdie the run/dataset) and spreads them over the run object
    """
    url = "{}/datasets_filtered_ordered".format(api_url)
    initial_response = _get_page(url=url,
                                 data_type="datasets",
                                 page=0,
                                 **kwargs)
    if "err" in initial_response:
        raise ValueError(initial_response["err"])

    resource_count = initial_response["count"]
    page_count = initial_response["pages"]
    datasets = initial_response["datasets"]
    if resource_count > limit:
        print(
            "ALERT: The specific api request returns more datasets than the limit({}), consider passing a greater limit to get_datasets(limit=number) to get the whole result."
            .format(limit))
    if resource_count > 10000:
        print(
            "WARNING: fetching more than 10,000 datasets. you probably want to pass a filter into get_datasets, or else this will take a while."
        )
    if resource_count > 20000 and "filter" not in kwargs:
        print(
            "ERROR: For queries that retrieve more than 20,000 datasets, you must pass a filter into get_datasets, an empty filter get_datasets(filter={}) works"
        )
        return None
    for page_number in range(1, page_count):
        additional_datasets = _get_page(page=page_number,
                                        url=url,
                                        data_type="datasets",
                                        **kwargs)
        datasets.extend(additional_datasets.get("datasets"))
        if len(datasets) >= limit:
            datasets = datasets[:limit]
            break

    if compress_attributes:
        compressed_datasets = []
        for dataset in datasets:
            compressed_dataset = {
                **dataset["Run"]["rr_attributes"],
                **dataset,
                "lumisections":
                dataset["DatasetTripletCache"]["triplet_summary"],
            }
            del compressed_dataset["DatasetTripletCache"]
            del compressed_dataset["Run"]
            compressed_datasets.append(compressed_dataset)
        return compressed_datasets
    return datasets


def _get_lumisection_helper(url, run_number, dataset_name="online", **kwargs):
    """
    Puts the headers, and cookies for all other lumisection methods
    """
    headers = _get_headers()
    cookies = _get_cookies(url, **kwargs)
    payload = json.dumps({
        "run_number": run_number,
        "dataset_name": dataset_name
    })
    return requests.post(url, cookies=cookies, headers=headers,
                         data=payload).json()


def get_lumisections(run_number, dataset_name="online", **kwargs):
    """
    Gets the Run Registry lumisections of the specified dataset
    """
    url = "{}/lumisections/rr_lumisections".format(api_url)
    return _get_lumisection_helper(url, run_number, dataset_name, **kwargs)


def get_oms_lumisections(run_number, dataset_name="online", **kwargs):
    """
    Gets the OMS lumisections saved in RR database
    """
    url = "{}/lumisections/oms_lumisections".format(api_url)
    return _get_lumisection_helper(url, run_number, dataset_name, **kwargs)


def get_lumisection_ranges(run_number, dataset_name="online", **kwargs):
    """
    Gets the lumisection ranges of the specified dataset
    """
    url = "{}/lumisections/rr_lumisection_ranges".format(api_url)
    return _get_lumisection_helper(url, run_number, dataset_name, **kwargs)


def get_oms_lumisection_ranges(run_number, **kwargs):
    """
    Gets the OMS lumisection ranges of the specified dataset (saved in RR database)
    """
    url = "{}/lumisections/oms_lumisection_ranges".format(api_url)
    return _get_lumisection_helper(url,
                                   run_number,
                                   dataset_name="online",
                                   **kwargs)


def get_joint_lumisection_ranges(run_number, dataset_name="online", **kwargs):
    """
    Gets the lumisection ranges of the specified dataset, breaken into RR breaks and OMS ranges
    """
    url = "{}/lumisections/joint_lumisection_ranges".format(api_url)
    return _get_lumisection_helper(url, run_number, dataset_name, **kwargs)


# DO NOT USE Using compiler (not-safe):
def generate_json(json_logic, **kwargs):
    """
    DO NOT USE, USE THE ONE BELOW (create_json)...
    It receives a json logic configuration and returns a json with lumisections which pass the filter
    """
    if isinstance(json_logic, str) == False:
        json_logic = json.dumps(json_logic)
    url = "{}/json_creation/generate".format(api_url)
    headers = _get_headers()
    cookies = _get_cookies(url, **kwargs)
    payload = json.dumps({"json_logic": json_logic})
    response = requests.post(url,
                             cookies=cookies,
                             headers=headers,
                             data=payload).json()
    return response['final_json']


# Using json portal (safe):
def create_json(json_logic, dataset_name_filter, **kwargs):
  """
  It adds a json to the queue and polls until json is either finished or an error occured
  """
  if isinstance(json_logic, str) == False:
        json_logic = json.dumps(json_logic)
  url = "{}/json_portal/generate".format(api_url)
  headers = _get_headers()
  cookies = _get_cookies(url, **kwargs)
  payload = json.dumps({"json_logic": json_logic, "dataset_name_filter": dataset_name_filter})
  response = requests.post(url,
                            cookies=cookies,
                            headers=headers,
                            data=payload).json()

  # Id of json:
  id_json = response['id']
  # Poll JSON until job is complete 
  while True:
    # polling URL:
    url = "{}/json_portal/json".format(api_url)
    cookies = _get_cookies(url, **kwargs)
    payload = json.dumps({"id_json": id_json})
    response = requests.post(url,
                      cookies=cookies,
                      headers=headers,
                      data=payload)
    if response.status_code == 200:
        return response.json()['final_json']
    else:
        if response.status_code == 202:
          # stil processing
          print('progress creating json: ', response.json()['progress'])
          time.sleep(15)
        elif response.status_code == 203:
          # stil processing
          print('json process is submited and pending, please wait...')
          time.sleep(15)
        elif response.status_code == 500:
          print('Error creating json')
          return
        else:
          print('error generating json')
          return
  

# advanced RR operations ==============================================================================
# Online Table
def move_runs(from_, to_, run = None, runs = [], **kwargs):
    """
    move run/runs from one state to another
    """
    if not run and not runs :
      print("move_runs(): no 'run' and 'runs' arguments were provided, return")
      return

    states = ["SIGNOFF", "OPEN", "COMPLETED"]
    if from_ not in states or to_ not in states :
      print("move_runs(): get states '", from_, "' , '", to_, "', while allowed states are ", states, ", return")
      return
    
    url = "%s/runs/move_run/%s/%s"  % (api_url, from_, to_)

    headers = _get_headers()
    cookies = _get_cookies(url, **kwargs)
    
    if run : 
      payload = json.dumps( { "run_number" : run } )
      return requests.post(url, cookies=cookies, headers=headers, data=payload)

    answers = []
    for run_number in runs :
      payload = json.dumps( { "run_number" : run_number } )
      answer = requests.post(url, cookies=cookies, headers=headers, data=payload).json()
      answers += [ answer ]

    return answers

def make_significant_runs(run = None, runs = [], **kwargs):
    """
    mark run/runs significant
    """
    if not run and not runs :
      print("move_runs(): no 'run' and 'runs' arguments were provided, return")
      return
    
    url = "%s/runs/mark_significant"  % (api_url)
    headers = _get_headers()

    cookies = _get_cookies(api_url, **kwargs)
    
    if run : 
      data = { "run_number" : run }
      return requests.post( url, cookies=cookies, headers=headers, json=data )

    answers = []
    for run_number in runs :
      data = { "run_number" : run }
      answer = requests.post( url, cookies=cookies, headers=headers, json=data )
      answers += [ answer ]

    return answers

def reset_RR_attributes_and_refresh_runs(run = None, runs = [], **kwargs):
    """
    reset RR attributes and refresh run/runs
    """
    if not run and not runs :
      print("move_runs(): no 'run' and 'runs' arguments were provided, return")
      return
    
    url = "%s/runs/reset_and_refresh_run"  % (api_url)
    headers = _get_headers()
    cookies = _get_cookies(url, **kwargs)
    
    if run : 
      url = "%s/runs/reset_and_refresh_run/%d"  % (api_url, run)
      return requests.post(url, cookies=cookies, headers=headers)

    answers = []
    for run_number in runs :
      url = "%s/runs/reset_and_refresh_run/%d"  % (api_url, run_number)
      answer = requests.post(url, cookies=cookies, headers=headers)
      answers += [ answer ]

    return answers
  
def edit_rr_lumisections(run, lumi_start, lumi_end, component, status, comment='', cause='', dataset_name='online', **kwargs):
    """
    WIP edit RR lumisections attributes
    """
    states = ["GOOD", "BAD", "STANDBY", "EXCLUDED", "NONSET"]
    if status not in states :
      print("move_runs(): get status '", status, "', while allowed statuses are ", states, ", return")
      return
    
    url = "%s/lumisections/edit_rr_lumisections"  % (api_url)

    headers = _get_headers()
    cookies = _get_cookies(url, **kwargs)
    payload = json.dumps( { "new_lumisection_range" : { "start" : lumi_start, "end" : lumi_end, "status" : status, "comment" : comment, "cause" : cause }, "run_number" : run, "dataset_name" : dataset_name, "component" : component } )
    return requests.post(url, cookies=cookies, headers=headers, data=payload)

# Offline table
WAITING_DQM_GUI_CONSTANT = 'waiting dqm gui'
def move_datasets(from_, to_, dataset_name, workspace = 'global', run = None, runs = [], **kwargs):
    """
    move offline dataset/datasets from one state to another
    """
    if not run and not runs :
      print("move_datasets(): no 'run' and 'runs' arguments were provided, return")
      return

    states = [ "SIGNOFF", "OPEN", "COMPLETED", WAITING_DQM_GUI_CONSTANT ]
    if from_ not in states or to_ not in states :
      print("move_datasets(): get states '", from_, "' , '", to_, "', while allowed states are ", states, ", return")
      return
    
    url = "%s/datasets/%s/move_dataset/%s/%s"  % (api_url, workspace, from_, to_)

    headers = _get_headers()
    cookies = _get_cookies(url, **kwargs)
    
    if run : 
      payload = json.dumps( { "run_number" : run , "dataset_name" : dataset_name, "workspace" : workspace } )
      return requests.post(url, cookies=cookies, headers=headers, data=payload)

    answers = []
    for run_number in runs :
      payload = json.dumps( { "run_number" : run , "dataset_name" : dataset_name, "workspace" : workspace } )
      answer  = requests.post(url, cookies=cookies, headers=headers, data=payload).json()
      answers += [ answer ]

    return answers

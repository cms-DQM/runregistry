import os
import logging
from locust import HttpUser, task, between
from utils import CernAuthToken

# Run the tests with:
# CLIENT_ID=<client id> CLIENT_SECRET=<client secret> locust --users 50 --spawn-rate 2 -H https://dev-cmsrunregistry.web.cern.ch --loglevel DEBUG

# Any access to RR goes through the OAuth2 proxy, so we will
# be needing a client id and a client secret to authenticate programmatically.
# Register a dummy application on CERN's application portal for that.
logging.info("Getting access token from CERN Auth")
token = CernAuthToken(
    client_id=os.environ.get("CLIENT_ID", ""),
    client_secret=os.environ.get("CLIENT_SECRET", ""),
).get_access_token(audience="dev-cmsrunregistry-sso-proxy")
logging.debug(f"Got token: {token}")

RR_URL = "https://dev-cmsrunregistry.web.cern.ch"


class UIUser(HttpUser):
    """
    Frontend user for accessing the main page with GET.
    This puts stress on both the frontend and the backend servers.
    """

    weight = 1
    wait_time = between(1, 5)
    host = RR_URL

    def on_start(self):
        self.client.headers = {"Authorization": f"Bearer {token}"}

    @task
    def get_homepage(self):
        self.client.get("/online/global")


class ApiUser(HttpUser):
    """
    Backend-only user to load test the backend's capacity.
    """

    weight = 3
    host = RR_URL

    def on_start(self):
        self.client.headers = {"Authorization": f"Bearer {token}"}

    @task
    def get_runs(self):
        self.client.post(
            "/api/runs_filtered_ordered",
            headers={**self.client.headers, **{"Content-Type": "application/json"}},
            json={
                "page": 0,
                "page_size": 5,
                "sortings": [],
                "filter": {
                    "and": [{"run_number": {"=": "380567"}}],
                    "rr_attributes.significant": True,
                },
            },
        )

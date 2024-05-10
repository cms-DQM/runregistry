import requests
import logging

logger = logging.getLogger(__name__)


class CernAuthToken:
    def __init__(self, client_id: str, client_secret: str):
        self.client_id = client_id
        self.client_secret = client_secret

    def get_access_token(self, audience: str) -> str:
        logger.debug(f"Getting access token for {self.client_id}")
        response = requests.post(
            "https://auth.cern.ch/auth/realms/cern/api-access/token",
            data={
                "grant_type": "client_credentials",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "audience": audience,
            },
        )
        if response.status_code != 200:
            raise Exception(
                f"Could not get token for {self.client_id}. Got {response.status_code} response."
            )
        return response.json()["access_token"]

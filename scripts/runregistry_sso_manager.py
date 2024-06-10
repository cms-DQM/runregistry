import json
import logging
import argparse
import requests
from .utils import CernAuthToken

logger = logging.getLogger(__name__)
logging.basicConfig(encoding="utf-8", level=logging.DEBUG)


class RunRegistrySSOManager:
    AUTH_API = "https://authorization-service-api.web.cern.ch/api/v1.0"
    # All the required e-groups (a.k.a roles) that we need to add to the SSO registration.
    # ids will be added in the process here.
    RR_EGROUPS = {
        "cms-dqm-runregistry-online-shifters": "",
        "cms-dqm-runregistry-admins-ctpps": "",
        "cms-dqm-runregistry-experts": "",
        "cms-dqm-runregistry-data-certification": "",
        "cms-shiftlist_shifters_dqm_p5": "",
        "cms-dqm-runregistry-admins-Castor": "",
        "cms-dqm-runregistry-admins-csc": "",
        "cms-dqm-runregistry-admins-dt": "",
        "cms-dqm-runregistry-admins-ecal": "",
        "cms-dqm-runregistry-admins-egamma": "",
        "cms-dqm-runregistry-admins-gem": "",
        "cms-dqm-runregistry-admins-hcal": "",
        "cms-dqm-runregistry-admins-hlt": "",
        "cms-dqm-runregistry-admins-jme": "",
        "cms-dqm-runregistry-admins-l1t": "",
        "cms-dqm-runregistry-admins-lum": "",
        "cms-dqm-runregistry-admins-muo": "",
        "cms-dqm-runregistry-admins-rpc": "",
        "cms-dqm-runregistry-admins-tau": "",
        "cms-dqm-runregistry-admins-tracker": "",
        "cms-dqm-runregistry-offline-tracker-shifters": "",
        "cms-dqm-oncall": "",
        "cms-dqm-runregistry-offline-btag-certifiers": "",
        "cms-dqm-runregistry-offline-csc-certifiers": "",
        "cms-dqm-runregistry-offline-castor-certifiers": "",
        "cms-dqm-runregistry-offline-dt-certifiers": "",
        "cms-dqm-runregistry-offline-ecal-certifiers": "",
        "cms-dqm-runregistry-offline-egamma-certifiers": "",
        "cms-dqm-runregistry-offline-hcal-certifiers": "",
        "cms-dqm-runregistry-offline-hlt-certifiers": "",
        "cms-dqm-runregistry-offline-l1t-certifiers": "",
        "cms-dqm-runregistry-offline-lum-certifiers": "",
        "cms-dqm-runregistry-offline-muo-certifiers": "",
        "cms-dqm-runregistry-offline-rpc-certifiers": "",
        "cms-dqm-runregistry-offline-tracker-certifiers": "",
        "cms-dqm-runregistry-offline-tau-certifiers": "",
        "cms-dqm-runregistry-offline-jme-certifiers": "",
        "cms-dqm-runregistry-offline-ctpps-certifiers": "",
        "cms-dqm-runregistry-offline-gem-certifiers": "",
    }

    def __init__(
        self, app_id: str, client_id: str, client_secret: str, token: str = ""
    ):

        self.app_id = app_id
        self.token = (
            token
            if token
            else CernAuthToken(
                client_id=client_id, client_secret=client_secret
            ).get_access_token(audience="authorization-service-api")
        )

    def __get_current_roles(self):
        """Get the currently set SSO roles for the SSO registration"""
        url = f"{self.AUTH_API}/Application/{self.app_id}/roles"
        logger.debug(f"Getting roles for app with id {self.app_id}, {url}")
        response = requests.get(
            url=url,
            headers={"accept": "*/*", "Authorization": f"Bearer {self.token}"},
        )

        if response.status_code != 200:
            raise Exception(
                f"Could not get roles for {self.app_id}. Got {response.status_code} response. {response.text}"
            )
        roles = response.json()["data"]
        roles_names = [role["name"] for role in roles]
        # Store ID
        for group in self.RR_EGROUPS.keys():
            logger.debug(f"Looking for {group.lower()} in roles")
            if group.lower() in roles_names:
                self.RR_EGROUPS[group] = roles[
                    roles_names.index(
                        group.lower(),
                    )
                ]["id"]
                logger.debug(
                    f"{group.lower()} found in roles, has id {self.RR_EGROUPS[group]}"
                )
        return roles_names

    def __create_new_role(self, role: str):
        """Create a new role, given a name"""
        logger.debug(f"Creating role {role}")
        response = requests.post(
            f"{self.AUTH_API}/Application/{self.app_id}/roles",
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
            },
            data=json.dumps(
                {
                    "name": role.lower(),
                    "displayName": role,
                    "description": role,
                    "required": False,
                    "multifactor": False,
                    "applyToAllUsers": False,
                }
            ),
        )
        if response.status_code != 200:
            raise Exception(
                f"Could not create role {role}. Got {response.status_code} response. {response.text}"
            )
        return response.json()["data"]

    def __is_role_in_group(self, role: str):
        response = requests.get(
            f"{self.AUTH_API}/Application/{self.app_id}/roles/{role}/groups",
            headers={
                "accept": "*/*",
                "Authorization": f"Bearer {self.token}",
            },
        )
        if response.status_code != 200:
            raise Exception(
                f"Could not create role {role}. Got {response.status_code} response. {response.text}"
            )
        logger.debug(f"Looking for {role} in {response.json()['data']}")
        for group in response.json()["data"]:
            if role == group["groupIdentifier"]:
                return True
        return False

    def __add_group_to_role(self, role_id: str, group_name: str):
        """Given a role_id (not role name), add the group name to it."""
        response = requests.post(
            f"{self.AUTH_API}/Application/{self.app_id}/roles/{role_id}/groups/{group_name}",
            headers={
                "accept": "*/*",
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
            },
        )
        if response.status_code != 200:
            raise Exception(
                f"Could not add group {group_name} to role {role_id}. Got {response.status_code} response. {response.text}"
            )
        return response.json()

    def create_all_roles(self):
        sso_roles = self.__get_current_roles()

        # Roles missing from the Application Registration
        missing_roles = (
            role for role in self.RR_EGROUPS.keys() if role.lower() not in sso_roles
        )
        for role in missing_roles:
            new_role = self.__create_new_role(role=role)
            self.RR_EGROUPS[role] = new_role["id"]

        for role, id in self.RR_EGROUPS.items():
            if not id:
                pass
            if not self.__is_role_in_group(role=role):
                self.__add_group_to_role(group_name=role, role_id=id)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        prog="Run Registry SSO manager",
        description="Script which adds the required roles to the Application Portal Run Registry registration",
    )
    parser.add_argument(
        "-t",
        "--token",
        action="store",
        required=False,
        help=(
            "A bearer token with sufficient privileges to manage the target application's SSO registration. If present, it will "
            "skip using client_id and client_secret to get a token."
        ),
    )
    parser.add_argument(
        "-c",
        "--client-id",
        action="store",
        required=True,
        help="The client secret of an SSO application authorized to manage the target application's SSO registration",
    )
    parser.add_argument(
        "-s",
        "--client-secret",
        action="store",
        help="The client id of an SSO application authorized to manage the target application's SSO registration",
        required=True,
    )
    parser.add_argument(
        "-i",
        "--application-id",
        action="store",
        required=True,
        help="The id of the Run Registry SSO registration in Application Portal",
    )
    args = parser.parse_args()
    app_id = args.application_id
    client_id = args.client_id
    client_secret = args.client_secret
    token = args.token
    rr_sso_manager = RunRegistrySSOManager(
        app_id=app_id, client_id=client_id, client_secret=client_secret, token=token
    )
    rr_sso_manager.create_all_roles()
